/*
 * Download Hub: GitHub owner/repo -> pick release -> install asset.
 * API calls run on the daemon (curl). Release lists are cached under
 * /data/pldmgr/github_cache/ for about an hour.
 */

#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <time.h>
#include <unistd.h>

#include "github_hub.h"
#include "json_helpers.h"
#include "payload_mgr.h"
#include "pldmgr.h"
#include "config.h"
#include "repository.h"

#define GH_REPOS_PATH "/data/pldmgr/github_repos.json"
#define GH_CACHE_DIR "/data/pldmgr/github_cache"
#define GH_CACHE_TTL_SEC 3600
#define GH_MAX_REPOS 40
#define GH_MAX_RELEASES 20
#define GH_MAX_ASSETS 24
#define GH_BODY_MAX 400

typedef struct {
  char name[256];
  char url[1024];
  long long size;
} GhAsset;

typedef struct {
  char tag[96];
  char name[256];
  char published_at[64];
  char body[GH_BODY_MAX];
  GhAsset assets[GH_MAX_ASSETS];
  int asset_count;
} GhRelease;

static const char *DEFAULT_REPOS[] = {
    "ItsBlurf/BFpilot",
    "itsPLK/ps5-payload-manager",
    "EchoStretch/kstuff-lite",
    "drakmor/ShadowMountPlus",
    "juma-sayeh/PS5-Game-Compressor",
    "seregonwar/zftpd",
    "ps5-payload-dev/elfldr",
    "ps5-payload-dev/websrv",
};
#define DEFAULT_REPOS_COUNT (sizeof(DEFAULT_REPOS) / sizeof(DEFAULT_REPOS[0]))

/* ── small helpers ─────────────────────────────────────────── */

static int is_payload_asset_name(const char *name) {
  const char *ext;
  if (!name || !name[0] || name[0] == '.')
    return 0;
  ext = strrchr(name, '.');
  if (!ext)
    return 0;
  return strcasecmp(ext, ".elf") == 0 || strcasecmp(ext, ".bin") == 0 ||
         strcasecmp(ext, ".js") == 0;
}

static int valid_slug(const char *slug) {
  const char *slash;
  size_t i;
  if (!slug || !slug[0])
    return 0;
  if (strlen(slug) >= 128)
    return 0;
  slash = strchr(slug, '/');
  if (!slash || slash == slug || slash[1] == '\0')
    return 0;
  if (strchr(slash + 1, '/'))
    return 0;
  for (i = 0; slug[i]; i++) {
    char c = slug[i];
    if (!(isalnum((unsigned char)c) || c == '-' || c == '_' || c == '.' ||
          c == '/'))
      return 0;
  }
  return 1;
}

/* Normalize "https://github.com/a/b" or "a/b.git" → "a/b" */
static int normalize_slug(const char *in, char *out, size_t out_size) {
  char tmp[256];
  const char *p = in;
  size_t n;

  if (!in || !out || out_size < 4)
    return -1;

  while (*p == ' ' || *p == '\t')
    p++;

  if (!strncmp(p, "https://", 8))
    p += 8;
  else if (!strncmp(p, "http://", 7))
    p += 7;

  if (!strncmp(p, "github.com/", 11))
    p += 11;
  else if (!strncmp(p, "www.github.com/", 15))
    p += 15;

  n = 0;
  while (*p && *p != '?' && *p != '#' && n + 1 < sizeof(tmp)) {
    if (*p == ' ' || *p == '\t' || *p == '\r' || *p == '\n')
      break;
    tmp[n++] = *p++;
  }
  tmp[n] = '\0';

  /* strip trailing .git or / */
  while (n > 0 && (tmp[n - 1] == '/' || tmp[n - 1] == ' '))
    tmp[--n] = '\0';
  if (n > 4 && strcasecmp(tmp + n - 4, ".git") == 0) {
    tmp[n - 4] = '\0';
    n -= 4;
  }

  if (!valid_slug(tmp))
    return -1;
  snprintf(out, out_size, "%s", tmp);
  return 0;
}

static void cache_path_for_repo(const char *repo, char *out, size_t out_size) {
  char safe[160];
  size_t i, j = 0;
  for (i = 0; repo[i] && j + 1 < sizeof(safe); i++) {
    char c = repo[i];
    safe[j++] = (c == '/') ? '_' : c;
  }
  safe[j] = '\0';
  snprintf(out, out_size, "%s/%s.json", GH_CACHE_DIR, safe);
}

/* ── repo list persistence ─────────────────────────────────── */

static int load_repos(char repos[][128], int *count) {
  char *json = NULL;
  size_t size = 0;
  const char *p;
  int n = 0;

  *count = 0;
  if (read_file_text(GH_REPOS_PATH, &json, &size) != 0 || !json) {
    for (size_t i = 0; i < DEFAULT_REPOS_COUNT && n < GH_MAX_REPOS; i++) {
      snprintf(repos[n], 128, "%s", DEFAULT_REPOS[i]);
      n++;
    }
    *count = n;
    return 0;
  }

  p = json;
  while (n < GH_MAX_REPOS && (p = strchr(p, '"')) != NULL) {
    const char *start = p + 1;
    const char *end = strchr(start, '"');
    char slug[128];
    size_t len;
    if (!end)
      break;
    /* skip the key "repos" */
    len = (size_t)(end - start);
    if (len > 0 && len < sizeof(slug) && strncmp(start, "repos", 5) != 0) {
      memcpy(slug, start, len);
      slug[len] = '\0';
      if (valid_slug(slug)) {
        int dup = 0;
        for (int i = 0; i < n; i++) {
          if (!strcasecmp(repos[i], slug)) {
            dup = 1;
            break;
          }
        }
        if (!dup) {
          snprintf(repos[n], 128, "%s", slug);
          n++;
        }
      }
    }
    p = end + 1;
  }
  free(json);

  if (n == 0) {
    for (size_t i = 0; i < DEFAULT_REPOS_COUNT && n < GH_MAX_REPOS; i++) {
      snprintf(repos[n], 128, "%s", DEFAULT_REPOS[i]);
      n++;
    }
  }
  *count = n;
  return 0;
}

static int save_repos(char repos[][128], int count) {
  char buf[8192];
  JsonListBuilder jb = {buf, sizeof(buf), 0, 1};
  ensure_dir_recursive(BASE_DATA_DIR);
  json_append(&jb, "{\"repos\":[");
  for (int i = 0; i < count; i++) {
    char e[256];
    pldmgr_json_escape(repos[i], e, sizeof(e));
    json_append(&jb, "%s\"%s\"", i ? "," : "", e);
  }
  json_append(&jb, "]}");
  return write_file_text(GH_REPOS_PATH, buf, jb.pos);
}

int github_repos_list_json(char *buf, size_t size) {
  char repos[GH_MAX_REPOS][128];
  int count = 0;
  JsonListBuilder jb = {buf, size, 0, 1};
  load_repos(repos, &count);
  buf[0] = '\0';
  json_append(&jb, "{\"repos\":[");
  for (int i = 0; i < count; i++) {
    char e[256];
    pldmgr_json_escape(repos[i], e, sizeof(e));
    json_append(&jb, "%s\"%s\"", i ? "," : "", e);
  }
  json_append(&jb, "]}");
  return 0;
}

int github_repos_add(const char *slug_or_url, char *msg, size_t msg_size) {
  char slug[128];
  char repos[GH_MAX_REPOS][128];
  int count = 0;

  if (normalize_slug(slug_or_url, slug, sizeof(slug)) != 0) {
    snprintf(msg, msg_size, "Use owner/repo (e.g. ItsBlurf/BFpilot)");
    return -1;
  }
  load_repos(repos, &count);
  for (int i = 0; i < count; i++) {
    if (!strcasecmp(repos[i], slug)) {
      snprintf(msg, msg_size, "Already added");
      return -1;
    }
  }
  if (count >= GH_MAX_REPOS) {
    snprintf(msg, msg_size, "Repo list full (%d)", GH_MAX_REPOS);
    return -1;
  }
  snprintf(repos[count], 128, "%s", slug);
  count++;
  if (save_repos(repos, count) != 0) {
    snprintf(msg, msg_size, "Failed to save");
    return -1;
  }
  snprintf(msg, msg_size, "%s", slug);
  return 0;
}

int github_repos_remove(const char *slug, char *msg, size_t msg_size) {
  char repos[GH_MAX_REPOS][128];
  int count = 0;
  int found = -1;
  char norm[128];

  if (normalize_slug(slug, norm, sizeof(norm)) != 0) {
    snprintf(msg, msg_size, "Invalid repo");
    return -1;
  }
  load_repos(repos, &count);
  for (int i = 0; i < count; i++) {
    if (!strcasecmp(repos[i], norm)) {
      found = i;
      break;
    }
  }
  if (found < 0) {
    snprintf(msg, msg_size, "Not found");
    return -1;
  }
  for (int i = found; i < count - 1; i++)
    memcpy(repos[i], repos[i + 1], 128);
  count--;
  if (save_repos(repos, count) != 0) {
    snprintf(msg, msg_size, "Failed to save");
    return -1;
  }
  snprintf(msg, msg_size, "OK");
  return 0;
}

int github_repos_set(const char *json, size_t len) {
  char repos[GH_MAX_REPOS][128];
  int count = 0;
  const char *p;
  (void)len;
  if (!json)
    return -1;
  p = json;
  while (count < GH_MAX_REPOS && (p = strchr(p, '"')) != NULL) {
    const char *start = p + 1;
    const char *end = strchr(start, '"');
    char slug[128];
    size_t l;
    if (!end)
      break;
    l = (size_t)(end - start);
    if (l > 0 && l < sizeof(slug) && strncmp(start, "repos", 5) != 0) {
      memcpy(slug, start, l);
      slug[l] = '\0';
      if (valid_slug(slug)) {
        int dup = 0;
        for (int i = 0; i < count; i++) {
          if (!strcasecmp(repos[i], slug)) {
            dup = 1;
            break;
          }
        }
        if (!dup)
          snprintf(repos[count++], 128, "%s", slug);
      }
    }
    p = end + 1;
  }
  return save_repos(repos, count);
}

/* ── GitHub releases parse (nested JSON with brace depth) ─── */

static const char *find_key(const char *s, const char *end, const char *key) {
  size_t klen = strlen(key);
  const char *p = s;
  while (p + klen + 3 < end) {
    if (*p == '"' && strncmp(p + 1, key, klen) == 0 && p[1 + klen] == '"') {
      const char *q = p + 2 + klen;
      while (q < end && (*q == ' ' || *q == '\t' || *q == '\n' || *q == '\r'))
        q++;
      if (q < end && *q == ':')
        return q + 1;
    }
    p++;
  }
  return NULL;
}

static int extract_string_value(const char *after_colon, const char *end,
                                char *out, size_t out_size) {
  const char *p = after_colon;
  size_t n = 0;
  while (p < end && (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r'))
    p++;
  if (p >= end || *p != '"')
    return -1;
  p++;
  while (p < end && *p != '"' && n + 1 < out_size) {
    if (*p == '\\' && p + 1 < end) {
      p++;
      if (*p == 'n')
        out[n++] = '\n';
      else if (*p == 't')
        out[n++] = '\t';
      else if (*p == 'r')
        out[n++] = '\r';
      else if (*p == '"' || *p == '\\' || *p == '/')
        out[n++] = *p;
      else if (*p == 'u' && p + 4 < end) {
        /* skip unicode escapes */
        p += 4;
      } else
        out[n++] = *p;
      p++;
      continue;
    }
    out[n++] = *p++;
  }
  out[n] = '\0';
  return 0;
}

static long long extract_number_value(const char *after_colon, const char *end) {
  const char *p = after_colon;
  long long v = 0;
  int any = 0;
  while (p < end && (*p == ' ' || *p == '\t'))
    p++;
  while (p < end && *p >= '0' && *p <= '9') {
    v = v * 10 + (*p - '0');
    p++;
    any = 1;
  }
  return any ? v : 0;
}

static const char *object_end(const char *start, const char *limit) {
  int depth = 0;
  int in_str = 0;
  int esc = 0;
  const char *p = start;
  if (*p != '{')
    return NULL;
  for (; p < limit; p++) {
    char c = *p;
    if (in_str) {
      if (esc)
        esc = 0;
      else if (c == '\\')
        esc = 1;
      else if (c == '"')
        in_str = 0;
      continue;
    }
    if (c == '"')
      in_str = 1;
    else if (c == '{')
      depth++;
    else if (c == '}') {
      depth--;
      if (depth == 0)
        return p + 1;
    }
  }
  return NULL;
}

static int parse_asset_obj(const char *obj, const char *end, GhAsset *a) {
  const char *k;
  memset(a, 0, sizeof(*a));
  k = find_key(obj, end, "name");
  if (!k || extract_string_value(k, end, a->name, sizeof(a->name)) != 0)
    return -1;
  k = find_key(obj, end, "browser_download_url");
  if (!k || extract_string_value(k, end, a->url, sizeof(a->url)) != 0)
    return -1;
  k = find_key(obj, end, "size");
  if (k)
    a->size = extract_number_value(k, end);
  return is_payload_asset_name(a->name) ? 0 : -1;
}

static int parse_release_obj(const char *obj, const char *end, GhRelease *r) {
  const char *k;
  const char *assets_key;
  const char *arr;
  const char *p;
  memset(r, 0, sizeof(*r));

  k = find_key(obj, end, "tag_name");
  if (!k || extract_string_value(k, end, r->tag, sizeof(r->tag)) != 0)
    return -1;
  k = find_key(obj, end, "name");
  if (k)
    extract_string_value(k, end, r->name, sizeof(r->name));
  if (!r->name[0])
    snprintf(r->name, sizeof(r->name), "%s", r->tag);
  k = find_key(obj, end, "published_at");
  if (k)
    extract_string_value(k, end, r->published_at, sizeof(r->published_at));
  k = find_key(obj, end, "body");
  if (k)
    extract_string_value(k, end, r->body, sizeof(r->body));

  assets_key = find_key(obj, end, "assets");
  if (!assets_key)
    return 0;
  arr = assets_key;
  while (arr < end && *arr != '[')
    arr++;
  if (arr >= end || *arr != '[')
    return 0;
  p = arr + 1;
  while (p < end && r->asset_count < GH_MAX_ASSETS) {
    while (p < end && (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' ||
                       *p == ','))
      p++;
    if (p >= end || *p == ']')
      break;
    if (*p == '{') {
      const char *oe = object_end(p, end);
      GhAsset a;
      if (!oe)
        break;
      if (parse_asset_obj(p, oe, &a) == 0)
        r->assets[r->asset_count++] = a;
      p = oe;
    } else {
      p++;
    }
  }
  return 0;
}

static int parse_releases_array(const char *json, size_t len, GhRelease *out,
                                int *out_count) {
  const char *p = json;
  const char *end = json + len;
  int n = 0;

  /* top-level is an array of release objects */
  while (p < end && (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r'))
    p++;
  if (p >= end || *p != '[')
    return -1;
  p++;

  while (p < end && n < GH_MAX_RELEASES) {
    while (p < end &&
           (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ','))
      p++;
    if (p >= end || *p == ']')
      break;
    if (*p == '{') {
      const char *oe = object_end(p, end);
      if (!oe)
        break;
      if (parse_release_obj(p, oe, &out[n]) == 0) {
        /* keep releases even with zero filtered assets (shows empty state) */
        n++;
      }
      p = oe;
    } else {
      p++;
    }
  }
  *out_count = n;
  return n > 0 ? 0 : -1;
}

static size_t build_releases_response(const char *repo, GhRelease *rels, int n,
                                      int cached, long fetched_at, char *buf,
                                      size_t size) {
  JsonListBuilder jb = {buf, size, 0, 1};
  char re[256];
  pldmgr_json_escape(repo, re, sizeof(re));
  json_append(&jb,
              "{\"ok\":true,\"repo\":\"%s\",\"cached\":%s,\"fetched_at\":%ld,"
              "\"releases\":[",
              re, cached ? "true" : "false", fetched_at);
  for (int i = 0; i < n; i++) {
    char te[192], ne[512], pe[128], be[GH_BODY_MAX * 2];
    pldmgr_json_escape(rels[i].tag, te, sizeof(te));
    pldmgr_json_escape(rels[i].name, ne, sizeof(ne));
    pldmgr_json_escape(rels[i].published_at, pe, sizeof(pe));
    pldmgr_json_escape(rels[i].body, be, sizeof(be));
    json_append(&jb,
                "%s{\"tag\":\"%s\",\"name\":\"%s\",\"published_at\":\"%s\","
                "\"body\":\"%s\",\"assets\":[",
                i ? "," : "", te, ne, pe, be);
    for (int a = 0; a < rels[i].asset_count; a++) {
      char an[512], au[1400];
      pldmgr_json_escape(rels[i].assets[a].name, an, sizeof(an));
      pldmgr_json_escape(rels[i].assets[a].url, au, sizeof(au));
      json_append(&jb, "%s{\"name\":\"%s\",\"size\":%lld,\"url\":\"%s\"}",
                  a ? "," : "", an, (long long)rels[i].assets[a].size, au);
    }
    json_append(&jb, "]}");
  }
  json_append(&jb, "]}");
  return jb.pos;
}

static int load_cached_releases(const char *repo, GhRelease *out, int *count,
                                long *fetched_at) {
  char path[512];
  char *json = NULL;
  size_t size = 0;
  const char *k;
  char repo_check[128];

  cache_path_for_repo(repo, path, sizeof(path));
  if (read_file_text(path, &json, &size) != 0 || !json)
    return -1;

  *fetched_at = 0;
  k = find_key(json, json + size, "fetched_at");
  if (k)
    *fetched_at = (long)extract_number_value(k, json + size);

  repo_check[0] = '\0';
  k = find_key(json, json + size, "repo");
  if (k)
    extract_string_value(k, json + size, repo_check, sizeof(repo_check));

  /* Find releases array inside our cache format */
  {
    const char *rel_key = find_key(json, json + size, "releases");
    const char *arr;
    const char *p;
    int n = 0;
    if (!rel_key) {
      free(json);
      return -1;
    }
    arr = rel_key;
    while (arr < json + size && *arr != '[')
      arr++;
    if (arr >= json + size) {
      free(json);
      return -1;
    }
    p = arr + 1;
    while (p < json + size && n < GH_MAX_RELEASES) {
      while (p < json + size &&
             (*p == ' ' || *p == '\t' || *p == '\n' || *p == '\r' || *p == ','))
        p++;
      if (p >= json + size || *p == ']')
        break;
      if (*p == '{') {
        const char *oe = object_end(p, json + size);
        GhRelease r;
        if (!oe)
          break;
        memset(&r, 0, sizeof(r));
        k = find_key(p, oe, "tag");
        if (k)
          extract_string_value(k, oe, r.tag, sizeof(r.tag));
        k = find_key(p, oe, "name");
        if (k)
          extract_string_value(k, oe, r.name, sizeof(r.name));
        k = find_key(p, oe, "published_at");
        if (k)
          extract_string_value(k, oe, r.published_at, sizeof(r.published_at));
        k = find_key(p, oe, "body");
        if (k)
          extract_string_value(k, oe, r.body, sizeof(r.body));
        /* assets */
        {
          const char *ak = find_key(p, oe, "assets");
          if (ak) {
            const char *ap = ak;
            while (ap < oe && *ap != '[')
              ap++;
            if (ap < oe && *ap == '[') {
              ap++;
              while (ap < oe && r.asset_count < GH_MAX_ASSETS) {
                while (ap < oe && (*ap == ' ' || *ap == '\t' || *ap == '\n' ||
                                   *ap == '\r' || *ap == ','))
                  ap++;
                if (ap >= oe || *ap == ']')
                  break;
                if (*ap == '{') {
                  const char *ae = object_end(ap, oe);
                  GhAsset a;
                  if (!ae)
                    break;
                  memset(&a, 0, sizeof(a));
                  k = find_key(ap, ae, "name");
                  if (k)
                    extract_string_value(k, ae, a.name, sizeof(a.name));
                  k = find_key(ap, ae, "url");
                  if (k)
                    extract_string_value(k, ae, a.url, sizeof(a.url));
                  k = find_key(ap, ae, "size");
                  if (k)
                    a.size = extract_number_value(k, ae);
                  if (a.name[0] && a.url[0])
                    r.assets[r.asset_count++] = a;
                  ap = ae;
                } else
                  ap++;
              }
            }
          }
        }
        if (r.tag[0])
          out[n++] = r;
        p = oe;
      } else
        p++;
    }
    free(json);
    *count = n;
    return n > 0 ? 0 : -1;
  }
}

static int fetch_and_cache(const char *repo, GhRelease *out, int *count,
                           long *fetched_at) {
  char api_url[256];
  char tmp_path[512];
  char cache_path[512];
  char *raw = NULL;
  size_t raw_size = 0;
  char *resp_buf;
  size_t resp_len;
  long now = (long)time(NULL);
  const size_t resp_cap = 512 * 1024;

  ensure_dir_recursive(BASE_DATA_DIR);
  ensure_dir_recursive(GH_CACHE_DIR);

  snprintf(api_url, sizeof(api_url),
           "https://api.github.com/repos/%s/releases?per_page=%d", repo,
           GH_MAX_RELEASES);
  snprintf(tmp_path, sizeof(tmp_path), "%s/releases_raw.tmp", GH_CACHE_DIR);

  pldmgr_log("[GH] Fetching releases for %s\n", repo);
  if (download_to_file_ex(api_url, tmp_path, 1) != 0) {
    pldmgr_log("[GH] Failed to download releases for %s\n", repo);
    return -1;
  }
  if (read_file_text(tmp_path, &raw, &raw_size) != 0 || !raw) {
    remove(tmp_path);
    return -1;
  }
  remove(tmp_path);

  if (parse_releases_array(raw, raw_size, out, count) != 0) {
    free(raw);
    pldmgr_log("[GH] Parse failed for %s\n", repo);
    return -1;
  }
  free(raw);

  *fetched_at = now;
  resp_buf = malloc(resp_cap);
  if (!resp_buf)
    return -1;
  resp_len = build_releases_response(repo, out, *count, 0, now, resp_buf, resp_cap);
  cache_path_for_repo(repo, cache_path, sizeof(cache_path));
  write_file_text(cache_path, resp_buf, resp_len);
  free(resp_buf);
  return 0;
}

size_t github_releases_json(const char *repo_in, int force_refresh, char *buf,
                            size_t size) {
  char repo[128];
  GhRelease *rels;
  int count = 0;
  long fetched_at = 0;
  long now = (long)time(NULL);
  int cached = 0;

  if (!buf || size < 64)
    return 0;
  if (normalize_slug(repo_in, repo, sizeof(repo)) != 0) {
    snprintf(buf, size, "{\"ok\":false,\"message\":\"Invalid repo\"}");
    return strlen(buf);
  }

  rels = calloc(GH_MAX_RELEASES, sizeof(GhRelease));
  if (!rels) {
    snprintf(buf, size, "{\"ok\":false,\"message\":\"Out of memory\"}");
    return strlen(buf);
  }

  if (!force_refresh &&
      load_cached_releases(repo, rels, &count, &fetched_at) == 0) {
    if (fetched_at > 0 && (now - fetched_at) < GH_CACHE_TTL_SEC) {
      cached = 1;
    } else {
      /* stale — try refresh, keep cache on failure */
      GhRelease *fresh = calloc(GH_MAX_RELEASES, sizeof(GhRelease));
      int fcount = 0;
      long fts = 0;
      if (fresh && fetch_and_cache(repo, fresh, &fcount, &fts) == 0) {
        free(rels);
        rels = fresh;
        count = fcount;
        fetched_at = fts;
        cached = 0;
      } else {
        free(fresh);
        cached = 1; /* serve stale */
        pldmgr_log("[GH] Using stale cache for %s\n", repo);
      }
    }
  } else {
    if (fetch_and_cache(repo, rels, &count, &fetched_at) != 0) {
      free(rels);
      snprintf(buf, size,
               "{\"ok\":false,\"message\":\"Failed to fetch releases for %s. "
               "Check network or set GITHUB_TOKEN in pldmgr_config.txt\"}",
               repo);
      return strlen(buf);
    }
  }

  {
    size_t n =
        build_releases_response(repo, rels, count, cached, fetched_at, buf, size);
    free(rels);
    return n;
  }
}

int github_install_asset(const char *repo_in, const char *tag, const char *asset,
                         char *msg, size_t msg_size) {
  char repo[128];
  GhRelease *rels;
  int count = 0;
  long fetched_at = 0;
  int ri, ai;
  char tmp_path[640];
  char detail[256];
  int found = 0;
  char url[1024];

  if (normalize_slug(repo_in, repo, sizeof(repo)) != 0) {
    snprintf(msg, msg_size, "Invalid repo");
    return -1;
  }
  if (!tag || !tag[0] || !asset || !asset[0] || strstr(asset, "/") ||
      strstr(asset, "..") || !is_payload_asset_name(asset)) {
    snprintf(msg, msg_size, "Invalid tag or asset");
    return -1;
  }

  rels = calloc(GH_MAX_RELEASES, sizeof(GhRelease));
  if (!rels) {
    snprintf(msg, msg_size, "Out of memory");
    return -1;
  }

  if (load_cached_releases(repo, rels, &count, &fetched_at) != 0) {
    if (fetch_and_cache(repo, rels, &count, &fetched_at) != 0) {
      free(rels);
      snprintf(msg, msg_size, "Release data unavailable");
      return -1;
    }
  }

  url[0] = '\0';
  for (ri = 0; ri < count; ri++) {
    if (strcmp(rels[ri].tag, tag) != 0)
      continue;
    for (ai = 0; ai < rels[ri].asset_count; ai++) {
      if (strcmp(rels[ri].assets[ai].name, asset) == 0) {
        snprintf(url, sizeof(url), "%s", rels[ri].assets[ai].url);
        found = 1;
        break;
      }
    }
    break;
  }
  free(rels);

  if (!found || !url[0]) {
    snprintf(msg, msg_size, "Asset not found in release");
    return -1;
  }

  ensure_dir_recursive(PAYLOADS_STORAGE_DIR);
  snprintf(tmp_path, sizeof(tmp_path), "%s/%s.part", PAYLOADS_STORAGE_DIR, asset);

  pldmgr_log("[GH] Downloading %s @ %s / %s\n", repo, tag, asset);
  if (download_to_file_ex(url, tmp_path, 0) != 0) {
    snprintf(msg, msg_size, "Download failed");
    remove(tmp_path);
    return -1;
  }

  snprintf(detail, sizeof(detail), "%s@%s", repo, tag);
  if (payload_mgr_import_to_storage(asset, tmp_path, "github", detail, msg,
                                    msg_size) != 0) {
    remove(tmp_path);
    return -1;
  }

  /* Enrich sidecar with version = tag if import wrote a simple one */
  {
    char folder[128];
    char details[700];
    pldmgr_utils_get_payload_folder_name(asset, folder, sizeof(folder));
    snprintf(details, sizeof(details), "%s/%s/%s.json", PAYLOADS_STORAGE_DIR,
             folder, asset);
    /* rewrite richer metadata */
    {
      char name_e[384], ver_e[192], url_e[1400], src_e[384], det_e[512];
      char json[2048];
      time_t now = time(NULL);
      struct tm tmv;
      char downloaded[64];
      memset(&tmv, 0, sizeof(tmv));
      localtime_r(&now, &tmv);
      strftime(downloaded, sizeof(downloaded), "%Y-%m-%dT%H:%M:%S%z", &tmv);
      pldmgr_json_escape(asset, name_e, sizeof(name_e));
      pldmgr_json_escape(tag, ver_e, sizeof(ver_e));
      pldmgr_json_escape(url, url_e, sizeof(url_e));
      pldmgr_json_escape(repo, src_e, sizeof(src_e));
      pldmgr_json_escape(detail, det_e, sizeof(det_e));
      snprintf(json, sizeof(json),
               "{\"name\":\"%s\",\"filename\":\"%s\",\"version\":\"%s\","
               "\"url\":\"%s\",\"source\":\"github\",\"source_name\":\"%s\","
               "\"install_source\":\"github\",\"install_source_detail\":\"%s\","
               "\"downloaded_at\":\"%s\"}",
               name_e, name_e, ver_e, url_e, src_e, det_e, downloaded);
      write_file_text(details, json, strlen(json));
    }
  }

  pldmgr_log("[GH] Installed %s from %s@%s\n", asset, repo, tag);
  snprintf(msg, msg_size, "Installed %s", asset);
  return 0;
}

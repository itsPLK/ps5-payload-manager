#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <ctype.h>
#include <time.h>
#include <dirent.h>
#include <unistd.h>
#include <sys/stat.h>
#include <curl/curl.h>

#include "repository.h"
#include "sha256.h"
#include "json_helpers.h"
#include "config.h"
#include "pldmgr.h"
#include "payload_mgr.h"
#include "assets_cacert_pem.h"

/* ── cURL download helper ──────────────────────────────────── */

static size_t write_data(void *ptr, size_t size, size_t nmemb, FILE *stream) {
    return fwrite(ptr, size, nmemb, stream);
}

static void read_github_token(char *out, size_t out_size) {
    FILE *f;
    char line[512];
    out[0] = '\0';
    f = fopen(PLDMGR_CONFIG_PATH, "r");
    if (!f)
        return;
    while (fgets(line, sizeof(line), f)) {
        if (!strncmp(line, "GITHUB_TOKEN=", 13)) {
            char *v = line + 13;
            size_t len = strcspn(v, "\r\n");
            if (len >= out_size)
                len = out_size - 1;
            memcpy(out, v, len);
            out[len] = '\0';
            break;
        }
    }
    fclose(f);
}

int download_to_file_ex(const char *url, const char *out_path, int github_api) {
    CURL *curl;
    FILE *fp;
    CURLcode res = CURLE_FAILED_INIT;
    struct curl_slist *headers = NULL;

    if (!url || !out_path) {
        pldmgr_log("[PLDMGR] download_to_file: missing url or path\n");
        return -1;
    }

    fp = fopen(out_path, "wb");
    if (!fp) {
        pldmgr_log("[PLDMGR] download_to_file: failed to open %s\n", out_path);
        return -1;
    }

    curl = curl_easy_init();
    if (curl) {
        curl_easy_setopt(curl, CURLOPT_URL, url);
        curl_easy_setopt(curl, CURLOPT_WRITEFUNCTION, write_data);
        curl_easy_setopt(curl, CURLOPT_WRITEDATA, fp);
        curl_easy_setopt(curl, CURLOPT_USERAGENT,
                         github_api ? "pldmgr-download-hub/1.0" : "pldmgr/1.0");
        curl_easy_setopt(curl, CURLOPT_FOLLOWLOCATION, 1L);
        curl_easy_setopt(curl, CURLOPT_TIMEOUT, 120L);
        curl_easy_setopt(curl, CURLOPT_CONNECTTIMEOUT, 20L);

        /* Securely verify SSL against embedded CA bundle.
         * Older curl + mbedTLS wants a NUL-terminated PEM length. */
        char *ca_bundle = malloc(assets_cacert_pem_len + 1);
        if (ca_bundle) {
            memcpy(ca_bundle, assets_cacert_pem, assets_cacert_pem_len);
            ca_bundle[assets_cacert_pem_len] = '\0';
        }

        struct curl_blob blob;
        blob.data = ca_bundle ? ca_bundle : (void *)assets_cacert_pem;
        blob.len = ca_bundle ? (assets_cacert_pem_len + 1) : assets_cacert_pem_len;
        blob.flags = CURL_BLOB_COPY;

        curl_easy_setopt(curl, CURLOPT_CAINFO_BLOB, &blob);

        if (ca_bundle) {
            free(ca_bundle);
        }

        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 1L);
        curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 2L);

        if (github_api) {
            char token[256];
            headers = curl_slist_append(headers, "Accept: application/vnd.github+json");
            headers = curl_slist_append(headers, "X-GitHub-Api-Version: 2022-11-28");
            read_github_token(token, sizeof(token));
            if (token[0]) {
                char auth[320];
                snprintf(auth, sizeof(auth), "Authorization: Bearer %s", token);
                headers = curl_slist_append(headers, auth);
            }
            curl_easy_setopt(curl, CURLOPT_HTTPHEADER, headers);
        }

        res = curl_easy_perform(curl);

        /* If SSL verification fails, retry insecurely (checksums still gate ELFs). */
        if (res == CURLE_PEER_FAILED_VERIFICATION) {
            pldmgr_log("[PLDMGR] SSL verification failed. Retrying insecurely: %s\n", url);
            curl_easy_setopt(curl, CURLOPT_SSL_VERIFYPEER, 0L);
            curl_easy_setopt(curl, CURLOPT_SSL_VERIFYHOST, 0L);
            res = curl_easy_perform(curl);
        }

        long http_code = 0;
        curl_easy_getinfo(curl, CURLINFO_RESPONSE_CODE, &http_code);

        if (headers)
            curl_slist_free_all(headers);
        curl_easy_cleanup(curl);

        if (res != CURLE_OK) {
            pldmgr_log("[PLDMGR] curl_easy_perform failed: %s url=%s\n",
                       curl_easy_strerror(res), url);
        } else if (http_code != 200) {
            pldmgr_log("[PLDMGR] HTTP status %ld for %s\n", http_code, url);
            res = CURLE_HTTP_RETURNED_ERROR;
        }
    }

    fclose(fp);

    if (res != CURLE_OK) {
        remove(out_path);
        return -1;
    }

    return 0;
}

int download_to_file(const char *url, const char *out_path) {
    return download_to_file_ex(url, out_path, 0);
}

/* ── JSON parsing ──────────────────────────────────────────── */

int parse_repository_payloads(const char *json, RepoPayload **out_items, size_t *out_count) {
    const char *p = json;
    RepoPayload *items = NULL;
    size_t count = 0;

    *out_items = NULL;
    *out_count = 0;

    while ((p = strchr(p, '{')) != NULL) {
        const char *end = strchr(p, '}');
        RepoPayload item;
        RepoPayload *tmp;
        if (!end)
            break;

        memset(&item, 0, sizeof(item));
        if (json_extract_string(p, end, "name", item.name, sizeof(item.name)) != 0 ||
            json_extract_string(p, end, "filename", item.filename, sizeof(item.filename)) != 0 ||
            json_extract_string(p, end, "url", item.url, sizeof(item.url)) != 0) {
            p = end + 1;
            continue;
        }

        json_extract_string(p, end, "source", item.source, sizeof(item.source));
        json_extract_string(p, end, "source_direct", item.source_direct, sizeof(item.source_direct));
        json_extract_string(p, end, "description", item.description, sizeof(item.description));
        json_extract_string(p, end, "last_update", item.last_update, sizeof(item.last_update));
        json_extract_string(p, end, "version", item.version, sizeof(item.version));
        json_extract_string(p, end, "checksum", item.checksum, sizeof(item.checksum));
        
        if (json_extract_string(p, end, "category", item.category, sizeof(item.category)) != 0 || strlen(item.category) == 0) {
            strncpy(item.category, "Uncategorized", sizeof(item.category) - 1);
        }

        tmp = (RepoPayload *)realloc(items, (count + 1) * sizeof(RepoPayload));
        if (!tmp) {
            free(items);
            return -1;
        }
        items = tmp;
        items[count] = item;
        count++;
        p = end + 1;
    }

    *out_items = items;
    *out_count = count;
    return 0;
}

static int load_cached_repository(RepoPayload **out_items, size_t *out_count) {
    char *json = NULL;
    size_t size = 0;
    int ret;

    if (read_file_text(REPOSITORY_CACHE_PATH, &json, &size) != 0 || !json || size == 0) {
        if (json)
            free(json);
        return -1;
    }

    ret = parse_repository_payloads(json, out_items, out_count);
    free(json);
    return ret;
}

/* ── Payload metadata sidecar ──────────────────────────────── */

int write_payload_details_json(const RepoPayload *item, const char *details_path,
                               const char *install_source, const char *install_source_detail) {
    char name[256], filename[384], url[1400], source[1400], source_direct[1400];
    char description[1400], last_update[128], version[128], checksum[128], category[256];
    char downloaded_at[64], i_src[256], i_detail[1400], i_src_name[256];
    char json_buf[8192];
    time_t now = time(NULL);
    struct tm tmv;

    memset(&tmv, 0, sizeof(tmv));
    localtime_r(&now, &tmv);
    strftime(downloaded_at, sizeof(downloaded_at), "%Y-%m-%dT%H:%M:%S%z", &tmv);

    pldmgr_json_escape(item->name, name, sizeof(name));
    pldmgr_json_escape(item->filename, filename, sizeof(filename));
    pldmgr_json_escape(item->url, url, sizeof(url));
    pldmgr_json_escape(item->source, source, sizeof(source));
    pldmgr_json_escape(item->source_direct, source_direct, sizeof(source_direct));
    pldmgr_json_escape(item->description, description, sizeof(description));
    pldmgr_json_escape(item->last_update, last_update, sizeof(last_update));
    pldmgr_json_escape(item->version, version, sizeof(version));
    pldmgr_json_escape(item->checksum, checksum, sizeof(checksum));
    pldmgr_json_escape(item->category, category, sizeof(category));
    pldmgr_json_escape(install_source ? install_source : "unknown", i_src, sizeof(i_src));
    pldmgr_json_escape(install_source_detail ? install_source_detail : "", i_detail, sizeof(i_detail));
    pldmgr_json_escape(item->source_name[0] ? item->source_name : "", i_src_name, sizeof(i_src_name));

    snprintf(json_buf, sizeof(json_buf),
             "{\n"
             "  \"name\": \"%s\",\n"
             "  \"filename\": \"%s\",\n"
             "  \"url\": \"%s\",\n"
             "  \"source\": \"%s\",\n"
             "  \"source_direct\": \"%s\",\n"
             "  \"description\": \"%s\",\n"
             "  \"last_update\": \"%s\",\n"
             "  \"version\": \"%s\",\n"
             "  \"checksum\": \"%s\",\n"
             "  \"category\": \"%s\",\n"
             "  \"downloaded_at\": \"%s\",\n"
             "  \"install_source\": \"%s\",\n"
             "  \"install_source_detail\": \"%s\",\n"
             "  \"source_name\": \"%s\"\n"
             "}\n",
             name, filename, url, source, source_direct, description,
             last_update, version, checksum, category, downloaded_at, i_src, i_detail,
             i_src_name);

    FILE *f = fopen(details_path, "w");
    if (!f) return -1;
    fwrite(json_buf, 1, strlen(json_buf), f);
    fclose(f);
    return 0;
}

int write_simple_payload_details_json(const char *filename, const char *details_path,
                                      const char *install_source, const char *install_source_detail) {
    RepoPayload item;
    memset(&item, 0, sizeof(item));
    strncpy(item.name, filename, sizeof(item.name) - 1);
    strncpy(item.filename, filename, sizeof(item.filename) - 1);
    return write_payload_details_json(&item, details_path, install_source, install_source_detail);
}

/* ── Repository cache management ───────────────────────────── */

int repository_push_json(const char *json, size_t len) {
    RepoPayload *items = NULL;
    size_t count = 0;
    char tmp_path[512];
    time_t now = time(NULL);

    if (!json || len == 0) {
        pldmgr_log("[PLDMGR] !!! repository_push: empty body\n");
        return -1;
    }

    if (parse_repository_payloads(json, &items, &count) != 0 || count == 0) {
        pldmgr_log("[PLDMGR] !!! repository_push: JSON parse failed or 0 entries\n");
        if (items) free(items);
        return -1;
    }
    free(items);

    ensure_dir_recursive(BASE_DATA_DIR);
    ensure_dir_recursive(PAYLOADS_STORAGE_DIR);

    snprintf(tmp_path, sizeof(tmp_path), "%s.tmp", REPOSITORY_CACHE_PATH);
    if (write_file_text(tmp_path, json, len) != 0) {
        remove(tmp_path);
        return -1;
    }
    if (rename(tmp_path, REPOSITORY_CACHE_PATH) != 0) {
        remove(tmp_path);
        return -1;
    }

    config_write_last_update((long)now);
    pldmgr_log("[PLDMGR] Repository cache updated via browser push (%zu entries)\n", count);
    return 0;
}

int repository_ensure_fresh(int force_refresh) {
    long last_update = 0;
    time_t now = time(NULL);
    char tmp_path[512];
    char *json = NULL;
    size_t json_size = 0;
    RepoPayload *items = NULL;
    size_t count = 0;

    ensure_dir_recursive(BASE_DATA_DIR);
    ensure_dir_recursive(PAYLOADS_STORAGE_DIR);

    config_read_last_update(&last_update);

    if (!force_refresh && access(REPOSITORY_CACHE_PATH, F_OK) == 0) {
        long delta = (long)now - last_update;
        if (delta >= 0 && delta < REPOSITORY_REFRESH_INTERVAL_SEC) {
            return 0;
        }
    }

    snprintf(tmp_path, sizeof(tmp_path), "%s.tmp", REPOSITORY_CACHE_PATH);
    if (download_to_file(REPOSITORY_SOURCE_URL, tmp_path) != 0) {
        return -1;
    }

    if (read_file_text(tmp_path, &json, &json_size) != 0 || json_size == 0) {
        remove(tmp_path);
        if (json)
            free(json);
        return -1;
    }

    if (parse_repository_payloads(json, &items, &count) != 0 || count == 0) {
        pldmgr_log("[PLDMGR] !!! Repository payload JSON parse failed\n");
        free(items);
        free(json);
        remove(tmp_path);
        return -1;
    }

    free(items);
    free(json);

    if (rename(tmp_path, REPOSITORY_CACHE_PATH) != 0) {
        remove(tmp_path);
        return -1;
    }

    config_write_last_update((long)now);
    pldmgr_log("[PLDMGR] Repository cache refreshed (%ld entries timestamp)\n", (long)count);
    return 0;
}

size_t repository_list_json(char *json_buf, size_t buf_size, int force_refresh) {
    char *cached = NULL;
    size_t cached_size = 0;
    long last_update = 0;
    size_t pos = 0;

    if (force_refresh) {
        if (repository_ensure_fresh(1) != 0) {
            config_read_last_update(&last_update);
            snprintf(json_buf, buf_size,
                     "{\"payloads\":[],\"last_update\":%ld,\"cache_status\":\"error\"}",
                     last_update);
            return strlen(json_buf);
        }
    }

    config_read_last_update(&last_update);

    if (read_file_text(REPOSITORY_CACHE_PATH, &cached, &cached_size) != 0 || cached_size == 0) {
        if (cached)
            free(cached);
        snprintf(json_buf, buf_size,
                 "{\"payloads\":[],\"last_update\":%ld,\"cache_status\":\"missing\"}",
                 last_update);
        return strlen(json_buf);
    }

    pos += (size_t)snprintf(json_buf + pos, buf_size - pos, "{\"payloads\":");
    if (pos >= buf_size || buf_size - pos <= 64 || cached_size > (buf_size - pos - 64)) {
        snprintf(json_buf, buf_size,
                 "{\"payloads\":[],\"last_update\":%ld,\"cache_status\":\"truncated\"}",
                 last_update);
        free(cached);
        return strlen(json_buf);
    }
    if (pos < buf_size) {
        size_t copy_len = cached_size;
        memcpy(json_buf + pos, cached, copy_len);
        pos += copy_len;
    }

    pos += (size_t)snprintf(json_buf + pos, buf_size - pos,
                            ",\"last_update\":%ld,\"cache_status\":\"ok\",\"repo_url\":\"%s\"}",
                            last_update, REPOSITORY_SOURCE_URL);

    free(cached);
    return pos;
}

/* ── Install from repository ───────────────────────────────── */

int repository_install_download(const char *filename, const char *install_source_detail,
                                char *msg_buf, size_t msg_buf_size) {
    RepoPayload *items = NULL;
    size_t count = 0;
    int found = -1;
    char tmp_path[512];

    if (msg_buf && msg_buf_size > 0)
        msg_buf[0] = '\0';

    if (!filename || strlen(filename) == 0 || strstr(filename, "/") || strstr(filename, "..")) {
        snprintf(msg_buf, msg_buf_size, "Invalid filename");
        return -1;
    }

    if (load_cached_repository(&items, &count) != 0 || count == 0) {
        if (repository_ensure_fresh(1) == 0) {
            if (load_cached_repository(&items, &count) != 0 || count == 0) {
                snprintf(msg_buf, msg_buf_size, "Repository cache missing or invalid");
                if (items) free(items);
                return -1;
            }
        } else {
            snprintf(msg_buf, msg_buf_size, "Repository cache missing or invalid");
            if (items) free(items);
            return -1;
        }
    }

    for (size_t i = 0; i < count; i++) {
        if (strcmp(items[i].filename, filename) == 0) {
            found = (int)i;
            break;
        }
    }

    if (found < 0) {
        free(items);
        snprintf(msg_buf, msg_buf_size, "Payload not found in repository");
        return -1;
    }

    ensure_dir_recursive(PAYLOADS_STORAGE_DIR);
    snprintf(tmp_path, sizeof(tmp_path), "%s/%s.part", PAYLOADS_STORAGE_DIR, items[found].filename);

    if (download_to_file(items[found].url, tmp_path) != 0) {
        free(items);
        snprintf(msg_buf, msg_buf_size, "Download failed");
        remove(tmp_path);
        return -1;
    }

    const char *detail = (install_source_detail && install_source_detail[0])
                             ? install_source_detail
                             : REPOSITORY_SOURCE_URL;

    if (repository_install_commit(items[found].filename, tmp_path,
                                  "repository", detail,
                                  msg_buf, msg_buf_size) != 0) {
        free(items);
        return -1;
    }

    free(items);
    return 0;
}

int repository_install_commit(const char *filename, const char *uploaded_temp_path,
                              const char *install_source, const char *install_source_detail,
                              char *msg_buf, size_t msg_buf_size) {
    RepoPayload *items = NULL;
    size_t count = 0;
    int found = -1;
    char payload_dir[512];
    char final_path[640];
    char details_path[700];

    if (!filename || strlen(filename) == 0 || strstr(filename, "/") || strstr(filename, "..")) {
        snprintf(msg_buf, msg_buf_size, "Invalid filename");
        return -1;
    }

    if (load_cached_repository(&items, &count) != 0 || count == 0) {
        if (repository_ensure_fresh(1) == 0) {
            if (load_cached_repository(&items, &count) != 0 || count == 0) {
                snprintf(msg_buf, msg_buf_size, "Repository cache missing or invalid");
                if (items) free(items);
                return -1;
            }
        } else {
            snprintf(msg_buf, msg_buf_size, "Repository cache missing or invalid");
            if (items) free(items);
            return -1;
        }
    }

    if (count == 0) {
        snprintf(msg_buf, msg_buf_size, "Repository cache missing or invalid");
        if (items) free(items);
        return -1;
    }

    for (size_t i = 0; i < count; i++) {
        if (strcmp(items[i].filename, filename) == 0) {
            found = (int)i;
            break;
        }
    }

    if (found < 0) {
        free(items);
        snprintf(msg_buf, msg_buf_size, "Payload not found in repository");
        return -1;
    }

    char folder_name[128];
    pldmgr_utils_get_payload_folder_name(items[found].filename, folder_name, sizeof(folder_name));
    snprintf(payload_dir, sizeof(payload_dir), "%s/%s", PAYLOADS_STORAGE_DIR, folder_name);
    if (ensure_dir_recursive(payload_dir) != 0) {
        free(items);
        snprintf(msg_buf, msg_buf_size, "Failed to create payload directory");
        return -1;
    }

    snprintf(final_path, sizeof(final_path), "%s/%s", payload_dir, items[found].filename);
    snprintf(details_path, sizeof(details_path), "%s/%s.json", payload_dir, items[found].filename);

    if (strlen(items[found].checksum) == 64) {
        char calculated[65];
        if (compute_sha256_file(uploaded_temp_path, calculated) != 0) {
            free(items);
            remove(uploaded_temp_path);
            snprintf(msg_buf, msg_buf_size, "Checksum computation failed");
            return -1;
        }
        if (strcasecmp(calculated, items[found].checksum) != 0) {
            pldmgr_log("[PLDMGR] !!! Checksum mismatch for %s\n", items[found].filename);
            free(items);
            remove(uploaded_temp_path);
            snprintf(msg_buf, msg_buf_size, "Checksum mismatch");
            return -1;
        }
    }

    /* Verify succeeded, now clear previous payload and metadata. */
    payload_mgr_remove_old_files(payload_dir, items[found].filename);

    if (rename(uploaded_temp_path, final_path) != 0) {
        free(items);
        remove(uploaded_temp_path);
        snprintf(msg_buf, msg_buf_size, "Failed to finalize payload file");
        return -1;
    }

    if (write_payload_details_json(&items[found], details_path, install_source, install_source_detail) != 0) {
        free(items);
        remove(final_path);
        snprintf(msg_buf, msg_buf_size, "Failed to write payload metadata");
        return -1;
    }

    pldmgr_log("[PLDMGR] Repository payload installed: %s -> %s\n", items[found].filename, final_path);
    snprintf(msg_buf, msg_buf_size, "Installed %s", items[found].filename);
    free(items);
    return 0;
}

/* ── Self-update ───────────────────────────────────────────── */

int get_elf_pldmgr_version(const char *path, char *out_version, size_t out_size) {
    FILE *f = fopen(path, "rb");
    if (!f) return -1;

    char sig[16];
    sig[0] = 'P'; sig[1] = 'L'; sig[2] = 'D'; sig[3] = 'M'; sig[4] = 'G';
    sig[5] = 'R'; sig[6] = '_'; sig[7] = 'V'; sig[8] = 'E'; sig[9] = 'R'; sig[10] = ':'; sig[11] = '\0';
    size_t sig_len = 11;

    char buffer[8192];
    size_t bytes_read;
    int match_idx = 0;

    while ((bytes_read = fread(buffer, 1, sizeof(buffer), f)) > 0) {
        for (size_t i = 0; i < bytes_read; i++) {
            if (buffer[i] == sig[match_idx]) {
                match_idx++;
                if (match_idx == (int)sig_len) {
                    size_t v_idx = 0;
                    i++;
                    while (i < bytes_read && buffer[i] != '\0' && v_idx < out_size - 1) {
                        out_version[v_idx++] = buffer[i++];
                    }
                    if (i < bytes_read && buffer[i] == '\0') {
                        if (v_idx > 0) {
                            out_version[v_idx] = '\0';
                            fclose(f);
                            return 0;
                        } else {
                            match_idx = 0;
                            continue;
                        }
                    } else {
                        while (v_idx < out_size - 1) {
                            int c = fgetc(f);
                            if (c == EOF || c == '\0') break;
                            out_version[v_idx++] = (char)c;
                        }
                        out_version[v_idx] = '\0';
                        if (v_idx > 0) {
                            fclose(f);
                            return 0;
                        } else {
                            match_idx = 0;
                            continue;
                        }
                    }
                }
            } else {
                match_idx = 0;
                if (buffer[i] == sig[0]) match_idx = 1;
            }
        }
    }
    fclose(f);
    return -1;
}

static int parse_version_part(const char **p) {
    int val = 0;
    while (**p >= '0' && **p <= '9') {
        val = val * 10 + (**p - '0');
        (*p)++;
    }
    if (**p == '.') (*p)++;
    return val;
}

static int compare_versions(const char *v1, const char *v2) {
    const char *p1 = v1;
    const char *p2 = v2;

    int maj1 = parse_version_part(&p1);
    int maj2 = parse_version_part(&p2);
    if (maj1 != maj2) return maj1 - maj2;

    int min1 = parse_version_part(&p1);
    int min2 = parse_version_part(&p2);
    if (min1 != min2) return min1 - min2;

    int pat1 = parse_version_part(&p1);
    int pat2 = parse_version_part(&p2);

    int res = pat1 - pat2;
    pldmgr_log("[PLDMGR] Comparing versions: %s vs %s -> %d\n", v1, v2, res);
    return res;
}

int repository_check_self_update(char *out_path, size_t out_size) {
    DIR *dir = opendir(PAYLOADS_STORAGE_DIR);
    if (!dir) return -1;

    struct dirent *entry;
    while ((entry = readdir(dir)) != NULL) {
        if (entry->d_name[0] == '.') continue;

        /* Check for pldmgr or payload-manager directory (case-insensitive) */
        if (strcasecmp(entry->d_name, "pldmgr") == 0 || strcasecmp(entry->d_name, "payload-manager") == 0) {
            char subdir_path[512];
            snprintf(subdir_path, sizeof(subdir_path), "%s/%s", PAYLOADS_STORAGE_DIR, entry->d_name);

            struct stat st;
            if (stat(subdir_path, &st) == 0 && S_ISDIR(st.st_mode)) {
                DIR *sdir = opendir(subdir_path);
                if (sdir) {
                    struct dirent *sentry;
                    while ((sentry = readdir(sdir)) != NULL) {
                        if (sentry->d_name[0] == '.') continue;

                        /* Look for .elf or .bin files that match our name */
                        if (strstr(sentry->d_name, ".elf") || strstr(sentry->d_name, ".bin")) {
                            if (strcasestr(sentry->d_name, "pldmgr") || strcasestr(sentry->d_name, "payload-manager")) {
                                char full_path[512];
                                snprintf(full_path, sizeof(full_path), "%s/%s", subdir_path, sentry->d_name);

                                /* Verify ELF Magic */
                                unsigned char magic[4];
                                FILE *ef = fopen(full_path, "rb");
                                if (ef) {
                                    if (fread(magic, 1, 4, ef) == 4 && magic[0] == 0x7f && magic[1] == 'E' && magic[2] == 'L' && magic[3] == 'F') {
                                        fclose(ef);
                                        char version[64];
                                        if (get_elf_pldmgr_version(full_path, version, sizeof(version)) == 0) {
                                            pldmgr_log("[PLDMGR] Found potential update: %s (v%s)\n", full_path, version);
                                            if (compare_versions(version, MENU_VERSION) > 0) {
                                                strncpy(out_path, full_path, out_size);
                                                closedir(sdir);
                                                closedir(dir);
                                                return 0;
                                            }
                                        }
                                    } else {
                                        fclose(ef);
                                    }
                                }
                            }
                        }
                    }
                    closedir(sdir);
                }
            }
        }
    }

    closedir(dir);
    return -1;
}

#ifndef GITHUB_HUB_H
#define GITHUB_HUB_H

#include <stddef.h>

/* List configured GitHub repos (owner/repo). JSON: {"repos":["a/b",...]} */
int github_repos_list_json(char *buf, size_t size);

/* Add a repo slug. Accepts "owner/repo" or full github URL. */
int github_repos_add(const char *slug_or_url, char *msg, size_t msg_size);

/* Remove a repo slug. */
int github_repos_remove(const char *slug, char *msg, size_t msg_size);

/* Replace entire list from JSON body {"repos":["owner/repo",...]}. */
int github_repos_set(const char *json, size_t len);

/*
 * Return release catalog for a repo.
 * force_refresh=1 ignores disk cache.
 * JSON shape:
 * {
 *   "ok":true,"repo":"owner/repo","cached":true,"fetched_at":...,
 *   "releases":[
 *     {"tag":"v1","name":"...","published_at":"...","body":"...",
 *      "assets":[{"name":"x.elf","size":123,"url":"https://..."}]}
 *   ]
 * }
 */
size_t github_releases_json(const char *repo, int force_refresh,
                            char *buf, size_t size);

/*
 * Download a release asset into /data/pldmgr/payloads/.
 * repo=owner/repo, tag=release tag, asset=filename.
 */
int github_install_asset(const char *repo, const char *tag, const char *asset,
                         char *msg, size_t msg_size);

#endif

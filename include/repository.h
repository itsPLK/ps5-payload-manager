#ifndef REPOSITORY_H
#define REPOSITORY_H

#include <stddef.h>

/* Payload entry from a repository JSON */
typedef struct RepoPayload {
    char name[128];
    char filename[256];
    char url[1024];
    char source[1024];
    char source_direct[1024];
    char description[1024];
    char last_update[64];
    char version[64];
    char checksum[65];
    char source_name[256];
    char category[128];
} RepoPayload;

/* Download a URL to a local file. Returns 0 on success, -1 on failure. */
int download_to_file(const char *url, const char *out_path);

/* Same as download_to_file, optional GitHub API headers + Bearer token from config. */
int download_to_file_ex(const char *url, const char *out_path, int github_api);

/* Parse a JSON string containing payload objects into a RepoPayload array.
 * Caller must free *out_items. Returns 0 on success, -1 on failure. */
int parse_repository_payloads(const char *json, RepoPayload **out_items, size_t *out_count);

/* Write a .json sidecar file with payload metadata.
 * Returns 0 on success. */
int write_payload_details_json(const RepoPayload *item, const char *details_path,
                               const char *install_source, const char *install_source_detail);

/* Write a minimal sidecar file when full RepoPayload info isn't available. */
int write_simple_payload_details_json(const char *filename, const char *details_path,
                                      const char *install_source, const char *install_source_detail);

/* ── Repository cache management ────────────────────────── */

/* Accept a full JSON blob pushed by the browser and replace the cache. */
int repository_push_json(const char *json, size_t len);

/* Ensure the repository cache is up-to-date. If force_refresh, always re-download. */
int repository_ensure_fresh(int force_refresh);

/* Build the /repository_payloads JSON response.
 * Returns bytes written. */
size_t repository_list_json(char *json_buf, size_t buf_size, int force_refresh);

/* Download and install a payload from the default repository.
 * msg_buf receives a human-readable status message. */
int repository_install_download(const char *filename, const char *install_source_detail,
                                char *msg_buf, size_t msg_buf_size);

/* Verify a previously-uploaded file against the repository and commit it.
 * msg_buf receives a human-readable status message. */
int repository_install_commit(const char *filename, const char *uploaded_temp_path,
                              const char *install_source, const char *install_source_detail,
                              char *msg_buf, size_t msg_buf_size);

/* ── Self-update ────────────────────────────────────────── */

/* Read the PLDMGR_VER: signature from an ELF binary.
 * Returns 0 on success. */
int get_elf_pldmgr_version(const char *path, char *out_version, size_t out_size);

/* Scan the payload storage for a newer pldmgr.elf.
 * If found, writes the path to out_path and returns 0. */
int repository_check_self_update(char *out_path, size_t out_size);

#endif

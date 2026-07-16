/*
 * HTTP Server — Route dispatch for all API and asset endpoints.
 *
 * Contains the MHD on_request callback and all route-handling logic
 * previously embedded in main.c.
 */

#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <sys/stat.h>
#include <microhttpd.h>

#include "http_server.h"
#include "pldmgr.h"
#include "log_server.h"
#include "config.h"
#include "payload_mgr.h"
#include "repository.h"
#include "sources.h"
#include "process_mgr.h"
#include "ps5_launcher.h"
#include "github_hub.h"

#include "assets_index_html.h"
#include "assets_cache_appcache.h"
#include "assets_favicon_svg.h"
#include "assets_icon_png.h"

#define RESPONSE_BUFFER_SIZE 1048576
#define CORS_ORIGIN "*"

/* Shared flag — set from main() shutdown route, read by main loop */
volatile int http_keep_running = 1;

/* ── Helpers ───────────────────────────────────────────────── */

static void add_cors_headers(struct MHD_Response *resp) {
    MHD_add_response_header(resp, "Access-Control-Allow-Origin", CORS_ORIGIN);
}

static struct MHD_Response *alloc_response_buffer(char **out) {
    *out = malloc(RESPONSE_BUFFER_SIZE);
    if (*out)
        return NULL;
    static const char oom[] = "{\"error\":\"Out of memory\"}";
    struct MHD_Response *resp = MHD_create_response_from_buffer(
        sizeof(oom) - 1, (void *)oom, MHD_RESPMEM_PERSISTENT);
    MHD_add_response_header(resp, "Content-Type", "application/json");
    add_cors_headers(resp);
    return resp;
}

static int has_supported_extension(const char *path) {
    const char *ext = strrchr(path, '.');
    if (!ext) return 0;
    return strcasecmp(ext, ".elf") == 0 || strcasecmp(ext, ".bin") == 0;
}

static int is_safe_filename(const char *name) {
    if (!name || name[0] == '\0') return 0;
    if (strstr(name, "/") || strstr(name, "..")) return 0;
    return 1;
}

static int is_allowed_payload_path(const char *path) {
    if (!path || path[0] == '\0') return 0;
    if (strstr(path, "..")) return 0;
    if (!has_supported_extension(path)) return 0;

    for (int i = 0; i < SCAN_DIRS_COUNT; i++) {
        size_t len = strlen(SCAN_DIRS[i]);
        if (strncmp(path, SCAN_DIRS[i], len) == 0 &&
            (path[len] == '/' || path[len] == '\0')) {
            return 1;
        }
    }

    /* Allow USB root payloads if SCAN_USB_PAYLOADS is enabled in config */
    if (strncmp(path, "/mnt/usb", 8) == 0 &&
        path[8] >= '0' && path[8] <= '7' &&
        path[9] == '/') {
        if (config_read_bool("SCAN_USB_PAYLOADS", 0)) {
            return 1;
        }
    }

    return 0;
}

/* ── POST request state ────────────────────────────────────── */

struct PostStatus {
    char *data;
    size_t size;
    int error;
};

struct UploadStatus {
    FILE *fp;
    size_t total_size;
    int error;
    char filename[256];
    char temp_path[512];
    char repo_url[512];
};

/* ── Helper: Noisy routes ──────────────────────────────────── */

/* Filter out endpoints that the frontend polls automatically to reduce log spam */
static int is_noisy_route(const char *url) {
    if (strcmp(url, ROUTE_LOG) == 0) return 1;
    if (strcmp(url, ROUTE_INDEX) == 0) return 1;
    if (strcmp(url, ROUTE_INDEX_HTML) == 0) return 1;
    if (strcmp(url, "/favicon.svg") == 0) return 1;
    if (strcmp(url, "/icon.png") == 0) return 1;
    if (strcmp(url, ROUTE_CACHE_MANIFEST) == 0) return 1;
    if (strcmp(url, ROUTE_GETIP) == 0) return 1;
    if (strcmp(url, ROUTE_AUTOLOAD_STATUS) == 0) return 1;
    if (strcmp(url, ROUTE_VERSION) == 0) return 1;
    if (strcmp(url, ROUTE_LIST_PAYLOADS) == 0) return 1;
    if (strcmp(url, ROUTE_GET_CONFIG) == 0) return 1;
    if (strcmp(url, ROUTE_REPO_LIST) == 0) return 1;
    if (strcmp(url, ROUTE_PROCESSES_LIST) == 0) return 1;
    if (strcmp(url, ROUTE_GH_REPOS_LIST) == 0) return 1;
    if (strcmp(url, "/events") == 0) return 1;
    return 0;
}

/* ── Main request handler ──────────────────────────────────── */

enum MHD_Result http_on_request(void *cls, struct MHD_Connection *conn,
                                const char *url, const char *method,
                                const char *version, const char *upload_data,
                                size_t *upload_data_size, void **con_cls) {

    /* Handle CORS Preflight (OPTIONS) */
    if (strcmp(method, "OPTIONS") == 0) {
        struct MHD_Response *resp =
            MHD_create_response_from_buffer(0, NULL, MHD_RESPMEM_PERSISTENT);
        add_cors_headers(resp);
        MHD_add_response_header(resp, "Access-Control-Allow-Methods",
                                "GET, POST, OPTIONS");
        MHD_add_response_header(resp, "Access-Control-Allow-Headers",
                                "Content-Type");
        enum MHD_Result ret = MHD_queue_response(conn, MHD_HTTP_OK, resp);
        MHD_destroy_response(resp);
        return ret;
    }

    /* Set flag that we received a request (meaning browser is open) */
    log_server_set_active();

    /* ── Initial call for a new request ────────────────────── */
    if (*con_cls == NULL) {
        if (strncmp(url, ROUTE_UPLOAD, strlen(ROUTE_UPLOAD)) == 0) {
            struct UploadStatus *status = malloc(sizeof(struct UploadStatus));
            status->fp = NULL;
            status->total_size = 0;
            status->error = 0;

            const char *filename =
                MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "filename");
            if (filename && !strstr(filename, "/") && !strstr(filename, "..")) {
                char path[512];
                mkdir(BASE_DATA_DIR, 0777);
                mkdir(PAYLOADS_STORAGE_DIR, 0777);
                snprintf(path, sizeof(path), "%s/%s.tmp", PAYLOADS_STORAGE_DIR, filename);

                strncpy(status->filename, filename, sizeof(status->filename) - 1);
                status->filename[sizeof(status->filename) - 1] = '\0';
                strncpy(status->temp_path, path, sizeof(status->temp_path) - 1);
                status->temp_path[sizeof(status->temp_path) - 1] = '\0';

                status->fp = fopen(path, "wb");
                if (!status->fp) {
                    pldmgr_log("[PLDMGR] !!! FAILED to open temp file: %s\n", path);
                    status->error = 1;
                } else {
                    pldmgr_log("[PLDMGR] Starting upload to temp: %s\n", path);
                }
            } else {
                pldmgr_log("[PLDMGR] !!! Upload failed: Missing filename parameter\n");
                status->error = 1;
            }
            *con_cls = status;
            return MHD_YES;
        }

        if (strcmp(url, ROUTE_SET_CONFIG) == 0 && strcmp(method, "POST") == 0) {
            struct PostStatus *status = malloc(sizeof(struct PostStatus));
            status->data = NULL;
            status->size = 0;
            status->error = 0;
            *con_cls = status;
            return MHD_YES;
        }

        if (strcmp(url, ROUTE_REPO_PUSH) == 0 && strcmp(method, "POST") == 0) {
            struct PostStatus *status = malloc(sizeof(struct PostStatus));
            status->data = NULL;
            status->size = 0;
            status->error = 0;
            *con_cls = status;
            return MHD_YES;
        }

        if (strcmp(url, ROUTE_SOURCES_SET) == 0 && strcmp(method, "POST") == 0) {
            struct PostStatus *status = malloc(sizeof(struct PostStatus));
            status->data = NULL;
            status->size = 0;
            status->error = 0;
            *con_cls = status;
            return MHD_YES;
        }

        if (strcmp(url, ROUTE_GH_REPOS_SET) == 0 && strcmp(method, "POST") == 0) {
            struct PostStatus *status = malloc(sizeof(struct PostStatus));
            status->data = NULL;
            status->size = 0;
            status->error = 0;
            *con_cls = status;
            return MHD_YES;
        }

        if (strncmp(url, ROUTE_REPO_INSTALL_PUSH,
                    strlen(ROUTE_REPO_INSTALL_PUSH)) == 0 &&
            strcmp(method, "POST") == 0) {
            struct UploadStatus *status = malloc(sizeof(struct UploadStatus));
            status->fp = NULL;
            status->total_size = 0;
            status->error = 0;
            const char *filename =
                MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "filename");
            if (filename && !strstr(filename, "/") && !strstr(filename, "..")) {
                char path[512];
                mkdir(BASE_DATA_DIR, 0777);
                mkdir(PAYLOADS_STORAGE_DIR, 0777);
                snprintf(path, sizeof(path), "%s/%s.part", PAYLOADS_STORAGE_DIR, filename);
                strncpy(status->filename, filename, sizeof(status->filename) - 1);
                status->filename[sizeof(status->filename) - 1] = '\0';
                strncpy(status->temp_path, path, sizeof(status->temp_path) - 1);
                status->temp_path[sizeof(status->temp_path) - 1] = '\0';

                const char *repo_url = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "repo_url");
                if (repo_url) {
                    strncpy(status->repo_url, repo_url, sizeof(status->repo_url) - 1);
                    status->repo_url[sizeof(status->repo_url) - 1] = '\0';
                } else {
                    strncpy(status->repo_url, REPOSITORY_SOURCE_URL, sizeof(status->repo_url) - 1);
                    status->repo_url[sizeof(status->repo_url) - 1] = '\0';
                }

                status->fp = fopen(path, "wb");
                if (!status->fp) {
                    pldmgr_log("[PLDMGR] !!! Failed to open for install: %s\n", path);
                    status->error = 1;
                } else {
                    pldmgr_log("[PLDMGR] Installing payload: %s\n", path);
                }
            } else {
                pldmgr_log("[PLDMGR] !!! install_push: invalid filename\n");
                status->error = 1;
            }
            *con_cls = status;
            return MHD_YES;
        }

        *con_cls = (void *)1;
        return MHD_YES;
    }

    /* ── Handle POST data for /set_config ──────────────────── */
    if (strcmp(url, ROUTE_SET_CONFIG) == 0 && strcmp(method, "POST") == 0) {
        struct PostStatus *status = (struct PostStatus *)*con_cls;
        if (*upload_data_size != 0) {
            char *new_data = realloc(status->data, status->size + *upload_data_size + 1);
            if (!new_data) {
                status->error = 1;
            } else {
                status->data = new_data;
                memcpy(status->data + status->size, upload_data, *upload_data_size);
                status->size += *upload_data_size;
                status->data[status->size] = '\0';
            }
            *upload_data_size = 0;
            return MHD_YES;
        } else {
            /* Finished receiving JSON */
            pldmgr_log("[PLDMGR] Received config update: %s\n",
                       status->data ? status->data : "(null)");

            if (status->data && !status->error) {
                config_handle_set_json(status->data);
            }

            if (status->data)
                free(status->data);
            free(status);
            *con_cls = NULL;

            struct MHD_Response *resp = MHD_create_response_from_buffer(
                strlen(MSG_OK), (void *)MSG_OK, MHD_RESPMEM_MUST_COPY);
            add_cors_headers(resp);
            enum MHD_Result ret = MHD_queue_response(conn, MHD_HTTP_OK, resp);
            MHD_destroy_response(resp);
            return ret;
        }
    }

    /* ── Handle POST data for /repository_push ─────────────── */
    if (strcmp(url, ROUTE_REPO_PUSH) == 0 && strcmp(method, "POST") == 0) {
        struct PostStatus *status = (struct PostStatus *)*con_cls;
        if (*upload_data_size != 0) {
            char *nd = realloc(status->data, status->size + *upload_data_size + 1);
            if (!nd) {
                status->error = 1;
            } else {
                status->data = nd;
                memcpy(status->data + status->size, upload_data, *upload_data_size);
                status->size += *upload_data_size;
                status->data[status->size] = '\0';
            }
            *upload_data_size = 0;
            return MHD_YES;
        } else {
            int ok = -1;
            if (status->data && !status->error)
                ok = repository_push_json(status->data, status->size);
            if (status->data)
                free(status->data);
            free(status);
            *con_cls = NULL;

            /* Return the current list JSON so the frontend refreshes in one trip */
            char *resp_buf;
            struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
            if (oom_resp) {
                enum MHD_Result ret2 = MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
                MHD_destroy_response(oom_resp);
                return ret2;
            }

            size_t len = repository_list_json(resp_buf, RESPONSE_BUFFER_SIZE, 0);
            struct MHD_Response *resp = MHD_create_response_from_buffer(
                len, (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            enum MHD_Result ret2 = MHD_queue_response(
                conn, ok == 0 ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST, resp);
            MHD_destroy_response(resp);
            return ret2;
        }
    }

    /* ── Handle POST data for /sources_set ─────────────────── */
    if (strcmp(url, ROUTE_SOURCES_SET) == 0 && strcmp(method, "POST") == 0) {
        struct PostStatus *status = (struct PostStatus *)*con_cls;
        if (*upload_data_size != 0) {
            char *nd = realloc(status->data, status->size + *upload_data_size + 1);
            if (!nd) {
                status->error = 1;
            } else {
                status->data = nd;
                memcpy(status->data + status->size, upload_data, *upload_data_size);
                status->size += *upload_data_size;
                status->data[status->size] = '\0';
            }
            *upload_data_size = 0;
            return MHD_YES;
        } else {
            int ok = -1;
            if (status->data && !status->error)
                ok = sources_save(status->data, status->size);
            if (status->data)
                free(status->data);
            free(status);
            *con_cls = NULL;

            const char *msg = ok == 0 ? MSG_OK : "Failed to save sources";
            struct MHD_Response *resp_ss = MHD_create_response_from_buffer(
                strlen(msg), (void *)msg, MHD_RESPMEM_MUST_COPY);
            add_cors_headers(resp_ss);
            enum MHD_Result ret_ss = MHD_queue_response(
                conn, ok == 0 ? MHD_HTTP_OK : MHD_HTTP_INTERNAL_SERVER_ERROR, resp_ss);
            MHD_destroy_response(resp_ss);
            return ret_ss;
        }
    }

    /* ── Handle POST data for /github_repos_set ────────────── */
    if (strcmp(url, ROUTE_GH_REPOS_SET) == 0 && strcmp(method, "POST") == 0) {
        struct PostStatus *status = (struct PostStatus *)*con_cls;
        if (*upload_data_size != 0) {
            char *nd = realloc(status->data, status->size + *upload_data_size + 1);
            if (!nd) {
                status->error = 1;
            } else {
                status->data = nd;
                memcpy(status->data + status->size, upload_data, *upload_data_size);
                status->size += *upload_data_size;
                status->data[status->size] = '\0';
            }
            *upload_data_size = 0;
            return MHD_YES;
        } else {
            int ok = -1;
            if (status->data && !status->error)
                ok = github_repos_set(status->data, status->size);
            if (status->data)
                free(status->data);
            free(status);
            *con_cls = NULL;

            const char *msg = ok == 0 ? MSG_OK : "Failed to save repos";
            struct MHD_Response *resp_gh = MHD_create_response_from_buffer(
                strlen(msg), (void *)msg, MHD_RESPMEM_MUST_COPY);
            add_cors_headers(resp_gh);
            enum MHD_Result ret_gh = MHD_queue_response(
                conn, ok == 0 ? MHD_HTTP_OK : MHD_HTTP_INTERNAL_SERVER_ERROR, resp_gh);
            MHD_destroy_response(resp_gh);
            return ret_gh;
        }
    }

    /* ── Chunked upload for /manage:upload ─────────────────── */
    if (strncmp(url, ROUTE_UPLOAD, strlen(ROUTE_UPLOAD)) == 0) {
        struct UploadStatus *status = (struct UploadStatus *)*con_cls;
        if (*upload_data_size != 0) {
            if (status->fp && !status->error) {
                size_t written = fwrite(upload_data, 1, *upload_data_size, status->fp);
                if (written != *upload_data_size) {
                    pldmgr_log("[PLDMGR] !!! Write error: expected %zu, got %zu\n",
                               *upload_data_size, written);
                    status->error = 1;
                }
                status->total_size += written;
            }
            *upload_data_size = 0;
            return MHD_YES;
        } else {
            /* Upload finished */
            if (status->fp) {
                fflush(status->fp);
                fclose(status->fp);
                status->fp = NULL;

                if (!status->error) {
                    char msg[256];
                    if (payload_mgr_import_to_storage(status->filename, status->temp_path, "web_upload", "", msg, sizeof(msg)) != 0) {
                        pldmgr_log("[PLDMGR] !!! Failed to commit upload: %s\n", msg);
                        status->error = 1;
                    }
                }
            }
            pldmgr_log("[PLDMGR] Upload finished. Total bytes: %zu, Error: %d\n",
                       status->total_size, status->error);

            int err = status->error;
            free(status);
            *con_cls = NULL;

            const char *msg = err ? "Error during upload\n" : MSG_OK;
            struct MHD_Response *resp = MHD_create_response_from_buffer(
                strlen(msg), (void *)msg, MHD_RESPMEM_MUST_COPY);
            add_cors_headers(resp);
            enum MHD_Result ret = MHD_queue_response(
                conn, err ? MHD_HTTP_INTERNAL_SERVER_ERROR : MHD_HTTP_OK, resp);
            MHD_destroy_response(resp);
            return ret;
        }
    }

    /* ── Chunked upload for /repository_install_push ────────── */
    if (strncmp(url, ROUTE_REPO_INSTALL_PUSH, strlen(ROUTE_REPO_INSTALL_PUSH)) == 0) {
        struct UploadStatus *status = (struct UploadStatus *)*con_cls;
        if (*upload_data_size != 0) {
            if (status->fp && !status->error) {
                size_t written = fwrite(upload_data, 1, *upload_data_size, status->fp);
                if (written != *upload_data_size) {
                    status->error = 1;
                }
                status->total_size += written;
            }
            *upload_data_size = 0;
            return MHD_YES;
        } else {
            if (status->fp) {
                fflush(status->fp);
                fclose(status->fp);
            }
            int err = status->error;

            char msg_buf[1024] = "";
            if (!err) {
                if (repository_install_commit(
                        status->filename, status->temp_path, "repository", status->repo_url, msg_buf,
                        sizeof(msg_buf)) != 0) {
                    err = 1;
                }
            }

            pldmgr_log("[PLDMGR] Payload install %s (%zu bytes)\n",
                       err ? "FAILED" : "complete", status->total_size);
            free(status);
            *con_cls = NULL;
            if (err && msg_buf[0] == '\0') {
                snprintf(msg_buf, sizeof(msg_buf), "Write error");
            }
            char json_resp[1024];
            snprintf(json_resp, sizeof(json_resp), "{\"ok\":%s,\"message\":\"%s\"}",
                     err ? "false" : "true", err ? msg_buf : "Installed");
            struct MHD_Response *resp2 = MHD_create_response_from_buffer(
                strlen(json_resp), (void *)json_resp, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp2, "Content-Type", "application/json");
            add_cors_headers(resp2);
            enum MHD_Result ret2 = MHD_queue_response(
                conn, err ? MHD_HTTP_INTERNAL_SERVER_ERROR : MHD_HTTP_OK, resp2);
            MHD_destroy_response(resp2);
            return ret2;
        }
    }

    /* ── Log significant requests ──────────────────────────── */
    if (!is_noisy_route(url)) {
        pldmgr_log("[PLDMGR] Request: %s %s\n", method, url);
    }

    struct MHD_Response *resp = NULL;
    enum MHD_Result ret;
    int http_status = MHD_HTTP_OK;

    /* ── USB routes ────────────────────────────────────────── */
    if (strcmp(url, ROUTE_USB_MOVE_CHECK) == 0) {
        const char *path = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "path");
        if (path) {
            char *resp_buf;
            struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
            if (oom_resp) {
                ret = MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
                MHD_destroy_response(oom_resp);
                return ret;
            }
            int rc = payload_mgr_usb_check(path, resp_buf, RESPONSE_BUFFER_SIZE);
            resp = MHD_create_response_from_buffer(strlen(resp_buf), (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            ret = MHD_queue_response(conn, rc == 0 ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST, resp);
            MHD_destroy_response(resp);
            return ret;
        } else {
            const char *err = "{\"error\":\"Missing path\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
        }
        add_cors_headers(resp);
        ret = MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        MHD_destroy_response(resp);
        return ret;
    }

    if (strcmp(url, ROUTE_USB_MOVE_PERFORM) == 0) {
        const char *path = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "path");
        const char *overwrite_str = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "overwrite");
        int overwrite = (overwrite_str && strcmp(overwrite_str, "true") == 0) ? 1 : 0;
        const char *keep_original_str = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "keep_original");
        int keep_original = (keep_original_str && strcmp(keep_original_str, "true") == 0) ? 1 : 0;
        if (path) {
            char *resp_buf;
            struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
            if (oom_resp) {
                ret = MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
                MHD_destroy_response(oom_resp);
                return ret;
            }
            int rc = payload_mgr_usb_move(path, overwrite, keep_original, resp_buf, RESPONSE_BUFFER_SIZE);
            resp = MHD_create_response_from_buffer(strlen(resp_buf), (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            ret = MHD_queue_response(conn, rc == 0 ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST, resp);
            MHD_destroy_response(resp);
            return ret;
        } else {
            const char *err = "{\"error\":\"Missing path\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
        }
        add_cors_headers(resp);
        ret = MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        MHD_destroy_response(resp);
        return ret;
    }

    /* ── Static assets ─────────────────────────────────────── */
    if (strcmp(url, ROUTE_INDEX) == 0 || strcmp(url, ROUTE_INDEX_HTML) == 0) {
        resp = MHD_create_response_from_buffer(assets_index_html_len,
                                               (void *)assets_index_html,
                                               MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(resp, "Content-Type", "text/html");
        MHD_add_response_header(resp, "Cache-Control", "no-cache, must-revalidate");
    } else if (strcmp(url, ROUTE_CACHE_MANIFEST) == 0) {
        resp = MHD_create_response_from_buffer(assets_cache_appcache_len,
                                               (void *)assets_cache_appcache,
                                               MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(resp, "Content-Type", "text/cache-manifest");
        MHD_add_response_header(resp, "Cache-Control", "no-cache, must-revalidate");
    } else if (strcmp(url, "/favicon.svg") == 0) {
        resp = MHD_create_response_from_buffer(assets_favicon_svg_len,
                                               (void *)assets_favicon_svg,
                                               MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(resp, "Content-Type", "image/svg+xml");
        MHD_add_response_header(resp, "Cache-Control", "max-age=604800");
    } else if (strcmp(url, "/icon.png") == 0) {
        resp = MHD_create_response_from_buffer(assets_icon_png_len,
                                               (void *)assets_icon_png,
                                               MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(resp, "Content-Type", "image/png");
        MHD_add_response_header(resp, "Cache-Control", "max-age=604800");

    /* ── API routes ────────────────────────────────────────── */
    } else if (strcmp(url, ROUTE_CHECK) == 0) {
        const char *filename = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "filename");
        if (!filename) {
            const char *err = "{\"error\":\"Missing filename\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            return MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        }
        if (!is_safe_filename(filename)) {
            const char *err = "{\"error\":\"Invalid filename\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            return MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        }
        char *resp_buf;
        struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
        if (oom_resp)
            return MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
        payload_mgr_check_existing(filename, resp_buf, RESPONSE_BUFFER_SIZE);
        resp = MHD_create_response_from_buffer(strlen(resp_buf), (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
        MHD_add_response_header(resp, "Content-Type", "application/json");
        add_cors_headers(resp);
        return MHD_queue_response(conn, MHD_HTTP_OK, resp);
    } else if (strcmp(url, ROUTE_LIST_PAYLOADS) == 0) {
        char *resp_buf;
        struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
        if (oom_resp)
            return MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
        size_t len = payload_mgr_list_json(resp_buf, RESPONSE_BUFFER_SIZE);
        resp = MHD_create_response_from_buffer(len, (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
        MHD_add_response_header(resp, "Content-Type", "application/json");
    } else if (strcmp(url, ROUTE_PROCESSES_LIST) == 0) {
        char *resp_buf;
        struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
        if (oom_resp)
            return MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
        size_t len = process_list_json(resp_buf, RESPONSE_BUFFER_SIZE);
        resp = MHD_create_response_from_buffer(len, (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
        MHD_add_response_header(resp, "Content-Type", "application/json");
    } else if (strcmp(url, ROUTE_PROCESS_KILL) == 0) {
        const char *pid_str = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "pid");
        if (!pid_str) {
            const char *err = "{\"ok\":false,\"message\":\"Missing pid\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            return MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        }
        int pid = atoi(pid_str);
        int rc = process_kill(pid);
        
        pldmgr_log("[PLDMGR] Process kill requested for PID %d: %s\n", pid, rc == 0 ? "SUCCESS" : "FAILED");
        
        char json_resp[256];
        snprintf(json_resp, sizeof(json_resp), "{\"ok\":%s,\"message\":\"%s\"}",
                 rc == 0 ? "true" : "false", rc == 0 ? "Killed" : "Failed to kill");
        resp = MHD_create_response_from_buffer(strlen(json_resp), (void *)json_resp, MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(resp, "Content-Type", "application/json");
        add_cors_headers(resp);
        return MHD_queue_response(conn, rc == 0 ? MHD_HTTP_OK : MHD_HTTP_INTERNAL_SERVER_ERROR, resp);
    } else if (strcmp(url, ROUTE_REPO_LIST) == 0) {
        char *resp_buf;
        struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
        if (oom_resp)
            return MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
        PldmgrConfig cfg;
        config_read(&cfg);
        size_t len;
        if (cfg.multi_sources_enabled)
            len = sources_multi_repository_list_json(resp_buf, RESPONSE_BUFFER_SIZE, 0);
        else
            len = repository_list_json(resp_buf, RESPONSE_BUFFER_SIZE, 0);
        resp = MHD_create_response_from_buffer(len, (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
        MHD_add_response_header(resp, "Content-Type", "application/json");
    } else if (strcmp(url, ROUTE_REPO_REFRESH) == 0) {
        char *resp_buf;
        struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
        if (oom_resp)
            return MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
        PldmgrConfig cfg;
        config_read(&cfg);
        size_t len2;
        if (cfg.multi_sources_enabled)
            len2 = sources_multi_repository_list_json(resp_buf, RESPONSE_BUFFER_SIZE, 1);
        else
            len2 = repository_list_json(resp_buf, RESPONSE_BUFFER_SIZE, 1);
        resp = MHD_create_response_from_buffer(len2, (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
        MHD_add_response_header(resp, "Content-Type", "application/json");
    } else if (strcmp(url, ROUTE_REPO_INSTALL) == 0) {
        const char *filename = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "filename");
        const char *repo_url = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "repo_url");
        const char *source_id = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "source_id");
        if (!filename) {
            const char *err = "{\"ok\":false,\"message\":\"Missing filename\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            return MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        }
        if (!is_safe_filename(filename)) {
            const char *err = "{\"ok\":false,\"message\":\"Invalid filename\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            return MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        }

        char msg_buf[1024] = "";
        int rc;
        if (source_id && source_id[0]) {
            rc = sources_multi_repository_install(filename, source_id,
                                                  repo_url ? repo_url : "",
                                                  msg_buf, sizeof(msg_buf));
        } else {
            const char *detail = (repo_url && repo_url[0]) ? repo_url : REPOSITORY_SOURCE_URL;
            rc = repository_install_download(filename, detail, msg_buf, sizeof(msg_buf));
        }
        if (msg_buf[0] == '\0') {
            snprintf(msg_buf, sizeof(msg_buf), rc == 0 ? "Installed" : "Install failed");
        }

        char json_resp[1024];
        snprintf(json_resp, sizeof(json_resp), "{\"ok\":%s,\"message\":\"%s\"}",
                 rc == 0 ? "true" : "false", msg_buf);
        resp = MHD_create_response_from_buffer(strlen(json_resp), (void *)json_resp, MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(resp, "Content-Type", "application/json");
        add_cors_headers(resp);
        return MHD_queue_response(conn, rc == 0 ? MHD_HTTP_OK : MHD_HTTP_INTERNAL_SERVER_ERROR, resp);
    } else if (strcmp(url, ROUTE_SOURCES_LIST) == 0) {
        char *resp_buf;
        struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
        if (oom_resp)
            return MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
        sources_list_json(resp_buf, RESPONSE_BUFFER_SIZE);
        resp = MHD_create_response_from_buffer(strlen(resp_buf), (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
        MHD_add_response_header(resp, "Content-Type", "application/json");
    } else if (strcmp(url, ROUTE_SOURCES_ADD) == 0) {
        const char *src_url = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "url");
        if (!src_url || !src_url[0]) {
            const char *err = "{\"ok\":false,\"message\":\"Missing url parameter\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            return MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        }
        char msg_buf_src[512] = "";
        int rc_src = sources_add(src_url, msg_buf_src, sizeof(msg_buf_src));
        char json_resp_src[1024];
        if (rc_src == 0) {
            char name_escaped[512];
            pldmgr_json_escape(msg_buf_src, name_escaped, sizeof(name_escaped));
            snprintf(json_resp_src, sizeof(json_resp_src),
                     "{\"ok\":true,\"name\":\"%s\"}", name_escaped);
        } else {
            char msg_escaped[512];
            pldmgr_json_escape(msg_buf_src, msg_escaped, sizeof(msg_escaped));
            snprintf(json_resp_src, sizeof(json_resp_src),
                     "{\"ok\":false,\"message\":\"%s\"}", msg_escaped);
        }
        resp = MHD_create_response_from_buffer(strlen(json_resp_src), (void *)json_resp_src, MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(resp, "Content-Type", "application/json");
        add_cors_headers(resp);
        return MHD_queue_response(conn, rc_src == 0 ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST, resp);
    } else if (strcmp(url, ROUTE_SOURCES_REMOVE) == 0) {
        const char *idx_str = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "index");
        if (!idx_str) {
            const char *err = "{\"ok\":false,\"message\":\"Missing index parameter\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err, MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            return MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        }
        int idx = atoi(idx_str);
        char msg_rm[256] = "";
        int rc_rm = sources_remove(idx, msg_rm, sizeof(msg_rm));
        char json_rm[512];
        char msg_rm_e[256];
        pldmgr_json_escape(msg_rm, msg_rm_e, sizeof(msg_rm_e));
        snprintf(json_rm, sizeof(json_rm), "{\"ok\":%s,\"message\":\"%s\"}",
                 rc_rm == 0 ? "true" : "false", msg_rm_e);
        resp = MHD_create_response_from_buffer(strlen(json_rm), (void *)json_rm, MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(resp, "Content-Type", "application/json");
        add_cors_headers(resp);
        return MHD_queue_response(conn, rc_rm == 0 ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST, resp);
    } else if (strcmp(url, ROUTE_GH_REPOS_LIST) == 0) {
        char *resp_buf;
        struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
        if (oom_resp)
            return MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
        github_repos_list_json(resp_buf, RESPONSE_BUFFER_SIZE);
        resp = MHD_create_response_from_buffer(strlen(resp_buf), (void *)resp_buf,
                                               MHD_RESPMEM_MUST_FREE);
        MHD_add_response_header(resp, "Content-Type", "application/json");
    } else if (strcmp(url, ROUTE_GH_REPOS_ADD) == 0) {
        const char *slug = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "repo");
        if (!slug || !slug[0])
            slug = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "url");
        char msg_buf[256] = "";
        int rc = slug ? github_repos_add(slug, msg_buf, sizeof(msg_buf)) : -1;
        if (!slug)
            snprintf(msg_buf, sizeof(msg_buf), "Missing repo");
        char msg_e[512];
        char json_resp[640];
        pldmgr_json_escape(msg_buf, msg_e, sizeof(msg_e));
        if (rc == 0)
            snprintf(json_resp, sizeof(json_resp), "{\"ok\":true,\"repo\":\"%s\"}", msg_e);
        else
            snprintf(json_resp, sizeof(json_resp), "{\"ok\":false,\"message\":\"%s\"}", msg_e);
        resp = MHD_create_response_from_buffer(strlen(json_resp), (void *)json_resp,
                                               MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(resp, "Content-Type", "application/json");
        add_cors_headers(resp);
        return MHD_queue_response(conn, rc == 0 ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST, resp);
    } else if (strcmp(url, ROUTE_GH_REPOS_REMOVE) == 0) {
        const char *slug = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "repo");
        char msg_buf[256] = "";
        int rc = slug ? github_repos_remove(slug, msg_buf, sizeof(msg_buf)) : -1;
        if (!slug)
            snprintf(msg_buf, sizeof(msg_buf), "Missing repo");
        char msg_e[512];
        char json_resp[640];
        pldmgr_json_escape(msg_buf, msg_e, sizeof(msg_e));
        snprintf(json_resp, sizeof(json_resp), "{\"ok\":%s,\"message\":\"%s\"}",
                 rc == 0 ? "true" : "false", msg_e);
        resp = MHD_create_response_from_buffer(strlen(json_resp), (void *)json_resp,
                                               MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(resp, "Content-Type", "application/json");
        add_cors_headers(resp);
        return MHD_queue_response(conn, rc == 0 ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST, resp);
    } else if (strcmp(url, ROUTE_GH_RELEASES) == 0) {
        const char *repo = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "repo");
        const char *force = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "refresh");
        int force_refresh = force && (force[0] == '1' || !strcasecmp(force, "true"));
        if (!repo || !repo[0]) {
            const char *err = "{\"ok\":false,\"message\":\"Missing repo\"}";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err,
                                                   MHD_RESPMEM_MUST_COPY);
            MHD_add_response_header(resp, "Content-Type", "application/json");
            add_cors_headers(resp);
            return MHD_queue_response(conn, MHD_HTTP_BAD_REQUEST, resp);
        }
        char *resp_buf;
        struct MHD_Response *oom_resp = alloc_response_buffer(&resp_buf);
        if (oom_resp)
            return MHD_queue_response(conn, MHD_HTTP_INTERNAL_SERVER_ERROR, oom_resp);
        size_t len = github_releases_json(repo, force_refresh, resp_buf, RESPONSE_BUFFER_SIZE);
        int ok = (len > 0 && strstr(resp_buf, "\"ok\":true") != NULL);
        resp = MHD_create_response_from_buffer(len, (void *)resp_buf, MHD_RESPMEM_MUST_FREE);
        MHD_add_response_header(resp, "Content-Type", "application/json");
        add_cors_headers(resp);
        {
            enum MHD_Result ret = MHD_queue_response(
                conn, ok ? MHD_HTTP_OK : MHD_HTTP_BAD_GATEWAY, resp);
            MHD_destroy_response(resp);
            return ret;
        }
    } else if (strcmp(url, ROUTE_GH_INSTALL) == 0) {
        const char *repo = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "repo");
        const char *tag = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "tag");
        const char *asset = MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "asset");
        char msg_buf[512] = "";
        int rc = -1;
        if (repo && tag && asset)
            rc = github_install_asset(repo, tag, asset, msg_buf, sizeof(msg_buf));
        else
            snprintf(msg_buf, sizeof(msg_buf), "Need repo, tag, and asset");
        char msg_e[640];
        char json_resp[800];
        pldmgr_json_escape(msg_buf, msg_e, sizeof(msg_e));
        snprintf(json_resp, sizeof(json_resp), "{\"ok\":%s,\"message\":\"%s\"}",
                 rc == 0 ? "true" : "false", msg_e);
        resp = MHD_create_response_from_buffer(strlen(json_resp), (void *)json_resp,
                                               MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(resp, "Content-Type", "application/json");
        add_cors_headers(resp);
        return MHD_queue_response(conn, rc == 0 ? MHD_HTTP_OK : MHD_HTTP_BAD_REQUEST, resp);
    } else if (strncmp(url, ROUTE_LOAD_PAYLOAD, strlen(ROUTE_LOAD_PAYLOAD)) == 0) {
        const char *path = url + strlen(ROUTE_LOAD_PAYLOAD);
        const char *final_path = NULL;
        char resolved_path[512];
        if (is_allowed_payload_path(path)) {
            final_path = path;
        } else {
            const char *filename = strrchr(path, '/');
            filename = filename ? filename + 1 : path;
            if (is_safe_filename(filename) &&
                payload_mgr_resolve_path(filename, resolved_path,
                                         sizeof(resolved_path)) == 0) {
                final_path = resolved_path;
            }
        }

        if (!final_path) {
            pldmgr_log("[PLDMGR] !!! Payload path rejected: %s\n", path);
            const char *err = "Invalid payload name\n";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err,
                                                   MHD_RESPMEM_PERSISTENT);
            http_status = MHD_HTTP_BAD_REQUEST;
        } else if (ps5_launch_elf(final_path) == 0) {
            resp = MHD_create_response_from_buffer(strlen(MSG_OK), (void *)MSG_OK,
                                                   MHD_RESPMEM_PERSISTENT);
        } else {
            const char *err = "Failed to launch payload\n";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err,
                                                   MHD_RESPMEM_PERSISTENT);
            http_status = MHD_HTTP_INTERNAL_SERVER_ERROR;
        }
        MHD_add_response_header(resp, "Content-Type", "text/plain");
    } else if (strncmp(url, ROUTE_DELETE, strlen(ROUTE_DELETE)) == 0) {
        const char *filename =
            MHD_lookup_connection_value(conn, MHD_GET_ARGUMENT_KIND, "filename");
        if (filename) {
            if (strstr(filename, "/") || strstr(filename, "..")) {
                const char *err = "Invalid filename\n";
                resp = MHD_create_response_from_buffer(strlen(err), (void *)err,
                                                       MHD_RESPMEM_PERSISTENT);
            } else {
                if (payload_mgr_delete_payload_file(filename) == 0) {
                    pldmgr_log("[PLDMGR] Deleted payload: %s\n", filename);
                    resp = MHD_create_response_from_buffer(strlen(MSG_OK), (void *)MSG_OK,
                                                           MHD_RESPMEM_PERSISTENT);
                } else {
                    const char *err = "Failed to delete file\n";
                    resp = MHD_create_response_from_buffer(strlen(err), (void *)err,
                                                           MHD_RESPMEM_PERSISTENT);
                }
            }
        } else {
            const char *err = "Missing filename\n";
            resp = MHD_create_response_from_buffer(strlen(err), (void *)err,
                                                   MHD_RESPMEM_PERSISTENT);
        }
        MHD_add_response_header(resp, "Content-Type", "text/plain");
    } else if (strcmp(url, ROUTE_SHUTDOWN) == 0) {
        const char *msg = "Payload Manager Core shutting down...\n";
        pldmgr_log("[PLDMGR] %s", msg);
        resp = MHD_create_response_from_buffer(strlen(msg), (void *)msg,
                                               MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(resp, "Content-Type", "text/plain");
        http_keep_running = 0;
    } else if (strcmp(url, ROUTE_LOG) == 0) {
        char *resp_buf;
        resp = alloc_response_buffer(&resp_buf);
        if (!resp) {
            size_t pos = log_build_json(resp_buf, RESPONSE_BUFFER_SIZE);
            resp = MHD_create_response_from_buffer(pos, (void *)resp_buf,
                                                   MHD_RESPMEM_MUST_FREE);
            MHD_add_response_header(resp, "Content-Type", "application/json");
        }
    } else if (strcmp(url, ROUTE_VERSION) == 0) {
        resp = MHD_create_response_from_buffer(
            strlen(MENU_VERSION), (void *)MENU_VERSION, MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(resp, "Content-Type", "text/plain");
    } else if (strcmp(url, ROUTE_GETIP) == 0) {
        char ip[64];
        if (pldmgr_get_local_ip(ip, sizeof(ip)) != 0) {
            strcpy(ip, "0.0.0.0");
        }
        resp = MHD_create_response_from_buffer(strlen(ip), (void *)ip,
                                               MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(resp, "Content-Type", "text/plain");
    } else if (strcmp(url, ROUTE_AUTOLOAD_STATUS) == 0) {
        int total, done;
        char current[128];
        pldmgr_autoload_get_status(&total, &done, current);
        int remaining = pldmgr_autoload_get_remaining_seconds();
        long long remaining_ms = pldmgr_autoload_get_remaining_ms();

        char list_buf[4096] = "";
        FILE *f = fopen(AUTOLOAD_CONFIG_PATH, "r");
        if (f) {
            char line[256];
            int first = 1;
            while (fgets(line, sizeof(line), f)) {
                line[strcspn(line, "\r\n")] = 0;
                if (strlen(line) == 0 || line[0] == '!')
                    continue;
                if (!first) strcat(list_buf, ",");
                strcat(list_buf, line);
                first = 0;
            }
            fclose(f);
        }

        PldmgrConfig cfg;
        config_read(&cfg);

        char current_escaped[256];
        char list_escaped[8192];
        pldmgr_json_escape(current, current_escaped, sizeof(current_escaped));
        pldmgr_json_escape(list_buf, list_escaped, sizeof(list_escaped));

        char *resp_buf;
        resp = alloc_response_buffer(&resp_buf);
        if (!resp) {
            snprintf(resp_buf, RESPONSE_BUFFER_SIZE,
                     "{\"remaining\":%d,\"remaining_ms\":%lld,\"total\":%d,\"done\":%d,\"current\":\"%s\","
                     "\"list\":\"%s\",\"delay\":%d,\"KILL_DISC_PLAYER_ON_STARTUP\":%s,\"SCAN_USB_PAYLOADS\":%s}",
                     remaining, remaining_ms, total, done, current_escaped, list_escaped, cfg.autoload_delay,
                     cfg.kill_disc_player ? "true" : "false", cfg.scan_usb_payloads ? "true" : "false");
            resp = MHD_create_response_from_buffer(strlen(resp_buf),
                                                   (void *)resp_buf,
                                                   MHD_RESPMEM_MUST_FREE);
            MHD_add_response_header(resp, "Content-Type", "application/json");
        }
    } else if (strcmp(url, ROUTE_AUTOLOAD_CLEAR) == 0) {
        pldmgr_autoload_reset();
        const char *msg = "Autoload status cleared.\n";
        resp = MHD_create_response_from_buffer(strlen(msg), (void *)msg,
                                               MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(resp, "Content-Type", "text/plain");
    } else if (strcmp(url, ROUTE_ABORT) == 0) {
        pldmgr_autoload_abort();
        const char *msg = "Autoload sequence aborted.\n";
        resp = MHD_create_response_from_buffer(strlen(msg), (void *)msg,
                                               MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(resp, "Content-Type", "text/plain");
    } else if (strcmp(url, "/autoload_status") == 0) {
        char resp_buf[64];
        snprintf(resp_buf, sizeof(resp_buf), "{\"remaining\":%d}",
                 pldmgr_autoload_get_remaining_seconds());
        resp = MHD_create_response_from_buffer(strlen(resp_buf),
                                               (void *)resp_buf,
                                               MHD_RESPMEM_MUST_COPY);
        MHD_add_response_header(resp, "Content-Type", "application/json");
    } else if (strcmp(url, ROUTE_GET_CONFIG) == 0) {
        PldmgrConfig cfg;
        config_read(&cfg);

        /* Get list */
        char list_buf[4096] = {0};
        FILE *f = fopen(AUTOLOAD_CONFIG_PATH, "r");
        if (f) {
            char line[256];
            int first = 1;
            while (fgets(line, sizeof(line), f)) {
                line[strcspn(line, "\r\n")] = 0;
                if (strlen(line) == 0)
                    continue;
                if (!first)
                    strncat(list_buf, ",", sizeof(list_buf) - strlen(list_buf) - 1);
                strncat(list_buf, line, sizeof(list_buf) - strlen(list_buf) - 1);
                first = 0;
            }
            fclose(f);
        }

        char list_escaped[8192];
        pldmgr_json_escape(list_buf, list_escaped, sizeof(list_escaped));

        char *resp_buf;
        resp = alloc_response_buffer(&resp_buf);
        if (!resp) {
            snprintf(resp_buf, RESPONSE_BUFFER_SIZE,
                     "{\"AUTOLOAD_ENABLED\":%s,\"AUTOLOAD_LIST\":\"%s\",\"LAST_"
                     "REPOSITORY_UPDATE\":%ld,"
                     "\"AUTO_BROWSER_OPEN\":%s,\"AUTOLOAD_DELAY\":%d,\"KILL_DISC_"
                     "PLAYER_ON_STARTUP\":%s,\"SCAN_USB_PAYLOADS\":%s,\"AUTO_INSTALL_APP\":%s,"
                     "\"MULTI_SOURCES_ENABLED\":%s}",
                     cfg.autoload_enabled ? "true" : "false", list_escaped, cfg.last_repository_update,
                     cfg.auto_browser_open ? "true" : "false", cfg.autoload_delay,
                     cfg.kill_disc_player ? "true" : "false", cfg.scan_usb_payloads ? "true" : "false",
                     cfg.auto_install_app ? "true" : "false",
                     cfg.multi_sources_enabled ? "true" : "false");
            resp = MHD_create_response_from_buffer(strlen(resp_buf),
                                                   (void *)resp_buf,
                                                   MHD_RESPMEM_MUST_FREE);
            MHD_add_response_header(resp, "Content-Type", "application/json");
        }
    } else if (strcmp(url, "/events") == 0) {
        struct LogSSEConnection *sse = malloc(sizeof(struct LogSSEConnection));
        sse->last_log_version = 0;
        sse->sent_initial = 0;

        resp = MHD_create_response_from_callback(
            MHD_SIZE_UNKNOWN, 1024, &log_stream_callback, sse, &log_stream_cleanup);
        MHD_add_response_header(resp, "Content-Type", "text/event-stream");
        MHD_add_response_header(resp, "Cache-Control", "no-cache");
        MHD_add_response_header(resp, "Connection", "keep-alive");
    } else {
        /* Default: 404 */
        const char *not_found = "404 Not Found\n";
        resp = MHD_create_response_from_buffer(strlen(not_found), (void *)not_found,
                                               MHD_RESPMEM_PERSISTENT);
        MHD_add_response_header(resp, "Content-Type", "text/plain");
    }

    if (!resp)
        return MHD_NO;

    add_cors_headers(resp);
    ret = MHD_queue_response(conn, http_status, resp);
    MHD_destroy_response(resp);

    return ret;
}

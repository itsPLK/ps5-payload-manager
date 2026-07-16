#pragma once

#include <stddef.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Gets a non-loopback LAN IP. Returns 0 on success, -1 if none (offline OK). */
int pldmgr_get_local_ip(char *ip_buf, size_t buf_size);

/* 1 if HTTP answers on 127.0.0.1:port (tile/local health). */
int pldmgr_probe_http_loopback(unsigned short port);

void pldmgr_utils_get_payload_folder_name(const char *filename, char *out_buf, size_t out_size);
void pldmgr_json_escape(const char *src, char *dst, size_t dst_size);

#ifdef __cplusplus
}
#endif

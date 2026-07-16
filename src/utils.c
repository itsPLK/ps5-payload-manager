#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <errno.h>
#include <sys/socket.h>
#include <sys/time.h>
#include <netdb.h>
#include <ifaddrs.h>
#include <arpa/inet.h>
#include <netinet/in.h>
#include <netinet/tcp.h>
#include "utils.h"

int pldmgr_get_local_ip(char *ip_buf, size_t buf_size) {
    struct ifaddrs *ifaddr, *ifa;
    int family, s;

    if (!ip_buf || buf_size == 0)
        return -1;
    ip_buf[0] = '\0';

    if (getifaddrs(&ifaddr) == -1) {
        return -1;
    }

    for (ifa = ifaddr; ifa != NULL; ifa = ifa->ifa_next) {
        if (ifa->ifa_addr == NULL) continue;

        family = ifa->ifa_addr->sa_family;

        if (family == AF_INET) {
            /* Skip loopback — tile uses 127.0.0.1; this is LAN display only */
            if (strncmp(ifa->ifa_name, "lo", 2) == 0) continue;

            s = getnameinfo(ifa->ifa_addr, sizeof(struct sockaddr_in),
                           ip_buf, buf_size, NULL, 0, NI_NUMERICHOST);
            if (s == 0) {
                freeifaddrs(ifaddr);
                return 0;
            }
        }
    }

    freeifaddrs(ifaddr);
    return -1;
}

int pldmgr_probe_http_loopback(unsigned short port) {
    int fd;
    struct sockaddr_in addr;
    struct timeval tv;
    char req[128];
    char buf[128];
    ssize_t n;
    int ok = 0;

    fd = socket(AF_INET, SOCK_STREAM, 0);
    if (fd < 0)
        return 0;

    tv.tv_sec = 1;
    tv.tv_usec = 0;
    (void)setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
    (void)setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

    memset(&addr, 0, sizeof(addr));
    addr.sin_family = AF_INET;
    addr.sin_port = htons(port);
    addr.sin_addr.s_addr = htonl(INADDR_LOOPBACK);

    if (connect(fd, (struct sockaddr *)&addr, sizeof(addr)) != 0) {
        close(fd);
        return 0;
    }

    snprintf(req, sizeof(req),
             "GET /version HTTP/1.0\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n");
    if (send(fd, req, strlen(req), 0) < 0) {
        close(fd);
        return 0;
    }

    n = recv(fd, buf, sizeof(buf) - 1, 0);
    if (n > 0) {
        buf[n] = '\0';
        /* Any HTTP response means the listen socket is alive for the tile. */
        if (strstr(buf, "HTTP/") != NULL || strstr(buf, "0.") != NULL)
            ok = 1;
    }

    close(fd);
    return ok;
}

void pldmgr_utils_get_payload_folder_name(const char *filename, char *out_buf, size_t out_size) {
    char clean[256];
    strncpy(clean, filename, sizeof(clean) - 1);
    clean[sizeof(clean) - 1] = '\0';

    /* Strip extension */
    char *dot = strrchr(clean, '.');
    if (dot) *dot = '\0';

    /* Look for version marker like _v1.2.3 or -v1.2.3 */
    char *v = strstr(clean, "_v");
    if (!v) v = strstr(clean, "-v");
    
    if (v) {
        *v = '\0';
    } else {
        /* Fallback: look for just _ or - followed by digit */
        for (int i = 0; clean[i]; i++) {
            if ((clean[i] == '_' || clean[i] == '-') && (clean[i+1] >= '0' && clean[i+1] <= '9')) {
                clean[i] = '\0';
                break;
            }
        }
    }

    /* Further clean: remove -ps4, -ps5 suffixes if they were before the version */
    char *p = strstr(clean, "-ps5");
    if (!p) p = strstr(clean, "_ps5");
    if (!p) p = strstr(clean, "-ps4");
    if (!p) p = strstr(clean, "_ps4");
    if (p) *p = '\0';

    strncpy(out_buf, clean, out_size - 1);
    out_buf[out_size - 1] = '\0';
}

void pldmgr_json_escape(const char *src, char *dst, size_t dst_size) {
    size_t pos = 0;
    if (dst_size == 0) {
        return;
    }

    for (size_t i = 0; src[i] != '\0' && pos + 1 < dst_size; i++) {
        unsigned char c = (unsigned char)src[i];
        if ((c == '"' || c == '\\') && pos + 2 < dst_size) {
            dst[pos++] = '\\';
            dst[pos++] = (char)c;
        } else if (c >= 0x20 && c <= 0x7E) {
            dst[pos++] = (char)c;
        }
    }

    dst[pos] = '\0';
}

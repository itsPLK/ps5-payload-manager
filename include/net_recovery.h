#ifndef NET_RECOVERY_H
#define NET_RECOVERY_H

/*
 * Pure HTTP recovery policy for Rest Mode / offline.
 * LAN IP is for display only — loopback tile (127.0.0.1:8084) must not
 * depend on WAN or a non-loopback address (upstream #61 / #40).
 */

#ifdef __cplusplus
extern "C" {
#endif

/**
 * Decide whether MHD (or any HTTP listen) should be restarted.
 *
 * @param resume_event     1 if console just resumed (SIGCONT / Rest Mode wake)
 * @param has_lan_ip       1 if a non-loopback IPv4 address is available
 * @param ip_changed       1 if LAN IP string changed since last known
 * @param loopback_ok      1 if local health probe to 127.0.0.1:port succeeded
 * @param daemon_alive     1 if daemon handle is non-NULL
 * @return 1 to restart listen, 0 to leave as-is
 */
int pldmgr_should_restart_http(int resume_event, int has_lan_ip, int ip_changed,
                               int loopback_ok, int daemon_alive);

#ifdef __cplusplus
}
#endif

#endif

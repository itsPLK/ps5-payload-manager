#ifndef NET_RECOVERY_H
#define NET_RECOVERY_H

/* Helpers for deciding when to rebind HTTP after Rest Mode / offline. */

#ifdef __cplusplus
extern "C" {
#endif

/* Returns 1 if the HTTP server should be restarted. */
int pldmgr_should_restart_http(int resume_event, int has_lan_ip, int ip_changed,
                               int loopback_ok, int daemon_alive);

#ifdef __cplusplus
}
#endif

#endif

#include "net_recovery.h"

int pldmgr_should_restart_http(int resume_event, int has_lan_ip, int ip_changed,
                               int loopback_ok, int daemon_alive) {
  (void)has_lan_ip; /* display/notify only — never gate the listen socket */

  /* Rest Mode wake: sockets are often half-dead even if process survives. */
  if (resume_event)
    return 1;

  /* Never leave a missing daemon. */
  if (!daemon_alive)
    return 1;

  /* Local tile uses 127.0.0.1 — if that fails, rebind regardless of WAN. */
  if (!loopback_ok)
    return 1;

  /* Optional: rebind when LAN IP appears/changes so remote clients work. */
  if (ip_changed)
    return 1;

  return 0;
}

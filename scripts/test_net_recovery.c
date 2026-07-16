/*
 * Host unit test for pldmgr_should_restart_http (real net_recovery.c).
 * Build: gcc -Iinclude -o test_net_recovery scripts/test_net_recovery.c src/net_recovery.c
 * Run:   ./test_net_recovery
 */
#include <stdio.h>
#include <stdlib.h>
#include "net_recovery.h"

static int fails = 0;

static void expect(int cond, const char *msg) {
  if (!cond) {
    fprintf(stderr, "FAIL: %s\n", msg);
    fails++;
  } else {
    printf("PASS: %s\n", msg);
  }
}

int main(void) {
  /* Offline, daemon up, loopback healthy → no restart */
  expect(pldmgr_should_restart_http(0, 0, 0, 1, 1) == 0,
         "offline + loopback OK + daemon → stay");

  /* Rest Mode resume → always restart (even if loopback probe still "ok") */
  expect(pldmgr_should_restart_http(1, 0, 0, 1, 1) == 1,
         "resume forces restart without LAN IP");

  /* Dead loopback (post-rest half-dead sockets) → restart without WAN */
  expect(pldmgr_should_restart_http(0, 0, 0, 0, 1) == 1,
         "loopback fail forces restart offline");

  /* Missing daemon → restart */
  expect(pldmgr_should_restart_http(0, 0, 0, 1, 0) == 1,
         "null daemon forces restart");

  /* LAN IP appears/changes → restart so remote clients work */
  expect(pldmgr_should_restart_http(0, 1, 1, 1, 1) == 1,
         "LAN IP change restarts");

  /* has_lan_ip alone without change/probe fail → no restart */
  expect(pldmgr_should_restart_http(0, 1, 0, 1, 1) == 0,
         "stable LAN + healthy loopback → stay");

  /* Cable unplug: no LAN, loopback still OK → stay (UI still works) */
  expect(pldmgr_should_restart_http(0, 0, 0, 1, 1) == 0,
         "LAN lost but loopback OK → stay (tile works)");

  if (fails) {
    fprintf(stderr, "%d failure(s)\n", fails);
    return 1;
  }
  printf("All net_recovery tests passed.\n");
  return 0;
}

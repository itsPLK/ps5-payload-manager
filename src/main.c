/*
 * Payload Manager Core - Main Entry Point
 *
 * This is a native PS5 ELF daemon that hosts a web server
 * to manage payloads and system settings.
 *
 * All HTTP routing lives in http_server.c.
 * This file handles: process init, signal setup, MHD lifecycle, and watchdog.
 */

#include <microhttpd.h>
#include <signal.h>
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/syscall.h>
#include <sys/sysctl.h>
#include <unistd.h>

#include "pldmgr.h"
#include "config.h"
#include "http_server.h"
#include "repository.h"
#include "ps5_launcher.h"
#include "app_installer.h"

#define DEFAULT_PORT MENU_PORT

/* Defined in http_server.c — set to 0 by /shutdown route */
extern volatile int http_keep_running;

static volatile sig_atomic_t resume_flag = 0;

static void handle_sigcont(int sig) { resume_flag = 1; }

static pid_t find_pid(const char *name) {
    int mib[4] = {1, 14, 8, 0};
    pid_t mypid = getpid();
    pid_t pid = -1;
    size_t buf_size;
    uint8_t *buf;

    if (sysctl(mib, 4, 0, &buf_size, 0, 0)) {
        pldmgr_log("[PLDMGR] sysctl failed\n");
        return -1;
    }

    if (!(buf = malloc(buf_size))) {
        pldmgr_log("[PLDMGR] malloc failed\n");
        return -1;
    }

    if (sysctl(mib, 4, buf, &buf_size, 0, 0)) {
        pldmgr_log("[PLDMGR] sysctl failed\n");
        free(buf);
        return -1;
    }

    for (uint8_t *ptr = buf; ptr < (buf + buf_size);) {
        int ki_structsize = *(int *)ptr;
        pid_t ki_pid = *(pid_t *)&ptr[72];
        char *ki_tdname = (char *)&ptr[447];

        ptr += ki_structsize;
        if (!strcmp(name, ki_tdname) && ki_pid != mypid) {
            pid = ki_pid;
        }
    }

    free(buf);
    return pid;
}

/* PS5 System Calls (Internal) */
extern int sceNetCtlInit();
extern int sceUserServiceInitialize(void *);

__attribute__((used)) volatile const char pldmgr_version_sig[] = "PLDMGR_VER:" MENU_VERSION;

int main(int argc, char *argv[]) {
    struct MHD_Daemon *daemon;
    unsigned short port = DEFAULT_PORT;
    pid_t pid;

    syscall(SYS_thr_set_name, -1, "pldmgr.elf");

    while ((pid = find_pid("pldmgr.elf")) > 0) {
        if (kill(pid, SIGKILL)) {
            pldmgr_log("[PLDMGR] kill failed\n");
            return EXIT_FAILURE;
        }
        sleep(1);
    }

    pldmgr_log("[PLDMGR] Starting Payload Manager v%s on port %d...\n",
               pldmgr_version_sig + 11, port);

    /* Check for Self-Update */
    char new_payload_path[512];
    if (repository_check_self_update(new_payload_path, sizeof(new_payload_path)) == 0) {
        pldmgr_log("[PLDMGR] Found updated payload manager at %s. Launching...\n",
                    new_payload_path);
        ps5_launch_elf(new_payload_path);
        return 0;
    }

    /* Initialize PS5 System Services */
    pldmgr_log("[PLDMGR] Initializing system services...\n");
    if (sceNetCtlInit() == 0) {
        pldmgr_log("[PLDMGR] Network Controller initialized.\n");
    }

    int user_prio = 256;
    if (sceUserServiceInitialize(&user_prio) == 0) {
        pldmgr_log("[PLDMGR] User Service initialized.\n");
    }

    /* Read startup config */
    PldmgrConfig cfg;
    config_read(&cfg);

    /* Install app if requested */
    if (cfg.auto_install_app) {
        pldmgr_install_app_if_needed();
    }

    /* Kill Disc Player if running (BD-JB host) and enabled in config */
    if (cfg.kill_disc_player) {
        ps5_kill_disc_player();
    }

    /* Signal Resilience */
    signal(SIGPIPE, SIG_IGN);
    signal(SIGHUP, SIG_IGN);
    signal(SIGTERM, SIG_IGN);
    signal(SIGCONT, handle_sigcont);

    /* Start the MHD daemon */
    daemon = MHD_start_daemon(MHD_USE_THREAD_PER_CONNECTION | MHD_USE_DEBUG, port,
                              NULL, NULL, &http_on_request, NULL, MHD_OPTION_END);

    if (NULL == daemon) {
        pldmgr_log("[PLDMGR] Failed to start HTTP daemon!\n");
        pldmgr_notify("Error: HTTP Server Failed\nPort 8084 may be busy");
        return 1;
    }

    pldmgr_log("[PLDMGR] Server is running. Visit /shutdown to exit.\n");

    /* Startup Notification - Only show if browser autostart is off */
    char current_ip[64] = "unknown";
    pldmgr_get_local_ip(current_ip, sizeof(current_ip));

    if (!cfg.auto_browser_open) {
        if (strcmp(current_ip, "unknown") != 0) {
            pldmgr_notify("Payload Manager v%s\nIP: %s\nPort: %d", MENU_VERSION,
                          current_ip, port);
        } else {
            pldmgr_notify("Payload Manager v%s\nWaiting for Network...", MENU_VERSION);
        }
    }

    /* Start Autoload Sequence (if config exists) before any network repo check */
    pldmgr_autoload_start();

    if (cfg.auto_browser_open) {
        char browser_url[128];
        snprintf(browser_url, sizeof(browser_url), "http://127.0.0.1:%d", port);
        ps5_launch_browser(browser_url);
    }

    /* Try cache refresh */
    repository_ensure_fresh(0);

    /* Watchdog and main loop */
    int network_check_timer = 0;
    while (http_keep_running) {
        usleep(100000); /* 100ms sleep */

        /* Immediate Wake-up Recovery */
        if (resume_flag) {
            resume_flag = 0;
            pldmgr_log("[PLDMGR] Console resumed from standby. Restarting "
                       "server...\n");
            pldmgr_autoload_reset();

            /* Force full server restart — the old socket is likely dead */
            if (daemon)
                MHD_stop_daemon(daemon);

            usleep(1000000); /* 1s for network stack to stabilize */

            daemon = MHD_start_daemon(MHD_USE_THREAD_PER_CONNECTION | MHD_USE_DEBUG,
                                      port, NULL, NULL, &http_on_request, NULL,
                                      MHD_OPTION_END);

            if (daemon) {
                /* Re-read current IP */
                if (pldmgr_get_local_ip(current_ip, sizeof(current_ip)) != 0)
                    strcpy(current_ip, "unknown");
                pldmgr_log("[PLDMGR] Server restarted after standby. IP: %s\n",
                           current_ip);
            } else {
                pldmgr_log("[PLDMGR] !!! Failed to restart server after standby!\n");
                pldmgr_notify("Payload Manager: Server restart failed after standby");
                strcpy(current_ip, "unknown");
            }

            /* Reset timer so we don't immediately re-check */
            network_check_timer = 0;
        }

        /* Network Watchdog (every 5 seconds) */
        if (++network_check_timer >= 50) {
            network_check_timer = 0;
            char new_ip[64] = "unknown";
            int has_ip = (pldmgr_get_local_ip(new_ip, sizeof(new_ip)) == 0);

            if (has_ip && (strcmp(new_ip, current_ip) != 0 ||
                           strcmp(current_ip, "unknown") == 0)) {
                pldmgr_log("[PLDMGR] Network state refresh: %s -> %s. Restarting "
                           "server...\n",
                           current_ip, new_ip);
                if (daemon)
                    MHD_stop_daemon(daemon);

                usleep(800000);

                daemon = MHD_start_daemon(MHD_USE_THREAD_PER_CONNECTION | MHD_USE_DEBUG,
                                          port, NULL, NULL, &http_on_request, NULL,
                                          MHD_OPTION_END);

                if (daemon) {
                    strcpy(current_ip, new_ip);
                    pldmgr_log("[PLDMGR] Server restored on %s:%d\n", current_ip, port);
                    pldmgr_notify("Payload Manager: Service Restored\nIP: %s", current_ip);
                } else {
                    pldmgr_log("[PLDMGR] !!! Failed to restore server!\n");
                }
            } else if (!has_ip && strcmp(current_ip, "unknown") != 0) {
                pldmgr_log("[PLDMGR] Network lost (was %s). Restarting server "
                           "for loopback...\n", current_ip);
                strcpy(current_ip, "unknown");

                /* Restart daemon to ensure clean socket for loopback */
                if (daemon)
                    MHD_stop_daemon(daemon);

                usleep(300000);

                daemon = MHD_start_daemon(
                    MHD_USE_THREAD_PER_CONNECTION | MHD_USE_DEBUG, port, NULL,
                    NULL, &http_on_request, NULL, MHD_OPTION_END);

                if (daemon) {
                    pldmgr_log("[PLDMGR] Server restarted after network loss "
                               "(loopback only)\n");
                } else {
                    pldmgr_log("[PLDMGR] !!! Failed to restart server after "
                               "network loss!\n");
                    pldmgr_notify("Payload Manager: Server restart failed");
                }
            }
        }
    }

    pldmgr_log("[PLDMGR] Shutting down...\n");
    if (daemon)
        MHD_stop_daemon(daemon);

    sleep(1);

    return 0;
}

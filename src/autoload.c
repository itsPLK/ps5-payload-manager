#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <strings.h>
#include <unistd.h>
#include <sys/stat.h>
#include <fcntl.h>
#include <sys/time.h>

static volatile long long countdown_end_time = 0;

long long get_current_time_ms() {
    struct timeval tv;
    gettimeofday(&tv, NULL);
    return (long long)(tv.tv_sec) * 1000 + (tv.tv_usec) / 1000;
}

#include "pldmgr.h"
#include "autoload.h"
#include "payload_mgr.h"
#include "ps5_launcher.h"

static volatile int abort_flag = 0;
static volatile int remaining_seconds = -1;
static volatile int is_executing = 0;
static pthread_t autoload_thread;

static char autoload_current_name[128] = "";
static int autoload_total_count = 0;
static int autoload_done_count = 0;
static int autoload_triggered = 0; // Starts at 0, becomes 1 when frontend connects

int pldmgr_autoload_get_remaining_seconds() {
    return remaining_seconds;
}

long long pldmgr_autoload_get_remaining_ms() {
    if (countdown_end_time == 0) return (long long)remaining_seconds * 1000;
    long long now = get_current_time_ms();
    if (now >= countdown_end_time) return 0;
    return countdown_end_time - now;
}

void pldmgr_autoload_get_status(int *total, int *done, char *current) {
    autoload_triggered = 1; // Signal that frontend is ready/active
    *total = autoload_total_count;
    *done = autoload_done_count;
    if (current) strcpy(current, autoload_current_name);
}

void* pldmgr_autoload_worker(void* arg) {
    struct stat st;
    int has_config = (stat(AUTOLOAD_CONFIG_PATH, &st) == 0);
    
    int enabled = 0;
    int browser_open = 1;
    int auto_delay = 5;

    FILE *ef = fopen(PLDMGR_CONFIG_PATH, "r");
    if (ef) {
        char line[128];
        while (fgets(line, sizeof(line), ef)) {
            if (strncmp(line, "AUTOLOAD_ENABLED=", 17) == 0) {
                enabled = atoi(line + 17);
            } else if (strncmp(line, "AUTO_BROWSER_OPEN=", 18) == 0) {
                browser_open = atoi(line + 18);
            } else if (strncmp(line, "AUTOLOAD_DELAY=", 15) == 0) {
                auto_delay = atoi(line + 15);
            }
        }
        fclose(ef);
    }

    if (!enabled || !has_config) return NULL;

    remaining_seconds = auto_delay;

    if (browser_open) {
        pldmgr_log("[Autoload] Browser Mode: Waiting for frontend connection...\n");
        /* Wait for trigger (frontend connect) or safety timeout (15s) */
        int wait_timeout = 50; // 50 * 100ms = 5 seconds
        while (!autoload_triggered && wait_timeout-- > 0) {
            if (abort_flag) return NULL;
            usleep(100000);
        }
        if (autoload_triggered) {
            pldmgr_log("[Autoload] Frontend connected. Starting countdown.\n");
        } else {
            pldmgr_log("[Autoload] Frontend timeout. Starting countdown anyway.\n");
        }
    }

    countdown_end_time = get_current_time_ms() + (long long)auto_delay * 1000;

    /* Perform countdown for the specified delay in all modes */
    if (auto_delay > 0) {
        int klog_fd = -1;
        
        /* Only fallback to on-screen notification and PS button if browser is NOT automatically opened */
        if (!browser_open) {
            if (!pldmgr_server_is_active()) {
                char ip[64];
                if (pldmgr_get_local_ip(ip, sizeof(ip)) != 0) strcpy(ip, "0.0.0.0");
                pldmgr_notify("Payload Manager Running\nhttp://%s:%d", ip, MENU_PORT);
                pldmgr_notify("Autoloading in %ds\nPress PS Button to Abort", auto_delay);
            }

            klog_fd = open("/dev/klog", O_RDONLY | O_NONBLOCK);
            if (klog_fd >= 0) {
                /* Flush existing log buffer so we only catch NEW button presses */
                char flush_buf[4096];
                while (read(klog_fd, flush_buf, sizeof(flush_buf)) > 0);
            }
            pldmgr_log("[Autoload] Fallback Mode: Starting %ds countdown (PS Button active)...\n", auto_delay);
        } else {
            pldmgr_log("[Autoload] Browser Mode: Starting %ds countdown...\n", auto_delay);
        }
        
        char klog_buf[2048];
        long long remaining_ms;
        while ((remaining_ms = countdown_end_time - get_current_time_ms()) > 0) {
            remaining_seconds = (int)((remaining_ms + 999) / 1000);
            if (abort_flag) {
                if (klog_fd >= 0) close(klog_fd);
                countdown_end_time = 0;
                remaining_seconds = -1;
                return NULL;
            }

            if (klog_fd >= 0) {
                ssize_t n = read(klog_fd, klog_buf, sizeof(klog_buf) - 1);
                if (n > 0) {
                    klog_buf[n] = 0;
                    if (strstr(klog_buf, "onPSButtonPressed")) {
                        pldmgr_log("[Autoload] ABORTED via PS Button.\n");
                        pldmgr_notify("Autoload Aborted");
                        abort_flag = 1;
                        close(klog_fd);
                        countdown_end_time = 0;
                        remaining_seconds = -1;
                        return NULL;
                    }
                }
            }
            usleep(100000); /* 100ms */
        }
        if (klog_fd >= 0) close(klog_fd);
    }
    countdown_end_time = 0;
    remaining_seconds = 0;
    is_executing = 1;
    
    FILE *f = fopen(AUTOLOAD_CONFIG_PATH, "r");
    if (!f) {
        pldmgr_log("[Autoload] !!! Failed to open %s\n", AUTOLOAD_CONFIG_PATH);
        remaining_seconds = -1;
        return NULL;
    }

    pldmgr_log("[Autoload] Starting sequence...\n");
    
    /* Count total first for UI */
    autoload_total_count = 0;
    autoload_done_count = 0;
    char count_line[256];
    while (fgets(count_line, sizeof(count_line), f)) {
        if (count_line[0] != '!' && strlen(count_line) > 1) autoload_total_count++;
    }
    rewind(f);
    
    char line[256];
    while (fgets(line, sizeof(line), f)) {
        line[strcspn(line, "\r\n")] = 0;
        if (strlen(line) == 0) continue;

        if (line[0] == '!') {
            int delay = atoi(line + 1);
            if (delay > 0) {
                pldmgr_log("[Autoload] Delaying for %d ms...\n", delay);
                usleep(delay * 1000);
            }
        } else {
            char full_path[512];
            if (payload_mgr_resolve_path(line, full_path, sizeof(full_path)) == 0) {
                strncpy(autoload_current_name, line, sizeof(autoload_current_name) - 1);
                pldmgr_log("[Autoload] Launching: %s\n", full_path);
                ps5_launch_elf(full_path);
                autoload_done_count++;
                if (strcasestr(line, "kstuff") != NULL) {
                    /* Allow kstuff to finish installing kernel traps and patching
                     * SceShellCore before subsequent payloads attach to it. */
                    usleep(3000000);
                } else {
                    usleep(500000); /* UI visibility */
                }
            } else {
                pldmgr_log("[Autoload] !!! Payload not found: %s\n", line);
            }
        }
    }

    fclose(f);
    pldmgr_log("[Autoload] Sequence complete.\n");
    strcpy(autoload_current_name, "DONE");
    remaining_seconds = 0;
    is_executing = 0;
    return NULL;
}

int pldmgr_autoload_start() {
    abort_flag = 0;
    is_executing = 0;
    if (pthread_create(&autoload_thread, NULL, pldmgr_autoload_worker, NULL) != 0) {
        pldmgr_log("[Autoload] !!! Failed to create background thread\n");
        return -1;
    }
    pthread_detach(autoload_thread);
    return 0;
}

void pldmgr_autoload_abort() {
    if (!is_executing) {
        abort_flag = 1;
    }
}

void pldmgr_autoload_reset() {
    /* If already counting down, don't reset to avoid jumps.
     * The browser launch often triggers a system 'resume' which would snap time back.
     * We only reset if the countdown has already finished or hasn't started. */
    if (countdown_end_time > 0 && remaining_seconds > 0) {
        pldmgr_log("[PLDMGR] Autoload reset ignored (timer active)\n");
        return;
    }

    pldmgr_log("[PLDMGR] Autoload reset triggered\n");
    remaining_seconds = -1;
    is_executing = 0;
    autoload_total_count = 0;
    autoload_done_count = 0;
    autoload_triggered = 0;
    strcpy(autoload_current_name, "");
}

void pldmgr_autoload_update_config_entry(const char *old_filename, const char *new_filename) {
    FILE *f = fopen(AUTOLOAD_CONFIG_PATH, "r");
    if (!f) return;

    char lines[100][256];
    int line_count = 0;
    int modified = 0;

    while (line_count < 100 && fgets(lines[line_count], sizeof(lines[0]), f)) {
        char clean_line[256];
        strcpy(clean_line, lines[line_count]);
        clean_line[strcspn(clean_line, "\r\n")] = 0;
        
        if (strcmp(clean_line, old_filename) == 0) {
            modified = 1;
            if (new_filename) {
                snprintf(lines[line_count], sizeof(lines[0]), "%s\n", new_filename);
                line_count++;
            }
            /* If new_filename is NULL, we just skip incrementing line_count, effectively deleting it */
        } else {
            line_count++;
        }
    }
    fclose(f);

    if (modified) {
        f = fopen(AUTOLOAD_CONFIG_PATH, "w");
        if (f) {
            for (int i = 0; i < line_count; i++) {
                fputs(lines[i], f);
            }
            fclose(f);
            pldmgr_log("[Autoload] Config updated: replaced/removed %s\n", old_filename);
        }
    }
}

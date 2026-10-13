#include "history_mgr.h"
#include "process_mgr.h"
#include "json_helpers.h"
#include "pldmgr.h"
#include <string.h>
#include <strings.h>
#include <stdio.h>

#define MAX_HISTORY_ITEMS 20
#define MAX_PATH_LEN 512

static char history[MAX_HISTORY_ITEMS][MAX_PATH_LEN];
static int history_count = 0;

static int matches_proc_name(const char *path, const char *proc_name) {
    const char *base = strrchr(path, '/');
    base = base ? base + 1 : path;
    if (strcasecmp(base, proc_name) == 0) {
        return 1;
    }
    const char *ext = strrchr(proc_name, '.');
    size_t stem_len = ext ? (size_t)(ext - proc_name) : strlen(proc_name);
    if (stem_len > 0 && strncasecmp(base, proc_name, stem_len) == 0) {
        char next = base[stem_len];
        if (next == '.' || next == '-' || next == '_') {
            return 1;
        }
    }
    return 0;
}

void history_mgr_add(const char *path) {
    if (!path || path[0] == '\0') return;

    /* Check if already in history */
    int existing_idx = -1;
    for (int i = 0; i < history_count; i++) {
        if (strcmp(history[i], path) == 0) {
            existing_idx = i;
            break;
        }
    }

    if (existing_idx != -1) {
        /* Move existing item to the front (index 0 is most recent) */
        char temp[MAX_PATH_LEN];
        strncpy(temp, history[existing_idx], MAX_PATH_LEN - 1);
        temp[MAX_PATH_LEN - 1] = '\0';
        
        for (int i = existing_idx; i > 0; i--) {
            strncpy(history[i], history[i-1], MAX_PATH_LEN - 1);
            history[i][MAX_PATH_LEN - 1] = '\0';
        }
        strncpy(history[0], temp, MAX_PATH_LEN - 1);
        history[0][MAX_PATH_LEN - 1] = '\0';
    } else {
        /* Shift everything down */
        int shift_end = history_count < MAX_HISTORY_ITEMS ? history_count : MAX_HISTORY_ITEMS - 1;
        for (int i = shift_end; i > 0; i--) {
            strncpy(history[i], history[i-1], MAX_PATH_LEN - 1);
            history[i][MAX_PATH_LEN - 1] = '\0';
        }
        /* Insert at front */
        strncpy(history[0], path, MAX_PATH_LEN - 1);
        history[0][MAX_PATH_LEN - 1] = '\0';
        if (history_count < MAX_HISTORY_ITEMS) {
            history_count++;
        }
    }
}

void history_mgr_remove_by_name(const char *proc_name) {
    if (!proc_name || proc_name[0] == '\0') return;

    int write_idx = 0;
    for (int i = 0; i < history_count; i++) {
        if (!matches_proc_name(history[i], proc_name)) {
            if (write_idx != i) {
                strncpy(history[write_idx], history[i], MAX_PATH_LEN - 1);
                history[write_idx][MAX_PATH_LEN - 1] = '\0';
            }
            write_idx++;
        }
    }
    history_count = write_idx;
}

size_t history_mgr_to_json(char *buf, size_t max_size) {
    process_sync_daemons_to_history();

    JsonListBuilder jb = { buf, max_size, 0, 1 };
    buf[0] = '\0';

    json_append(&jb, "{\"history\":[\n");

    for (int i = 0; i < history_count; i++) {
        char path_escaped[1024];
        pldmgr_json_escape(history[i], path_escaped, sizeof(path_escaped));
        json_append(&jb, "%s  \"%s\"", (i > 0) ? ",\n" : "", path_escaped);
    }

    json_append(&jb, "\n]}\n");
    return jb.pos;
}

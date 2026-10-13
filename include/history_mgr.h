#ifndef PLDMGR_HISTORY_MGR_H
#define PLDMGR_HISTORY_MGR_H

#include <stddef.h>

/* Adds a payload path to the history, moving it to the most recent spot if it already exists. */
void history_mgr_add(const char *path);

/* Removes any history entry matching a process name (e.g. "ftpsrv.elf" or "shadowmountplus.elf"). */
void history_mgr_remove_by_name(const char *proc_name);

/* Returns the history as a JSON string: {"history":["/path/to/payload.elf", ...]} */
size_t history_mgr_to_json(char *buf, size_t max_size);

#endif /* PLDMGR_HISTORY_MGR_H */

#ifndef PROCESS_MGR_H
#define PROCESS_MGR_H

#include <stddef.h>

/* Build a JSON list of all running processes.
 * Returns bytes written. */
size_t process_list_json(char *buf, size_t max_size);

/* Kill a process by PID. Returns 0 on success, -1 on failure. */
int process_kill(int pid);

/* Syncs active userland ELF daemons into launch history. */
void process_sync_daemons_to_history(void);

#endif

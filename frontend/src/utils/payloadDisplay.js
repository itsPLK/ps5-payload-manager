/* Name / version parsing for payload labels. */

export const parsePayloadName = (path) => {
  if (!path) return { displayName: '', version: null };
  if (path.startsWith('!')) {
    const ms = parseInt(path.substring(1));
    return { displayName: `Delay (${ms / 1000}s)`, version: null, isDelay: true };
  }

  let name = path.split('/').pop().replace(/\.(elf|bin|js)$/i, '');

  // Try to find version pattern like _v1.0 or -v1.0 or _1.0
  const versionMatch = name.match(/[_-](v?\d+[\d.a-z-]+)/i);
  let version = null;

  if (versionMatch) {
    version = versionMatch[1];
    name = name.replace(versionMatch[0], '');
  }

  return {
    displayName: name.replace(/_/g, ' ').replace(/-/g, ' '),
    version: version,
    isDelay: false
  };
};

/* Prefer version from the filename; fall back to sidecar/meta if present. */
export const resolvePayloadDisplay = (path, metaVersion = null) => {
  const parsed = parsePayloadName(path);
  if (parsed.isDelay) return parsed;

  const fromMeta =
    metaVersion != null && String(metaVersion).trim() !== ''
      ? String(metaVersion).trim()
      : null;

  return {
    displayName: parsed.displayName,
    version: parsed.version || fromMeta || null,
    isDelay: false,
    versionSource: parsed.version ? 'filename' : (fromMeta ? 'meta' : null),
  };
};

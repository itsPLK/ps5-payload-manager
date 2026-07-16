/**
 * Pure name/version helpers (no UI deps) — used by PayloadName and unit tests.
 */

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

/**
 * Resolve display name + version for installed payloads.
 * Filename-parsed version wins; otherwise use sidecar/meta.version (e.g. GH tag v0.4.0).
 */
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

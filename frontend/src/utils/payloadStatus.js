import { compareVersions, slug } from './versions.js';
import { isSystemPayload } from './helpers.js';

export const OFFICIAL_REPOSITORY_URL = 'https://itsplk.github.io/ps5-payloads-mirror/payloads_v2.json';
export const LEGACY_OFFICIAL_REPOSITORY_URL = 'https://itsplk.github.io/ps5-payloads-mirror/payloads.json';

export function isOfficialRepoUrl(url) {
  const norm = normalizeUrl(url);
  return norm === OFFICIAL_REPOSITORY_URL || norm === LEGACY_OFFICIAL_REPOSITORY_URL;
}

export function isOfficialSource(sourceName, sourceUrl) {
  if (sourceUrl && isOfficialRepoUrl(sourceUrl)) return true;
  if (!sourceName || typeof sourceName !== 'string') return false;
  const s = sourceName.trim().toLowerCase();
  return s === 'official repository' || isOfficialRepoUrl(s);
}

export function isOfficialSelfUpdate(payload, srcUrl) {
  return (payload?.id || slug(payload?.name || payload?.filename)) === 'pldmgr' &&
    isOfficialRepoUrl(srcUrl);
}

export function isRepositoryPayloadVisible(payload, srcUrl) {
  return isOfficialSelfUpdate(payload, srcUrl) ||
    ![payload?.id, payload?.name, payload?.filename].some(isSystemPayload);
}

/**
 * Moves payloads with an available update to the front of the list while
 * keeping the existing relative order of both groups (stable partition).
 */
export function pinUpdatesFirst(payloads = []) {
  const updates = [];
  const rest = [];
  for (const p of payloads) (p?.isUpdate ? updates : rest).push(p);
  return updates.concat(rest);
}

export function normalizeUrl(url) {
  if (!url || typeof url !== 'string') return '';
  return url.trim().replace(/\/+$/, '');
}

export function isGitHubUrl(url) {
  if (!url || typeof url !== 'string') return false;
  return /^https?:\/\/(?:www\.)?github\.com(\/|$)/i.test(url);
}

export function formatRepoNameFromUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  const stripped = trimmed
    .replace(/\/payloads\.json(\?.*)?$/i, '')
    .replace(/\.json(\?.*)?$/i, '')
    .replace(/\/+$/, '');

  // 1. GitHub raw URLs: https://raw.githubusercontent.com/<owner>/<repo>/...
  const ghRawMatch = stripped.match(/raw\.githubusercontent\.com\/([^/]+)\/([^/]+)/i);
  if (ghRawMatch) return `${ghRawMatch[1]}/${ghRawMatch[2]}`;

  // 2. GitHub repo URLs: https://github.com/<owner>/<repo>
  const ghMatch = stripped.match(/github\.com\/([^/]+)\/([^/]+)/i);
  if (ghMatch) return `${ghMatch[1]}/${ghMatch[2]}`;

  // 3. GitHub Pages: https://<owner>.github.io/<repo>
  const ghIoMatch = stripped.match(/([^/:]+)\.github\.io\/([^/]+)/i);
  if (ghIoMatch) return `${ghIoMatch[1]}/${ghIoMatch[2]}`;
  const ghIoBase = stripped.match(/([^/:]+)\.github\.io/i);
  if (ghIoBase) return ghIoBase[1];

  // 4. Cloudflare Pages: https://<name>.pages.dev
  const pagesDevMatch = stripped.match(/([^/:]+)\.pages\.dev/i);
  if (pagesDevMatch) return pagesDevMatch[1];

  try {
    const parsed = new URL(trimmed);
    const host = parsed.hostname.replace(/^www\./, '');
    const pathParts = parsed.pathname.split('/').filter((p) => p && !p.toLowerCase().endsWith('.json'));
    if (pathParts.length > 0) {
      return `${host}/${pathParts[0]}`;
    }
    return host;
  } catch {
    return trimmed;
  }
}

export function resolveSourceDisplayName(slot, sources = []) {
  if (!slot) return 'another repository';

  // 1. If slot already has a valid source_name (not a URL)
  if (slot.source_name && typeof slot.source_name === 'string') {
    const sName = slot.source_name.trim();
    if (sName && !sName.startsWith('http://') && !sName.startsWith('https://')) {
      return sName;
    }
  }

  // 2. Look up matching source by URL or id in sources list
  const normSlotUrl = normalizeUrl(slot.source_url || slot.source_name);
  if (Array.isArray(sources)) {
    const matched = sources.find((s) => {
      if (!s) return false;
      if (s.url && normalizeUrl(s.url) === normSlotUrl) return true;
      if (s.id && (s.id === slot.source_url || s.id === slot.source_name)) return true;
      return false;
    });
    if (matched && matched.name && typeof matched.name === 'string') {
      const mName = matched.name.trim();
      if (mName && !mName.startsWith('http://') && !mName.startsWith('https://')) {
        return mName;
      }
    }
  }

  // 3. Known official repo URL fallback
  if (
    normSlotUrl.includes('ps5-payloads-mirror') ||
    normSlotUrl.includes('ps5-payloads.pages.dev')
  ) {
    return 'Official Repository';
  }

  // 4. Extract clean repo name from URL
  const rawUrl = slot.source_url || (typeof slot.source_name === 'string' && slot.source_name.startsWith('http') ? slot.source_name : '');
  if (rawUrl) {
    const clean = formatRepoNameFromUrl(rawUrl);
    if (clean) return clean;
  }

  return (slot.source_name && !slot.source_name.startsWith('http')) ? slot.source_name : 'another repository';
}

/**
 * Computes status for a repository payload according to redesign spec §4:
 *
 * | Slot state | Card | Button |
 * |---|---|---|
 * | no slot (same id may exist from another source) | – (+ "Also installed from X" hint) | Install -> conflict dialog if conflict |
 * | repo newer | Update badge | Update |
 * | equal, checksum differs | Update badge | Update |
 * | equal | Installed | Reinstall |
 * | repo older | Installed | (none) |
 *
 * Local slots never show up on repo cards.
 */
export function getPayloadStatus({ payload, srcUrl, items = [], sources = [], multiSources = false, self = null }) {
  void multiSources;
  if (!payload) {
    return {
      status: 'not_installed',
      isInstalled: false,
      isUpdate: false,
      installedSlot: null,
      otherSlots: [],
      hasConflict: false,
      conflictSlot: null,
      alsoInstalledFrom: null,
      badge: null,
      buttonAction: null,
    };
  }

  if (isOfficialSelfUpdate(payload, srcUrl)) {
    const runningVersion = self?.running_version;
    const pendingVersion = self?.pending_version;
    const pending = Boolean(pendingVersion && runningVersion && compareVersions(pendingVersion, runningVersion) > 0);
    const version = pending ? pendingVersion : runningVersion;
    const isUpdate = Boolean(version && compareVersions(payload.version, version) > 0);
    return {
      status: isUpdate ? 'update' : 'installed',
      isInstalled: true,
      isUpdate,
      installedSlot: { id: 'pldmgr', version },
      otherSlots: [],
      hasConflict: false,
      conflictSlot: null,
      alsoInstalledFrom: null,
      badge: isUpdate ? 'update' : 'installed',
      buttonAction: isUpdate ? 'update' : null,
      restartRequired: pending,
    };
  }

  const targetId = payload.id || slug(payload.name || payload.filename);
  const normSrcUrl = normalizeUrl(srcUrl);

  const repoItems = Array.isArray(items)
    ? items.filter((item) => item && item.kind === 'repo')
    : [];

  const isOfficialSrc = isOfficialRepoUrl(normSrcUrl);
  const installedSlot =
    repoItems.find(
      (item) =>
        item.id === targetId &&
        (normalizeUrl(item.source_url) === normSrcUrl ||
         (isOfficialSrc && isOfficialRepoUrl(item.source_url)))
    ) || null;

  const otherSlots = repoItems.filter(
    (item) =>
      item.id === targetId &&
      normalizeUrl(item.source_url) !== normSrcUrl &&
      !(isOfficialSrc && isOfficialRepoUrl(item.source_url))
  );

  if (!installedSlot) {
    const conflictSlot = otherSlots.length > 0 ? otherSlots[0] : null;
    const alsoInstalledFrom = conflictSlot
      ? resolveSourceDisplayName(conflictSlot, sources)
      : null;

    return {
      status: 'not_installed',
      isInstalled: false,
      isUpdate: false,
      installedSlot: null,
      otherSlots,
      hasConflict: otherSlots.length > 0,
      conflictSlot,
      alsoInstalledFrom,
      badge: null,
      buttonAction: 'install',
    };
  }

  // Matching slot exists for this (source_url, id)
  const cmp = compareVersions(
    payload.version,
    installedSlot.version,
    payload.last_update,
    installedSlot.last_update
  );

  if (cmp > 0) {
    // Repo is newer
    return {
      status: 'update',
      isInstalled: false,
      isUpdate: true,
      installedSlot,
      otherSlots,
      hasConflict: false,
      conflictSlot: null,
      alsoInstalledFrom: null,
      badge: 'update',
      buttonAction: 'update',
    };
  }

  if (cmp === 0) {
    // Check if checksum differs
    const checksumDiffers = Boolean(
      payload.checksum &&
        installedSlot.checksum &&
        payload.checksum.trim().toLowerCase() !==
          installedSlot.checksum.trim().toLowerCase()
    );

    if (checksumDiffers) {
      return {
        status: 'update',
        isInstalled: false,
        isUpdate: true,
        installedSlot,
        otherSlots,
        hasConflict: false,
        conflictSlot: null,
        alsoInstalledFrom: null,
        badge: 'update',
        buttonAction: 'update',
      };
    }

    return {
      status: 'installed',
      isInstalled: true,
      isUpdate: false,
      installedSlot,
      otherSlots,
      hasConflict: false,
      conflictSlot: null,
      alsoInstalledFrom: null,
      badge: 'installed',
      buttonAction: 'reinstall',
    };
  }

  // cmp < 0: Repo is older than installed slot
  return {
    status: 'older',
    isInstalled: true,
    isUpdate: false,
    installedSlot,
    otherSlots,
    hasConflict: false,
    conflictSlot: null,
    alsoInstalledFrom: null,
    badge: 'installed',
    buttonAction: null,
  };
}

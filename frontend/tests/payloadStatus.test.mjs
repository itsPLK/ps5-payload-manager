import test from 'node:test';
import assert from 'node:assert/strict';
import { getPayloadStatus, formatRepoNameFromUrl, resolveSourceDisplayName, isGitHubUrl, isOfficialSource, pinUpdatesFirst } from '../src/utils/payloadStatus.js';

const OFFICIAL_URL = 'https://official.repo/payloads.json';
const OTHER_URL = 'https://other.repo/payloads.json';

test('getPayloadStatus: no slot, no conflict -> not_installed with Install button', () => {
  const payload = {
    id: 'kstuff-lite',
    name: 'kstuff-lite',
    version: '1.11',
    checksum: 'abc111',
  };
  const items = [];
  const status = getPayloadStatus({ payload, srcUrl: OFFICIAL_URL, items });

  assert.equal(status.status, 'not_installed');
  assert.equal(status.isInstalled, false);
  assert.equal(status.isUpdate, false);
  assert.equal(status.hasConflict, false);
  assert.equal(status.alsoInstalledFrom, null);
  assert.equal(status.badge, null);
  assert.equal(status.buttonAction, 'install');
});

test('getPayloadStatus: no slot, same id in another repo -> not_installed with conflict & alsoInstalledFrom', () => {
  const payload = {
    id: 'kstuff-lite',
    name: 'kstuff-lite',
    version: '1.11',
    checksum: 'abc111',
  };
  const items = [
    {
      kind: 'repo',
      slot: 'repo/kstuff-lite@99999999',
      id: 'kstuff-lite',
      source_url: OTHER_URL,
      source_name: 'Other Repository',
      version: '1.10',
    },
  ];
  const status = getPayloadStatus({ payload, srcUrl: OFFICIAL_URL, items });

  assert.equal(status.status, 'not_installed');
  assert.equal(status.isInstalled, false);
  assert.equal(status.isUpdate, false);
  assert.equal(status.hasConflict, true);
  assert.equal(status.alsoInstalledFrom, 'Other Repository');
  assert.equal(status.badge, null);
  assert.equal(status.buttonAction, 'install');
});

test('getPayloadStatus: local slots are completely ignored and do not match repo cards', () => {
  const payload = {
    id: 'ftpsrv',
    name: 'ftpsrv',
    version: '1.0',
  };
  const items = [
    {
      kind: 'local',
      slot: 'local/ftpsrv',
      filename: 'ftpsrv.elf',
      origin: 'web_upload',
    },
  ];
  const status = getPayloadStatus({ payload, srcUrl: OFFICIAL_URL, items });

  assert.equal(status.status, 'not_installed');
  assert.equal(status.isInstalled, false);
  assert.equal(status.hasConflict, false);
  assert.equal(status.buttonAction, 'install');
});

test('getPayloadStatus: repo newer -> update badge and Update button', () => {
  const payload = {
    id: 'kstuff-lite',
    name: 'kstuff-lite',
    version: '1.12',
    checksum: 'abc112',
  };
  const items = [
    {
      kind: 'repo',
      slot: 'repo/kstuff-lite@3fa91c0e',
      id: 'kstuff-lite',
      source_url: OFFICIAL_URL,
      source_name: 'Official Repository',
      version: '1.11',
      checksum: 'abc111',
    },
  ];
  const status = getPayloadStatus({ payload, srcUrl: OFFICIAL_URL, items });

  assert.equal(status.status, 'update');
  assert.equal(status.isInstalled, false);
  assert.equal(status.isUpdate, true);
  assert.equal(status.badge, 'update');
  assert.equal(status.buttonAction, 'update');
});

test('getPayloadStatus: equal version with differing checksum -> update badge and Update button', () => {
  const payload = {
    id: 'kstuff-lite',
    name: 'kstuff-lite',
    version: '1.11',
    checksum: 'newhash',
  };
  const items = [
    {
      kind: 'repo',
      slot: 'repo/kstuff-lite@3fa91c0e',
      id: 'kstuff-lite',
      source_url: OFFICIAL_URL,
      source_name: 'Official Repository',
      version: '1.11',
      checksum: 'oldhash',
    },
  ];
  const status = getPayloadStatus({ payload, srcUrl: OFFICIAL_URL, items });

  assert.equal(status.status, 'update');
  assert.equal(status.isUpdate, true);
  assert.equal(status.badge, 'update');
  assert.equal(status.buttonAction, 'update');
});

test('getPayloadStatus: equal version and checksum -> installed badge and Reinstall button', () => {
  const payload = {
    id: 'kstuff-lite',
    name: 'kstuff-lite',
    version: '1.11',
    checksum: 'samehash',
  };
  const items = [
    {
      kind: 'repo',
      slot: 'repo/kstuff-lite@3fa91c0e',
      id: 'kstuff-lite',
      source_url: OFFICIAL_URL,
      source_name: 'Official Repository',
      version: '1.11',
      checksum: 'samehash',
    },
  ];
  const status = getPayloadStatus({ payload, srcUrl: OFFICIAL_URL, items });

  assert.equal(status.status, 'installed');
  assert.equal(status.isInstalled, true);
  assert.equal(status.isUpdate, false);
  assert.equal(status.badge, 'installed');
  assert.equal(status.buttonAction, 'reinstall');
});

test('getPayloadStatus: repo older -> installed badge and no button', () => {
  const payload = {
    id: 'kstuff-lite',
    name: 'kstuff-lite',
    version: '1.10',
    checksum: 'oldhash',
  };
  const items = [
    {
      kind: 'repo',
      slot: 'repo/kstuff-lite@3fa91c0e',
      id: 'kstuff-lite',
      source_url: OFFICIAL_URL,
      source_name: 'Official Repository',
      version: '1.11',
      checksum: 'current',
    },
  ];
  const status = getPayloadStatus({ payload, srcUrl: OFFICIAL_URL, items });

  assert.equal(status.status, 'older');
  assert.equal(status.isInstalled, true);
  assert.equal(status.isUpdate, false);
  assert.equal(status.badge, 'installed');
  assert.equal(status.buttonAction, null);
});

test('formatRepoNameFromUrl formats various repository URLs correctly', () => {
  assert.equal(
    formatRepoNameFromUrl('https://raw.githubusercontent.com/Lightning-Mods/PS5-Payloads/main/payloads.json'),
    'Lightning-Mods/PS5-Payloads'
  );
  assert.equal(
    formatRepoNameFromUrl('https://github.com/itsplk/ps5-payloads-mirror/releases/latest/download/payloads.json'),
    'itsplk/ps5-payloads-mirror'
  );
  assert.equal(
    formatRepoNameFromUrl('https://itsplk.github.io/ps5-payloads-mirror/payloads.json'),
    'itsplk/ps5-payloads-mirror'
  );
  assert.equal(
    formatRepoNameFromUrl('https://ps5-payloads.pages.dev/payloads.json'),
    'ps5-payloads'
  );
  assert.equal(
    formatRepoNameFromUrl('https://example.com/custom-repo/payloads.json'),
    'example.com/custom-repo'
  );
});

test('resolveSourceDisplayName resolves friendly name from sources or URL', () => {
  const sources = [
    { id: 'default', name: 'Official Repository', url: 'https://itsplk.github.io/ps5-payloads-mirror/payloads.json' },
    { id: 'community', name: 'Community Hub', url: 'https://community.org/repo/payloads.json' },
  ];

  // 1. Existing friendly source_name takes precedence
  assert.equal(
    resolveSourceDisplayName({ source_url: 'https://other.com', source_name: 'Custom Repo' }, sources),
    'Custom Repo'
  );

  // 2. Looks up matching source in sources list
  assert.equal(
    resolveSourceDisplayName({ source_url: 'https://community.org/repo/payloads.json' }, sources),
    'Community Hub'
  );

  // 3. Fallback for official mirror URL
  assert.equal(
    resolveSourceDisplayName({ source_url: 'https://itsplk.github.io/ps5-payloads-mirror/payloads.json' }, []),
    'Official Repository'
  );

  // 4. Extracts clean name from URL when not in sources
  assert.equal(
    resolveSourceDisplayName({ source_url: 'https://raw.githubusercontent.com/Lightning-Mods/PS5-Payloads/main/payloads.json' }, []),
    'Lightning-Mods/PS5-Payloads'
  );
});

test('getPayloadStatus resolves alsoInstalledFrom using repo name instead of URL', () => {
  const payload = {
    id: 'etaHEN',
    name: 'etaHEN',
    version: '2.0b',
  };
  const items = [
    {
      kind: 'repo',
      slot: 'repo/etaHEN@12345678',
      id: 'etaHEN',
      source_url: 'https://raw.githubusercontent.com/Lightning-Mods/PS5-Payloads/main/payloads.json',
      source_name: '', // Empty or missing
      version: '1.9b',
    },
  ];
  const sources = [
    { id: 'official', name: 'Official Repository', url: OFFICIAL_URL },
    { id: 'lm', name: 'LightningMods Hub', url: 'https://raw.githubusercontent.com/Lightning-Mods/PS5-Payloads/main/payloads.json' },
  ];

  const status = getPayloadStatus({ payload, srcUrl: OFFICIAL_URL, items, sources });

  assert.equal(status.hasConflict, true);
  assert.equal(status.alsoInstalledFrom, 'LightningMods Hub');
  assert.notEqual(status.alsoInstalledFrom, 'https://raw.githubusercontent.com/Lightning-Mods/PS5-Payloads/main/payloads.json');
});

test('isGitHubUrl accurately identifies GitHub repo URLs vs third party URLs', () => {
  assert.equal(isGitHubUrl('https://github.com/itsPLK/ps5-payload-manager'), true);
  assert.equal(isGitHubUrl('http://github.com/Lightning-Mods/PS5-Payloads'), true);
  assert.equal(isGitHubUrl('https://www.github.com/user/repo'), true);
  assert.equal(isGitHubUrl('https://gitlab.com/user/repo'), false);
  assert.equal(isGitHubUrl('https://codeberg.org/user/repo'), false);
  assert.equal(isGitHubUrl('https://my-custom-site.com/payloads'), false);
  assert.equal(isGitHubUrl(''), false);
  assert.equal(isGitHubUrl(null), false);
  assert.equal(isGitHubUrl(undefined), false);
});

test('self-update is always installed, only newer versions offer an update, and pending versions suppress it', () => {
  const srcUrl = 'https://itsplk.github.io/ps5-payloads-mirror/payloads.json/';
  const payload = { id: 'pldmgr', version: 'v0.6.0', checksum: 'new' };
  const self = { running_version: '0.5.2', pending_version: '' };
  const items = [{ kind: 'repo', id: 'pldmgr', source_url: OTHER_URL, version: '0.5.1' }];
  const status = getPayloadStatus({ payload, srcUrl, self, items });
  assert.equal(status.isInstalled, true);
  assert.equal(status.buttonAction, 'update');
  assert.equal(status.hasConflict, false);
  for (const version of ['v0.5.2', '0.5.1']) {
    assert.equal(getPayloadStatus({ payload: { ...payload, version }, srcUrl, self }).buttonAction, null);
  }
  const pending = getPayloadStatus({ payload, srcUrl, self: { ...self, pending_version: '0.6.0' } });
  assert.equal(pending.buttonAction, null);
  assert.equal(pending.restartRequired, true);
  assert.equal(pending.installedSlot.version, '0.6.0');
  assert.equal(getPayloadStatus({ payload, srcUrl }).buttonAction, null);
});

test('isOfficialSource accurately identifies official repo names and urls', () => {
  assert.equal(isOfficialSource('Official Repository'), true);
  assert.equal(isOfficialSource('official repository'), true);
  assert.equal(isOfficialSource(null, 'https://itsplk.github.io/ps5-payloads-mirror/payloads_v2.json'), true);
  assert.equal(isOfficialSource(null, 'https://itsplk.github.io/ps5-payloads-mirror/payloads.json'), true);
  assert.equal(isOfficialSource(null, 'https://itsplk.github.io/ps5-payloads-mirror/payloads.json/'), true);
  assert.equal(isOfficialSource('My Custom Source', 'https://example.com/payloads.json'), false);
  assert.equal(isOfficialSource('Other Repository'), false);
  assert.equal(isOfficialSource(null, null), false);
});

test('pinUpdatesFirst moves updates to the front and keeps relative order', () => {
  const list = [
    { id: 'a' },
    { id: 'b', isUpdate: true },
    { id: 'c' },
    { id: 'd', isUpdate: true },
    { id: 'e', isUpdate: false },
  ];
  assert.deepEqual(pinUpdatesFirst(list).map((p) => p.id), ['b', 'd', 'a', 'c', 'e']);
  assert.deepEqual(list.map((p) => p.id), ['a', 'b', 'c', 'd', 'e'], 'input is not mutated');
  assert.deepEqual(pinUpdatesFirst([]), []);
  assert.deepEqual(pinUpdatesFirst(), []);
});

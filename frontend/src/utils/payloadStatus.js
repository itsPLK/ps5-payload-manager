const getVersionFromFilename = (filename) => {
  const name = (filename || '').replace(/\.(elf|bin)$/i, '')
  const match = name.match(/[_-](v?\d+[\d.a-z-]+)/i)
  return match ? match[1] : ''
}

export const getPayloadBaseName = (filename) => {
  let clean = (filename || '').replace(/\.(elf|bin)$/i, '')
  const versionMatch = clean.match(/[_-]v?(\d+[\d.a-z-]+)/i)
  if (versionMatch) clean = clean.replace(versionMatch[0], '')
  return clean.replace(/[_-]ps[45]$/i, '')
}

export const getPayloadVersion = (payload) => {
  const version = payload?.version?.trim()
  return version || getVersionFromFilename(payload?.filename)
}

const normalizeVersion = (version) => version.trim().replace(/^v/i, '').toLowerCase()

const hasMatchingVersion = (remoteVersion, installedVersion) => (
  remoteVersion && installedVersion &&
  normalizeVersion(remoteVersion) === normalizeVersion(installedVersion)
)

const normalizeRepositoryUrl = (value) => (
  (value || '').trim().replace(/\/+$/, '')
)

const normalizeRepositoryIdentity = (value) => (
  (value || '').trim().replace(/\/+$/, '').toLowerCase()
)

const getSourceUrl = (payload) => (
  payload?.sourceUrl || payload?.source_url ||
  ((payload?.installSource || payload?.install_source) === 'repository'
    ? (payload?.installSourceDetail || payload?.install_source_detail)
    : '')
)

const getSourceId = (payload) => payload?.sourceId || payload?.source_id || payload?.source || ''

const getSourceName = (payload) => (
  payload?.sourceName || payload?.source_name || payload?.source_direct || ''
)

const isSameRepository = (remotePayload, installedPayload) => {
  if ((installedPayload.installSource || installedPayload.install_source) === 'usb') return false

  const remoteUrl = normalizeRepositoryUrl(getSourceUrl(remotePayload))
  const installedUrl = normalizeRepositoryUrl(getSourceUrl(installedPayload))
  if (remoteUrl && installedUrl) return remoteUrl === installedUrl

  const remoteId = normalizeRepositoryIdentity(getSourceId(remotePayload))
  const installedId = normalizeRepositoryIdentity(getSourceId(installedPayload))
  if (remoteId && installedId) return remoteId === installedId

  const remoteName = normalizeRepositoryIdentity(getSourceName(remotePayload))
  const installedName = normalizeRepositoryIdentity(getSourceName(installedPayload))
  if (remoteName && installedName) return remoteName === installedName

  return true
}

export const isUsbPayloadPath = (path) => path.includes('/mnt/usb')

export const getInstalledPayloads = (payloadPaths = [], payloadMeta = {}) => (
  payloadPaths
    .filter((path) => !isUsbPayloadPath(path))
    .map((path) => {
      const filename = path.split('/').pop()
      const metadata = payloadMeta[filename] || {}

      return {
        filename,
        version: metadata.version || getPayloadVersion({ filename }),
        sourceId: metadata.source || '',
        sourceName: metadata.source_name || metadata.source_direct || '',
        sourceUrl: metadata.install_source === 'repository'
          ? metadata.install_source_detail || ''
          : '',
        installSource: metadata.install_source || ''
      }
    })
)

export const getPayloadStatus = (remotePayload, installedPayloads) => {
  const repositoryPayloads = installedPayloads.filter((installedPayload) => (
    isSameRepository(remotePayload, installedPayload)
  ))
  const exactMatch = repositoryPayloads.find(({ filename }) => filename === remotePayload.filename)
  const baseName = getPayloadBaseName(remotePayload.filename)
  const baseMatch = repositoryPayloads.find(({ filename }) => getPayloadBaseName(filename) === baseName)
  const remoteVersion = getPayloadVersion(remotePayload)
  const versionMatch = repositoryPayloads.find((installedPayload) => (
    getPayloadBaseName(installedPayload.filename) === baseName &&
    hasMatchingVersion(remoteVersion, getPayloadVersion(installedPayload))
  ))
  const exactMatchHasDifferentVersion = exactMatch && remoteVersion &&
    getPayloadVersion(exactMatch) &&
    !hasMatchingVersion(remoteVersion, getPayloadVersion(exactMatch))
  const isInstalled = Boolean(versionMatch || (exactMatch && !exactMatchHasDifferentVersion))

  return {
    ...remotePayload,
    isInstalled,
    isUpdate: !isInstalled && Boolean(baseMatch),
    installedFilename: (exactMatch || versionMatch || baseMatch)?.filename
  }
}

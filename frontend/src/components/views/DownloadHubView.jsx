import React, { useEffect, useMemo, useState } from 'react'
import {
  CloudDownload, Plus, Trash2, RefreshCw, Loader2, Package,
  ChevronRight, AlertTriangle, HardDrive
} from 'lucide-react'
import { cn, isPS5 } from '../../utils/helpers'

function formatSize(n) {
  const v = Number(n) || 0
  if (v < 1024) return `${v} B`
  if (v < 1024 * 1024) return `${(v / 1024).toFixed(1)} KB`
  return `${(v / (1024 * 1024)).toFixed(2)} MB`
}

const DownloadHubView = ({ addToast, showConfirm, localPayloads = [], onInstalled }) => {
  const [repos, setRepos] = useState([])
  const [selected, setSelected] = useState('')
  const [releases, setReleases] = useState([])
  const [selectedTag, setSelectedTag] = useState('')
  const [loadingRepos, setLoadingRepos] = useState(true)
  const [loadingReleases, setLoadingReleases] = useState(false)
  const [installing, setInstalling] = useState('')
  const [error, setError] = useState('')
  const [cached, setCached] = useState(false)
  const [newRepo, setNewRepo] = useState('')
  const [adding, setAdding] = useState(false)
  const [showAdd, setShowAdd] = useState(false)

  const localNames = useMemo(
    () => (localPayloads || []).map(p => String(p).split('/').pop()),
    [localPayloads]
  )

  const loadRepos = async () => {
    setLoadingRepos(true)
    try {
      const res = await fetch('/github_repos_list')
      const data = await res.json()
      const list = data?.repos || []
      setRepos(list)
      if (!selected && list.length) setSelected(list[0])
      if (selected && !list.includes(selected) && list.length) setSelected(list[0])
    } catch {
      setError('Could not load repo list')
    } finally {
      setLoadingRepos(false)
    }
  }

  const loadReleases = async (repo, force = false) => {
    if (!repo) return
    setLoadingReleases(true)
    setError('')
    setReleases([])
    setSelectedTag('')
    try {
      const url = `/github_releases?repo=${encodeURIComponent(repo)}${force ? '&refresh=1' : ''}`
      const res = await fetch(url)
      const data = await res.json()
      if (!data?.ok) {
        setError(data?.message || 'Failed to load releases')
        return
      }
      setReleases(data.releases || [])
      setCached(!!data.cached)
      if (data.releases?.length) setSelectedTag(data.releases[0].tag)
    } catch {
      setError('Network error loading releases')
    } finally {
      setLoadingReleases(false)
    }
  }

  useEffect(() => { loadRepos() }, [])

  useEffect(() => {
    if (selected) loadReleases(selected, false)
  }, [selected])

  const activeRelease = useMemo(
    () => releases.find(r => r.tag === selectedTag) || null,
    [releases, selectedTag]
  )

  const handleAdd = async (e) => {
    e?.preventDefault?.()
    const value = newRepo.trim()
    if (!value) return
    setAdding(true)
    try {
      const res = await fetch(`/github_repos_add?repo=${encodeURIComponent(value)}`)
      const data = await res.json()
      if (data.ok) {
        addToast(`Added ${data.repo}`)
        setNewRepo('')
        setShowAdd(false)
        await loadRepos()
        setSelected(data.repo)
      } else {
        addToast(data.message || 'Add failed', 'error')
      }
    } catch {
      addToast('Add failed', 'error')
    }
    setAdding(false)
  }

  const handleRemove = (repo) => {
    showConfirm('Remove repo', `Remove ${repo} from the list?`, async () => {
      try {
        const res = await fetch(`/github_repos_remove?repo=${encodeURIComponent(repo)}`)
        const data = await res.json()
        if (data.ok) {
          addToast('Removed')
          if (selected === repo) setSelected('')
          await loadRepos()
        } else {
          addToast(data.message || 'Remove failed', 'error')
        }
      } catch {
        addToast('Remove failed', 'error')
      }
    })
  }

  const handleInstall = async (asset) => {
    if (!selected || !selectedTag || !asset?.name) return
    const already = localNames.includes(asset.name)
    const go = async () => {
      setInstalling(asset.name)
      try {
        const qs = new URLSearchParams({
          repo: selected,
          tag: selectedTag,
          asset: asset.name
        })
        const res = await fetch(`/github_install?${qs.toString()}`)
        const data = await res.json()
        if (data.ok) {
          addToast(data.message || `Installed ${asset.name}`)
          onInstalled?.()
        } else {
          addToast(data.message || 'Install failed', 'error')
        }
      } catch {
        addToast('Install failed', 'error')
      }
      setInstalling('')
    }

    if (already) {
      showConfirm(
        'Replace file',
        `${asset.name} is already installed. Replace it with ${selected}@${selectedTag}?`,
        go
      )
    } else {
      go()
    }
  }

  return (
    <div className="space-y-8 pb-16">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">
            Download <span className="text-ps-blue">Hub</span>
          </h2>
          <p className="text-zinc-500 mt-2 text-sm md:text-base max-w-2xl">
            Pick a GitHub repo, choose a release version, then install the .elf / .bin you want.
          </p>
        </div>
        <button
          onClick={() => selected && loadReleases(selected, true)}
          disabled={!selected || loadingReleases}
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-white/5 border border-white/10 hover:border-ps-blue/40 font-bold disabled:opacity-40"
        >
          <RefreshCw className={cn('w-4 h-4', loadingReleases && 'animate-spin')} />
          Refresh
        </button>
      </div>

      <div className={cn(
        'grid gap-6',
        isPS5 ? 'grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]' : 'grid-cols-1 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.4fr)]'
      )}>
        {/* Repo list */}
        <section className="glass-card rounded-ps-3xl border border-white/10 overflow-hidden flex flex-col min-h-[420px]">
          <div className="px-5 py-4 border-b border-white/10 flex items-center justify-between">
            <h3 className="font-bold text-white uppercase tracking-widest text-sm">Repos</h3>
            <button
              onClick={() => setShowAdd(v => !v)}
              className="p-2 rounded-xl bg-ps-blue/20 text-ps-blue hover:bg-ps-blue hover:text-white transition-all"
              title="Add repo"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>

          {showAdd && (
            <form onSubmit={handleAdd} className="p-4 border-b border-white/10 space-y-3 bg-black/20">
              <input
                value={newRepo}
                onChange={e => setNewRepo(e.target.value)}
                placeholder="owner/repo or github.com/owner/repo"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-ps-blue/50"
                disabled={adding}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={adding || !newRepo.trim()}
                  className="flex-1 py-3 rounded-xl bg-ps-blue font-bold disabled:opacity-50"
                >
                  {adding ? 'Adding…' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setNewRepo('') }}
                  className="px-4 py-3 rounded-xl bg-white/5 font-bold"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}

          <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
            {loadingRepos ? (
              <div className="flex justify-center py-16">
                <Loader2 className="w-8 h-8 animate-spin text-ps-blue" />
              </div>
            ) : repos.length === 0 ? (
              <p className="text-zinc-500 text-center py-12 text-sm">No repos yet. Add one.</p>
            ) : (
              repos.map(repo => (
                <div
                  key={repo}
                  className={cn(
                    'group flex items-center gap-2 rounded-2xl border transition-all',
                    selected === repo
                      ? 'bg-ps-blue/15 border-ps-blue/40'
                      : 'border-transparent hover:bg-white/5 hover:border-white/10'
                  )}
                >
                  <button
                    onClick={() => setSelected(repo)}
                    className="flex-1 text-left px-4 py-4 min-w-0"
                  >
                    <p className="font-bold text-white truncate">{repo.split('/')[1] || repo}</p>
                    <p className="text-xs text-zinc-500 font-mono truncate">{repo}</p>
                  </button>
                  <button
                    onClick={() => handleRemove(repo)}
                    className="p-3 mr-2 rounded-xl text-zinc-600 hover:text-red-400 hover:bg-red-500/10 opacity-70 group-hover:opacity-100"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Release + assets */}
        <section className="glass-card rounded-ps-3xl border border-white/10 overflow-hidden flex flex-col min-h-[420px]">
          <div className="px-5 py-4 border-b border-white/10 flex flex-col md:flex-row md:items-center gap-3 md:justify-between">
            <div className="min-w-0">
              <h3 className="font-bold text-white text-lg truncate">
                {selected || 'Select a repository'}
              </h3>
              {cached && (
                <p className="text-[11px] text-zinc-500 uppercase tracking-widest mt-1">Cached (1h)</p>
              )}
            </div>
            {releases.length > 0 && (
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-zinc-500 font-bold uppercase tracking-widest">Version</span>
                <select
                  value={selectedTag}
                  onChange={e => setSelectedTag(e.target.value)}
                  className="bg-black/40 border border-white/10 rounded-xl px-4 py-2.5 text-white font-bold min-w-[140px] focus:outline-none focus:border-ps-blue/50"
                >
                  {releases.map(r => (
                    <option key={r.tag} value={r.tag}>{r.tag}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-5 space-y-5">
            {!selected && (
              <div className="text-center py-20 text-zinc-500">
                <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
                Choose a repo on the left
              </div>
            )}

            {selected && loadingReleases && (
              <div className="flex flex-col items-center py-20 gap-4">
                <Loader2 className="w-10 h-10 animate-spin text-ps-blue" />
                <p className="text-zinc-500">Loading releases…</p>
              </div>
            )}

            {error && !loadingReleases && (
              <div className="flex items-start gap-3 p-4 rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300">
                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-2 min-w-0">
                  <p className="text-sm leading-relaxed">{error}</p>
                  <button
                    onClick={() => loadReleases(selected, true)}
                    className="text-sm font-bold text-white underline"
                  >
                    Retry
                  </button>
                </div>
              </div>
            )}

            {activeRelease && !loadingReleases && (
              <>
                <div className="space-y-2">
                  <p className="text-white font-bold text-xl">{activeRelease.name || activeRelease.tag}</p>
                  {activeRelease.published_at && (
                    <p className="text-xs text-zinc-500">
                      {new Date(activeRelease.published_at).toLocaleString()}
                    </p>
                  )}
                  {activeRelease.body && (
                    <pre className="text-sm text-zinc-400 whitespace-pre-wrap font-sans bg-black/20 border border-white/5 rounded-2xl p-4 max-h-40 overflow-y-auto custom-scrollbar">
                      {activeRelease.body}
                    </pre>
                  )}
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                    Assets (.elf / .bin / .js)
                  </h4>
                  {!activeRelease.assets?.length ? (
                    <p className="text-zinc-500 text-sm py-6 text-center border border-dashed border-white/10 rounded-2xl">
                      No payload assets in this release
                    </p>
                  ) : (
                    activeRelease.assets.map(asset => {
                      const installed = localNames.includes(asset.name)
                      const busy = installing === asset.name
                      return (
                        <div
                          key={asset.name}
                          className="flex flex-col sm:flex-row sm:items-center gap-3 p-4 rounded-2xl border border-white/10 bg-white/[0.02] hover:border-ps-blue/30"
                        >
                          <div className="flex items-start gap-3 min-w-0 flex-1">
                            <div className="p-2.5 rounded-xl bg-white/5 shrink-0">
                              <HardDrive className="w-5 h-5 text-ps-blue" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-bold text-white truncate">{asset.name}</p>
                              <p className="text-xs text-zinc-500 mt-0.5">
                                {formatSize(asset.size)}
                                {installed ? ' · installed' : ''}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleInstall(asset)}
                            disabled={!!installing}
                            className={cn(
                              'inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold transition-all shrink-0 disabled:opacity-50',
                              installed
                                ? 'bg-emerald-700 hover:bg-emerald-600 text-white'
                                : 'bg-ps-blue hover:bg-ps-blue/80 text-white'
                            )}
                          >
                            {busy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CloudDownload className="w-4 h-4" />
                            )}
                            <span>{busy ? 'Installing…' : installed ? 'Reinstall' : 'Install'}</span>
                            {!isPS5 && <ChevronRight className="w-4 h-4 opacity-60" />}
                          </button>
                        </div>
                      )
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default DownloadHubView

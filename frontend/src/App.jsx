import React, { useState, useEffect, useRef } from 'react'
import {
  Settings,
  CloudDownload,
  Cpu,
  LayoutDashboard,
  Database,
  RefreshCw,
  Package,
  Heart,
  Menu,
  Terminal,
  X
} from 'lucide-react'
import { useTranslation } from 'react-i18next'

import './App.css'

// Utilities
import { cn, isPS5, isSystemPayload } from './utils/helpers'

// UI Components
import Toast from './components/ui/Toast'
import Modal from './components/ui/Modal'
import NavButton from './components/ui/NavButton'
import PayloadButton from './components/ui/PayloadButton'
import LogoIcon from './components/ui/LogoIcon'
import Atmosphere from './components/ui/Atmosphere'
import HudBar from './components/ui/HudBar'
import { useTheme } from './theme/ThemeContext'

// Views
import StorageHub from './components/views/StorageHub'
import AutoloadView from './components/views/AutoloadView'
import SettingsView from './components/views/SettingsView'
import DonateView from './components/views/DonateView'
import AutoloadOverlay from './components/views/AutoloadOverlay'
import MoveFromUsbView from './components/views/MoveFromUsbView'
import LogViewer from './components/views/LogViewer'
import ManageSourcesView from './components/views/ManageSourcesView'
import ActiveProcessesView from './components/views/ActiveProcessesView'

function App() {
  const { t } = useTranslation()
  const { themeId } = useTheme()
  const isCyberpunk = themeId === 'cyberpunk'
  const [view, setView] = useState('dashboard')
  const mainRef = useRef(null)

  useEffect(() => {
    if (mainRef.current) {
      mainRef.current.scrollTop = 0
    }
    window.scrollTo(0, 0)
  }, [view])

  const [sidebarExpanded, setSidebarExpanded] = useState(() => {
    const saved = localStorage.getItem('sidebarExpanded')
    return saved !== null ? JSON.parse(saved) : true
  })

  useEffect(() => {
    localStorage.setItem('sidebarExpanded', JSON.stringify(sidebarExpanded))
  }, [sidebarExpanded])
  const [autoloadStatus, setAutoloadStatus] = useState(null)
  const [logs, setLogs] = useState([])
  const [payloads, setPayloads] = useState([])
  const [config, setConfig] = useState({})
  const [ip, setIp] = useState('0.0.0.0')
  const [version, setVersion] = useState('Loading...')
  const [loading, setLoading] = useState(false)
  const [activeLoadingName, setActiveLoadingName] = useState('')
  const [toasts, setToasts] = useState([])
  const [loadingPayloads, setLoadingPayloads] = useState(true)
  const [downloadModal, setDownloadModal] = useState({ show: false, name: '', progress: 0 })
  const [confirmModal, setConfirmModal] = useState({ show: false, title: '', message: '', onConfirm: null })
  const [moveFromUsbPath, setMoveFromUsbPath] = useState(null)
  const [storageScrollTarget, setStorageScrollTarget] = useState(null)
  const [showLogs, setShowLogs] = useState(false)
  // Map filename -> metadata (source_name, etc.)
  const [payloadMeta, setPayloadMeta] = useState({})

  useEffect(() => {
    if (!showLogs) return
    const eventSource = new EventSource('/events')
    eventSource.onmessage = (e) => {
      setLogs(prev => [...prev, e.data].slice(-200))
    }
    return () => eventSource.close()
  }, [showLogs])
  const [isOffline, setIsOffline] = useState(false)




  const showConfirm = (title, message, onConfirm) => {
    setConfirmModal({
      show: true,
      title,
      message,
      onConfirm: () => {
        setConfirmModal({ show: false })
        onConfirm()
      }
    })
  }

  const addToast = (message, type = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }

  const api = async (endpoint, options = {}) => {
    try {
      const response = await fetch(endpoint, options)
      if (options.method === 'POST') return response.text()
      try {
        const text = await response.text()
        if (text.toLowerCase().includes('<!doctype')) return null
        return JSON.parse(text)
      } catch (e) { return null }
    } catch (e) { return null }
  }

  const refreshPayloads = async (retryCount = 0) => {
    setLoadingPayloads(true)
    const data = await api('/list_payloads')
    if (data?.payloads) {
      const sorted = [...data.payloads].sort((a, b) => {
        const aIsUsb = a.startsWith('/mnt/usb')
        const bIsUsb = b.startsWith('/mnt/usb')
        if (aIsUsb && !bIsUsb) return 1
        if (!aIsUsb && bIsUsb) return -1
        return a.localeCompare(b)
      })
      setPayloads(sorted)
      // Build metadata map: filename -> meta object
      if (data.meta && typeof data.meta === 'object') {
        setPayloadMeta(data.meta)
      }
      setLoadingPayloads(false)
    } else if (retryCount < 5) {
      setTimeout(() => refreshPayloads(retryCount + 1), 1000)
    } else {
      setLoadingPayloads(false)
    }
  }

  const refreshConfig = async () => {
    const data = await api('/get_config')
    if (data) setConfig(data)
  }

  const handleAbort = async () => {
    await fetch('/abort').catch(() => { })
    setAutoloadStatus(prev => prev ? { ...prev, remaining: -1 } : null)
    addToast(t("app.toasts.sequence_aborted", "Sequence Aborted"), "error")
  }

  const handleFinish = async () => {
    await fetch('/autoload_clear').catch(() => { })
    setAutoloadStatus(null)
    window.location.reload()
  }

  const loadPayload = async (path) => {
    const name = path.split('/').pop().replace(/\.(elf|bin)$/i, '').replace(/_/g, ' ')
    setLoading(true)
    setActiveLoadingName(name)
    try {
      const safePath = encodeURI(path)
      const res = await fetch(`/loadpayload:${safePath}`)
      if (!res.ok) throw new Error(`${t("app.toasts.launch_failed", "Launch failed")} (${res.status})`)
      addToast(t("app.toasts.payload_launched", "{{name}} launched", { name }))
    } catch (e) { addToast(e.message || t("app.toasts.launch_failed", "Launch failed"), "error") }
    setTimeout(() => {
      setLoading(false)
      setActiveLoadingName('')
    }, 1500)
  }

  const handleDelete = (fileName) => {
    showConfirm(
      t("app.modals.delete_payload.title", "Delete Payload"),
      t("app.modals.delete_payload.message", "Are you sure you want to remove {{fileName}}?", { fileName }),
      async () => {
        const res = await fetch(`/manage:delete?filename=${encodeURIComponent(fileName)}`)
        if (!res.ok) {
          addToast(`Delete failed (${res.status})`, 'error')
          return
        }
        refreshPayloads()
        addToast(t("app.toasts.payload_removed", "{{fileName}} removed", { fileName }))
      }
    )
  }

  const handleUpload = async (e) => {
    const input = e.target
    const file = input.files?.[0]
    input.value = ''
    if (!file) return

    // Only allow .elf and .bin files (lua dropped in v0.3.3+)
    if (!/\.(elf|bin)$/i.test(file.name)) {
      addToast(t("app.toasts.unsupported_file", "Unsupported file type. Only .elf and .bin files are allowed."), "error")
      return
    }

    try {
      const res = await fetch(`/manage:check?filename=${encodeURIComponent(file.name)}`)
      const data = await res.json()
      if (data.file_exists || data.folder_exists) {
        setConfirmModal({
          show: true,
          title: t("app.modals.overwrite.title", "Overwrite Payload"),
          message: data.file_exists
            ? t("app.modals.overwrite.file_exists", "The file {{fileName}} already exists. Overwrite it?", { fileName: file.name })
            : t("app.modals.overwrite.folder_exists", "A different version of this payload exists in the \"{{folderName}}\" folder. Overwrite it?", { folderName: data.folder_name }),
          onConfirm: () => performUpload(file)
        })
      } else {
        performUpload(file)
      }
    } catch (err) {
      performUpload(file)
    }
  }

  const performUpload = async (file) => {
    setConfirmModal({ show: false })
    setDownloadModal({ show: true, name: file.name, progress: 20 })
    try {
      const res = await fetch(`/manage:upload?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: file
      })
      if (!res.ok) throw new Error(`${t("app.toasts.upload_failed", "Upload failed")} (${res.status})`)
      setDownloadModal(prev => ({ ...prev, progress: 100 }))
      addToast(t("app.toasts.payload_uploaded", "{{fileName}} uploaded", { fileName: file.name }))
      refreshPayloads()
    } catch (e) { addToast(e.message || t("app.toasts.upload_failed", "Upload failed"), "error") }
    setTimeout(() => setDownloadModal({ show: false }), 800)
  }

  const handleInstall = async (p, sourceId, repoUrl) => {
    if (p.isUpdate || p.isInstalled) {
      setConfirmModal({
        show: true,
        title: p.isUpdate ? t("app.modals.reinstall.update_title", "Update Payload") : t("app.modals.reinstall.reinstall_title", "Reinstall Payload"),
        message: t("app.modals.reinstall.message", "A version of {{name}} is already installed. Do you want to replace it with the repository version?", { name: p.name || p.filename }),
        onConfirm: () => performInstall(p, sourceId, repoUrl)
      })
    } else {
      performInstall(p, sourceId, repoUrl)
    }
  }

  const performInstall = async (p, sourceId, repoUrl) => {
    setConfirmModal({ show: false })
    setDownloadModal({ show: true, name: p.filename, progress: 10 })
    try {
      setDownloadModal(prev => ({ ...prev, progress: 30 }))
      let url = `/repository_install?filename=${encodeURIComponent(p.filename)}`
      if (sourceId) url += `&source_id=${encodeURIComponent(sourceId)}`
      if (repoUrl) url += `&repo_url=${encodeURIComponent(repoUrl)}`
      const res = await fetch(url)
      setDownloadModal(prev => ({ ...prev, progress: 80 }))

      const data = await res.json().catch(() => null)
      if (res.ok && data?.ok) {
        setDownloadModal(prev => ({ ...prev, progress: 100 }))
        addToast(t("app.toasts.payload_installed", "{{fileName}} installed", { fileName: p.filename }))
        refreshPayloads()
      } else throw new Error(data?.message || t("app.toasts.install_failed", "Installation failed"))
    } catch (e) { addToast(e.message || t("app.toasts.install_failed", "Installation failed"), 'error') }
    setTimeout(() => setDownloadModal({ show: false }), 800)
  }

  const handleImportFromUsb = (path) => {
    setMoveFromUsbPath(path)
    setView('move_from_usb')
  }

  const handleSaveConfig = async (newConfig) => {
    const merged = { ...config, ...newConfig }
    const success = await api('/set_config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged)
    })
    if (success) {
      refreshConfig()
      return true
    } else {
      addToast(t("app.toasts.save_failed", "Save failed"), "error")
      return false
    }
  }

  useEffect(() => {
    const init = async () => {
      let offline = false
      try {
        const ipRes = await fetch('/getip').then(r => r.text())
        if (ipRes.toLowerCase().includes('<!doctype')) offline = true
        else setIp(ipRes)
      } catch (e) {
        offline = true
      }

      try {
        const verRes = await fetch('/version').then(r => r.text())
        if (verRes.toLowerCase().includes('<!doctype')) offline = true
        else setVersion(verRes)
      } catch (e) {
        offline = true
      }

      if (offline) {
        setIsOffline(true)
      } else {
        refreshPayloads()
        refreshConfig()
      }
    }
    init()
  }, [])




  useEffect(() => {
    if (view === 'autoload' || view === 'storage') {
      refreshConfig()
      refreshPayloads()
    }
  }, [view])

  useEffect(() => {
    let statusTimeout
    async function poll() {
      try {
        const res = await fetch('/autoload_status')
        if (res.ok) {
          const data = await res.json()
          setAutoloadStatus(data)

          // Poll as long as autoload is active (remaining >= 0), including DONE state
          // Only stop when remaining goes negative (after /autoload_clear is called)
          const isActive = data && data.remaining >= 0
          if (isActive) {
            const delay = data.remaining > 0 ? 600 : 500
            statusTimeout = setTimeout(poll, delay)
          }
          return
        }
      } catch (e) { }
      statusTimeout = setTimeout(poll, 5000)
    }
    poll()
    return () => clearTimeout(statusTimeout)
  }, [])



  if (isOffline) {
    return (
      <div className="min-h-screen ps5-bg text-zinc-100 font-ps5 flex flex-col items-center justify-center p-4 text-center">
        <div className="max-w-lg p-12 bg-black/40 rounded-3xl border border-white/5">
          <div className="text-7xl font-light text-zinc-400 mb-12 font-mono">:(</div>
          <h1 className="text-2xl font-bold mb-4 text-zinc-300">{t("app.offline.title", "Payload Manager is not running...")}</h1>
          <p className="text-lg text-zinc-400 leading-relaxed">{t("app.offline.message_1", "Please ensure you have loaded")} <strong>pldmgr.elf</strong> {t("app.offline.message_2", "on your PS5 before launching this application.")}</p>
        </div>
      </div>
    )
  }

  // Keep overlay active while remaining >= 0, including DONE state.
  // The overlay is only dismissed when handleFinish() calls /autoload_clear,
  // which resets remaining to -1 on the backend.
  const isAutoloadActive = autoloadStatus && autoloadStatus.remaining >= 0;

  if (isAutoloadActive) {
    return <AutoloadOverlay status={autoloadStatus} onCancel={handleAbort} onFinish={handleFinish} isPS5={isPS5} />;
  }

  return (


    <div className={cn("app-shell ps5-bg text-zinc-100 font-ps5", `theme-${themeId}`)}>
      {/* Cyberpunk-only chrome ΓÇö unmounted on classic so no leftover layout/DOM */}
      {isCyberpunk && <Atmosphere />}
      {isCyberpunk && <HudBar version={version} ip={ip} />}

      <div className={cn(
        "app-body relative z-[1]",
        isPS5 ? "flex-row" : "flex-col md:flex-row"
      )}>
      {/* Toast Container */}
      <div className="fixed top-0 right-0 p-8 z-[2000] space-y-4 pointer-events-none">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>

      {/* Modals */}
      <Modal show={downloadModal.show} title={t("app.modals.installing.title", "Installing Payload")} onClose={() => { }}>
        <div className="space-y-6">
          <div className="flex justify-between items-end">
            <span className="text-ps-blue font-black uppercase italic tracking-tighter text-2xl">{downloadModal.name}</span>
            <span className="text-white font-bold text-xl">{downloadModal.progress}%</span>
          </div>
          <div className="h-4 bg-white/5 rounded-full overflow-hidden border border-white/10 p-0.5">
            <div className="h-full cp-progress-fill rounded-full transition-all duration-500" style={{ width: `${downloadModal.progress}%` }} />
          </div>
        </div>
      </Modal>

      <Modal
        show={confirmModal.show}
        title={confirmModal.title}
        onClose={() => setConfirmModal({ show: false })}
        footer={
          <>
            <button onClick={() => setConfirmModal({ show: false })} className="flex-1 px-8 py-5 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold transition-all uppercase tracking-tight">{t("app.buttons.cancel", "Cancel")}</button>
            <button onClick={confirmModal.onConfirm} className="flex-1 px-8 py-5 rounded-2xl bg-red-600 hover:bg-red-500 text-white font-bold transition-all uppercase tracking-tight">{t("app.buttons.confirm", "Confirm")}</button>
          </>
        }
      >
        {confirmModal.message}
      </Modal>

      <aside className={cn(
        "cp-sidebar transition-all duration-500 z-[100] shrink-0 self-stretch",
        isPS5 ? "flex" : "hidden md:flex",
        sidebarExpanded ? "w-80" : "w-24"
      )}>
        {/* Yellow hazard stripe ΓÇö cyberpunk only (height 0 in classic via CSS) */}
        <div className="cp-hazard shrink-0" aria-hidden="true" />
        <div className="cp-sidebar__inner">
          <div className="cp-sidebar__brand">
            <button
              onClick={() => setSidebarExpanded(!sidebarExpanded)}
              className="p-3 bg-white/5 hover:bg-ps-yellow hover:text-black rounded-lg transition-all mr-4 shrink-0 border border-white/10"
            >
              <Menu className="w-6 h-6" />
            </button>
            <div className={cn("flex items-center space-x-3 transition-all duration-500", sidebarExpanded ? "opacity-100 scale-100" : "opacity-0 scale-90 absolute pointer-events-none")}>
              <div className="p-2 rounded-lg cp-brand-icon">
                <LogoIcon className="w-6 h-6" />
              </div>
              <span className="text-xl cp-brand cp-glitch">PLDMGR</span>
            </div>
          </div>

          <nav className="cp-sidebar__nav">
            <NavButton sidebar sidebarExpanded={sidebarExpanded} active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={LayoutDashboard} label={t("app.nav.dashboard", "Dashboard")} />
            <NavButton sidebar sidebarExpanded={sidebarExpanded} active={view === 'storage'} onClick={() => setView('storage')} icon={Database} label={t("app.nav.storage", "Manage Payloads")} />
            <NavButton sidebar sidebarExpanded={sidebarExpanded} active={view === 'autoload'} onClick={() => setView('autoload')} icon={RefreshCw} label={t("app.nav.autoload", "Autoload")} />
            <NavButton sidebar sidebarExpanded={sidebarExpanded} active={view === 'processes'} onClick={() => setView('processes')} icon={Cpu} label={t("app.nav.processes", "Active Processes")} />
            <NavButton sidebar sidebarExpanded={sidebarExpanded} active={view === 'settings'} onClick={() => setView('settings')} icon={Settings} label={t("app.nav.settings", "Settings")} />
          </nav>

          <div className="cp-sidebar__foot">
            <NavButton
              sidebar
              sidebarExpanded={sidebarExpanded}
              active={view === 'donate'}
              onClick={() => setView('donate')}
              icon={Heart}
              label={t("app.nav.donate", "Donate")}
              isDonate
            />
          </div>
        </div>
      </aside>

      {/* MOBILE BOTTOM NAV */}
      <nav className={cn(
        "fixed bottom-0 inset-x-0 z-[100] bg-[#0a0508]/95 border-t border-red-500/30 h-[calc(5rem+env(safe-area-inset-bottom))] pb-[env(safe-area-inset-bottom)] flex items-center overflow-x-auto hide-scrollbar",
        isPS5 ? "hidden" : "md:hidden"
      )}>
        <NavButton active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={LayoutDashboard} label={t("app.nav.dashboard", "Dashboard")} mobileLabel={t("app.nav.home_mobile", "Home")} />
        <NavButton showSeparator active={view === 'storage'} onClick={() => setView('storage')} icon={Database} label={t("app.nav.storage", "Manage Payloads")} mobileLabel={t("app.nav.manage_mobile", "Manage")} />
        <NavButton showSeparator active={view === 'autoload'} onClick={() => setView('autoload')} icon={RefreshCw} label={t("app.nav.autoload", "Autoload")} mobileLabel={t("app.nav.auto_mobile", "Auto")} />
        <NavButton showSeparator active={view === 'processes'} onClick={() => setView('processes')} icon={Cpu} label={t("app.nav.processes", "Active Processes")} mobileLabel={t("app.nav.processes_mobile", "Processes")} />
        <NavButton showSeparator active={view === 'settings'} onClick={() => setView('settings')} icon={Settings} label={t("app.nav.settings", "Settings")} mobileLabel={t("app.nav.settings", "Settings")} />
        <NavButton
          showSeparator
          active={view === 'donate'}
          onClick={() => setView('donate')}
          icon={Heart}
          label={t("app.nav.donate", "Donate")}
          mobileLabel={t("app.nav.donate", "Donate")}
          isDonate
        />
      </nav>

      {/* MAIN CONTENT AREA ΓÇö app-main is the only vertical scrollport */}
      <div className="app-main-wrap">
        <main
          ref={mainRef}
          className={cn(
            "app-main custom-scrollbar",
            isPS5
              ? "pt-8 px-16 pb-12"
              : isCyberpunk
                ? "pt-8 px-6 pb-36 md:pt-10 md:px-16 md:pb-12"
                : "pt-6 px-6 pb-36 md:pt-10 md:px-16 md:pb-12"
          )}
        >
          {view === 'dashboard' && (
            <div className="space-y-8 md:space-y-12">
              <h2 className="text-4xl font-extrabold tracking-widest">
                <span className="cp-title-accent">{t("app.dashboard.title_1", "Launch")}</span>{' '}
                <span className="text-white">{t("app.dashboard.title_2", "Payload")}</span>
              </h2>
              <div className={cn(
                "grid gap-4 md:gap-6",
                isPS5 ? "grid-cols-3 xl:grid-cols-4" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
              )}>
                {loadingPayloads ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="glass-card p-6 rounded-ps-xl flex flex-col space-y-2 border-white/5">
                      <div className="h-7 w-40 bg-white/5 rounded-lg" />
                      <div className="h-3 w-20 bg-white/5 rounded-md opacity-50" />
                    </div>
                  ))
                ) : payloads.length === 0 ? (
                  <div className="col-span-full py-20 border-2 border-dashed border-white/5 rounded-ps-xl flex flex-col items-center justify-center space-y-6 bg-white/[0.01]">
                    <Package className="w-16 h-16 text-white/10" />
                    <div className="text-center">
                      <p className="text-white font-extrabold tracking-tight text-2xl">{t("app.dashboard.empty.title", "Empty Library")}</p>
                      <p className="text-zinc-500 font-medium">{t("app.dashboard.empty.message", "Add payloads from the Cloud Hub to get started.")}</p>
                    </div>
                    <button onClick={() => { setStorageScrollTarget('cloud-repository'); setView('storage'); }} className="px-8 py-3 bg-ps-blue text-white rounded-xl font-bold tracking-tight">{t("app.dashboard.empty.button", "Open Repository")}</button>
                  </div>
                ) : (
                  payloads.filter(p => !isSystemPayload(p)).map((p) => (
                    <PayloadButton
                      key={p}
                      path={p}
                      onClick={() => loadPayload(p)}
                      isLoading={loading && activeLoadingName === p.split('/').pop().replace(/\.(elf|bin)$/i, '').replace(/_/g, ' ')}
                      sourceName={config.MULTI_SOURCES_ENABLED ? (payloadMeta[p.split('/').pop()]?.source_name || null) : null}
                      version={payloadMeta[p.split('/').pop()]?.version || null}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {view === 'storage' && (
            <StorageHub
              payloads={payloads}
              payloadMeta={payloadMeta}
              onInstall={handleInstall}
              onDelete={handleDelete}
              onUpload={handleUpload}
              onImportFromUsb={handleImportFromUsb}
              config={config}
              ip={ip}
              scrollTarget={storageScrollTarget}
              onClearScrollTarget={() => setStorageScrollTarget(null)}
            />
          )}

          {view === 'move_from_usb' && moveFromUsbPath && (
            <MoveFromUsbView
              path={moveFromUsbPath}
              onBack={() => setView('storage')}
              onComplete={() => {
                refreshPayloads()
                setView('storage')
                setMoveFromUsbPath(null)
              }}
              addToast={addToast}
            />
          )}

          {view === 'autoload' && (
            <AutoloadView
              payloads={payloads}
              config={config}
              onSaveConfig={handleSaveConfig}
              onToast={addToast}
              onRedirect={(v, target) => {
                if (target) setStorageScrollTarget(target)
                setView(v)
              }}
            />
          )}

          {view === 'settings' && (
            <SettingsView
              config={config}
              onSaveConfig={handleSaveConfig}
              isPS5={isPS5}
              logs={logs}
              setLogs={setLogs}
              showLogs={showLogs}
              setShowLogs={setShowLogs}
              onNavigate={(v) => setView(v)}
            />
          )}

          {view === 'sources' && (
            <ManageSourcesView
              onBack={() => setView('settings')}
              ip={ip}
              addToast={addToast}
              showConfirm={showConfirm}
            />
          )}

          {view === 'processes' && (
            <ActiveProcessesView
              ip={ip}
              addToast={addToast}
              showConfirm={showConfirm}
            />
          )}

          {view === 'donate' && <DonateView />}
        </main>
      </div>
      </div>{/* end body row under HUD */}

      {loading && (
        <div className="fixed inset-0 bg-ps-black/95 z-[9999] flex flex-col items-center justify-center space-y-12">
          <div className="ps5-robust-spinner" />
          <div className="text-center">
            <h4 className="cp-glitch cp-glitch-flicker text-4xl font-extrabold text-white tracking-tight mb-4 uppercase italic">{activeLoadingName || t("app.loading.title", "Launching...")}</h4>
            <p className="label-caps !text-ps-blue tracking-[0.3em] font-black">{t("app.loading.subtitle", "LAUNCHING PAYLOAD...")}</p>
          </div>
        </div>
      )}
      {showLogs && (
        <div className="fixed inset-0 z-[9999] bg-[#08080a] flex flex-col animate-in fade-in duration-300">
          <div className="p-6 md:p-8 border-b border-white/10 flex items-center justify-between bg-[#08080a]/95 backdrop-blur-xl sticky top-0 z-10">
            <div className="flex items-center space-x-4">
              <Terminal className="w-8 h-8 text-ps-blue" />
              <h3 className="text-3xl font-black text-white uppercase italic tracking-tighter">{t("app.logs.title", "Logs")}</h3>
            </div>
            <button
              onClick={() => setShowLogs(false)}
              className="p-4 rounded-2xl bg-white/5 hover:bg-red-600 hover:text-white transition-all border border-white/10 group"
            >
              <X className="w-8 h-8 transition-transform group-hover:rotate-90" />
            </button>
          </div>
          <div className="flex-1 overflow-hidden bg-black/20">
            <LogViewer logs={logs} />
          </div>
        </div>
      )}
    </div>
  )
}

export default App

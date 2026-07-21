import React, { useState, useEffect } from 'react'
import {
  ArrowLeft, Plus, Trash2, ChevronUp, ChevronDown,
  Lock, Globe, Loader2, AlertTriangle
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useTranslation } from 'react-i18next'
import { cn, isPS5 } from '../../utils/helpers'

const ManageSourcesView = ({ onBack, ip, addToast, showConfirm }) => {
  const { t } = useTranslation()
  const [sources, setSources] = useState([])
  const [loading, setLoading] = useState(true)
  const [newUrl, setNewUrl] = useState('')
  const [adding, setAdding] = useState(false)
  const [addError, setAddError] = useState('')
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    fetch('/sources_list')
      .then(r => r.json())
      .then(d => {
        if (d?.sources) setSources(d.sources)
      })
      .catch(() => { })
      .finally(() => setLoading(false))
  }, [])

  const saveSources = async (updated) => {
    try {
      const res = await fetch('/sources_set', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sources: updated })
      })
      if (res.ok) {
        addToast(t("manage_sources.saved", "Sources saved"))
      } else {
        addToast(t("manage_sources.save_failed", "Failed to save sources"), 'error')
      }
    } catch {
      addToast(t("manage_sources.save_failed", "Failed to save sources"), 'error')
    }
  }

  const move = (idx, dir) => {
    if (idx + dir < 1 || idx + dir >= sources.length) return
    const updated = [...sources]
      ;[updated[idx], updated[idx + dir]] = [updated[idx + dir], updated[idx]]
    setSources(updated)
    saveSources(updated)
  }

  const remove = (idx) => {
    if (idx === 0) return
    const src = sources[idx]
    showConfirm(
      t("manage_sources.remove_title", "Remove Source"),
      t("manage_sources.remove_message", "Remove \"{{name}}\" from your sources?", { name: src.name }),
      () => {
        const updated = sources.filter((_, i) => i !== idx)
        setSources(updated)
        saveSources(updated)
      }
    )
  }

  const handleAdd = async (e) => {
    e.preventDefault()
    setAddError('')
    if (!newUrl.trim()) return
    setAdding(true)
    try {
      const res = await fetch(`/sources_add?url=${encodeURIComponent(newUrl.trim())}`)
      const data = await res.json()
      if (data.ok) {
        // Reload sources list
        const listRes = await fetch('/sources_list')
        const listData = await listRes.json()
        if (listData?.sources) setSources(listData.sources)
        setNewUrl('')
        setShowAddForm(false)
        addToast(t("manage_sources.added", "\"{{name}}\" added", { name: data.name }))
      } else {
        setAddError(data.message || t("manage_sources.add_failed", "Failed to add source"))
      }
    } catch {
      setAddError(t("manage_sources.add_request_failed", "Request failed. Check the URL and try again."))
    }
    setAdding(false)
  }

  /* ---- PS5 Mode: QR + URL only ---- */
  if (isPS5) {
    return (
      <div className="max-w-3xl mx-auto space-y-12 pb-20">
        <div className="flex items-center space-x-6">
          <button
            onClick={onBack}
            className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
          >
            <ArrowLeft className="w-7 h-7" />
          </button>
          <h2 className="text-4xl font-extrabold text-white tracking-tight">
            {t("manage_sources.ps5_title_1", "Manage")} <span className="text-ps-blue">{t("manage_sources.ps5_title_2", "Sources")}</span>
          </h2>
        </div>

        <div className="glass-card p-10 rounded-ps-3xl border border-white/10 flex flex-col items-center gap-8">
          <div className="bg-white p-6 rounded-3xl">
            <QRCodeSVG value={`http://${ip}:8084`} size={180} level="M" />
          </div>
          <code className="text-white font-mono text-xl font-black opacity-90 italic tracking-tight uppercase">
            {ip}:8084
          </code>
          <p className="text-zinc-400 text-center text-lg leading-relaxed max-w-md">
            {t("manage_sources.ps5_description", "Open this address on your phone or PC to manage payload sources.")}
          </p>
        </div>
      </div>
    )
  }

  /* ---- Desktop Mode: full CRUD ---- */
  return (
    <div className="w-full max-w-3xl mx-auto space-y-10 pb-20 min-w-0">
      {/* Header */}
      <div className="flex items-center space-x-6">
        <button
          onClick={onBack}
          className="p-4 rounded-2xl bg-white/5 hover:bg-white/10 transition-all border border-white/10"
        >
          <ArrowLeft className="w-7 h-7" />
        </button>
        <h2 className="text-4xl font-extrabold text-white tracking-tight">
          {t("manage_sources.web_title_1", "Payload")} <span className="text-ps-blue">{t("manage_sources.web_title_2", "Sources")}</span>
        </h2>
      </div>
      {/* Sources list */}
      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="w-10 h-10 text-ps-blue animate-spin" />
        </div>
      ) : (
        <div className="space-y-3 w-full">
          {sources.map((src, idx) => (
            <div
              key={src.id}
              className={cn(
                'group flex flex-col lg:flex-row lg:items-center gap-4 lg:gap-6 p-5 lg:p-6 glass-card rounded-2xl border transition-all w-full min-w-0 max-w-full overflow-hidden',
                src.removable
                  ? 'border-white/10 hover:border-ps-blue/30'
                  : 'border-white/5 bg-white/[0.015]'
              )}
            >
              {/* Header row on mobile / Left group on desktop */}
              <div className="flex items-center justify-between lg:!justify-start flex-1 min-w-0 gap-4 w-full">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Priority index */}
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shrink-0',
                    idx === 0 ? 'bg-ps-blue/20 text-ps-blue' : 'bg-white/5 text-zinc-500'
                  )}>
                    {idx + 1}
                  </div>

                  {/* Icon */}
                  <div className="p-2 bg-white/5 rounded-xl shrink-0">
                    {src.removable
                      ? <Globe className="w-5 h-5 text-zinc-400 group-hover:text-ps-blue transition-colors" />
                      : <Lock className="w-5 h-5 text-ps-blue" />
                    }
                  </div>

                  {/* Name (mobile only, inline header) */}
                  <div className="min-w-0 lg:hidden">
                    <p className="font-bold text-white text-base leading-tight truncate">{src.name}</p>
                  </div>
                </div>

                {/* Mobile-only controls */}
                <div className="flex items-center space-x-2 shrink-0 lg:hidden">
                  {src.removable && (
                    <>
                      <button
                        onClick={() => move(idx, -1)}
                        disabled={idx <= 1}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        title={t("manage_sources.move_up_btn", "Move up")}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => move(idx, 1)}
                        disabled={idx === sources.length - 1}
                        className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                        title={t("manage_sources.move_down_btn", "Move down")}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => remove(idx)}
                        className="p-2 rounded-xl bg-red-950/20 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all"
                        title={t("manage_sources.remove_btn", "Remove source")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {!src.removable && (
                    <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-ps-blue border border-ps-blue/20 bg-ps-blue/5">
                      {t("manage_sources.default_badge", "Default")}
                    </span>
                  )}
                </div>

                {/* Desktop-only Name + URL container */}
                <div className="hidden lg:flex lg:flex-col flex-1 min-w-0">
                  <p className="font-bold text-white text-base leading-tight truncate">{src.name}</p>
                  <p className="text-xs text-zinc-500 truncate mt-0.5 font-mono">{src.url}</p>
                </div>
              </div>

              {/* Mobile-only URL row (separated for more vertical height and scrollable view) */}
              <div className="lg:hidden w-full min-w-0 max-w-full overflow-hidden">
                <div className="bg-white/[0.02] border border-white/5 rounded-xl p-3.5 flex flex-col gap-1 min-w-0 max-w-full overflow-hidden">
                  <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">{t("manage_sources.source_url_label", "Source URL")}</span>
                  <div className="overflow-x-auto py-0.5 custom-scrollbar min-w-0 w-full max-w-full">
                    <p className="text-xs text-zinc-400 font-mono whitespace-nowrap min-w-0">{src.url}</p>
                  </div>
                </div>
              </div>

              {/* Desktop-only Controls */}
              <div className="hidden lg:flex items-center space-x-2 shrink-0">
                {src.removable && (
                  <>
                    <button
                      onClick={() => move(idx, -1)}
                      disabled={idx <= 1}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                      title={t("manage_sources.move_up_btn", "Move up")}
                    >
                      <ChevronUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => move(idx, 1)}
                      disabled={idx === sources.length - 1}
                      className="p-2 rounded-xl bg-white/5 hover:bg-white/10 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
                      title={t("manage_sources.move_down_btn", "Move down")}
                    >
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => remove(idx)}
                      className="p-2 rounded-xl bg-red-950/20 text-red-500 border border-red-500/10 hover:bg-red-500 hover:text-white transition-all"
                      title={t("manage_sources.remove_btn", "Remove source")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                )}
                {!src.removable && (
                  <span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest text-ps-blue border border-ps-blue/20 bg-ps-blue/5">
                    {t("manage_sources.default_badge", "Default")}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Source */}
      {!showAddForm ? (
        <button
          onClick={() => { setShowAddForm(true); setAddError('') }}
          className="w-full flex items-center justify-center space-x-3 py-5 border-2 border-dashed border-white/10 rounded-2xl text-zinc-500 hover:text-ps-blue hover:border-ps-blue/30 transition-all font-bold"
        >
          <Plus className="w-5 h-5" />
          <span>{t("manage_sources.add_source_btn", "Add Source")}</span>
        </button>
      ) : (
        <form onSubmit={handleAdd} className="p-6 glass-card rounded-2xl border border-white/10 space-y-4">
          <p className="font-bold text-white text-lg">{t("manage_sources.add_new_title", "Add a New Source")}</p>
          <p className="text-sm text-zinc-500">
            {t("manage_sources.add_new_desc", "Paste the URL to a JSON file.")}
          </p>
          <div className="flex flex-col lg:flex-row gap-3">
            <input
              type="url"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              placeholder="https://example.com/payloads.json"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-5 py-3 text-white text-sm placeholder-zinc-600 focus:outline-none focus:border-ps-blue/50 transition-colors w-full"
              autoFocus
              disabled={adding}
            />
            <div className="flex gap-3 w-full lg:w-auto">
              <button
                type="submit"
                disabled={adding || !newUrl.trim()}
                className="flex-1 md:flex-initial flex items-center justify-center space-x-2 px-6 py-3 bg-ps-blue hover:bg-ps-blue/80 disabled:opacity-50 text-white rounded-xl font-bold transition-all whitespace-nowrap"
              >
                {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                <span>{adding ? t("manage_sources.validating", "Validating...") : t("manage_sources.add_btn", "Add")}</span>
              </button>
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setNewUrl(''); setAddError('') }}
                disabled={adding}
                className="flex-1 md:flex-initial px-5 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold transition-all text-center whitespace-nowrap"
              >
                {t("manage_sources.cancel_btn", "Cancel")}
              </button>
            </div>
          </div>
          {addError && (
            <div className="flex items-center space-x-3 text-red-400 text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{addError}</span>
            </div>
          )}
        </form>
      )}
    </div>
  )
}

export default ManageSourcesView

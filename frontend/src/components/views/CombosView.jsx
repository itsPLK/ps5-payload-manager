import React, { useState, useEffect } from 'react'
import { Plus, Trash2, Play, Pencil, X, ChevronUp, ChevronDown, Layers, Check, Loader2, AlertCircle } from 'lucide-react'
import PayloadName from '../ui/PayloadName'
import { cn, parsePayloadName, isSystemPayload } from '../../utils/helpers'

const CombosView = ({ payloads, addToast }) => {
  const [combos, setCombos] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('payloadCombos') || '[]')
    } catch { return [] }
  })

  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [editPayloads, setEditPayloads] = useState([])
  const [runningId, setRunningId] = useState(null)
  const [runProgress, setRunProgress] = useState({ current: 0, total: 0 })
  const [showNewForm, setShowNewForm] = useState(false)
  const [newName, setNewName] = useState('')
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)

  useEffect(() => {
    localStorage.setItem('payloadCombos', JSON.stringify(combos))
  }, [combos])

  const visiblePayloads = payloads.filter(p => !isSystemPayload(p))

  const createCombo = () => {
    if (!newName.trim()) return
    const combo = { id: Date.now().toString(), name: newName.trim(), payloads: [] }
    setCombos(prev => [...prev, combo])
    setNewName('')
    setShowNewForm(false)
    setEditingId(combo.id)
    setEditName(combo.name)
    setEditPayloads([])
  }

  const deleteCombo = (id) => {
    setCombos(prev => prev.filter(c => c.id !== id))
    if (editingId === id) setEditingId(null)
    setDeleteConfirmId(null)
  }

  const startEdit = (combo) => {
    setEditingId(combo.id)
    setEditName(combo.name)
    setEditPayloads([...combo.payloads])
  }

  const saveEdit = () => {
    if (!editName.trim()) return
    setCombos(prev => prev.map(c =>
      c.id === editingId ? { ...c, name: editName.trim(), payloads: editPayloads } : c
    ))
    setEditingId(null)
  }

  const addPayload = (path) => setEditPayloads(prev => [...prev, path])

  const removePayload = (idx) => setEditPayloads(prev => prev.filter((_, i) => i !== idx))

  const movePayload = (idx, dir) => {
    setEditPayloads(prev => {
      const next = [...prev]
      const target = idx + dir
      if (target < 0 || target >= next.length) return prev
      ;[next[idx], next[target]] = [next[target], next[idx]]
      return next
    })
  }

  const runCombo = async (combo) => {
    if (combo.payloads.length === 0) {
      addToast('No payloads in this combo', 'error')
      return
    }
    setRunningId(combo.id)
    for (let i = 0; i < combo.payloads.length; i++) {
      const path = combo.payloads[i]
      const { displayName } = parsePayloadName(path)
      setRunProgress({ current: i + 1, total: combo.payloads.length })
      try {
        const safePath = encodeURI(path)
        const res = await fetch(`/loadpayload:${safePath}`)
        if (!res.ok) throw new Error(`Failed (${res.status})`)
        addToast(`${displayName} launched`)
      } catch (e) {
        addToast(`${displayName}: ${e.message || 'Launch failed'}`, 'error')
      }
      if (i < combo.payloads.length - 1) await new Promise(r => setTimeout(r, 800))
    }
    setRunningId(null)
    setRunProgress({ current: 0, total: 0 })
  }

  return (
    <div className="space-y-8 md:space-y-12">

      {/* //Page header and new combo button// */}
      <div className="flex items-center justify-between">
        <h2 className="text-4xl font-extrabold tracking-tight text-white">
          Payload <span className="text-ps-blue">Combos</span>
        </h2>
        {!showNewForm && (
          <button
            onClick={() => setShowNewForm(true)}
            className="flex items-center gap-3 px-6 py-3 bg-ps-blue text-white rounded-xl font-bold tracking-tight hover:bg-ps-blue/80 transition-all"
          >
            <Plus className="w-5 h-5" />
            <span className="hidden sm:inline">New Combo</span>
          </button>
        )}
      </div>

      {/* //New combo name form// */}
      {showNewForm && (
        <div className="glass-card p-6 rounded-ps-xl border border-ps-blue/40 bg-ps-blue/5">
          <p className="label-caps mb-4">New Combo</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') createCombo(); if (e.key === 'Escape') { setShowNewForm(false); setNewName('') } }}
              placeholder="Combo name — e.g. Main, Management, Dev Setup"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-zinc-600 focus:outline-none focus:border-ps-blue transition-colors"
              autoFocus
            />
            <button
              onClick={createCombo}
              disabled={!newName.trim()}
              className="px-6 py-3 bg-ps-blue text-white rounded-xl font-bold hover:bg-ps-blue/80 transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              Create
            </button>
            <button
              onClick={() => { setShowNewForm(false); setNewName('') }}
              className="px-5 py-3 bg-white/5 text-zinc-400 rounded-xl font-bold hover:bg-white/10 hover:text-white transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* //Empty state// */}
      {combos.length === 0 && !showNewForm && (
        <div className="py-20 border-2 border-dashed border-white/5 rounded-ps-xl flex flex-col items-center justify-center space-y-6 bg-white/[0.01]">
          <Layers className="w-16 h-16 text-white/10" />
          <div className="text-center">
            <p className="text-white font-extrabold tracking-tight text-2xl">No Combos Yet</p>
            <p className="text-zinc-500 font-medium mt-1">Create a combo to launch multiple payloads in one tap.</p>
          </div>
          <button
            onClick={() => setShowNewForm(true)}
            className="px-8 py-3 bg-ps-blue text-white rounded-xl font-bold tracking-tight hover:bg-ps-blue/80 transition-all"
          >
            Create First Combo
          </button>
        </div>
      )}

      {/* //Combo list// */}
      <div className="space-y-4 md:space-y-6">
        {combos.map(combo => {
          const isEditing = editingId === combo.id
          const isRunning = runningId === combo.id

          return (
            <div
              key={combo.id}
              className={cn(
                'glass-card rounded-ps-xl border transition-all',
                isEditing ? 'border-ps-blue/50' : 'border-white/5'
              )}
            >
              {isEditing ? (

                //Edit panel//
                <div className="p-6 space-y-6">

                  {/* //Edit header row// */}
                  <div className="flex items-center gap-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={e => setEditName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit() }}
                      className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xl font-bold focus:outline-none focus:border-ps-blue transition-colors min-w-0"
                    />
                    <button
                      onClick={saveEdit}
                      disabled={!editName.trim()}
                      className="flex items-center gap-2 px-5 py-3 bg-ps-blue text-white rounded-xl font-bold hover:bg-ps-blue/80 transition-all disabled:opacity-40 disabled:pointer-events-none shrink-0"
                    >
                      <Check className="w-4 h-4" />
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="px-5 py-3 bg-white/5 text-zinc-400 rounded-xl font-bold hover:bg-white/10 hover:text-white transition-all shrink-0"
                    >
                      Cancel
                    </button>
                  </div>

                  {/* //Current payload sequence// */}
                  <div className="space-y-2">
                    <p className="label-caps">
                      Sequence
                      {editPayloads.length > 0 && (
                        <span className="ml-2 text-ps-blue">({editPayloads.length})</span>
                      )}
                    </p>
                    {editPayloads.length === 0 ? (
                      <div className="py-6 text-center border border-dashed border-white/10 rounded-xl text-zinc-500 text-sm">
                        No payloads added. Pick from the list below.
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {editPayloads.map((path, idx) => (
                          <div
                            key={idx}
                            className="flex items-center gap-3 bg-white/5 rounded-xl px-4 py-3 border border-white/5"
                          >
                            <span className="text-xs font-black text-ps-blue w-5 text-center shrink-0 tabular-nums">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <PayloadName path={path} className="text-white text-sm font-medium" />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                onClick={() => movePayload(idx, -1)}
                                disabled={idx === 0}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-all disabled:opacity-20 disabled:pointer-events-none"
                              >
                                <ChevronUp className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => movePayload(idx, 1)}
                                disabled={idx === editPayloads.length - 1}
                                className="p-1.5 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-white transition-all disabled:opacity-20 disabled:pointer-events-none"
                              >
                                <ChevronDown className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => removePayload(idx)}
                                className="p-1.5 rounded-lg hover:bg-red-600/20 text-zinc-500 hover:text-red-400 transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* //Payload picker grid// */}
                  <div className="space-y-3">
                    <p className="label-caps">Add Payload</p>
                    {visiblePayloads.length === 0 ? (
                      <p className="text-zinc-500 text-sm">No payloads installed.</p>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                        {visiblePayloads.map(p => (
                          <button
                            key={p}
                            onClick={() => addPayload(p)}
                            className="group glass-card p-3 rounded-xl border border-white/5 hover:border-ps-blue hover:bg-ps-blue/5 text-left transition-all"
                          >
                            <PayloadName path={p} className="text-white text-sm" />
                            <div className="mt-1.5 flex items-center gap-1 text-ps-blue opacity-0 group-hover:opacity-100 transition-opacity">
                              <Plus className="w-3 h-3" />
                              <span className="text-[10px] font-bold uppercase tracking-widest">Add</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                </div>

              ) : (

                //View panel//
                <div className="p-6">
                  <div className="flex items-start justify-between gap-4 flex-wrap">

                    {/* //Combo info// */}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-2xl font-extrabold text-white tracking-tight truncate">
                        {combo.name}
                      </h3>
                      <p className="text-zinc-500 text-sm mt-1">
                        {combo.payloads.length === 0
                          ? 'No payloads configured'
                          : `${combo.payloads.length} payload${combo.payloads.length !== 1 ? 's' : ''} in sequence`}
                      </p>
                    </div>

                    {/* //Action buttons// */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => startEdit(combo)}
                        disabled={!!runningId}
                        className="p-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-all disabled:opacity-30 disabled:pointer-events-none"
                        title="Edit combo"
                      >
                        <Pencil className="w-5 h-5" />
                      </button>
                      {deleteConfirmId === combo.id ? (
                        <>
                          <button
                            onClick={() => deleteCombo(combo.id)}
                            className="flex items-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all text-sm"
                          >
                            <AlertCircle className="w-4 h-4" />
                            Confirm
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-4 py-3 bg-white/5 text-zinc-400 rounded-xl font-bold hover:bg-white/10 hover:text-white transition-all text-sm"
                          >
                            Keep
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(combo.id)}
                          disabled={!!runningId}
                          className="p-3 rounded-xl bg-white/5 hover:bg-red-600/20 text-zinc-400 hover:text-red-400 transition-all disabled:opacity-30 disabled:pointer-events-none"
                          title="Delete combo"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                      <button
                        onClick={() => runCombo(combo)}
                        disabled={combo.payloads.length === 0 || !!runningId}
                        className="flex items-center gap-2 px-6 py-3 bg-ps-blue hover:bg-ps-blue/80 text-white rounded-xl font-bold transition-all disabled:opacity-40 disabled:pointer-events-none min-w-[120px] justify-center"
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span className="tabular-nums">{runProgress.current}/{runProgress.total}</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4" />
                            Run
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* //Payload sequence chips// */}
                  {combo.payloads.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {combo.payloads.map((path, idx) => {
                        const { displayName } = parsePayloadName(path)
                        const isCurrentlyRunning = isRunning && runProgress.current - 1 === idx
                        return (
                          <div
                            key={idx}
                            className={cn(
                              'flex items-center gap-2 rounded-lg px-3 py-1.5 border transition-all',
                              isCurrentlyRunning
                                ? 'bg-ps-blue/20 border-ps-blue/50 text-ps-blue'
                                : 'bg-white/5 border-white/5 text-zinc-300'
                            )}
                          >
                            <span className={cn('text-[10px] font-black tabular-nums', isCurrentlyRunning ? 'text-ps-blue' : 'text-ps-blue/60')}>
                              {idx + 1}
                            </span>
                            <span className="text-sm font-medium">{displayName}</span>
                            {isCurrentlyRunning && <Loader2 className="w-3 h-3 animate-spin" />}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default CombosView

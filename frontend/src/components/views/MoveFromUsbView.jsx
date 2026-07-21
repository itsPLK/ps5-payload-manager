import React, { useState, useEffect } from 'react'
import { ArrowLeft, HardDrive, Cpu, AlertTriangle, CheckCircle2, Loader2, Info, Usb } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'

const MoveFromUsbView = ({ path, onBack, onComplete, addToast }) => {
  const { t } = useTranslation()
  const [status, setStatus] = useState('loading') // loading, confirm, exists_same, exists_different, processing, error, success
  const [details, setDetails] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    checkPayload()
  }, [path])

  const checkPayload = async () => {
    setStatus('loading')
    try {
      const res = await fetch(`/usb_move_check?path=${encodeURIComponent(path)}`)
      const data = await res.json()
      if (data.error) {
        setErrorMsg(data.error)
        setStatus('error')
      } else {
        setDetails(data)
        if (data.status === 'exists_same') setStatus('exists_same')
        else if (data.status === 'exists_different' || data.folder_exists) setStatus('exists_different')
        else setStatus('confirm')
      }
    } catch (e) {
      setErrorMsg(t("move_usb.conn_failed", "Failed to connect to backend"))
      setStatus('error')
    }
  }

  const performMove = async (overwrite = false, keepOriginal = false) => {
    setStatus('processing')
    try {
      const res = await fetch(`/usb_move_perform?path=${encodeURIComponent(path)}&overwrite=${overwrite}&keep_original=${keepOriginal}`)
      const data = await res.json()
      if (data.error) {
        setErrorMsg(data.error)
        setStatus('error')
      } else {
        setStatus('success')
        addToast(data.warning || (keepOriginal ? t("move_usb.copied", "Payload copied to internal memory") : t("move_usb.moved", "Payload moved to internal memory")))
        setTimeout(() => {
          onComplete()
        }, 2000)
      }
    } catch (e) {
      setErrorMsg(t("move_usb.op_failed", "Operation failed"))
      setStatus('error')
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-12 animate-fade-in pb-20">
      <button onClick={onBack} className="flex items-center space-x-3 text-zinc-500 hover:text-white transition-colors group">
        <ArrowLeft className="w-6 h-6 group-hover:-translate-x-1 transition-transform" />
        <span className="font-bold uppercase tracking-widest text-sm">{t("move_usb.back_btn", "Back to Management")}</span>
      </button>

      <div className="space-y-4">
        <h2 className="text-4xl font-extrabold text-white tracking-tight">
          {t("move_usb.title_1", "Import")} <span className="text-ps-blue">{t("move_usb.title_2", "to Internal")}</span>
        </h2>
        <p className="text-zinc-500 max-w-2xl">{t("move_usb.description", "Import the selected payload from your USB drive to the PS5's internal data storage.")}</p>
      </div>

      <div className="glass-card p-6 md:p-10 rounded-ps-3xl border-white/10 bg-white/[0.02] space-y-8 md:space-y-10">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-8 text-center sm:text-left">
          <div className="p-4 md:p-6 bg-ps-blue/20 rounded-3xl border border-ps-blue/30 shrink-0">
            <Usb className="w-8 h-8 md:w-10 md:h-10 text-ps-blue" />
          </div>
          <div className="space-y-1 md:space-y-2 min-w-0 flex-1">
            <p className="label-caps !text-ps-blue">{t("move_usb.source_path_label", "Source Path")}</p>
            <p className="text-xl md:text-2xl font-black text-white italic tracking-tight truncate w-full">{path}</p>
          </div>
        </div>

        <div className="h-px bg-white/5" />

        {status === 'loading' && (
          <div className="py-12 flex flex-col items-center justify-center space-y-6">
            <Loader2 className="w-12 h-12 text-ps-blue animate-spin" />
            <p className="label-caps animate-pulse text-zinc-500">{t("move_usb.checking_storage", "Checking internal storage...")}</p>
          </div>
        )}

        {status === 'error' && (
          <div className="p-8 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start space-x-6">
            <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
            <div className="space-y-2">
              <p className="text-lg font-bold text-white">{t("move_usb.error_title", "Something went wrong")}</p>
              <p className="text-red-400/80 leading-relaxed">{errorMsg}</p>
              <button onClick={checkPayload} className="mt-4 px-6 py-2 bg-red-500 text-white rounded-xl font-bold text-sm">{t("move_usb.retry_btn", "Retry")}</button>
            </div>
          </div>
        )}

        {status === 'exists_same' && (
          <div className="space-y-6 md:space-y-8">
            <div className="p-6 md:p-8 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 text-center md:text-left">
              <CheckCircle2 className="w-8 h-8 text-emerald-500 shrink-0" />
              <div className="space-y-2">
                <p className="text-lg font-bold text-white">{t("move_usb.same_exists_title", "Identical file already exists")}</p>
                <p className="text-sm md:text-lg text-emerald-400/80 leading-relaxed">
                  {t("move_usb.same_exists_desc", "A payload with the same name and content (SHA256: {{sha}}...) is already in your internal library. No action is needed.", { sha: details?.sha256?.substring(0, 12) })}
                </p>
              </div>
            </div>
            <button onClick={onBack} className="w-full py-4 md:py-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-black uppercase italic text-lg md:text-xl transition-all border border-white/10">{t("move_usb.return_btn", "Return to Storage Hub")}</button>
          </div>
        )}

        {status === 'exists_different' && (
          <div className="space-y-6 md:space-y-8">
            <div className="p-6 md:p-8 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 text-center md:text-left">
              <AlertTriangle className="w-8 h-8 text-amber-500 shrink-0" />
              <div className="space-y-2">
                <p className="text-lg font-bold text-white">{t("move_usb.prev_version_title", "Previous version detected")}</p>
                <p className="text-sm md:text-lg text-amber-400/80 leading-relaxed">
                  {t("move_usb.prev_version_desc", "A version of <1>{{name}}</1> already exists in internal storage. Importing this will replace the current installation. Do you want to proceed?", { components: { 1: <strong /> }, name: details?.folder_name || details?.filename })}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={onBack} className="flex-1 py-4 md:py-6 rounded-2xl bg-white/5 hover:bg-white/10 text-white font-bold uppercase transition-all">{t("move_usb.cancel_btn", "Cancel")}</button>
              <div className="flex flex-1 gap-2">
                <button onClick={() => performMove(true, true)} className="flex-1 py-4 md:py-6 rounded-2xl bg-ps-blue/50 hover:bg-ps-blue/70 text-white font-black uppercase italic text-sm md:text-lg transition-all border border-ps-blue/30">{t("move_usb.overwrite_copy_btn", "Overwrite & Copy")}</button>
                <button onClick={() => performMove(true, false)} className="flex-1 py-4 md:py-6 rounded-2xl bg-ps-blue hover:bg-ps-blue/80 text-white font-black uppercase italic text-sm md:text-lg transition-all shadow-xl shadow-ps-blue/20">{t("move_usb.overwrite_move_btn", "Overwrite & Move")}</button>
              </div>
            </div>
          </div>
        )}

        {status === 'confirm' && (
          <div className="space-y-6 md:space-y-8">
            <div className="p-6 md:p-8 bg-ps-blue/5 border border-ps-blue/10 rounded-2xl flex flex-col md:flex-row items-center md:items-start gap-4 md:gap-6 text-center md:text-left">
              <Info className="w-8 h-8 text-ps-blue shrink-0" />
              <div className="space-y-2">
                <p className="text-lg font-bold text-white">{t("move_usb.ready_title", "Ready to Import")}</p>
                <p className="text-sm md:text-lg text-zinc-400 leading-relaxed">
                  {t("move_usb.ready_desc", "The payload will be imported to internal storage. You can either copy it and keep the original on the USB, or move it and delete the original.")}
                </p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <button onClick={() => performMove(false, true)} className="flex-1 py-4 md:py-6 rounded-2xl bg-white/10 hover:bg-white/20 text-white font-black uppercase italic text-lg md:text-xl transition-all border border-white/20">{t("move_usb.copy_btn", "Copy to Internal")}</button>
              <button onClick={() => performMove(false, false)} className="flex-1 py-4 md:py-6 rounded-2xl bg-ps-blue hover:bg-ps-blue/80 text-white font-black uppercase italic text-lg md:text-xl transition-all shadow-2xl shadow-ps-blue/30">{t("move_usb.move_btn", "Move to Internal")}</button>
            </div>
          </div>
        )}

        {status === 'processing' && (
          <div className="py-20 flex flex-col items-center justify-center space-y-8 text-center">
            <div className="ps5-robust-spinner" />
            <div className="space-y-2">
              <p className="text-2xl font-black text-white uppercase italic tracking-tighter animate-pulse">{t("move_usb.importing", "Importing Payload...")}</p>
              <p className="text-zinc-500">{t("move_usb.copying_desc", "Copying data and verifying integrity.")}</p>
            </div>
          </div>
        )}

        {status === 'success' && (
          <div className="py-20 flex flex-col items-center justify-center space-y-8 text-center">
            <div className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-500/20 animate-in zoom-in duration-500">
              <CheckCircle2 className="w-14 h-14 text-white" />
            </div>
            <div className="space-y-2">
              <p className="text-3xl font-black text-white uppercase italic tracking-tighter">{t("move_usb.success_title", "Success!")}</p>
              <p className="text-zinc-500">{t("move_usb.success_desc", "The payload has been safely imported to internal storage.")}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default MoveFromUsbView

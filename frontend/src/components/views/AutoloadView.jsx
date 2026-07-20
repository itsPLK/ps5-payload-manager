import React, { useState, useEffect } from 'react'
import { RefreshCw, ArrowLeft, ArrowRight, Activity, Zap, ChevronUp, ChevronDown, Trash2, CheckCircle2 } from 'lucide-react'
import { cn, isPS5, isSystemPayload } from '../../utils/helpers'
import { useTranslation } from 'react-i18next'
import PayloadName from '../ui/PayloadName'
import Modal from '../ui/Modal'
import ToggleSwitch from '../ui/ToggleSwitch'
import HudButton from '../ui/HudButton'
import { useTheme } from '../../theme/ThemeContext'

const AutoloadView = ({ payloads, config, onSaveConfig, onToast, onRedirect }) => {
  const { t } = useTranslation()
  const { themeId } = useTheme()
  const isCyberpunk = themeId === 'cyberpunk'
  const [subView, setSubView] = useState('list')
  const [enabled, setEnabled] = useState(false)
  const [autoloadList, setAutoloadList] = useState([])
  const [showDelayModal, setShowDelayModal] = useState(false)
  const [customDelay, setCustomDelay] = useState('')
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const lastSyncedRef = React.useRef('')

  // Load initial config
  useEffect(() => {
    if (config) {
      const en = config.AUTOLOAD_ENABLED === true || config.AUTOLOAD_ENABLED === "true"
      const listStr = config.AUTOLOAD_LIST || ''
      setEnabled(en)
      setAutoloadList(listStr.split(',').filter(x => x))
      lastSyncedRef.current = `${en}:${listStr}`
      setIsInitialized(true)
    }
  }, [config])

  // Debounced Auto-Save
  useEffect(() => {
    if (!isInitialized) return

    const currentState = `${enabled}:${autoloadList.join(',')}`
    if (currentState === lastSyncedRef.current) return

    const timer = setTimeout(async () => {
      const shouldEnable = enabled
      const finalList = autoloadList.map(p => p === 'DELAY' ? '!1000' : p)
      const finalStr = finalList.join(',')

      setSaving(true)
      const success = await onSaveConfig({
        AUTOLOAD_ENABLED: shouldEnable,
        AUTOLOAD_LIST: finalStr
      })

      if (success) {
        lastSyncedRef.current = `${shouldEnable}:${finalStr}`
        setSaved(true)
        setTimeout(() => setSaved(false), 2000)
      }
      setSaving(false)
    }, 1500)

    return () => clearTimeout(timer)
  }, [autoloadList, enabled, isInitialized, onSaveConfig])

  const internalPayloads = payloads.filter(p => !p.includes('/mnt/usb') && !isSystemPayload(p)).map(p => p.split('/').pop())
  const availablePayloads = internalPayloads.filter(p => !autoloadList.includes(p))

  const handleToggle = (val) => {
    setEnabled(val)
  }

  const addPayload = (p) => {
    const isKstuff = p.toLowerCase().includes('kstuff');
    if (isKstuff) {
      const existing = autoloadList.find(x => x.toLowerCase().includes('kstuff'));
      if (existing) {
        onToast(t("autoload.conflict_kstuff", "Conflict: Multiple KStuff payloads detected."), 'error');
        return;
      }
    }
    setAutoloadList([...autoloadList, p]);
    setSubView('list')
  }

  const addDelay = (ms) => {
    setAutoloadList([...autoloadList, `!${ms}`])
    setShowDelayModal(false)
    setSubView('list')
  }

  const moveUp = (index) => {
    if (index === 0) return
    const newList = [...autoloadList]
      ;[newList[index - 1], newList[index]] = [newList[index], newList[index - 1]]
    setAutoloadList(newList)
  }

  const moveDown = (index) => {
    if (index === autoloadList.length - 1) return
    const newList = [...autoloadList]
      ;[newList[index + 1], newList[index]] = [newList[index], newList[index + 1]]
    setAutoloadList(newList)
  }

  const renderAvailable = () => (
    <div className="space-y-8 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex items-center space-x-4">
          {subView === 'add' && (
            <HudButton
              onClick={() => setSubView('list')}
              icon={ArrowLeft}
              variant="secondary"
              size="sm"
              className="cp-btn--icon lg:hidden"
              aria-label="Back"
            />
          )}
          <h3 className="label-caps !text-white !opacity-100 text-xl tracking-widest">{t("autoload.available_title", "Available Payloads")}</h3>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-0 pb-6">
        <div className="grid grid-cols-1 gap-3">
          {availablePayloads.map(p => {
            const isKstuff = p.toLowerCase().includes('kstuff');
            const hasKstuff = autoloadList.some(x => x.toLowerCase().includes('kstuff'));
            const isBlocked = isKstuff && hasKstuff;

            return (
              <HudButton
                key={p}
                onClick={() => !isBlocked && addPayload(p)}
                disabled={isBlocked}
                endIcon={ArrowRight}
                variant="secondary"
                size="lg"
                block
                raw
                className={cn(
                  'cp-btn--bar cp-btn--payload-row',
                  isBlocked && 'opacity-40'
                )}
              >
                <PayloadName
                  path={p}
                  className={cn('text-lg md:text-xl', isBlocked ? 'text-zinc-500' : 'text-white')}
                  stacked
                />
              </HudButton>
            )
          })}
          <div className="pt-4 border-t border-white/10 mt-2">
            <HudButton
              onClick={() => setShowDelayModal(true)}
              icon={Zap}
              endIcon={ArrowRight}
              variant="primary"
              size="lg"
              block
              className="cp-btn--bar"
            >
              {t("autoload.add_delay_btn", "Add Delay")}
            </HudButton>
          </div>
          <div className="pt-8 border-t border-white/5 mt-8 text-center space-y-4">
            <p className="text-zinc-500 text-sm font-bold uppercase tracking-widest opacity-60">{t("autoload.missing_payload", "Missing a payload?")}</p>
            <button
              onClick={() => onRedirect('storage', 'usb-storage')}
              className="group flex flex-col items-center mx-auto space-y-3"
            >
              <div className="flex items-center space-x-3 text-ps-blue group-hover:text-white transition-colors">
                <span className="font-black italic text-lg uppercase tracking-tight">{t("autoload.move_usb_btn", "Move from USB to Internal")}</span>
              </div>
              <p className="text-xs text-zinc-600 max-w-[200px] leading-relaxed">{t("autoload.move_usb_desc", "Required for payloads you want to use in the Autoload sequence.")}</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  )

  const renderSequence = () => (
    <div className="space-y-8 flex flex-col h-full min-h-0">
      <div className="flex items-center justify-between shrink-0">
        <div className="flex flex-col">
          <h2 className="text-4xl font-extrabold text-white tracking-tight">
            {t("autoload.sequence_title_1", "Autoload")} <span className="cp-title-accent">{t("autoload.sequence_title_2", "Sequence")}</span>
          </h2>
          <div className="h-6 mt-1 overflow-hidden">
            {saving ? (
              <div className="flex items-center space-x-2 text-ps-blue/60 text-xs font-bold uppercase tracking-widest">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>{t("autoload.saving", "Saving Changes...")}</span>
              </div>
            ) : saved ? (
              <div className="flex items-center space-x-2 text-emerald-500 text-xs font-bold uppercase tracking-widest animate-in slide-in-from-bottom-2">
                <CheckCircle2 className="w-3 h-3" />
                <span>{t("autoload.saved", "All Changes Saved")}</span>
              </div>
            ) : null}
          </div>
        </div>
        {isCyberpunk ? (
          <div className="flex items-center gap-4 shrink-0">
            <span className="label-caps !text-zinc-400 !opacity-100 text-xs md:text-sm tracking-[0.16em] whitespace-nowrap">
              {t("autoload.enable_btn", "Enable Autoload")}
            </span>
            {/* ON = sequence active */}
            <ToggleSwitch on={enabled} onChange={handleToggle} />
          </div>
        ) : (
          <HudButton onClick={() => handleToggle(false)} variant="dangerSoft" size="sm">
            {t("autoload.disable_btn", "Disable Autoload")}
          </HudButton>
        )}
      </div>

      <div className="glass-panel p-6 rounded-ps-3xl border-white/10 flex-1 overflow-hidden flex flex-col min-h-0">
        <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-2 mb-2 pb-6">
          {autoloadList.map((p, i) => (
            <div key={`${p}-${i}`} className="relative flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/10 animate-in slide-in-from-left duration-200">
              <div className="absolute top-0 left-0 w-6 h-6 rounded-full bg-dark flex items-center justify-center z-20">
                <span className="text-gray-500 text-[12px] font-black">{i + 1}</span>
              </div>
              <div className="flex items-center min-w-0 pl-2">
                <PayloadName path={p} className="text-white" stacked />
              </div>
              <div className="flex items-center gap-2">
                <HudButton onClick={() => moveUp(i)} disabled={i === 0} icon={ChevronUp} variant="secondary" size="sm" className="cp-btn--icon" aria-label="Move up" />
                <HudButton onClick={() => moveDown(i)} disabled={i === autoloadList.length - 1} icon={ChevronDown} variant="secondary" size="sm" className="cp-btn--icon" aria-label="Move down" />
                <HudButton onClick={() => setAutoloadList(autoloadList.filter((_, idx) => idx !== i))} icon={Trash2} variant="dangerSoft" size="sm" className="cp-btn--icon" aria-label="Remove" />
              </div>
            </div>
          ))}
          {autoloadList.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center opacity-10 italic py-20">
              <RefreshCw className="w-16 h-16 mb-4" />
              <p className="text-2xl font-bold">{t("autoload.sequence_empty", "Sequence Empty")}</p>
            </div>
          )}

          <div className={cn("pt-4 mt-2", isPS5 ? "hidden" : "lg:hidden")}>
            <HudButton
              onClick={() => setSubView('add')}
              icon={Activity}
              variant="primary"
              size="lg"
              block
              className="cp-btn--bar"
            >
              {t("autoload.add_item_btn", "Add Item to Sequence")}
            </HudButton>
          </div>
        </div>
      </div>
    </div>
  )

  if (!enabled) {
    return (
      <div className="cp-autoload-off">
        <div className="cp-autoload-off__panel">
          <div className="cp-autoload-off__icon" aria-hidden="true">
            <Zap className="w-10 h-10 md:w-12 md:h-12" />
          </div>
          <div className="cp-autoload-off__copy">
            <h2 className="cp-autoload-off__title">
              {t("autoload.sequence_title_1", "Autoload")}{' '}
              <span className="cp-title-accent">{t("autoload.sequence_title_2", "Sequence")}</span>
            </h2>
            <p className="cp-autoload-off__desc">
              {t(
                "autoload.enable_desc",
                "Chain multiple payloads to be executed automatically every time Payload Manager starts."
              )}
            </p>
            <p className="cp-autoload-off__status">
              {t("autoload.disabled_status", "Autoload is currently off")}
            </p>
          </div>
          <div className="cp-autoload-off__actions">
            <HudButton
              onClick={() => handleToggle(true)}
              icon={Zap}
              variant="primary"
              size="lg"
              block
              className={isCyberpunk ? 'cp-btn--bar' : undefined}
            >
              {t("autoload.enable_btn", "Enable Autoload")}
            </HudButton>
            {(saving || saved) && (
              <div className="cp-autoload-off__save">
                {saving ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("autoload.saving", "Saving Changes...")}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{t("autoload.saved", "All Changes Saved")}</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex-1 flex flex-col min-h-0">
        <div className={cn(
          "gap-12 h-full min-h-0",
          isPS5 ? "grid grid-cols-2" : "hidden lg:grid lg:grid-cols-2"
        )}>
          {renderAvailable()}
          {renderSequence()}
        </div>
        <div className={cn(
          "h-full flex flex-col min-h-0",
          isPS5 ? "hidden" : "lg:hidden"
        )}>
          {subView === 'list' ? renderSequence() : renderAvailable()}
        </div>
      </div>

      <Modal
        show={showDelayModal}
        title={t("autoload.delay_modal.title", "Configure Delay")}
        onClose={() => setShowDelayModal(false)}
        footer={
          <HudButton onClick={() => setShowDelayModal(false)} variant="secondary" block>
            {t("autoload.delay_modal.cancel", "Cancel")}
          </HudButton>
        }
      >
        <div className="space-y-6 md:space-y-8">
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[1, 3, 5].map(s => (
              <HudButton
                key={s}
                onClick={() => addDelay(s * 1000)}
                variant="primary"
                size="lg"
                className="flex-1"
              >
                {s}s
              </HudButton>
            ))}
          </div>

          <div className="space-y-3 md:space-y-4">
            <p className="label-caps !text-zinc-500 text-sm md:text-base">{t("autoload.delay_modal.custom_delay_label", "Custom Delay (ms)")}</p>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="number"
                placeholder={t("autoload.delay_modal.placeholder", "e.g. 2500")}
                value={customDelay}
                onChange={(e) => setCustomDelay(e.target.value)}
                className="flex-1 bg-white/5 border border-white/10 rounded-2xl p-4 md:p-5 text-white font-mono text-xl md:text-2xl focus:border-ps-blue outline-none transition-all"
              />
              <HudButton
                onClick={() => customDelay && addDelay(parseInt(customDelay))}
                variant="primary"
                size="lg"
                className="shrink-0"
              >
                {t("autoload.delay_modal.add_btn", "Add")}
              </HudButton>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default AutoloadView

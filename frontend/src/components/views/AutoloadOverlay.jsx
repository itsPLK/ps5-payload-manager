import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'
import PayloadName from '../ui/PayloadName'
import HudButton from '../ui/HudButton'
import Atmosphere from '../ui/Atmosphere'
import { useTheme } from '../../theme/ThemeContext'

const AutoloadOverlay = ({ status, onCancel, onFinish, isPS5 }) => {
  const { t } = useTranslation()
  const { themeId, hasFeature } = useTheme()
  const showAtmosphere = hasFeature('atmosphere')
  const showHazard = hasFeature('hazardStripe')

  const isCountdown = status.remaining > 0 || (status.remaining === 0 && !status.current)
  const isExecuting = status.remaining === 0 && !!status.current && status.current !== 'DONE'
  const isDone = status.current === 'DONE'
  const payloadList =
    typeof status.list === 'string'
      ? status.list.split(',').filter((p) => p.trim() !== '')
      : []
  const listRef = useRef(null)
  const displayTotal = status.total > 0 ? status.total : payloadList.length
  const progress = displayTotal > 0 ? status.done / displayTotal : 0

  const [localMs, setLocalMs] = useState(status.remaining_ms ?? status.remaining * 1000)

  useEffect(() => {
    const serverMs = status.remaining_ms ?? status.remaining * 1000
    // Only sync downward so countdown never jumps backwards.
    setLocalMs((prev) => (serverMs < prev ? serverMs : prev))
  }, [status.remaining_ms, status.remaining])

  const isActiveRef = useRef(true)

  useEffect(() => {
    if (!isCountdown) return
    let lastTime = performance.now()
    let frameId
    const animate = (time) => {
      const delta = time - lastTime
      lastTime = time
      if (isActiveRef.current) {
        setLocalMs((prev) => Math.max(0, prev - delta))
      }
      frameId = requestAnimationFrame(animate)
    }
    frameId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frameId)
  }, [isCountdown])

  useEffect(() => {
    if (listRef.current) {
      const activeItem = listRef.current.querySelector('[data-active="true"]')
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }
  }, [status.done])

  return (
    <div
      className={cn('cp-autoload-overlay', showAtmosphere && 'ps5-bg')}
      data-theme={themeId}
    >
      {showAtmosphere && <Atmosphere />}
      {showHazard && <div className="cp-hazard shrink-0" aria-hidden="true" />}

      <div
        className={cn(
          'cp-autoload-overlay__inner relative z-[1] w-full max-w-[1400px] flex flex-col items-center',
          isPS5
            ? 'flex-row items-center justify-center space-x-24 space-y-0'
            : 'md:flex-row md:items-start md:justify-center md:space-x-24 md:space-y-0 space-y-12'
        )}
      >
        {/* LEFT: status + actions */}
        <div
          className={cn(
            'w-full max-w-md flex flex-col items-center space-y-10',
            !isPS5 && 'md:sticky md:top-0'
          )}
        >
          {!isDone &&
            payloadList.some((p) => p.toLowerCase().includes('etahen')) &&
            payloadList.some((p) => p.toLowerCase().includes('kstuff')) && (
              <div className="cp-autoload-overlay__warn">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>
                  {t('autoload_overlay.conflict', 'Conflict: etaHEN + KStuff active')}
                </span>
              </div>
            )}

          <div className="h-[320px] w-full flex flex-col items-center justify-center">
            {isCountdown && (
              <div className="cp-autoload-overlay__status animate-in fade-in zoom-in duration-300">
                <p className="cp-autoload-overlay__eyebrow">
                  {t('autoload_overlay.autoloading', 'Autoloading')}
                </p>
                <div className="cp-autoload-overlay__ring">
                  <svg className="absolute inset-0 w-full h-full -rotate-90 scale-110">
                    <circle
                      cx="112"
                      cy="112"
                      r="100"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="cp-autoload-overlay__ring-track"
                    />
                    <circle
                      cx="112"
                      cy="112"
                      r="100"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray="628"
                      strokeDashoffset={
                        628 - 628 * (localMs / ((status.delay || 5) * 1000))
                      }
                      className="cp-autoload-overlay__ring-fill"
                    />
                  </svg>
                  <span className="cp-autoload-overlay__ring-num">
                    {Math.ceil(localMs / 1000)}
                  </span>
                </div>
                <p className="cp-autoload-overlay__hint">
                  {t('autoload_overlay.waiting', 'Waiting for manual abort...')}
                </p>
              </div>
            )}

            {isExecuting && (
              <div className="cp-autoload-overlay__status animate-in fade-in zoom-in duration-300">
                <p className="cp-autoload-overlay__eyebrow">
                  {t('autoload_overlay.executing', 'Executing')}
                </p>
                <div className="cp-autoload-overlay__ring">
                  <svg className="absolute inset-0 w-full h-full -rotate-90 scale-110">
                    <circle
                      cx="112"
                      cy="112"
                      r="100"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      className="cp-autoload-overlay__ring-track"
                    />
                    <circle
                      cx="112"
                      cy="112"
                      r="100"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="8"
                      strokeDasharray="628"
                      strokeDashoffset={628 - 628 * progress}
                      className="cp-autoload-overlay__ring-fill transition-all duration-500 ease-out"
                    />
                  </svg>
                  <span className="cp-autoload-overlay__ring-num cp-autoload-overlay__ring-num--pct">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <p className="cp-autoload-overlay__hint italic">
                  {t('autoload_overlay.loading', 'Loading Payloads...')}
                </p>
              </div>
            )}

            {isDone && (
              <div className="cp-autoload-overlay__done animate-in zoom-in duration-500">
                <div className="cp-autoload-overlay__done-icon" aria-hidden="true">
                  <CheckCircle2 className="w-16 h-16 md:w-20 md:h-20" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="cp-autoload-overlay__done-title">
                    {t('autoload_overlay.done_title_1', 'Autoload')}
                    <br />
                    {t('autoload_overlay.done_title_2', 'Done')}
                  </h2>
                  <p className="cp-autoload-overlay__hint">
                    {t('autoload_overlay.all_loaded', 'All payloads loaded')}
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-full pt-4">
            {isDone ? (
              <HudButton
                onClick={onFinish}
                variant="primary"
                size="lg"
                block
                className="cp-btn--bar !min-h-[4.5rem] !text-xl"
              >
                {t('autoload_overlay.return_btn', 'Return to Dashboard')}
              </HudButton>
            ) : isCountdown ? (
              <HudButton
                onClick={onCancel}
                autoFocus
                variant="danger"
                size="lg"
                block
                className="cp-btn--bar !min-h-[4.5rem] !text-xl"
              >
                {t('autoload_overlay.abort_btn', 'Abort Autoload')}
              </HudButton>
            ) : (
              <div className="h-[92px] w-full flex items-center justify-center">
                <div className="cp-autoload-overlay__dots">
                  <span />
                  <span />
                  <span />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: payload list */}
        <div className="w-full max-w-xl flex flex-col min-h-0">
          <div
            ref={listRef}
            className={cn(
              'cp-autoload-overlay__list glass-card custom-scrollbar scroll-smooth',
              isPS5 ? 'h-[650px]' : 'h-[400px] md:h-[650px]'
            )}
          >
            <div className="cp-autoload-overlay__list-head">
              <h3 className="label-caps !opacity-100 text-sm tracking-widest">
                {t('autoload_overlay.payload_list', 'Payload List')}
              </h3>
              <span className="cp-autoload-overlay__count">
                {isDone ? displayTotal : status.done} / {displayTotal}
              </span>
            </div>

            <div className="space-y-3">
              {payloadList.map((name, i) => {
                const active = !isDone && isExecuting && i === status.done
                const done = isDone || i < status.done
                return (
                  <div
                    key={i}
                    data-active={active}
                    className={cn(
                      'cp-autoload-overlay__item glass-card',
                      active && 'is-active',
                      done && 'is-done',
                      !active && !done && 'is-pending'
                    )}
                  >
                    <div className="flex items-center space-x-5 min-w-0">
                      {done ? (
                        <CheckCircle2 className="cp-autoload-overlay__item-icon is-done w-6 h-6 shrink-0" />
                      ) : active ? (
                        <Loader2 className="cp-autoload-overlay__item-icon is-active w-6 h-6 shrink-0 animate-spin" />
                      ) : (
                        <div className="cp-autoload-overlay__item-icon is-pending w-6 h-6 shrink-0" />
                      )}
                      <PayloadName
                        path={name}
                        className={cn(
                          'text-xl font-bold min-w-0',
                          active ? 'text-white' : 'text-zinc-100'
                        )}
                        stacked
                      />
                    </div>
                    {done && (
                      <span className="cp-autoload-overlay__item-tag">
                        {t('autoload_overlay.success', 'Success')}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AutoloadOverlay

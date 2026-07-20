import React, { useMemo } from 'react'
import { Skull, RefreshCw, AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'
import { useTheme } from '../../theme/ThemeContext'
import HudButton from './HudButton'

/**
 * CP2077-style death / error screen ("FLATLINED").
 *
 * @param {object} props
 * @param {() => void} [props.onRetry]
 * @param {string} [props.title] — big FLATLINED heading (default)
 * @param {string} [props.message] — primary status line
 * @param {string} [props.detail] — secondary explanation (string or leave default offline copy)
 * @param {string} [props.retryLabel]
 * @param {string} [props.chipLabel] — top-left warn chip
 * @param {boolean} [props.embedded] — fit inside a view (not full-viewport takeover)
 * @param {boolean} [props.showReload] — secondary RELOAD INTERFACE row
 */
export default function FlatlinedScreen({
  onRetry,
  title,
  message,
  detail,
  retryLabel,
  chipLabel,
  embedded = false,
  showReload = true,
}) {
  const { t } = useTranslation()
  const { themeId } = useTheme()
  const isCyber = themeId === 'cyberpunk'

  const rain = useMemo(() => {
    const cols = []
    for (let i = 0; i < 18; i++) {
      const digits = Array.from({ length: 28 }, () =>
        (Math.random() > 0.5 ? '1' : '0') + (Math.random() > 0.7 ? 'X' : '')
      ).join('\n')
      cols.push({
        left: `${4 + i * 5.4}%`,
        delay: `${(i * 0.37) % 4}s`,
        duration: `${8 + (i % 5)}s`,
        opacity: 0.12 + (i % 4) * 0.04,
        text: digits,
      })
    }
    return cols
  }, [])

  const deckId = useMemo(
    () => `0.${String(Math.floor(Math.random() * 99999)).padStart(5, '0')}`,
    []
  )

  const handleRetry = () => {
    if (onRetry) onRetry()
    else window.location.reload()
  }

  const flatTitle = title ?? t('app.offline.flatlined', 'FLATLINED')
  const flatMessage =
    message ?? t('app.offline.title', 'Payload Manager is not running...')
  const flatRetry = retryLabel ?? t('app.offline.retry', 'RETRY CONNECTION')
  const flatChip = chipLabel ?? t('app.offline.connection_lost', 'CONNECTION LOST')

  return (
    <div
      className={cn(
        'cp-flatlined',
        isCyber && 'cp-flatlined--cyber',
        embedded && 'cp-flatlined--embedded'
      )}
    >
      <div className="cp-flatlined__rain" aria-hidden="true">
        {rain.map((col, i) => (
          <pre
            key={i}
            className="cp-flatlined__rain-col"
            style={{
              left: col.left,
              animationDelay: col.delay,
              animationDuration: col.duration,
              opacity: col.opacity,
            }}
          >
            {col.text}
          </pre>
        ))}
      </div>

      <div className="cp-flatlined__scan" aria-hidden="true" />
      <div className="cp-flatlined__vignette" aria-hidden="true" />

      <div className="cp-flatlined__top">
        <div className="cp-flatlined__chip cp-flatlined__chip--warn">{flatChip}</div>
        <div className="cp-flatlined__chip">
          {t('app.offline.core_error', 'CORE CRITICAL ERROR AT POINT 0.0')}
        </div>
      </div>

      <div className="cp-flatlined__panel">
        <div className="cp-flatlined__brand">
          <Skull className="cp-flatlined__skull" strokeWidth={1.25} />
          <div className="cp-flatlined__titles">
            <h1 className="cp-flatlined__title">{flatTitle}</h1>
            <p className="cp-flatlined__deck">コーデック {deckId}</p>
          </div>
        </div>

        <p className="cp-flatlined__msg">{flatMessage}</p>

        {detail !== null && (
          <p className="cp-flatlined__detail">
            {detail !== undefined ? (
              detail
            ) : (
              <>
                {t('app.offline.message_1', 'Please ensure you have loaded')}{' '}
                <strong>pldmgr.elf</strong>{' '}
                {t(
                  'app.offline.message_2',
                  'on your PS5 before launching this application.'
                )}
              </>
            )}
          </p>
        )}

        <div className="cp-flatlined__menu">
          <HudButton
            onClick={handleRetry}
            icon={RefreshCw}
            variant="primary"
            size="lg"
            block
            className="cp-btn--bar cp-flatlined__primary"
          >
            {flatRetry}
          </HudButton>

          {showReload && (
            <button
              type="button"
              className="cp-flatlined__menu-item"
              onClick={() => window.location.reload()}
            >
              {t('app.offline.reload', 'RELOAD INTERFACE')}
            </button>
          )}
        </div>

        <div className="cp-flatlined__foot">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            {t('app.offline.fatal', 'FATAL SYSTEM ERROR')} X00302 · NRN_ERROR IN 0A93/
            {deckId.slice(-4)}
          </span>
        </div>
      </div>
    </div>
  )
}

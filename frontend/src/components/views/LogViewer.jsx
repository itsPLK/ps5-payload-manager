import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'
import HudButton from '../ui/HudButton'

const LogViewer = ({ logs }) => {
  const { t } = useTranslation()
  const scrollRef = useRef(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasNewLogs, setHasNewLogs] = useState(false)

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 80
    setIsAtBottom(atBottom)
    if (atBottom) setHasNewLogs(false)
  }

  useEffect(() => {
    if (isAtBottom) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' })
    } else if (logs.length > 0) {
      setHasNewLogs(true)
    }
  }, [logs, isAtBottom])

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setIsAtBottom(true)
    setHasNewLogs(false)
  }

  return (
    <div className="cp-log-viewer">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="cp-log-viewer__scroll custom-scrollbar"
      >
        {logs.length === 0 ? (
          <div className="cp-log-viewer__empty">
            {t("logs.empty", "Waiting for log output…")}
          </div>
        ) : (
          logs.map((log, i) => (
            <div key={`${i}-${String(log).slice(0, 24)}`} className="cp-log-line">
              <span className="cp-log-line__num" aria-hidden="true">
                {String(i + 1).padStart(3, ' ')}
              </span>
              <span className="cp-log-line__prompt" aria-hidden="true">»</span>
              <span className="cp-log-line__text">{log}</span>
            </div>
          ))
        )}
        <div className="cp-log-viewer__pad" aria-hidden="true" />
      </div>

      {!isAtBottom && hasNewLogs && (
        <div className="cp-log-viewer__jump">
          <HudButton
            onClick={scrollToBottom}
            icon={ChevronDown}
            variant="primary"
            size="sm"
          >
            {t("logs.new_activity_btn", "New Activity Below")}
          </HudButton>
        </div>
      )}
    </div>
  )
}

export default LogViewer

import React, { useState, useEffect, useRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const LogViewer = ({ logs }) => {
  const { t } = useTranslation()
  const scrollRef = useRef(null)
  const [isAtBottom, setIsAtBottom] = useState(true)
  const [hasNewLogs, setHasNewLogs] = useState(false)

  const handleScroll = () => {
    if (!scrollRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 100
    setIsAtBottom(atBottom)
    if (atBottom) setHasNewLogs(false)
  }

  useEffect(() => {
    if (isAtBottom) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'auto' })
    } else {
      setHasNewLogs(true)
    }
  }, [logs, isAtBottom])

  const scrollToBottom = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setIsAtBottom(true)
    setHasNewLogs(false)
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col relative group h-full bg-black/40">
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 md:p-8 font-mono text-sm md:text-base space-y-1.5 custom-scrollbar scroll-smooth overscroll-contain"
      >
        {logs.map((log, i) => (
          <div key={`${i}-${log}`} className="flex space-x-4 opacity-100 border-l-2 border-transparent hover:border-ps-blue hover:bg-white/5 px-3 py-0.5 transition-all">
            <span className="text-zinc-600 select-none font-bold shrink-0 w-10 text-right pr-2">{i + 1}</span>
            <span className="text-ps-blue/80 font-bold">»</span>
            <span className="text-zinc-200 break-all leading-relaxed tracking-tight">{log}</span>
          </div>
        ))}
        <div className="h-20" /> {/* Bottom spacing for the button */}
      </div>

      {!isAtBottom && hasNewLogs && (
        <button
          onClick={scrollToBottom}
          className="absolute bottom-10 inset-x-0 mx-auto w-max px-8 py-4 bg-ps-blue text-white rounded-full font-black uppercase tracking-[0.2em] text-[11px] z-50 flex items-center space-x-3 border border-white/20 shadow-[0_0_50px_rgba(0,149,255,0.4)] animate-bounce hover:scale-105 active:scale-95 transition-transform"
        >
          <ChevronDown className="w-5 h-5" />
          <span>{t("logs.new_activity_btn", "New Activity Below")}</span>
        </button>
      )}
    </div>
  )
}

export default LogViewer

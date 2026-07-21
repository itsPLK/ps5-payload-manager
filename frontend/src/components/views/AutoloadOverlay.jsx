import React, { useState, useEffect, useRef } from 'react'
import { CheckCircle2, AlertTriangle, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../utils/helpers'
import PayloadName from '../ui/PayloadName'

const AutoloadOverlay = ({ status, onCancel, onFinish, isPS5 }) => {
  const { t } = useTranslation()
  const isCountdown = status.remaining > 0 || (status.remaining === 0 && !status.current);
  const isExecuting = status.remaining === 0 && !!status.current && status.current !== 'DONE';
  const isDone = status.current === 'DONE';
  const payloadList = (typeof status.list === 'string') ? status.list.split(',').filter(p => p.trim() !== '') : [];
  const listRef = useRef(null);
  const displayTotal = status.total > 0 ? status.total : payloadList.length;
  const progress = displayTotal > 0 ? (status.done / displayTotal) : 0;

  const [localMs, setLocalMs] = useState(status.remaining_ms ?? (status.remaining * 1000));

  useEffect(() => {
    const serverMs = status.remaining_ms ?? (status.remaining * 1000);
    // Only sync downward (forward in time): server can pull us closer to 0 if we drift,
    // but never push us back. This ensures a smooth, non-jumping countdown.
    setLocalMs(prev => serverMs < prev ? serverMs : prev);
  }, [status.remaining_ms, status.remaining]);

  const isActiveRef = useRef(true);

  useEffect(() => {
    if (!isCountdown) return;
    let lastTime = performance.now();
    let frameId;
    const animate = (time) => {
      const delta = time - lastTime;
      lastTime = time;
      if (isActiveRef.current) {
        setLocalMs(prev => Math.max(0, prev - delta));
      }
      frameId = requestAnimationFrame(animate);
    };
    frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isCountdown]);

  useEffect(() => {
    if (listRef.current) {
      const activeItem = listRef.current.querySelector('[data-active="true"]');
      if (activeItem) {
        activeItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [status.done]);

  return (
    <div className="fixed inset-0 bg-[#08080a] z-[9999] flex flex-col items-center justify-center p-6 md:p-12 overflow-y-auto custom-scrollbar">
      <div className={cn(
        "relative w-full max-w-[1400px] flex flex-col items-center",
        isPS5 ? "flex-row items-center justify-center space-x-24 space-y-0" : "md:flex-row md:items-start md:justify-center md:space-x-24 md:space-y-0 space-y-12"
      )}>

        {/* LEFT COLUMN: Status, Countdown, Success, Actions */}
        <div className={cn(
          "w-full max-w-md flex flex-col items-center space-y-10",
          !isPS5 && "md:sticky md:top-0"
        )}>
          {/* Conflict Warning */}
          {!isDone && (payloadList.some(p => p.toLowerCase().includes('etahen')) &&
            payloadList.some(p => p.toLowerCase().includes('kstuff'))) && (
              <div className="w-full p-4 bg-amber-500/10 border border-amber-500/50 rounded-2xl flex items-center justify-center space-x-3 text-amber-500 animate-in fade-in">
                <AlertTriangle className="w-5 h-5" />
                <span className="font-bold uppercase tracking-tight text-xs">{t("autoload_overlay.conflict", "Conflict: etaHEN + KStuff active")}</span>
              </div>
            )}

          {/* Status Header */}
          <div className="h-[320px] w-full flex flex-col items-center justify-center">
            {isCountdown && (
              <div className="space-y-8 animate-in fade-in zoom-in duration-300 text-center">
                <p className="text-ps-blue font-extrabold tracking-[0.2em] uppercase text-xl">{t("autoload_overlay.autoloading", "Autoloading")}</p>
                <div className="relative h-56 w-56 mx-auto flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90 scale-110">
                    <circle cx="112" cy="112" r="100" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                    <circle
                      cx="112" cy="112" r="100"
                      fill="none" stroke="currentColor" strokeWidth="8"
                      strokeDasharray="628"
                      strokeDashoffset={628 - (628 * (localMs / ((status.delay || 5) * 1000)))}
                      className="text-ps-blue"
                    />
                  </svg>
                  <span className="text-8xl font-bold text-white tabular-nums leading-none">
                    {Math.ceil(localMs / 1000)}
                  </span>
                </div>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm">{t("autoload_overlay.waiting", "Waiting for manual abort...")}</p>
              </div>
            )}

            {isExecuting && (
              <div className="space-y-8 animate-in fade-in zoom-in duration-300 text-center">
                <p className="text-ps-blue font-black tracking-[0.4em] uppercase text-xl">{t("autoload_overlay.executing", "Executing")}</p>
                <div className="relative h-56 w-56 mx-auto flex items-center justify-center">
                  <svg className="absolute inset-0 w-full h-full -rotate-90 scale-110">
                    <circle cx="112" cy="112" r="100" fill="none" stroke="currentColor" strokeWidth="8" className="text-white/5" />
                    <circle
                      cx="112" cy="112" r="100"
                      fill="none" stroke="currentColor" strokeWidth="8"
                      strokeDasharray="628"
                      strokeDashoffset={628 - (628 * progress)}
                      className="text-ps-blue transition-all duration-500 ease-out"
                    />
                  </svg>
                  <span className="text-6xl font-black text-white tabular-nums leading-none">
                    {Math.round(progress * 100)}%
                  </span>
                </div>
                <p className="text-zinc-500 font-bold uppercase tracking-widest text-sm italic">{t("autoload_overlay.loading", "Loading Payloads...")}</p>
              </div>
            )}

            {isDone && (
              <div className="flex flex-col items-center space-y-8 animate-in zoom-in duration-500">
                <div className="bg-emerald-500 text-white p-10 rounded-full">
                  <CheckCircle2 className="w-20 h-20" />
                </div>
                <div className="text-center space-y-2">
                  <h2 className="text-5xl md:text-6xl font-black text-white uppercase tracking-tighter">{t("autoload_overlay.done_title_1", "Autoload")}<br />{t("autoload_overlay.done_title_2", "Done")}</h2>
                  <p className="text-zinc-500 font-bold uppercase text-sm tracking-[0.2em]">{t("autoload_overlay.all_loaded", "All payloads loaded")}</p>
                </div>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="w-full pt-4">
            {isDone ? (
              <button
                onClick={onFinish}
                className="w-full py-8 bg-ps-blue text-white text-3xl font-extrabold rounded-3xl hover:bg-[#007acc] transition-all transform active:scale-95 shadow-[0_0_30px_rgba(0,149,255,0.2)]"
              >
                {t("autoload_overlay.return_btn", "Return to Dashboard")}
              </button>
            ) : isCountdown ? (
              <button
                onClick={onCancel}
                autoFocus
                className="w-full py-8 bg-white/10 text-white border border-white/10 text-3xl font-black uppercase rounded-3xl hover:bg-red-600 hover:border-red-600 transition-all transform active:scale-95"
              >
                {t("autoload_overlay.abort_btn", "Abort Autoload")}
              </button>
            ) : (
              <div className="h-[92px] w-full flex items-center justify-center">
                <div className="flex space-x-2">
                  <div className="w-2 h-2 bg-ps-blue rounded-full animate-bounce" />
                  <div className="w-2 h-2 bg-ps-blue rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-2 h-2 bg-ps-blue rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-full max-w-xl flex flex-col min-h-0">
          <div
            ref={listRef}
            className={cn(
              "w-full space-y-4 overflow-y-auto custom-scrollbar p-8 bg-white/5 rounded-[2.5rem] border border-white/10 scroll-smooth",
              isPS5 ? "h-[650px]" : "h-[400px] md:h-[650px]"
            )}
          >
            <div className="flex items-center justify-between mb-6 px-2 sticky top-0 bg-black/20 py-4 z-10 rounded-2xl border-b border-white/5">
              <h3 className="label-caps !text-white !opacity-100 text-sm tracking-widest flex items-center space-x-3">
                <span>{t("autoload_overlay.payload_list", "Payload List")}</span>
              </h3>
              <span className="bg-white/10 px-4 py-1 rounded-full text-zinc-300 font-black text-xs">
                {isDone ? displayTotal : status.done} / {displayTotal}
              </span>
            </div>

            <div className="space-y-3">
              {payloadList.map((name, i) => {
                const active = !isDone && isExecuting && i === status.done;
                const done = isDone || i < status.done;
                return (
                  <div
                    key={i}
                    data-active={active}
                    className={cn(
                      "flex items-center justify-between p-5 rounded-2xl border transition-all duration-500",
                      active ? 'bg-ps-blue/20 border-ps-blue scale-[1.02] z-10' :
                        done ? 'bg-emerald-500/5 border-emerald-500/20 opacity-100' : 'bg-white/5 border-white/10 opacity-40'
                    )}>
                    <div className="flex items-center space-x-5">
                      {done ? <CheckCircle2 className="w-6 h-6 text-emerald-500" /> :
                        active ? <Loader2 className="w-6 h-6 text-ps-blue animate-spin" /> :
                          <div className="w-6 h-6 rounded-full border-2 border-white/10" />}
                      <PayloadName
                        path={name}
                        className={cn("text-xl font-bold", active ? 'text-white' : 'text-zinc-100')}
                        stacked
                      />
                    </div>
                    {done && (
                      <span className="text-emerald-500 text-[10px] font-black uppercase tracking-widest italic">
                        {t("autoload_overlay.success", "Success")}
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

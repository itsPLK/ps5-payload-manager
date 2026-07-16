import React from 'react'
import { Loader2, Globe } from 'lucide-react'
import PayloadName from './PayloadName'

const PayloadButton = ({ path, onClick, isLoading, sourceName, metaVersion = null }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="group glass-card p-6 rounded-ps-xl flex flex-col border border-white/5 hover:border-ps-blue hover:bg-ps-blue/5 transition-all text-left relative overflow-hidden"
    >
      <div className="flex items-start justify-between w-full z-10">
        <PayloadName path={path} className="text-white text-xl" stacked metaVersion={metaVersion} />
        {isLoading && <Loader2 className="w-6 h-6 animate-spin text-ps-blue shrink-0" />}
      </div>
      {path.startsWith('/mnt/usb') && (
        <div className="mt-3 text-[10px] text-zinc-500 font-medium truncate opacity-60 group-hover:opacity-100 transition-opacity z-10 select-none">
          {path}
        </div>
      )}
      {sourceName && !path.startsWith('/mnt/usb') && (
        <div className="absolute bottom-2 right-3 flex items-center gap-1 z-10 pointer-events-none">
          <Globe className="w-3 h-3 text-zinc-500 shrink-0" />
          <span className="text-[11px] text-zinc-400 font-medium truncate max-w-[120px] select-none">
            {sourceName}
          </span>
        </div>
      )}
      {/* Glow effect */}
      <div className="absolute inset-0 bg-ps-blue/0 group-hover:bg-ps-blue/5 transition-colors z-0 pointer-events-none" />
    </button>
  )
}

export default PayloadButton

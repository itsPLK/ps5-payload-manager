import React from 'react'
import { Loader2, Globe, Star, ChevronLeft, ChevronRight } from 'lucide-react'
import PayloadName from './PayloadName'
import { cn } from '../../utils/helpers'

const PayloadButton = ({ path, onClick, isLoading, sourceName, version, isFavorite, isEditMode, onMoveFavorite, canMoveLeft, canMoveRight }) => {
  return (
    <button
      onClick={onClick}
      disabled={isLoading}
      className="group glass-card p-6 rounded-ps-xl flex flex-col border border-white/5 hover:border-ps-blue hover:bg-ps-blue/5 transition-all text-left relative overflow-hidden"
    >
      <div className="flex items-start justify-between w-full z-10">
        <PayloadName path={path} version={version} className="text-white text-xl" stacked />
        <div className="flex items-center gap-2 shrink-0">
          {isEditMode && (
            <div
              className={cn(
                "p-1 rounded-lg transition-all",
                isFavorite ? "text-yellow-400 opacity-100" : "text-zinc-600 opacity-50"
              )}
            >
              <Star className={cn("w-5 h-5", isFavorite && "fill-yellow-400")} />
            </div>
          )}
          {isLoading && <Loader2 className="w-6 h-6 animate-spin text-ps-blue" />}
        </div>
      </div>
      {path.startsWith('/mnt/usb') && (
        <div className="mt-3 text-[10px] text-zinc-500 font-medium truncate opacity-60 group-hover:opacity-100 transition-opacity z-10 select-none">
          {path}
        </div>
      )}
      {sourceName && !path.startsWith('/mnt/usb') && !(isEditMode && isFavorite) && (
        <div className="absolute bottom-2 right-3 flex items-center gap-1 z-10 pointer-events-none">
          <Globe className="w-3 h-3 text-zinc-500 shrink-0" />
          <span className="text-[11px] text-zinc-400 font-medium truncate max-w-[120px] select-none">
            {sourceName}
          </span>
        </div>
      )}
      {(isEditMode && isFavorite) && (
        <div className="absolute bottom-2 right-3 flex items-center gap-2 z-20">
          <button
            onClick={(e) => { e.stopPropagation(); if (canMoveLeft) onMoveFavorite(path, -1); }}
            disabled={!canMoveLeft}
            className="p-1.5 bg-ps-black border border-white/10 rounded-lg hover:bg-ps-blue/20 hover:border-ps-blue hover:text-ps-blue transition-colors disabled:opacity-30 disabled:pointer-events-none text-zinc-400"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); if (canMoveRight) onMoveFavorite(path, 1); }}
            disabled={!canMoveRight}
            className="p-1.5 bg-ps-black border border-white/10 rounded-lg hover:bg-ps-blue/20 hover:border-ps-blue hover:text-ps-blue transition-colors disabled:opacity-30 disabled:pointer-events-none text-zinc-400"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
      <div className="absolute inset-0 bg-ps-blue/0 group-hover:bg-ps-blue/5 transition-colors z-0 pointer-events-none" />
    </button>
  )
}

export default PayloadButton

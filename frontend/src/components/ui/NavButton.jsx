import React from 'react'
import { cn, isPS5 } from '../../utils/helpers'

const NavButton = ({ active, onClick, icon: Icon, label, mobileLabel, className, sidebar, sidebarExpanded, showSeparator, isDonate }) => {
  return (
    <div className="flex items-center flex-1 md:flex-none min-w-max">
      {showSeparator && <div className="w-px h-6 bg-white/10 md:hidden" />}
      <button
        onClick={onClick}
        className={cn(
          "flex items-center transition-all border group relative outline-none",
          sidebar
            ? cn("w-full p-4 mb-2 rounded-2xl border-none", sidebarExpanded ? "justify-start space-x-4" : "justify-center")
            : (isPS5 ? "flex-row space-x-3 px-6 py-3 rounded-2xl" : "flex-col md:flex-row md:space-x-3 px-4 md:px-6 py-2 md:py-3 rounded-2xl border-none flex-1 md:flex-none"),
          active
            ? (sidebar
              ? (isDonate ? "bg-red-600 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)]" : "bg-ps-blue text-white shadow-[0_0_20px_rgba(0,112,209,0.3)]")
              : (isDonate ? "text-red-500" : "text-ps-blue font-black"))
            : (isDonate ? "text-red-500/60" : "bg-transparent text-zinc-400 hover:text-white"),
          className
        )}
      >
        <Icon className={cn(
          "w-6 h-6 shrink-0 group-hover:scale-110 transition-transform",
          active ? (sidebar ? "text-current" : (isDonate ? "text-red-500" : "text-ps-blue")) : (isDonate ? "text-red-500" : "")
        )} />
        <span className={cn(
          "uppercase tracking-tighter transition-all duration-300 whitespace-nowrap overflow-hidden",
          sidebar
            ? (sidebarExpanded ? "opacity-100 w-auto font-bold text-sm" : "opacity-0 w-0")
            : (isPS5 ? "text-sm font-bold" : "text-[10px] md:text-sm")
        )}>
          <span className={cn((isPS5 || sidebar) ? "inline" : "hidden md:inline")}>{label}</span>
          {!isPS5 && !sidebar && <span className={cn("inline md:hidden", active ? (isDonate ? "text-red-500" : "text-ps-blue") : "font-medium text-zinc-500")}>{mobileLabel}</span>}
        </span>
      </button>
    </div>
  )
}

export default NavButton

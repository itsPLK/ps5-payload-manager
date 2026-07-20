import React from 'react'
import { cn, isPS5 } from '../../utils/helpers'

const NavButton = ({ active, onClick, icon: Icon, label, mobileLabel, className, sidebar, sidebarExpanded, showSeparator, isDonate }) => {
  return (
    <div
      className={cn(
        "flex items-center",
        // Sidebar: never grow — stacked items only. Mobile bar: share width.
        sidebar ? "w-full shrink-0" : "flex-1 md:flex-none"
      )}
    >
      {showSeparator && <div className="w-px h-6 bg-white/10 md:hidden" />}
      <button
        onClick={onClick}
        className={cn(
          "flex items-center transition-all border group relative outline-none cp-nav-item",
          sidebar
            ? cn(
                "w-full shrink-0",
                sidebarExpanded ? "justify-start" : "justify-center"
              )
            : (isPS5 ? "flex-row space-x-3 px-6 py-3" : "flex-col md:flex-row md:space-x-3 px-4 md:px-6 py-2 md:py-3 border-none flex-1 md:flex-none"),
          active && "is-active",
          // Donate stays red-tinted, but still uses the same frame shape when active
          isDonate && !active && "cp-nav-donate",
          isDonate && active && "cp-nav-donate is-active",
          className
        )}
      >
        <Icon className={cn(
          "w-5 h-5 shrink-0 transition-colors",
          active ? "text-current" : ""
        )} />
        <span className={cn(
          "uppercase tracking-widest transition-all duration-300 whitespace-nowrap overflow-hidden font-bold",
          sidebar
            ? (sidebarExpanded ? "opacity-100 w-auto text-sm" : "opacity-0 w-0")
            : (isPS5 ? "text-sm" : "text-[10px] md:text-sm")
        )}>
          <span className={cn((isPS5 || sidebar) ? "inline" : "hidden md:inline")}>{label}</span>
          {!isPS5 && !sidebar && (
            <span className={cn("inline md:hidden", active ? "font-black" : "font-medium opacity-70")}>
              {mobileLabel}
            </span>
          )}
        </span>
      </button>
    </div>
  )
}

export default NavButton

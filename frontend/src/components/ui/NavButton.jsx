import React from 'react'
import { cn, isPS5 } from '../../utils/helpers'

/**
 * Shared nav control for sidebar + mobile bar.
 * Layout (padding, gap, radius) comes from theme CSS via .cp-nav-item so
 * Classic and Cyberpunk can look completely different without fighting
 * Tailwind utilities here.
 */
const NavButton = ({ active, onClick, icon: Icon, label, mobileLabel, className, sidebar, sidebarExpanded, showSeparator, isDonate }) => {
  return (
    <div
      className={cn(
        'flex items-center',
        sidebar ? 'w-full shrink-0' : 'flex-1 md:flex-none'
      )}
    >
      {showSeparator && <div className="w-px h-6 bg-white/10 md:hidden" />}
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex items-center transition-all border group relative outline-none cp-nav-item',
          sidebar
            ? cn(
                'w-full shrink-0',
                sidebarExpanded ? 'justify-start' : 'justify-center'
              )
            : (isPS5
              ? 'flex-row px-6 py-3'
              : 'flex-col md:flex-row px-4 md:px-6 py-2 md:py-3 border-none flex-1 md:flex-none'),
          active && 'is-active',
          isDonate && 'cp-nav-donate',
          className
        )}
      >
        <Icon
          className={cn(
            'shrink-0 transition-colors',
            sidebar ? 'w-6 h-6' : 'w-5 h-5'
          )}
        />
        {/* Keep label mounted for expanded sidebar + mobile; fully omit width when collapsed */}
        {(!sidebar || sidebarExpanded) && (
          <span
            className={cn(
              'uppercase transition-all duration-300 whitespace-nowrap overflow-hidden font-bold',
              sidebar ? 'opacity-100 w-auto text-sm' : (isPS5 ? 'text-sm' : 'text-[10px] md:text-sm')
            )}
          >
            <span className={cn((isPS5 || sidebar) ? 'inline' : 'hidden md:inline')}>{label}</span>
            {!isPS5 && !sidebar && (
              <span className={cn('inline md:hidden', active ? 'font-black' : 'font-medium opacity-70')}>
                {mobileLabel}
              </span>
            )}
          </span>
        )}
      </button>
    </div>
  )
}

export default NavButton

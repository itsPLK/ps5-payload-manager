import React from 'react'
import { cn } from '../../utils/helpers'
import { useTheme } from '../../theme/ThemeContext'

/**
 * Theme-aware boolean control.
 * Cyberpunk: segmented OFF | ON bar (game settings style).
 * Classic: pill switch.
 */
export default function ToggleSwitch({ on = false, onChange, className, labels = { off: 'OFF', on: 'ON' } }) {
  const { themeId } = useTheme()
  const isCyber = themeId === 'cyberpunk'

  if (!isCyber) {
    return (
      <button
        type="button"
        role="switch"
        aria-checked={!!on}
        onClick={() => onChange?.(!on)}
        className={cn(
          'w-14 h-7 md:w-20 md:h-10 rounded-full transition-all relative p-1 md:p-1.5',
          on ? 'bg-ps-blue' : 'bg-white/10',
          className
        )}
      >
        <div
          className={cn(
            'w-5 h-5 md:w-7 md:h-7 bg-white rounded-full transition-all',
            on ? 'translate-x-7 md:translate-x-10' : 'translate-x-0'
          )}
        />
      </button>
    )
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!on}
      onClick={() => onChange?.(!on)}
      className={cn('cp-toggle', on ? 'is-on' : 'is-off', className)}
    >
      <span className={cn('cp-toggle__seg cp-toggle__seg--off', !on && 'is-selected')}>
        {labels.off}
      </span>
      <span className={cn('cp-toggle__seg cp-toggle__seg--on', on && 'is-selected')}>
        {labels.on}
      </span>
    </button>
  )
}

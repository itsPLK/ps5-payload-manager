import React from 'react'
import { cn } from '../../utils/helpers'
import { useTheme } from '../../theme/ThemeContext'

/**
 * Action button — Cyberpunk 2077 menu bar style when cyberpunk theme is active.
 * Classic falls back to original rounded pills so dual themes stay isolated.
 *
 * variants: primary | secondary | danger | dangerSoft | success | ghost
 * sizes: sm | md | lg
 */
const CLASSIC = {
  primary:
    'bg-ps-blue hover:bg-ps-blue/80 text-white rounded-2xl font-bold border border-transparent',
  secondary:
    'bg-white/5 hover:bg-white/10 text-white rounded-2xl font-bold border border-white/10',
  danger:
    'bg-red-600 hover:bg-red-500 text-white rounded-2xl font-bold border border-transparent',
  dangerSoft:
    'bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl font-bold border border-red-500/10',
  success:
    'bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-bold border border-transparent',
  ghost:
    'bg-transparent hover:bg-white/5 text-zinc-300 hover:text-white rounded-2xl font-bold border border-white/10 border-dashed',
}

const SIZE_CLASSIC = {
  sm: 'px-4 py-2 text-sm space-x-2',
  md: 'px-6 py-3 text-base space-x-3',
  lg: 'px-8 py-5 text-lg space-x-3',
}

const SIZE_ICON = {
  sm: 'w-4 h-4',
  md: 'w-5 h-5',
  lg: 'w-6 h-6',
}

export default function HudButton({
  children,
  icon: Icon,
  endIcon: EndIcon,
  variant = 'primary',
  size = 'md',
  block = false,
  /** When true, children are not wrapped in .cp-btn__label (for complex rows) */
  raw = false,
  className,
  type = 'button',
  ...props
}) {
  const { themeId } = useTheme()
  const isCyber = themeId === 'cyberpunk'
  const iconSpin = Icon && (Icon.displayName === 'Loader2' || Icon.name === 'Loader2')

  if (!isCyber) {
    return (
      <button
        type={type}
        className={cn(
          'inline-flex items-center justify-center transition-all transform active:scale-95 disabled:opacity-40 disabled:pointer-events-none',
          CLASSIC[variant] || CLASSIC.primary,
          SIZE_CLASSIC[size] || SIZE_CLASSIC.md,
          block && 'w-full',
          EndIcon && 'justify-between',
          className
        )}
        {...props}
      >
        <span className="inline-flex items-center gap-3 min-w-0">
          {Icon && (
            <Icon
              className={cn(
                SIZE_ICON[size] || SIZE_ICON.md,
                'shrink-0',
                iconSpin && 'animate-spin'
              )}
            />
          )}
          {children != null && children !== false && (
            raw ? children : <span className="min-w-0">{children}</span>
          )}
        </span>
        {EndIcon && <EndIcon className={cn(SIZE_ICON[size] || SIZE_ICON.md, 'shrink-0 ml-3')} />}
      </button>
    )
  }

  return (
    <button
      type={type}
      className={cn(
        'cp-btn',
        `cp-btn--${variant}`,
        size !== 'md' && `cp-btn--${size}`,
        block && 'cp-btn--block',
        EndIcon && 'cp-btn--with-end',
        className
      )}
      {...props}
    >
      {Icon && (
        <Icon
          className={cn(
            'cp-btn__icon',
            SIZE_ICON[size] || SIZE_ICON.md,
            iconSpin && 'animate-spin'
          )}
        />
      )}
      {children != null && children !== false && children !== '' && (
        raw ? (
          <span className="cp-btn__body min-w-0 flex-1 text-left">{children}</span>
        ) : (
          <span className="cp-btn__label">{children}</span>
        )
      )}
      {EndIcon && (
        <EndIcon className={cn('cp-btn__icon cp-btn__end', SIZE_ICON[size] || SIZE_ICON.md)} />
      )}
    </button>
  )
}

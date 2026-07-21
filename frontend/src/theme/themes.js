/**
 * Payload Manager themes — pack registry + full isolation.
 *
 * To add a theme:
 *   1. Add defineTheme(...) below (or import from ./packs/<id>.js)
 *   2. Prefer extends + vars for palette skins; set skin only for a new chrome family
 *   3. Optional: theme-*.css scoped with [data-skin="<family>"] or [data-theme="<id>"]
 *   4. Optional: public/favicon-<id>.svg + favicon field
 *   5. Import CSS in index.css if you add a new stylesheet
 *
 * Prefer hasFeature(...) over themeId === '…' in components.
 */

export const THEME_STORAGE_KEY = 'pldmgr-theme'
export const DEFAULT_THEME = 'classic'

/** Shared token keys — every resolved theme must define every key. */
export const THEME_VAR_KEYS = [
  '--color-ps-blue',
  '--color-ps-blue-glow',
  '--color-ps-yellow',
  '--color-ps-red',
  '--color-ps-black',
  '--color-ps-surface',
  '--color-ps-card',
  '--color-ps-border',
  '--color-nav-idle',
  '--color-nav-active',
  '--color-nav-active-bg',
  '--color-nav-active-border',
  '--color-nav-hover',
  '--color-nav-hover-bg',
  '--color-title-accent',
  '--color-title-glow',
  '--color-hud',
  '--color-text',
  '--color-muted',
  '--color-scrollbar',
  '--color-card-hover-bg',
  '--color-card-hover-border',
  '--color-card-hover-shadow',
  '--color-brand',
  '--color-brand-glow',
  '--color-brand-icon-bg',
  '--color-brand-icon-fg',
  '--color-brand-icon-border',
  '--color-brand-icon-shadow',
  '--font-ui',
  '--font-display',
  '--radius-ps-xl',
  '--radius-ps-2xl',
  '--radius-ps-3xl',
  '--radius-nav',
  '--letter-spacing-body',
  '--letter-spacing-heading',
  '--text-transform-heading',
  '--theme-atmosphere',
]

/**
 * Feature flags — chrome modules / UX variants.
 * Components should call hasFeature('atmosphere') instead of themeId === 'x'.
 */
export const FEATURE_DEFAULTS = {
  /** Code rain / haze backdrop */
  atmosphere: false,
  /** Top HUD bar (version / IP) */
  hudBar: false,
  /** Yellow hazard stripe under top chrome */
  hazardStripe: false,
  /** FLATLINED death-screen errors (vs simple classic cards) */
  flatlinedError: false,
  /** Segmented OFF|ON toggles + cyber bar-style buttons */
  hudControls: false,
  /** Slightly denser main padding used by HUD layouts */
  densePadding: false,
}

/** Built-in favicon map (public/). New themes can set favicon: '/favicon-x.svg'. */
export const THEME_FAVICONS = {
  classic: '/favicon-classic.svg',
  cyberpunk: '/favicon-cyberpunk.svg',
}

/** @type {Record<string, object>} */
const THEME_DEFS = {}

/**
 * Register a theme pack.
 *
 * @param {string} id
 * @param {object} opts
 * @param {string} opts.label
 * @param {string} [opts.description]
 * @param {string} [opts.favicon]
 * @param {string} [opts.extends] — id of base theme for vars + features + skin merge
 * @param {string} [opts.skin] — CSS chrome family (`data-skin`). Defaults to id, or parent when extends.
 *   Built-in skins: `classic` (theme-classic.css), `cyberpunk` (theme-cyberpunk.css).
 * @param {Partial<typeof FEATURE_DEFAULTS>} [opts.features]
 * @param {string[]} [opts.swatches] — Settings picker color chips
 * @param {Record<string, string>} opts.vars — CSS custom properties (full or partial if extends)
 */
export function defineTheme(id, opts) {
  if (!id || !opts?.label) {
    throw new Error('defineTheme(id, { label, vars }) requires id and label')
  }
  THEME_DEFS[id] = { id, ...opts }
  return THEME_DEFS[id]
}

function resolveThemeDef(id, seen = new Set()) {
  const def = THEME_DEFS[id]
  if (!def) return null
  if (seen.has(id)) {
    throw new Error(`Theme cycle detected at "${id}"`)
  }
  seen.add(id)

  let baseVars = {}
  let baseFeatures = { ...FEATURE_DEFAULTS }
  let baseSkin = null
  if (def.extends) {
    const parent = resolveThemeDef(def.extends, seen)
    if (!parent) {
      throw new Error(`Theme "${id}" extends unknown theme "${def.extends}"`)
    }
    baseVars = { ...parent.vars }
    baseFeatures = { ...parent.features }
    baseSkin = parent.skin
  }

  const features = { ...baseFeatures, ...(def.features || {}) }
  const vars = { ...baseVars, ...(def.vars || {}) }
  // skin = explicit pack skin → parent skin (extends) → own id
  const skin = def.skin || baseSkin || id

  // Validate complete token set
  const missing = THEME_VAR_KEYS.filter((k) => vars[k] == null || vars[k] === '')
  if (missing.length) {
    console.warn(`[theme] "${id}" missing CSS vars:`, missing.join(', '))
  }

  return {
    id,
    label: def.label,
    description: def.description || '',
    favicon: def.favicon || THEME_FAVICONS[id] || THEME_FAVICONS[DEFAULT_THEME],
    skin,
    swatches: def.swatches || [],
    features,
    vars,
  }
}

// ── Packs ───────────────────────────────────────────────────────────

defineTheme('classic', {
  label: 'Classic',
  description: 'Original PS blue manager look',
  skin: 'classic',
  favicon: THEME_FAVICONS.classic,
  swatches: ['#0095ff', '#101014', '#ffffff', '#08080a'],
  features: { ...FEATURE_DEFAULTS },
  vars: {
    '--color-ps-blue': '#0095ff',
    '--color-ps-blue-glow': 'rgba(0, 149, 255, 0.4)',
    '--color-ps-yellow': '#fcee0a',
    '--color-ps-red': '#ef4444',
    '--color-ps-black': '#08080a',
    '--color-ps-surface': '#101014',
    '--color-ps-card': 'rgba(24, 24, 28, 0.8)',
    '--color-ps-border': 'rgba(255, 255, 255, 0.08)',
    '--color-nav-idle': '#a1a1aa',
    '--color-nav-active': '#ffffff',
    '--color-nav-active-bg': '#0095ff',
    '--color-nav-active-border': 'transparent',
    '--color-nav-hover': '#ffffff',
    '--color-nav-hover-bg': 'rgba(255, 255, 255, 0.05)',
    '--color-title-accent': '#0095ff',
    '--color-title-glow': 'transparent',
    '--color-hud': 'rgba(255, 255, 255, 0.35)',
    '--color-text': '#f4f4f5',
    '--color-muted': '#a1a1aa',
    '--color-scrollbar': 'rgba(255, 255, 255, 0.15)',
    '--color-card-hover-bg': 'rgba(40, 40, 45, 0.95)',
    '--color-card-hover-border': '#0095ff',
    '--color-card-hover-shadow': 'none',
    '--color-brand': '#ffffff',
    '--color-brand-glow': 'transparent',
    '--color-brand-icon-bg': '#0095ff',
    '--color-brand-icon-fg': '#ffffff',
    '--color-brand-icon-border': 'transparent',
    '--color-brand-icon-shadow': 'none',
    '--font-ui': 'system-ui, "Segoe UI", sans-serif',
    '--font-display': 'system-ui, "Segoe UI", sans-serif',
    '--radius-ps-xl': '1rem',
    '--radius-ps-2xl': '1.5rem',
    '--radius-ps-3xl': '2rem',
    '--radius-nav': '1rem',
    '--letter-spacing-body': 'normal',
    '--letter-spacing-heading': '-0.025em',
    '--text-transform-heading': 'none',
    '--theme-atmosphere': '0',
  },
})

defineTheme('cyberpunk', {
  label: 'Cyberpunk 2077',
  description: 'Night City HUD — red chrome, cyan select, code rain',
  skin: 'cyberpunk',
  favicon: THEME_FAVICONS.cyberpunk,
  swatches: ['#ff3c3c', '#00f0ff', '#fcee0a', '#0a0508'],
  // Full token set (does not extend classic — different chrome family)
  features: {
    atmosphere: true,
    hudBar: true,
    hazardStripe: true,
    flatlinedError: true,
    hudControls: true,
    densePadding: true,
  },
  vars: {
    '--color-ps-blue': '#00f0ff',
    '--color-ps-blue-glow': 'rgba(0, 240, 255, 0.45)',
    '--color-ps-yellow': '#fcee0a',
    '--color-ps-red': '#ff3c3c',
    '--color-ps-black': '#0a0508',
    '--color-ps-surface': 'rgba(12, 4, 8, 0.92)',
    '--color-ps-card': 'rgba(18, 6, 10, 0.82)',
    '--color-ps-border': 'rgba(255, 60, 60, 0.28)',
    '--color-nav-idle': 'rgba(255, 90, 90, 0.75)',
    '--color-nav-active': '#00f0ff',
    '--color-nav-active-bg': 'rgba(0, 240, 255, 0.04)',
    '--color-nav-active-border': '#00f0ff',
    '--color-nav-hover': '#ff9a9a',
    '--color-nav-hover-bg': 'transparent',
    '--color-title-accent': '#ff3c3c',
    '--color-title-glow': 'rgba(255, 60, 60, 0.45)',
    '--color-hud': 'rgba(255, 80, 80, 0.55)',
    '--color-text': '#e8e4e0',
    '--color-muted': '#7a6a68',
    '--color-scrollbar': 'rgba(255, 60, 60, 0.35)',
    '--color-card-hover-bg': 'rgba(20, 10, 16, 0.95)',
    '--color-card-hover-border': 'rgba(0, 240, 255, 0.45)',
    '--color-card-hover-shadow': '0 0 24px rgba(0, 240, 255, 0.12)',
    '--color-brand': '#ff3c3c',
    '--color-brand-glow': 'rgba(255, 60, 60, 0.55)',
    '--color-brand-icon-bg': 'transparent',
    '--color-brand-icon-fg': '#ff3c3c',
    '--color-brand-icon-border': 'rgba(255, 60, 60, 0.5)',
    '--color-brand-icon-shadow': '0 0 16px rgba(255, 60, 60, 0.25)',
    '--font-ui': '"Share Tech Mono", Consolas, "Courier New", monospace',
    '--font-display': '"Share Tech Mono", Consolas, monospace',
    '--radius-ps-xl': '0.25rem',
    '--radius-ps-2xl': '0.35rem',
    '--radius-ps-3xl': '0.5rem',
    '--radius-nav': '2px',
    '--letter-spacing-body': '0.02em',
    '--letter-spacing-heading': '0.04em',
    '--text-transform-heading': 'uppercase',
    '--theme-atmosphere': '1',
  },
})

/**
 * Example palette-only theme (inherits cyberpunk features + skin CSS).
 * Uncomment to register — zero JSX changes; Settings grid picks it up automatically.
 *
 * defineTheme('matrix', {
 *   label: 'Matrix',
 *   description: 'HUD chrome with green phosphor palette',
 *   extends: 'cyberpunk', // → skin: cyberpunk, all HUD features on
 *   swatches: ['#00ff66', '#003311', '#0a0f0a', '#001a0a'],
 *   favicon: '/favicon-cyberpunk.svg',
 *   vars: {
 *     '--color-ps-blue': '#00ff66',
 *     '--color-ps-blue-glow': 'rgba(0, 255, 102, 0.45)',
 *     '--color-ps-red': '#00cc55',
 *     '--color-title-accent': '#00ff66',
 *     '--color-nav-idle': 'rgba(0, 255, 100, 0.55)',
 *     '--color-nav-active': '#00ff66',
 *     '--color-brand': '#00ff66',
 *     '--color-brand-icon-fg': '#00ff66',
 *     '--color-brand-icon-border': 'rgba(0, 255, 100, 0.45)',
 *     '--color-scrollbar': 'rgba(0, 255, 100, 0.35)',
 *   },
 * })
 */

// ── Resolved registry ───────────────────────────────────────────────

function buildThemes() {
  const out = {}
  for (const id of Object.keys(THEME_DEFS)) {
    out[id] = resolveThemeDef(id)
  }
  return out
}

export const THEMES = buildThemes()

export function listThemes() {
  return Object.values(THEMES)
}

export function getTheme(id) {
  return THEMES[id] || THEMES[DEFAULT_THEME]
}

/** @param {string} themeId @param {keyof typeof FEATURE_DEFAULTS} feature */
export function themeHasFeature(themeId, feature) {
  const theme = getTheme(themeId)
  return !!theme.features?.[feature]
}

/**
 * Swap tab favicon for the active theme.
 * Cache-bust so browsers actually repaint when switching.
 */
export function applyThemeFavicon(themeId) {
  if (typeof document === 'undefined') return
  const theme = getTheme(themeId)
  const href = theme.favicon || THEME_FAVICONS[DEFAULT_THEME] || '/favicon-classic.svg'
  const bust = `${href}?theme=${encodeURIComponent(theme.id)}`

  let link = document.querySelector('link[rel="icon"][data-theme-favicon]')
  if (!link) {
    link = document.querySelector('link[rel="icon"][type="image/svg+xml"]')
  }
  if (!link) {
    link = document.createElement('link')
    link.setAttribute('rel', 'icon')
    link.setAttribute('type', 'image/svg+xml')
    link.setAttribute('data-theme-favicon', '1')
    document.head.appendChild(link)
  }
  link.setAttribute('type', 'image/svg+xml')
  link.setAttribute('data-theme-favicon', '1')
  link.setAttribute('href', bust)
}

/**
 * Apply a theme with full isolation:
 * - removes every known theme class
 * - rewrites ALL theme CSS variables (complete set)
 * - sets data-theme for CSS selectors
 * - syncs body typography
 * - swaps favicon for the selected theme
 */
export function applyThemeVars(themeId) {
  const theme = getTheme(themeId)
  const root = document.documentElement
  const skin = theme.skin || theme.id

  Array.from(root.classList).forEach((c) => {
    if (c.startsWith('theme-') || c.startsWith('skin-')) root.classList.remove(c)
  })
  root.classList.add(`theme-${theme.id}`)
  root.classList.add(`skin-${skin}`)
  // data-theme = pack id (identity); data-skin = CSS chrome family (classic | cyberpunk | …)
  root.setAttribute('data-theme', theme.id)
  root.setAttribute('data-skin', skin)

  // Feature flags as data attributes for pure-CSS optional chrome
  Object.entries(theme.features || {}).forEach(([key, on]) => {
    root.setAttribute(`data-feature-${key}`, on ? '1' : '0')
  })

  THEME_VAR_KEYS.forEach((key) => {
    const value = theme.vars[key]
    if (value != null) root.style.setProperty(key, value)
    else root.style.removeProperty(key)
  })

  if (document.body) {
    document.body.style.fontFamily = theme.vars['--font-ui'] || ''
    document.body.style.letterSpacing = theme.vars['--letter-spacing-body'] || 'normal'
    document.body.style.color = theme.vars['--color-text'] || ''
    document.body.style.backgroundColor = theme.vars['--color-ps-black'] || ''
  }

  applyThemeFavicon(theme.id)
}

# Themes

Payload Manager themes are **packs**: tokens + feature flags + a CSS chrome family (`skin`).

## Concepts

| Layer | What it is | How it is selected |
|-------|------------|--------------------|
| **Pack id** (`data-theme`) | Identity / storage key | `defineTheme('matrix', …)` |
| **Skin** (`data-skin`) | CSS chrome family | `skin: 'cyberpunk'` or inherited via `extends` |
| **Features** | Optional DOM / UX modules | `features: { atmosphere: true, … }` + `hasFeature()` |
| **Vars** | CSS custom properties | full set or overrides on top of `extends` |

Built-in skins:

- `classic` → `theme-classic.css`
- `cyberpunk` → `theme-cyberpunk.css`

A palette-only theme can `extends: 'cyberpunk'` and get the HUD chrome **without** copying CSS or touching JSX.

## Add a theme in 4 steps

### 1. Register the pack (`themes.js`)

```js
defineTheme('matrix', {
  label: 'Matrix',
  description: 'HUD chrome with green phosphor palette',
  // Reuse cyberpunk chrome modules + CSS skin:
  extends: 'cyberpunk',
  swatches: ['#00ff66', '#003311', '#0a0f0a', '#001a0a'],
  favicon: '/favicon-cyberpunk.svg', // or public/favicon-matrix.svg
  // Only override what changes:
  vars: {
    '--color-ps-blue': '#00ff66',
    '--color-ps-blue-glow': 'rgba(0, 255, 102, 0.45)',
    '--color-ps-red': '#00cc55',
    '--color-title-accent': '#00ff66',
    '--color-nav-idle': 'rgba(0, 255, 100, 0.55)',
    '--color-nav-active': '#00ff66',
    '--color-brand': '#00ff66',
    '--color-brand-icon-fg': '#00ff66',
  },
})
```

`extends` merges **vars**, **features**, and **skin** from the base theme, then applies your overrides.

### 2. Feature flags (chrome modules)

| Feature | What it enables |
|---------|-----------------|
| `atmosphere` | Code-rain / haze backdrop |
| `hudBar` | Top HUD strip (version / IP) |
| `hazardStripe` | Yellow hazard tape |
| `flatlinedError` | FLATLINED death screen (else classic error cards) |
| `hudControls` | Segmented OFF\|ON toggles + bar-style buttons |
| `densePadding` | Tighter main content padding |

In components:

```js
const { hasFeature } = useTheme()
// or: import { useThemeFeature } from '../theme/ThemeContext'
if (hasFeature('atmosphere')) return <Atmosphere />
```

**Do not** use `themeId === 'cyberpunk'` for behavior — that blocks new themes.

### 3. Optional CSS overrides

Create `theme-matrix.css` only if tokens + the inherited skin cannot express something:

```css
[data-theme="matrix"] .some-special-shape {
  /* pack-specific one-offs */
}

/* Or a brand-new chrome family: */
[data-skin="matrix"] .cp-btn { /* … */ }
```

Import new stylesheets from `src/index.css` after the shared theme CSS.

Also available on `<html>`:

```html
data-theme="matrix"
data-skin="cyberpunk"
data-feature-atmosphere="1"
data-feature-hudBar="1"
…
```

### 4. Favicon (optional)

Add `public/favicon-<id>.svg` and set `favicon: '/favicon-<id>.svg'` on the pack.
`applyThemeVars` swaps the tab icon automatically.

## Token checklist

Every fully resolved theme must define all keys in `THEME_VAR_KEYS` (via base + overrides).
Missing keys log a console warning.

## Settings UI

The Appearance grid auto-lists `Object.values(THEMES)`.  
Use `swatches: ['#…', …]` for the color chips (up to 4 shown). Falls back to key brand tokens if omitted.

## Built-in packs

| id | skin | Role |
|----|------|------|
| `classic` | `classic` | Default — clean PS blue UI, simple errors |
| `cyberpunk` | `cyberpunk` | Full HUD chrome + FLATLINED |

`DEFAULT_THEME` is `classic`.

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Kept as ps-* so existing classes work — values are Night City palette
        'ps-blue': '#00f0ff',
        'ps-blue-glow': 'rgba(0, 240, 255, 0.4)',
        'ps-yellow': '#fcee0a',
        'ps-red': '#ff3c3c',
        'ps-black': '#05040a',
        'ps-surface': '#0a080c',
        'ps-card': 'rgba(12, 8, 14, 0.88)',
        'ps-border': 'rgba(255, 60, 60, 0.18)',
      },
      borderRadius: {
        'ps-xl': '0.75rem',
        'ps-2xl': '1rem',
        'ps-3xl': '1.25rem',
      },
      fontFamily: {
        'ps5': ['"Share Tech Mono"', 'Consolas', 'monospace'],
        'display': ['Orbitron', 'Oxanium', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'cp-cyan': '0 0 24px rgba(0, 240, 255, 0.25)',
        'cp-yellow': '0 0 24px rgba(252, 238, 10, 0.25)',
        'cp-red': '0 0 24px rgba(255, 60, 60, 0.2)',
      },
    },
  },
  plugins: [],
}

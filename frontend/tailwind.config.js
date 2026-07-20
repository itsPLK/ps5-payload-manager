/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Resolve through CSS custom properties so Classic/Cyberpunk switch works
        'ps-blue': 'var(--color-ps-blue)',
        'ps-blue-glow': 'var(--color-ps-blue-glow)',
        'ps-yellow': 'var(--color-ps-yellow)',
        'ps-red': 'var(--color-ps-red)',
        'ps-black': 'var(--color-ps-black)',
        'ps-surface': 'var(--color-ps-surface)',
        'ps-card': 'var(--color-ps-card)',
        'ps-border': 'var(--color-ps-border)',
      },
      borderRadius: {
        'ps-xl': 'var(--radius-ps-xl)',
        'ps-2xl': 'var(--radius-ps-2xl)',
        'ps-3xl': 'var(--radius-ps-3xl)',
      },
      fontFamily: {
        'ps5': 'var(--font-ui)',
        'display': 'var(--font-display)',
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

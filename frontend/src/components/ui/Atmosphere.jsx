/**
 * Cyberpunk atmosphere: red haze, code rain, grid — like Flatlined / pause menu.
 * Only visible when data-theme=cyberpunk (opacity via CSS).
 */

const COLS = 18
const ROWS = 24

function makeColumn(seed) {
  const lines = []
  for (let i = 0; i < ROWS; i++) {
    const n = ((seed * 17 + i * 31) % 1000) / 1000
    lines.push(n.toFixed(4))
  }
  return lines.join('\n')
}

export default function Atmosphere() {
  return (
    <div className="cp-atm" aria-hidden="true">
      <div className="cp-atm__haze" />
      <div className="cp-atm__grid" />
      <div className="cp-atm__vignette" />
      <div className="cp-atm__scanlines" />

      <div className="cp-atm__rain">
        {Array.from({ length: COLS }, (_, i) => (
          <pre
            key={i}
            className={`cp-atm__col cp-atm__col--${(i % 3) + 1}`}
            style={{
              left: `${(i / COLS) * 100}%`,
              animationDelay: `${-(i * 0.45)}s`,
              animationDuration: `${10 + (i % 5)}s`,
            }}
          >
            {makeColumn(i + 3)}
          </pre>
        ))}
      </div>
      {/* Corner status chips intentionally omitted — they clipped page headers */}
    </div>
  )
}

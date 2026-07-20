/**
 * Top HUD strip — pause menu style (level / street cred / eurodollars vibe).
 */
export default function HudBar({ version, ip }) {
  return (
    <header className="cp-hudbar" aria-hidden="false">
      <div className="cp-hudbar__left">
        <span className="cp-hudbar__stat">
          <span className="cp-hudbar__num">PLD</span>
          <span className="cp-hudbar__label">MGR</span>
        </span>
        <span className="cp-hudbar__sep" />
        <span className="cp-hudbar__stat cp-hudbar__stat--cyan">
          <span className="cp-hudbar__num">LINK</span>
          <span className="cp-hudbar__label">ACTIVE</span>
        </span>
      </div>
      <div className="cp-hudbar__mid">
        <span className="cp-hudbar__protocol">PROTOCOL 6920-A44 // PAYLOAD MANAGER</span>
      </div>
      <div className="cp-hudbar__right">
        <span className="cp-hudbar__meta">{version || '—'}</span>
        <span className="cp-hudbar__sep" />
        <span className="cp-hudbar__meta cp-hudbar__meta--cyan">{ip || '0.0.0.0'}</span>
      </div>
    </header>
  )
}

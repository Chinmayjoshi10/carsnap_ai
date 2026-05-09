import { useEffect, useState } from 'react'

/**
 * ScanFrame — animated card-alignment guide overlay.
 *
 * Renders a business-card-ratio rectangle with:
 *  • Animated corner brackets with subtle glow
 *  • Scan line that sweeps vertically
 *  • Dark vignette outside the scan area
 *  • Instruction text at the bottom
 *
 * Props:
 *  @param {string}  label - "Front" | "Back"
 *  @param {boolean} active - whether camera is live
 */
export default function ScanFrame({ label = 'Front', active = true }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(t)
  }, [])

  if (!active) return null

  return (
    <div className="cs-scan-overlay" aria-hidden="true">
      {/* Dark vignette mask — drawn with box-shadow on the frame */}
      <div
        className="cs-scan-frame-wrapper"
        style={{ opacity: mounted ? 1 : 0, transform: mounted ? 'scale(1)' : 'scale(0.97)' }}
      >
        {/* Main frame */}
        <div className="cs-scan-frame">
          {/* Corner brackets */}
          <span className="cs-corner cs-tl" />
          <span className="cs-corner cs-tr" />
          <span className="cs-corner cs-bl" />
          <span className="cs-corner cs-br" />

          {/* Scan line */}
          <div className="cs-scan-line" />

          {/* Side badge */}
          <div className="cs-side-badge">
            <span className="cs-side-dot" />
            {label} side
          </div>
        </div>
      </div>

      {/* Instruction text */}
      <p className="cs-scan-instruction">
        Position card within the frame
      </p>
    </div>
  )
}

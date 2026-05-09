/**
 * CaptureControls — bottom dock for the camera scanner.
 *
 * Modes:
 *  • LIVE:     gallery button · shutter · camera-flip
 *  • REVIEW:   retake · use-photo
 *
 * Props:
 *  @param {boolean}  cameraReady
 *  @param {boolean}  hasCapture    - true when a photo is captured (review mode)
 *  @param {boolean}  hasFlip       - device has multiple cameras
 *  @param {function} onShutter
 *  @param {function} onRetake
 *  @param {function} onUsePhoto
 *  @param {function} onFlipCamera
 *  @param {function} onGalleryPick - receives (e) from file input
 */
export default function CaptureControls({
  cameraReady,
  hasCapture,
  hasFlip,
  onShutter,
  onRetake,
  onUsePhoto,
  onFlipCamera,
  onGalleryPick,
}) {
  // ─── REVIEW MODE ───
  if (hasCapture) {
    return (
      <div className="cs-controls cs-controls-review">
        <button onClick={onRetake} className="cs-action-pill cs-retake" aria-label="Retake">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Retake</span>
        </button>

        <button onClick={onUsePhoto} className="cs-action-pill cs-use" aria-label="Use photo">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span>Use Photo</span>
        </button>
      </div>
    )
  }

  // ─── LIVE MODE ───
  return (
    <div className="cs-controls cs-controls-live">
      {/* Gallery */}
      <label className="cs-ctrl-btn cs-gallery" aria-label="Upload from gallery">
        <input
          type="file"
          accept="image/*"
          onChange={onGalleryPick}
          style={{ display: 'none' }}
        />
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </label>

      {/* Shutter */}
      <button
        onClick={onShutter}
        disabled={!cameraReady}
        className="cs-shutter"
        aria-label="Capture"
      >
        <span className="cs-shutter-ring" />
        <span className="cs-shutter-fill" />
      </button>

      {/* Flip camera */}
      {hasFlip ? (
        <button onClick={onFlipCamera} className="cs-ctrl-btn cs-flip" aria-label="Switch camera">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M20 7l-3-3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M17 4v7a4 4 0 01-4 4H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            <path d="M4 17l3 3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M7 20v-7a4 4 0 014-4h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      ) : (
        <div className="cs-ctrl-spacer" />
      )}
    </div>
  )
}

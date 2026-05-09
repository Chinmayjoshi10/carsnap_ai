import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import CameraOverlay from './scanner/CameraOverlay'
import CardPreviewStack from './scanner/CardPreviewStack'
import './scanner/scanner.css'

/**
 * CardUploader — orchestrates the premium scanning workflow.
 *
 * Flow:
 *  1. Launch screen (camera hero + gallery fallback)
 *  2. → CameraOverlay for front capture
 *  3. → Preview + back-side prompt (camera or upload or skip)
 *  4. → CameraOverlay for back capture (optional)
 *  5. → CardPreviewStack showing both sides
 *
 * Props (unchanged from original):
 *  @param {function}     onFrontCaptured
 *  @param {function}     onBackCaptured
 *  @param {string|null}  frontImage
 *  @param {string|null}  backImage
 */

const cameraSupported = !!(
  typeof navigator !== 'undefined' &&
  navigator.mediaDevices &&
  navigator.mediaDevices.getUserMedia
)

export default function CardUploader({ onFrontCaptured, onBackCaptured, frontImage, backImage }) {
  const [showCamera, setShowCamera] = useState(false)
  const [cameraSide, setCameraSide] = useState('front')

  const readFile = (file, callback) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onloadend = () => callback(reader.result)
    reader.readAsDataURL(file)
  }

  const openCamera = (side) => {
    setCameraSide(side)
    setShowCamera(true)
  }

  const handleCameraCapture = (base64) => {
    setShowCamera(false)
    if (cameraSide === 'front') {
      onFrontCaptured(base64)
    } else {
      onBackCaptured(base64)
    }
  }

  // ─── Camera overlay ───
  if (showCamera) {
    return (
      <AnimatePresence>
        <CameraOverlay
          key="camera"
          onCapture={handleCameraCapture}
          onClose={() => setShowCamera(false)}
          side={cameraSide}
        />
      </AnimatePresence>
    )
  }

  // ─── BOTH SIDES CAPTURED ───
  if (frontImage && backImage) {
    return (
      <CardPreviewStack
        frontImage={frontImage}
        backImage={backImage}
        onRetakeFront={() => onFrontCaptured(null)}
        onRetakeBack={() => onBackCaptured(null)}
        onRemoveBack={() => onBackCaptured(null)}
        onReset={() => onFrontCaptured(null)}
      />
    )
  }

  // ─── FRONT CAPTURED → prompt for back ───
  if (frontImage && !backImage) {
    return (
      <div className="cs-back-prompt">
        <CardPreviewStack
          frontImage={frontImage}
          backImage={null}
          onRetakeFront={() => onFrontCaptured(null)}
          onReset={() => onFrontCaptured(null)}
        />

        {/* Back side options */}
        <div className="cs-back-options">
          {cameraSupported && (
            <button
              onClick={() => openCamera('back')}
              className="cs-back-option cs-primary"
            >
              <div className="cs-back-option-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.8"/>
                </svg>
              </div>
              <div className="cs-back-option-text">
                <h4>Scan back</h4>
                <p>Use camera</p>
              </div>
            </button>
          )}

          <label className="cs-back-option">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => readFile(e.target.files[0], onBackCaptured)}
            />
            <div className="cs-back-option-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <polyline points="17 8 12 3 7 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                <line x1="12" y1="3" x2="12" y2="15" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="cs-back-option-text">
              <h4>Upload back</h4>
              <p>From gallery</p>
            </div>
          </label>
        </div>

        <button
          onClick={() => onBackCaptured('skip')}
          className="cs-back-skip"
        >
          Skip — continue with front only
        </button>
      </div>
    )
  }

  // ─── INITIAL STATE — launch screen ───
  return (
    <div className="cs-launcher">
      {/* Hero camera button */}
      {cameraSupported && (
        <button onClick={() => openCamera('front')} className="cs-launch-btn">
          <div className="cs-launch-glow" />
          <div className="cs-launch-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="13" r="4" stroke="currentColor" strokeWidth="1.6"/>
            </svg>
          </div>
          <div className="cs-launch-text">
            <h3>Scan Business Card</h3>
            <p>AI-powered card recognition</p>
          </div>
          <div className="cs-launch-badge">
            <span className="cs-launch-badge-dot" />
            Live Scanner
          </div>
        </button>
      )}

      {/* Divider */}
      {cameraSupported && (
        <div className="cs-launch-divider">
          <span>or upload a photo</span>
        </div>
      )}

      {/* Gallery fallback */}
      <label className="cs-launch-gallery">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => readFile(e.target.files[0], onFrontCaptured)}
        />
        <div className="cs-launch-gallery-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.6"/>
            <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
            <path d="M3 16l5-5 4 4 3-3 6 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <div className="cs-launch-gallery-text">
          <h4>Upload from gallery</h4>
          <p>Select a photo or drag & drop</p>
        </div>
      </label>
    </div>
  )
}

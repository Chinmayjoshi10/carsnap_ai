import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import ScanFrame from './ScanFrame'
import CaptureControls from './CaptureControls'

/**
 * CameraOverlay — immersive fullscreen camera scanner.
 *
 * Orchestrates the complete capture workflow:
 *  1. Live camera viewfinder with scan frame
 *  2. Capture with flash + haptic
 *  3. Photo review (retake / use)
 *  4. Graceful error fallback
 *
 * Props:
 *  @param {function} onCapture  – called with base64 data-URL
 *  @param {function} onClose    – called when user cancels
 *  @param {string}   side       – "front" | "back"
 */
export default function CameraOverlay({ onCapture, onClose, side = 'front' }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)

  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState(null)
  const [facingMode, setFacingMode] = useState('environment')
  const [capturedImage, setCapturedImage] = useState(null)
  const [flashActive, setFlashActive] = useState(false)
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false)
  const [entering, setEntering] = useState(true)

  const label = side === 'front' ? 'Front' : 'Back'

  // ─── Entrance animation ───
  useEffect(() => {
    const t = setTimeout(() => setEntering(false), 50)
    return () => clearTimeout(t)
  }, [])

  // ─── Enumerate cameras ───
  useEffect(() => {
    navigator.mediaDevices?.enumerateDevices?.().then((devices) => {
      const cams = devices.filter(d => d.kind === 'videoinput')
      setHasMultipleCameras(cams.length > 1)
    }).catch(() => {})
  }, [])

  // ─── Start camera ───
  const startCamera = useCallback(async () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }

    setCameraReady(false)
    setCameraError(null)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      })

      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.setAttribute('playsinline', 'true')
        await videoRef.current.play()
        setCameraReady(true)
      }
    } catch (err) {
      console.error('Camera error:', err)
      const msg =
        err.name === 'NotAllowedError' ? 'Camera permission denied. Please enable it in your browser settings.' :
        err.name === 'NotFoundError'   ? 'No camera found on this device.' :
        err.name === 'NotReadableError'? 'Camera is in use by another app.' :
        'Could not access camera.'
      setCameraError(msg)
    }
  }, [facingMode])

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
    }
  }, [startCamera])

  // ─── Capture ───
  const captureFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    setFlashActive(true)
    setTimeout(() => setFlashActive(false), 180)

    // Haptic feedback
    if (navigator.vibrate) navigator.vibrate(15)

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
    setCapturedImage(dataUrl)
    video.pause()
  }, [])

  // ─── Retake ───
  const handleRetake = useCallback(() => {
    setCapturedImage(null)
    if (videoRef.current && streamRef.current) {
      videoRef.current.play()
    }
  }, [])

  // ─── Use photo ───
  const handleUsePhoto = useCallback(() => {
    if (capturedImage) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      onCapture(capturedImage)
    }
  }, [capturedImage, onCapture])

  // ─── Flip camera ───
  const handleFlip = useCallback(() => {
    setFacingMode(prev => prev === 'environment' ? 'user' : 'environment')
    setCapturedImage(null)
  }, [])

  // ─── Gallery fallback ───
  const handleGallery = useCallback((e) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onloadend = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      onCapture(reader.result)
    }
    reader.readAsDataURL(file)
  }, [onCapture])

  // ─── Close ───
  const handleClose = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    onClose()
  }, [onClose])

  return (
    <motion.div
      className="cs-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
    >
      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {/* ─── Top bar ─── */}
      <div className="cs-topbar">
        <button onClick={handleClose} className="cs-topbar-btn" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="cs-topbar-center">
          <span className="cs-topbar-label">{label} Side</span>
          <span className="cs-topbar-sublabel">Business Card Scanner</span>
        </div>

        {/* Flip camera — or spacer */}
        {hasMultipleCameras && !cameraError ? (
          <button onClick={handleFlip} className="cs-topbar-btn" aria-label="Switch camera">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M20 7l-3-3-3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M17 4v7a4 4 0 01-4 4H4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              <path d="M4 17l3 3 3-3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M7 20v-7a4 4 0 014-4h9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        ) : (
          <div style={{ width: 40 }} />
        )}
      </div>

      {/* ─── Viewfinder ─── */}
      <div className="cs-viewfinder">
        {/* Error fallback */}
        {cameraError && (
          <div className="cs-error-state">
            <div className="cs-error-icon-wrap">
              <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
                <rect x="10" y="16" width="28" height="20" rx="3" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
                <circle cx="24" cy="26" r="5" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
                <path d="M18 16l-2-4h16l-2 4" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
                <path d="M6 6l36 36" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <p className="cs-error-msg">{cameraError}</p>
            <label className="cs-error-upload-btn">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleGallery}
                style={{ display: 'none' }}
              />
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Upload from Gallery
            </label>
          </div>
        )}

        {/* Live feed */}
        {!cameraError && (
          <>
            <video
              ref={videoRef}
              className="cs-video"
              muted
              playsInline
              style={{ opacity: capturedImage ? 0 : 1 }}
            />

            {/* Loading */}
            <AnimatePresence>
              {!cameraReady && !capturedImage && (
                <motion.div
                  className="cs-loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="cs-loading-ring" />
                  <p>Initializing camera...</p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Scan frame overlay */}
            <ScanFrame label={label} active={cameraReady && !capturedImage} />

            {/* Captured preview */}
            <AnimatePresence>
              {capturedImage && (
                <motion.img
                  key="preview"
                  src={capturedImage}
                  alt="Captured"
                  className="cs-captured-img"
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </AnimatePresence>

            {/* Flash */}
            <AnimatePresence>
              {flashActive && (
                <motion.div
                  className="cs-flash"
                  initial={{ opacity: 0.9 }}
                  animate={{ opacity: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                />
              )}
            </AnimatePresence>
          </>
        )}
      </div>

      {/* ─── Bottom controls ─── */}
      {!cameraError && (
        <CaptureControls
          cameraReady={cameraReady}
          hasCapture={!!capturedImage}
          hasFlip={hasMultipleCameras}
          onShutter={captureFrame}
          onRetake={handleRetake}
          onUsePhoto={handleUsePhoto}
          onFlipCamera={handleFlip}
          onGalleryPick={handleGallery}
        />
      )}
    </motion.div>
  )
}

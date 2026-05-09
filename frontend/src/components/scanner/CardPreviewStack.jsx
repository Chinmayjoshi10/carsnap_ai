import { motion, AnimatePresence } from 'framer-motion'

/**
 * CardPreviewStack — elegant stacked card previews after capture.
 *
 * Shows front (and optionally back) card images as overlapping cards
 * with tap-to-expand, retake, and remove actions.
 *
 * Props:
 *  @param {string|null}  frontImage
 *  @param {string|null}  backImage
 *  @param {function}     onRetakeFront
 *  @param {function}     onRetakeBack
 *  @param {function}     onRemoveBack
 *  @param {function}     onReset        – full reset
 */
export default function CardPreviewStack({
  frontImage,
  backImage,
  onRetakeFront,
  onRetakeBack,
  onRemoveBack,
  onReset,
}) {
  if (!frontImage) return null

  return (
    <motion.div
      className="cs-preview-stack"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Header */}
      <div className="cs-preview-header">
        <div className="cs-preview-header-left">
          <div className="cs-preview-dot" />
          <span className="cs-preview-title">Scanned Cards</span>
        </div>
        <button onClick={onReset} className="cs-preview-reset">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Rescan
        </button>
      </div>

      {/* Cards */}
      <div className={`cs-preview-cards ${backImage ? 'cs-has-back' : ''}`}>
        <AnimatePresence mode="popLayout">
          {/* Front card */}
          <motion.div
            key="front-card"
            className="cs-preview-card"
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          >
            <img src={frontImage} alt="Front side" className="cs-preview-img" />
            <div className="cs-preview-card-overlay">
              <span className="cs-preview-badge">Front</span>
              <button onClick={onRetakeFront} className="cs-preview-action" aria-label="Retake front">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            </div>
          </motion.div>

          {/* Back card */}
          {backImage && (
            <motion.div
              key="back-card"
              className="cs-preview-card"
              layout
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3, delay: 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <img src={backImage} alt="Back side" className="cs-preview-img" />
              <div className="cs-preview-card-overlay">
                <span className="cs-preview-badge">Back</span>
                <div className="cs-preview-actions-group">
                  <button onClick={onRetakeBack} className="cs-preview-action" aria-label="Retake back">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M1 4v6h6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3.51 15a9 9 0 102.13-9.36L1 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button onClick={onRemoveBack} className="cs-preview-action cs-preview-remove" aria-label="Remove back">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

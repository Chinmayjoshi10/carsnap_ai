import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

/**
 * ProcessingOverlay — immersive AI processing screen.
 *
 * Shows progressive status steps with shimmer effects and smooth transitions.
 * Replaces the generic StatusBanner during extraction.
 *
 * Props:
 *  @param {boolean}       visible
 *  @param {string|null}   currentStep  - current processing message
 *  @param {boolean}       hasBack      - true if back side was captured
 *  @param {string|null}   frontImage   - for preview during processing
 *  @param {string|null}   error        - error message (shows error state)
 *  @param {function}      onDismissError
 */

const STEPS = [
  { key: 'reading',    label: 'Reading card details',      icon: '📖' },
  { key: 'back',       label: 'Analyzing back side',       icon: '🔄' },
  { key: 'context',    label: 'Understanding business',    icon: '🧠' },
  { key: 'generating', label: 'Generating intelligence',   icon: '✨' },
]

function getStepIndex(message) {
  if (!message) return 0
  const m = message.toLowerCase()
  if (m.includes('back'))       return 1
  if (m.includes('understand') || m.includes('context')) return 2
  if (m.includes('generat') || m.includes('follow'))     return 3
  return 0
}

export default function ProcessingOverlay({
  visible,
  currentStep,
  hasBack = false,
  frontImage,
  error,
  onDismissError,
}) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (visible && currentStep) {
      setActiveIndex(getStepIndex(currentStep))
    }
  }, [visible, currentStep])

  // Filter steps based on whether back was captured
  const displaySteps = hasBack ? STEPS : STEPS.filter(s => s.key !== 'back')

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="cs-processing-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
        >
          <div className="cs-processing-content">
            {/* Card preview thumbnail */}
            {frontImage && (
              <motion.div
                className="cs-processing-card-preview"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.1, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <img src={frontImage} alt="Scanned card" />
                <div className="cs-processing-shimmer" />
              </motion.div>
            )}

            {/* Error state */}
            {error ? (
              <motion.div
                className="cs-processing-error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <div className="cs-processing-error-icon">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.5"/>
                    <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <p className="cs-processing-error-text">{error}</p>
                <button onClick={onDismissError} className="cs-processing-error-btn">
                  Try Again
                </button>
              </motion.div>
            ) : (
              <>
                {/* AI badge */}
                <motion.div
                  className="cs-processing-badge"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2, duration: 0.4 }}
                >
                  <span className="cs-processing-badge-dot" />
                  AI Processing
                </motion.div>

                {/* Steps */}
                <div className="cs-processing-steps">
                  {displaySteps.map((step, i) => {
                    const isActive = i === activeIndex
                    const isDone = i < activeIndex

                    return (
                      <motion.div
                        key={step.key}
                        className={`cs-processing-step ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.25 + i * 0.08, duration: 0.35 }}
                      >
                        <div className="cs-step-indicator">
                          {isDone ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                              <path d="M20 6L9 17l-5-5" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          ) : isActive ? (
                            <div className="cs-step-spinner" />
                          ) : (
                            <div className="cs-step-pending" />
                          )}
                        </div>
                        <span className="cs-step-icon">{step.icon}</span>
                        <span className="cs-step-label">{step.label}</span>
                      </motion.div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

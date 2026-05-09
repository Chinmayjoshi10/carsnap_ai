import { useState } from 'react'

const ScanIcon = () => (
  <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
    <rect x="4" y="4" width="12" height="3" rx="1.5" fill="#2563EB"/>
    <rect x="4" y="4" width="3" height="12" rx="1.5" fill="#2563EB"/>
    <rect x="32" y="4" width="12" height="3" rx="1.5" fill="#2563EB"/>
    <rect x="41" y="4" width="3" height="12" rx="1.5" fill="#2563EB"/>
    <rect x="4" y="41" width="12" height="3" rx="1.5" fill="#2563EB"/>
    <rect x="4" y="32" width="3" height="12" rx="1.5" fill="#2563EB"/>
    <rect x="32" y="41" width="12" height="3" rx="1.5" fill="#2563EB"/>
    <rect x="41" y="32" width="3" height="12" rx="1.5" fill="#2563EB"/>
    <rect x="8" y="23" width="32" height="2" rx="1" fill="#2563EB" opacity="0.3"/>
    <rect x="8" y="23" width="16" height="2" rx="1" fill="#2563EB">
      <animate attributeName="width" values="0;32;32" dur="2s" repeatCount="indefinite"/>
    </rect>
  </svg>
)

const FlipIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M14 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M17 6H7a4 4 0 000 8h1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)

function CardPreview({ src, label, onRemove }) {
  return (
    <div className="relative rounded-2xl overflow-hidden bg-surface shadow-card">
      <img
        src={src}
        alt={`${label} side`}
        className="w-full object-cover"
        style={{ maxHeight: '180px' }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent" />
      <button
        onClick={onRemove}
        className="absolute top-2 right-2 w-7 h-7 bg-white rounded-full flex items-center justify-center shadow-lifted text-tx-secondary text-xs font-medium hover:bg-gray-50 transition-colors"
      >
        ✕
      </button>
      <div className="absolute bottom-2 left-3">
        <span className="text-white text-xs font-medium bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
          {label}
        </span>
      </div>
    </div>
  )
}

export default function CardUploader({ onFrontCaptured, onBackCaptured, frontImage, backImage }) {
  const [dragging, setDragging] = useState(false)

  const readFile = (file, callback) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onloadend = () => callback(reader.result)
    reader.readAsDataURL(file)
  }

  // ─── BOTH SIDES CAPTURED ───
  if (frontImage && backImage) {
    return (
      <div className="flex flex-col gap-3" style={{ animation: 'fadeUp 0.2s ease forwards' }}>
        <div className="grid grid-cols-2 gap-3">
          <CardPreview src={frontImage} label="Front" onRemove={() => onFrontCaptured(null)} />
          <CardPreview src={backImage} label="Back" onRemove={() => onBackCaptured(null)} />
        </div>
      </div>
    )
  }

  // ─── FRONT CAPTURED, PROMPT FOR BACK ───
  if (frontImage && !backImage) {
    return (
      <div className="flex flex-col gap-3" style={{ animation: 'fadeUp 0.2s ease forwards' }}>
        <CardPreview src={frontImage} label="Front" onRemove={() => onFrontCaptured(null)} />

        {/* Back side capture prompt */}
        <label
          className="flex items-center gap-3 px-4 py-3.5 rounded-2xl cursor-pointer transition-all bg-surface hover:shadow-card"
          style={{
            border: '1.5px dashed #E8E5E0',
            boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
          }}
        >
          {/* CRITICAL: these attributes must not change */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => readFile(e.target.files[0], onBackCaptured)}
          />
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: '#EFF6FF', color: '#2563EB' }}
          >
            <FlipIcon />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-tx-primary">Capture back side</p>
            <p className="text-xs text-tx-muted">Optional — tap to add back of card</p>
          </div>
          <span className="text-xs text-tx-muted">→</span>
        </label>

        <button
          onClick={() => onBackCaptured('skip')}
          className="text-xs text-tx-muted text-center py-1 hover:text-tx-secondary transition-colors"
        >
          Skip — front side only
        </button>
      </div>
    )
  }

  // ─── INITIAL STATE — CAPTURE FRONT ───
  return (
    <label
      className="flex flex-col items-center justify-center gap-4 rounded-3xl cursor-pointer transition-all duration-200 select-none"
      style={{
        padding: '40px 24px',
        border: `2px dashed ${dragging ? '#2563EB' : '#E8E5E0'}`,
        background: dragging ? 'rgba(37,99,235,0.03)' : '#FFFFFF',
        boxShadow: dragging ? '0 0 0 4px rgba(37,99,235,0.08)' : '0 1px 3px rgba(0,0,0,0.06)',
      }}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); readFile(e.dataTransfer.files[0], onFrontCaptured) }}
    >
      {/* CRITICAL: these attributes must not change */}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => readFile(e.target.files[0], onFrontCaptured)}
      />
      <ScanIcon />
      <div className="text-center">
        <p className="font-semibold text-tx-primary text-base">Scan visiting card</p>
        <p className="text-tx-muted text-sm mt-1">Tap to capture the front side</p>
      </div>
      <div className="flex items-center gap-2 mt-1">
        <span className="w-16 h-px bg-border" />
        <span className="text-tx-muted text-xs">or drag & drop</span>
        <span className="w-16 h-px bg-border" />
      </div>
    </label>
  )
}

import { useState, useRef, useContext, useEffect } from 'react'
import { AuthContext } from '../App'
import CardUploader from '../components/CardUploader'
import ContactForm from '../components/ContactForm'
import EmailEditor from '../components/EmailEditor'
import StatusBanner from '../components/StatusBanner'
import GmailConnect from '../components/GmailConnect'
import ProcessingOverlay from '../components/scanner/ProcessingOverlay'
import { extractCard, sendEmail, saveContact, updateContact, batchSend } from '../lib/api'

const emptyContact = {
  full_name: '', job_title: '', company: '',
  emails: [], phones: [],
  address: '', website: '', linkedin: '',
  social_handles: [], services: [], industry_tags: [],
  business_summary: '', notes: '', confidence: 0,
}

const SectionLabel = ({ children }) => (
  <div className="flex items-center gap-2 mb-3">
    <div className="w-0.5 h-4 rounded-full bg-accent" />
    <span className="text-xs font-semibold text-tx-secondary uppercase tracking-wider">{children}</span>
  </div>
)

export default function Capture() {
  const { user, gmailConnected, setGmailConnected, handleSignIn } = useContext(AuthContext)
  const [frontImage, setFrontImage] = useState(null)
  const [backImage, setBackImage] = useState(null)
  const [contact, setContact] = useState(emptyContact)
  const [emailDraft, setEmailDraft] = useState('')
  const [emailSubject, setEmailSubject] = useState('')
  const [status, setStatus] = useState(null)
  const [extracted, setExtracted] = useState(false)
  const [savedId, setSavedId] = useState(null)
  const [extraData, setExtraData] = useState({})
  const lastSentRef = useRef(0)

  // Processing overlay state
  const [processing, setProcessing] = useState(false)
  const [processingStep, setProcessingStep] = useState(null)
  const [processingError, setProcessingError] = useState(null)
  const [processingHasBack, setProcessingHasBack] = useState(false)

  // ── Batch upload state ──
  const [batchFiles, setBatchFiles] = useState([])
  const [batchProcessing, setBatchProcessing] = useState(false)
  const [batchProgress, setBatchProgress] = useState(null)
  const [batchResults, setBatchResults] = useState(null)
  const batchInputRef = useRef(null)

  // Dynamically update placeholder if user signs in after extraction
  useEffect(() => {
    if (user && emailDraft && /\[Your Name\]/i.test(emailDraft)) {
      const senderName = user.displayName || user.email?.split('@')[0] || ''
      if (senderName) {
        setEmailDraft(prev => prev.replace(/\[Your Name\]/gi, senderName))
      }
    }
  }, [user, emailDraft])

  // Called when back image is captured or skipped
  const handleBackCaptured = async (value) => {
    const isSkip = value === 'skip'
    const back = isSkip ? null : value

    if (!isSkip) setBackImage(back)

    // Now extract with front + back
    await runExtraction(frontImage, back)
  }

  const runExtraction = async (front, back) => {
    setProcessing(true)
    setProcessingError(null)
    setProcessingHasBack(!!back)
    setProcessingStep('Reading card details...')

    try {
      if (back) {
        await new Promise(r => setTimeout(r, 800))
        setProcessingStep('Analyzing back side...')
        await new Promise(r => setTimeout(r, 600))
        setProcessingStep('Understanding business context...')
      }

      const data = await extractCard(front, back)

      setProcessingStep('Generating intelligence...')
      await new Promise(r => setTimeout(r, 500))

      setContact({
        full_name: data.full_name || '',
        job_title: data.job_title || '',
        company: data.company || '',
        emails: data.emails || [],
        phones: data.phones || [],
        address: data.address || '',
        website: data.website || '',
        linkedin: data.linkedin || '',
        social_handles: data.social_handles || [],
        services: data.services || [],
        industry_tags: data.industry_tags || [],
        business_summary: data.business_summary || '',
        notes: data.notes || '',
        confidence: data.confidence || 0,
      })
      setEmailSubject(data.email_subject || '')

      // Replace [Your Name] placeholder with the signed-in user's actual name
      let draft = data.email_draft || ''
      if (user) {
        const senderName = user.displayName || user.email?.split('@')[0] || ''
        if (senderName) {
          draft = draft.replace(/\[Your Name\]/gi, senderName)
        }
      }
      setEmailDraft(draft)
      setExtraData({
        raw_card_text: data.raw_card_text || '',
        front_image_url: data.front_image_url || '',
        back_image_url: data.back_image_url || '',
      })
      setExtracted(true)
      setProcessing(false)
      setProcessingStep(null)
      setStatus({ type: 'success', message: 'Card analyzed — review and edit below' })
      setTimeout(() => setStatus(null), 3000)
    } catch (err) {
      setProcessingError(err.message || 'Could not read card. Try a clearer photo.')
    }
  }

  const handleDismissProcessingError = () => {
    setProcessing(false)
    setProcessingError(null)
    setProcessingStep(null)
  }

  const handleFrontCaptured = (base64) => {
    if (!base64) {
      // Clear everything
      setFrontImage(null); setBackImage(null); setContact(emptyContact)
      setEmailDraft(''); setEmailSubject(''); setExtracted(false); setExtraData({})
      return
    }
    setFrontImage(base64)
    // Don't extract yet — wait for back side decision
  }

  const canSend = user && gmailConnected && contact.emails?.[0]

  const handleSend = async () => {
    const toEmail = contact.emails?.[0]
    if (!toEmail) return setStatus({ type: 'error', message: 'Add an email address first' })
    if (!user || !gmailConnected) return setStatus({ type: 'error', message: 'Connect Gmail first to send emails' })
    if (Date.now() - lastSentRef.current < 60000)
      return setStatus({ type: 'error', message: 'Please wait before sending again' })
    setStatus({ type: 'loading', message: 'Sending via Gmail...' })
    try {
      const subject = emailSubject || `Great connecting with you${contact.full_name ? ', ' + contact.full_name.split(' ')[0] : ''}`
      await sendEmail(toEmail, subject, emailDraft, user.uid)
      lastSentRef.current = Date.now()
      if (savedId) await updateContact(savedId, { email_sent: true })
      setStatus({ type: 'success', message: `Email sent via Gmail to ${toEmail}` })
    } catch (err) {
      const detail = err.message || ''
      if (detail.includes('gmail_reconnect_required') || detail.includes('gmail_not_connected')) {
        setGmailConnected(false)
        setStatus({ type: 'error', message: 'Gmail disconnected. Please reconnect your Gmail.' })
      } else {
        setStatus({ type: 'error', message: detail || 'Email failed. Try again.' })
      }
    }
  }

  const handleSave = async () => {
    setStatus({ type: 'loading', message: 'Saving...' })
    try {
      const result = await saveContact({
        ...contact,
        raw_card_text: extraData.raw_card_text || '',
        front_image_url: extraData.front_image_url || '',
        back_image_url: extraData.back_image_url || '',
        email_subject: emailSubject,
        email_draft: emailDraft,
        email_sent: false,
        saved_by: user?.uid || '',
      })
      setSavedId(result.id)
      setStatus({ type: 'success', message: 'Contact saved with full intelligence' })
      setTimeout(() => setStatus(null), 3000)
    } catch {
      setStatus({ type: 'error', message: 'Save failed. Try again.' })
    }
  }

  const reset = () => {
    setFrontImage(null); setBackImage(null); setContact(emptyContact)
    setEmailDraft(''); setEmailSubject(''); setExtraData({})
    setStatus(null); setExtracted(false); setSavedId(null)
  }

  // ── Batch upload handlers ──
  const handleBatchFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    const imageFiles = files.filter(f => f.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    // Read all files to base64
    const promises = imageFiles.map(file => new Promise((resolve) => {
      const reader = new FileReader()
      reader.onloadend = () => resolve({ name: file.name, data: reader.result })
      reader.readAsDataURL(file)
    }))

    Promise.all(promises).then(results => {
      setBatchFiles(prev => [...prev, ...results])
      setBatchResults(null)
    })

    // Reset the input so the same files can be re-selected
    if (batchInputRef.current) batchInputRef.current.value = ''
  }

  const removeBatchFile = (index) => {
    setBatchFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleBatchSend = async () => {
    if (!user || !gmailConnected) {
      setStatus({ type: 'error', message: 'Connect Gmail first to send emails' })
      return
    }
    if (batchFiles.length === 0) return

    setBatchProcessing(true)
    setBatchProgress(`Processing ${batchFiles.length} card${batchFiles.length > 1 ? 's' : ''}...`)
    setBatchResults(null)

    try {
      const cards = batchFiles.map(f => ({ front_image: f.data, back_image: null }))
      const result = await batchSend(cards, user.uid)

      setBatchResults(result)
      setBatchProgress(null)
      setBatchFiles([])
    } catch (err) {
      const detail = err.message || ''
      if (detail.includes('gmail_reconnect_required') || detail.includes('gmail_not_connected')) {
        setGmailConnected(false)
        setBatchProgress(null)
        setStatus({ type: 'error', message: 'Gmail disconnected. Please reconnect your Gmail.' })
      } else {
        setBatchProgress(null)
        setStatus({ type: 'error', message: detail || 'Batch processing failed. Try again.' })
      }
    } finally {
      setBatchProcessing(false)
    }
  }

  const clearBatch = () => {
    setBatchFiles([])
    setBatchResults(null)
    setBatchProgress(null)
  }

  return (
    <div className="flex flex-col gap-5 px-4 pt-6 pb-10 page-enter">

      {/* Processing overlay */}
      <ProcessingOverlay
        visible={processing}
        currentStep={processingStep}
        hasBack={processingHasBack}
        frontImage={frontImage}
        error={processingError}
        onDismissError={handleDismissProcessingError}
      />

      {/* Hero text */}
      {!extracted && !frontImage && (
        <div className="pb-2">
          <h1 className="text-2xl font-semibold text-tx-primary tracking-tight">
            Capture a card
          </h1>
          <p className="text-tx-secondary text-sm mt-1">
            Scan both sides of a visiting card for complete business intelligence.
          </p>
        </div>
      )}

      {/* Card uploader */}
      <CardUploader
        onFrontCaptured={handleFrontCaptured}
        onBackCaptured={handleBackCaptured}
        frontImage={frontImage}
        backImage={backImage === 'skip' ? null : backImage}
      />

      {/* Status */}
      {status && <StatusBanner status={status.type} message={status.message} />}

      {/* ══════════ BATCH UPLOAD SECTION ══════════ */}
      {!extracted && !frontImage && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-0.5 h-4 rounded-full" style={{ background: '#8B5CF6' }} />
            <span className="text-xs font-semibold text-tx-secondary uppercase tracking-wider">Batch Upload &amp; Send</span>
          </div>

          <div
            className="rounded-2xl overflow-hidden bg-surface"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)' }}
          >
            {/* Header */}
            <div
              className="px-4 py-3 flex items-center justify-between"
              style={{ borderBottom: '1px solid #F3F2EF' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <span className="text-xs font-medium text-tx-muted uppercase tracking-wider">
                  Multiple Cards
                </span>
              </div>
              {batchFiles.length > 0 && (
                <span className="text-xs font-medium tabular-nums" style={{ color: '#8B5CF6' }}>
                  {batchFiles.length} card{batchFiles.length > 1 ? 's' : ''} selected
                </span>
              )}
            </div>

            <div className="p-4">
              {/* Description */}
              <p className="text-xs text-tx-muted mb-3 leading-relaxed">
                Upload multiple business card images at once. Each card will be processed, a contact saved, and a follow-up email sent automatically.
              </p>

              {/* File picker */}
              <label
                className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed py-4 cursor-pointer transition-colors hover:border-purple-300 hover:bg-purple-50/30"
                style={{ borderColor: batchFiles.length > 0 ? '#8B5CF6' : '#E5E7EB' }}
              >
                <input
                  ref={batchInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleBatchFileSelect}
                />
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <polyline points="17 8 12 3 7 8" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <line x1="12" y1="3" x2="12" y2="15" stroke="#8B5CF6" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span className="text-sm font-medium" style={{ color: '#8B5CF6' }}>
                  {batchFiles.length > 0 ? 'Add more cards' : 'Select card images'}
                </span>
              </label>

              {/* Selected files preview */}
              {batchFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {batchFiles.map((file, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl px-3 py-2"
                      style={{ background: '#FAFAF9' }}
                    >
                      <img
                        src={file.data}
                        alt={file.name}
                        className="w-10 h-10 rounded-lg object-cover"
                        style={{ border: '1px solid #E8E5E0' }}
                      />
                      <span className="flex-1 text-xs text-tx-secondary truncate">
                        {file.name}
                      </span>
                      <button
                        onClick={() => removeBatchFile(i)}
                        className="text-tx-muted hover:text-red-500 transition-colors p-1"
                        title="Remove"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                          <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                          <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Batch send button */}
              {batchFiles.length > 0 && (
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={handleBatchSend}
                    disabled={batchProcessing || !user || !gmailConnected}
                    className="flex-1 flex items-center justify-center gap-2 rounded-xl font-medium text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      height: '44px',
                      background: user && gmailConnected ? '#8B5CF6' : '#6B7280',
                      color: '#fff',
                    }}
                  >
                    {batchProcessing ? (
                      <>
                        <div className="w-4 h-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <>
                        <span>🚀</span>
                        <span>
                          {!user ? 'Sign in first' : !gmailConnected ? 'Connect Gmail' : `Extract & Send (${batchFiles.length})`}
                        </span>
                      </>
                    )}
                  </button>
                  <button
                    onClick={clearBatch}
                    disabled={batchProcessing}
                    className="rounded-xl px-4 text-sm font-medium transition-all active:scale-95 disabled:opacity-40"
                    style={{
                      height: '44px',
                      background: '#fff',
                      color: '#6B7280',
                      border: '1.5px solid #E8E5E0',
                    }}
                  >
                    Clear
                  </button>
                </div>
              )}

              {/* Batch progress */}
              {batchProgress && (
                <div
                  className="mt-3 px-4 py-3 rounded-xl text-sm font-medium flex items-center gap-2"
                  style={{ background: '#EDE9FE', color: '#6D28D9' }}
                >
                  <div className="w-4 h-4 rounded-full border-2 border-purple-200 border-t-purple-600 animate-spin" />
                  {batchProgress}
                </div>
              )}

              {/* Batch results */}
              {batchResults && (
                <div className="mt-3 space-y-2">
                  <div
                    className="px-4 py-3 rounded-xl text-sm font-medium"
                    style={{
                      background: batchResults.failed > 0 ? '#FEF3C7' : '#F0FDF4',
                      color: batchResults.failed > 0 ? '#92400E' : '#166534',
                    }}
                  >
                    ✓ Processed {batchResults.total} card{batchResults.total > 1 ? 's' : ''} —
                    {' '}{batchResults.sent} email{batchResults.sent !== 1 ? 's' : ''} sent
                    {batchResults.skipped > 0 && `, ${batchResults.skipped} skipped`}
                    {batchResults.failed > 0 && `, ${batchResults.failed} failed`}
                  </div>

                  {/* Per-card details */}
                  {batchResults.results?.map((r, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 rounded-xl px-3 py-2 text-xs"
                      style={{ background: '#FAFAF9' }}
                    >
                      <span style={{
                        color: r.status === 'sent' ? '#16A34A'
                             : r.status === 'no_email' || r.status === 'skipped' ? '#D97706'
                             : '#DC2626'
                      }}>
                        {r.status === 'sent' ? '✓' : r.status === 'no_email' || r.status === 'skipped' ? '⚠' : '✗'}
                      </span>
                      <span className="flex-1 text-tx-secondary truncate">
                        {r.full_name || `Card ${i + 1}`}
                        {r.email ? ` → ${r.email}` : ''}
                      </span>
                      <span className="text-tx-muted capitalize">
                        {r.status === 'sent' ? 'Sent'
                          : r.status === 'no_email' ? 'No email'
                          : r.status === 'skipped' ? 'Skipped'
                          : r.status === 'email_failed' ? 'Send failed'
                          : 'Error'}
                      </span>
                    </div>
                  ))}

                  <button
                    onClick={clearBatch}
                    className="w-full text-center text-xs text-tx-muted py-1 hover:text-tx-secondary transition-colors"
                  >
                    Clear results
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Gmail connect — required to send */}
      <div className="mt-4">
        <SectionLabel>Send via Gmail</SectionLabel>
        {user ? (
          <GmailConnect
            user={user}
            gmailConnected={gmailConnected}
            onStatusChange={setGmailConnected}
          />
        ) : (
          <button
            onClick={handleSignIn}
            className="w-full text-left rounded-2xl px-4 py-3 text-sm bg-surface hover:bg-gray-50 transition-colors"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '3px solid #2563EB' }}
          >
            <p className="text-tx-primary font-medium">Sign in required</p>
            <p className="text-tx-muted text-xs mt-1">Sign in with Google and connect Gmail to send follow-up emails.</p>
          </button>
        )}
      </div>

      {/* Extracted content */}
      {extracted && (
        <div className="flex flex-col gap-5" style={{ animation: 'fadeUp 0.25s ease forwards' }}>

          <div>
            <SectionLabel>Contact Intelligence</SectionLabel>
            <ContactForm contact={contact} onChange={setContact} />
          </div>

          <div>
            <SectionLabel>Follow-up Email</SectionLabel>
            <EmailEditor value={emailDraft} onChange={setEmailDraft} subject={emailSubject} onSubjectChange={setEmailSubject} />
          </div>



          {/* Action buttons */}
          <div className="flex gap-3 pt-1">
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-medium text-sm transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                height: '52px',
                background: canSend ? '#0F1B2D' : '#6B7280',
                color: '#fff',
                boxShadow: '0 1px 2px rgba(0,0,0,0.12)',
              }}
            >
              <span>✉</span>
              <span>{!user ? 'Sign in first' : !gmailConnected ? 'Connect Gmail' : 'Send via Gmail'}</span>
            </button>
            <button
              onClick={handleSave}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl font-medium text-sm transition-all active:scale-95"
              style={{
                height: '52px',
                background: '#fff',
                color: '#0F1B2D',
                border: '1.5px solid #E8E5E0',
                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
              }}
            >
              <span>↓</span>
              <span>Save Contact</span>
            </button>
          </div>

          {/* Reset */}
          <button
            onClick={reset}
            className="text-center text-tx-muted text-xs py-1 hover:text-tx-secondary transition-colors"
          >
            ← Capture another card
          </button>
        </div>
      )}
    </div>
  )
}

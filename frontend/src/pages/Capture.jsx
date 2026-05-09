import { useState, useRef, useContext } from 'react'
import { AuthContext } from '../App'
import CardUploader from '../components/CardUploader'
import ContactForm from '../components/ContactForm'
import EmailEditor from '../components/EmailEditor'
import StatusBanner from '../components/StatusBanner'
import GmailConnect from '../components/GmailConnect'
import ProcessingOverlay from '../components/scanner/ProcessingOverlay'
import { extractCard, sendEmail, saveContact, updateContact } from '../lib/api'

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
  const { user, gmailConnected, setGmailConnected } = useContext(AuthContext)
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
          <div
            className="rounded-2xl px-4 py-3 text-sm bg-surface"
            style={{ boxShadow: '0 1px 3px rgba(0,0,0,0.06)', borderLeft: '3px solid #2563EB' }}
          >
            <p className="text-tx-primary font-medium">Sign in required</p>
            <p className="text-tx-muted text-xs mt-1">Sign in with Google and connect Gmail to send follow-up emails.</p>
          </div>
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

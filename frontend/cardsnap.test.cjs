// CardSnap end-to-end Playwright suite.
// Run: `cd frontend && npx playwright test`
// Requires backend on :8000 and frontend on :3000 (see playwright.config.cjs).

const { test, expect } = require('@playwright/test')
const path = require('path')

const TEST_CARD = path.resolve(__dirname, 'test_assets', 'test_card.jpg')

// Deterministic mock /extract payload — avoids LLM/OCR variance in CI.
const MOCK_EXTRACT = {
  full_name: 'Priya Sharma',
  job_title: 'Founder',
  company: 'Lotus Designs',
  emails: ['priya@lotusdesigns.in'],
  phones: ['+91 98765 43210'],
  address: '12 MG Road, Bangalore 560001',
  website: 'lotusdesigns.in',
  linkedin: 'linkedin.com/in/priyasharma',
  social_handles: ['@lotusdesigns'],
  services: ['Brand Identity', 'Print Design'],
  industry_tags: ['Design', 'Branding'],
  business_summary: 'Boutique design studio specializing in heritage brands.',
  notes: '',
  confidence: 0.92,
  email_subject: 'Great connecting with you, Priya',
  email_draft: 'Hi Priya,\n\nIt was lovely meeting you. I would love to stay in touch.\n\nWarm regards,\n[Your Name]',
  raw_card_text: 'PRIYA SHARMA | Founder | Lotus Designs',
  front_image_url: '',
  back_image_url: '',
}

// Reusable network mocks installed before page.goto().
// Patterns are scoped to the backend host (port 8000) so they don't accidentally
// intercept SPA route navigations served by the Vite dev server on :3000.
const API = 'http://localhost:8000'

async function installMocks(page, { extract = MOCK_EXTRACT, contacts = [], gmailConnected = false } = {}) {
  await page.route(`${API}/extract`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(extract) })
  )
  await page.route(`${API}/contacts`, route => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(contacts) })
    }
    return route.continue()
  })
  await page.route(`${API}/save-contact`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, id: 'mock_id_123' }) })
  )
  await page.route(`${API}/auth/google/status/*`, route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gmail_connected: gmailConnected }) })
  )
}

// Drive the multi-step capture: upload front, then skip back, wait for extracted form.
async function uploadAndExtract(page) {
  const launcherInput = page.locator('.cs-launcher input[type="file"]')
  await launcherInput.setInputFiles(TEST_CARD)
  // Now in back-prompt phase
  await page.click('text=Skip — continue with front only')
  // Wait for extracted UI (Contact Intelligence + Follow-up Email sections)
  await expect(page.getByText('Contact Intelligence')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText('Follow-up Email').first()).toBeVisible()
}

test.describe('CardSnap — Smoke (unauthenticated)', () => {

  test('1. Capture page renders hero + uploader', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Capture a card' })).toBeVisible()
    await expect(page.locator('.cs-launcher')).toBeVisible()
    await expect(page.locator('.cs-launcher input[type="file"]')).toBeAttached()
  })

  test('2. Contacts page renders heading + search', async ({ page }) => {
    await installMocks(page)
    await page.goto('/contacts')
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible()
    await expect(page.getByPlaceholder('Search contacts...')).toBeVisible()
  })

  test('3. Nav switches between Capture and Contacts', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await page.click('a[href="/contacts"]')
    await expect(page).toHaveURL(/\/contacts$/)
    await expect(page.getByRole('heading', { name: 'Contacts' })).toBeVisible()
    await page.click('a[href="/"]')
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByRole('heading', { name: 'Capture a card' })).toBeVisible()
  })

  test('4. Nav is fixed at top', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    const pos = await page.locator('nav').first().evaluate(el => getComputedStyle(el).position)
    expect(pos).toBe('fixed')
  })

  test('5. No horizontal scroll on mobile viewport', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    const { sw, cw } = await page.evaluate(() => ({
      sw: document.documentElement.scrollWidth,
      cw: document.documentElement.clientWidth,
    }))
    expect(sw).toBeLessThanOrEqual(cw + 5)
  })

  test('6. Gallery input accepts images and does NOT force the camera', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    const input = page.locator('.cs-launcher input[type="file"]')
    await expect(input).toHaveAttribute('accept', 'image/*')
    // capture must NOT be set, otherwise mobile opens the camera instead of the gallery
    const captureAttr = await input.getAttribute('capture')
    expect(captureAttr).toBeNull()
  })

  test('7. Sign-in CTA visible when unauthenticated', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    // Top-right nav sign in
    await expect(page.getByRole('button', { name: /^Sign in$/i })).toBeVisible()
    // Page-level sign-in prompt under Send via Gmail
    await expect(page.getByText('Sign in required')).toBeVisible()
  })
})

test.describe('CardSnap — Capture flow (mocked /extract)', () => {

  test('8. Upload → skip back → contact form is populated', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await uploadAndExtract(page)
    // Name field populated from mock
    await expect(page.locator('input[type="text"]').filter({ hasNotText: '' }).first()).toHaveValue(/Priya/i)
    // Email field populated
    await expect(page.locator('input[type="email"]')).toHaveValue('priya@lotusdesigns.in')
    // Email body populated
    await expect(page.locator('textarea')).toContainText('Hi Priya')
  })

  test('9. Contact name field is editable', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await uploadAndExtract(page)
    const nameField = page.locator('input[type="text"]').first()
    await nameField.fill('Edited Name')
    await expect(nameField).toHaveValue('Edited Name')
  })

  test('10. Email subject + body editable', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await uploadAndExtract(page)
    const subject = page.getByPlaceholder('Email subject line...')
    await subject.fill('Custom subject line')
    await expect(subject).toHaveValue('Custom subject line')
    const body = page.locator('textarea')
    await body.fill('Custom body content from test.')
    await expect(body).toHaveValue('Custom body content from test.')
  })

  test('11. Send button shows "Sign in first" when unauthenticated and is disabled', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await uploadAndExtract(page)
    const sendBtn = page.locator('button', { hasText: 'Sign in first' })
    await expect(sendBtn).toBeVisible()
    await expect(sendBtn).toBeDisabled()
  })

  test('12. Save Contact succeeds (mocked) and shows confirmation', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await uploadAndExtract(page)
    await page.click('button:has-text("Save Contact")')
    await expect(page.getByText(/Contact saved/i)).toBeVisible({ timeout: 10_000 })
  })

  test('13. "Capture another card" resets the form', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await uploadAndExtract(page)
    await page.click('text=Capture another card')
    await expect(page.locator('.cs-launcher')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Capture a card' })).toBeVisible()
  })

  test('14. Send Email button is min 44px tall (touch target)', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await uploadAndExtract(page)
    const btn = page.locator('button', { hasText: /Sign in first|Connect Gmail|Send via Gmail/ })
    const box = await btn.boundingBox()
    expect(box?.height || 0).toBeGreaterThanOrEqual(44)
  })
})

test.describe('CardSnap — Error handling', () => {

  test('15. Extract API failure surfaces a visible error', async ({ page }) => {
    // Override /extract to return 502 BEFORE other mocks
    await page.route(`${API}/extract`, route =>
      route.fulfill({ status: 502, contentType: 'application/json', body: JSON.stringify({ detail: 'OCR failed: simulated' }) })
    )
    await page.route(`${API}/contacts`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
    )
    await page.route(`${API}/auth/google/status/*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gmail_connected: false }) })
    )
    await page.goto('/')
    await page.locator('.cs-launcher input[type="file"]').setInputFiles(TEST_CARD)
    await page.click('text=Skip — continue with front only')
    // ProcessingOverlay surfaces the error inline; look for the simulated detail or a retry affordance
    await expect(page.getByText(/OCR failed|Could not read|Try a clearer photo|simulated/i).first())
      .toBeVisible({ timeout: 30_000 })
  })

  test('16. Network-aborted /extract still surfaces an error', async ({ page }) => {
    await page.route(`${API}/extract`, route => route.abort('failed'))
    await page.route(`${API}/auth/google/status/*`, route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ gmail_connected: false }) })
    )
    await page.goto('/')
    await page.locator('.cs-launcher input[type="file"]').setInputFiles(TEST_CARD)
    await page.click('text=Skip — continue with front only')
    await expect(page.getByText(/Could not read|failed|error/i).first()).toBeVisible({ timeout: 30_000 })
  })
})

test.describe('CardSnap — Contacts page', () => {

  const MOCK_CONTACTS = [
    {
      id: 'c1', full_name: 'Alice Chen', company: 'Acme Co', job_title: 'CEO',
      emails: ['alice@acme.com'], phones: ['+1 555-1111'],
      industry_tags: ['Tech'], email_sent: true, created_at: '2026-05-01T00:00:00Z',
    },
    {
      id: 'c2', full_name: 'Bob Patel', company: 'Globex', job_title: 'CTO',
      emails: ['bob@globex.com'], phones: ['+1 555-2222'],
      industry_tags: ['Finance'], email_sent: false, created_at: '2026-05-02T00:00:00Z',
    },
  ]

  test('17. Renders contacts with name/company and search count', async ({ page }) => {
    await installMocks(page, { contacts: MOCK_CONTACTS })
    await page.goto('/contacts')
    await expect(page.getByText('Alice Chen')).toBeVisible()
    await expect(page.getByText('Bob Patel')).toBeVisible()
    await expect(page.getByText('2 of 2 contacts')).toBeVisible()
  })

  test('18. Sent badge appears on emailed contacts', async ({ page }) => {
    await installMocks(page, { contacts: MOCK_CONTACTS })
    await page.goto('/contacts')
    await expect(page.getByText('✓ Sent')).toBeVisible()
  })

  test('19. Search filters by name', async ({ page }) => {
    await installMocks(page, { contacts: MOCK_CONTACTS })
    await page.goto('/contacts')
    await page.getByPlaceholder('Search contacts...').fill('Alice')
    await expect(page.getByText('Alice Chen')).toBeVisible()
    await expect(page.getByText('Bob Patel')).toBeHidden()
  })

  test('20. Empty-search state on no match', async ({ page }) => {
    await installMocks(page, { contacts: MOCK_CONTACTS })
    await page.goto('/contacts')
    await page.getByPlaceholder('Search contacts...').fill('ZZZNOMATCH')
    await expect(page.getByText('No contacts match')).toBeVisible()
  })

  test('21. Clicking a contact card expands details', async ({ page }) => {
    await installMocks(page, { contacts: MOCK_CONTACTS })
    await page.goto('/contacts')
    await page.getByText('Alice Chen').click()
    await expect(page.getByText('alice@acme.com')).toBeVisible()
    await expect(page.getByText('+1 555-1111')).toBeVisible()
  })
})

test.describe('CardSnap — Mobile UX', () => {

  test('22. Capture page nav links visible on mobile viewport', async ({ page }) => {
    await installMocks(page)
    await page.goto('/')
    await expect(page.locator('a[href="/"]')).toBeVisible()
    await expect(page.locator('a[href="/contacts"]')).toBeVisible()
  })

  test('23. Active nav link shows underline state', async ({ page }) => {
    await installMocks(page)
    await page.goto('/contacts')
    // The active link is the one styled with full opacity white — assert color
    const linkColor = await page.locator('a[href="/contacts"]').evaluate(el => getComputedStyle(el).color)
    // White-ish: rgb(255,255,255)
    expect(linkColor).toMatch(/rgb\(255,\s*255,\s*255\)/)
  })
})

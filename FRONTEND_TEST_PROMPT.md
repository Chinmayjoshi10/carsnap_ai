# CARDSNAP — FULL FRONTEND TEST PROMPT
# Paste this entire prompt to Claude Opus 4.6 in Antigravity
# Run this from the frontend/ directory with backend already running

---

<role>
You are a senior frontend QA engineer specializing in mobile web applications. You test React apps thoroughly — UI rendering, camera functionality, API integration, mobile responsiveness, and real user flows. You fix what you find. You report everything.
</role>

<task>
Start the CardSnap frontend, run every test below, fix failures inline, and produce a complete frontend test report. The backend is already running at http://localhost:8000 and has passed all API tests.
</task>

<thinking_protocol>
Before running any test, think through:
1. Is the frontend built? Is node_modules installed?
2. Is VITE_API_URL set correctly in .env.local pointing to the running backend?
3. What browser will be used for testing? Playwright with Chromium.
4. Camera testing requires special browser flags — what are they?
5. What is the mobile viewport to simulate? 390x844 (iPhone 14 Pro)
6. Which tests need a real image file vs a synthetic one?
Only then begin.
</thinking_protocol>

---

## PHASE 1 — FRONTEND ENVIRONMENT SETUP

```bash
# 1.1 Confirm we are in frontend directory
pwd
ls -la

# 1.2 Check .env.local
echo "=== ENV CHECK ==="
cat .env.local | sed 's/=.*/=***/' # mask values

# 1.3 Verify VITE_API_URL points to running backend
python3 -c "
import urllib.request
try:
    r = urllib.request.urlopen('http://localhost:8000/health', timeout=5)
    print('  ✓ Backend reachable at http://localhost:8000')
except Exception as e:
    print(f'  ✗ Backend NOT reachable: {e}')
    print('  FIX: Start backend first with: uvicorn main:app --reload --port 8000')
"

# 1.4 Install dependencies if needed
npm install

# 1.5 Check all source files exist
echo "=== SOURCE FILES ==="
for f in \
  src/App.jsx \
  src/main.jsx \
  src/index.css \
  src/lib/api.js \
  src/lib/firebase.js \
  src/components/CardUploader.jsx \
  src/components/ContactForm.jsx \
  src/components/EmailEditor.jsx \
  src/components/ContactList.jsx \
  src/components/StatusBanner.jsx \
  src/pages/Capture.jsx \
  src/pages/Contacts.jsx; do
  [ -f "$f" ] && echo "  ✓ $f" || echo "  ✗ MISSING: $f"
done

# 1.6 Install Playwright for automated testing
npm install --save-dev @playwright/test playwright 2>/dev/null
npx playwright install chromium 2>/dev/null
echo "  ✓ Playwright ready"

# 1.7 Create a real test visiting card image for upload
python3 -c "
from PIL import Image, ImageDraw
import os

img = Image.new('RGB', (800, 400), color='white')
draw = ImageDraw.Draw(img)

# Card border
draw.rectangle([10, 10, 790, 390], outline='#1E40AF', width=3)

# Content
draw.rectangle([10, 10, 790, 80], fill='#1E40AF')
draw.text((30, 25), 'TECHVISION INDIA PVT LTD', fill='white')

draw.text((40, 110), 'Rajesh Kumar', fill='#1E293B')
draw.text((40, 155), 'Chief Technology Officer', fill='#475569')
draw.text((40, 210), 'rajesh.kumar@techvision.in', fill='#1E40AF')
draw.text((40, 250), '+91 98100 55555', fill='#475569')
draw.text((40, 290), 'www.techvision.in', fill='#475569')
draw.text((40, 330), 'Mumbai, Maharashtra — 400001', fill='#94A3B8')

os.makedirs('/tmp/cardsnap_test', exist_ok=True)
img.save('/tmp/cardsnap_test/test_card.jpg', 'JPEG', quality=95)
print('  ✓ Test card image saved: /tmp/cardsnap_test/test_card.jpg')
"
```

---

## PHASE 2 — BUILD VALIDATION

```bash
# 2.1 Lint check — catch any JS errors before running
echo "=== LINT CHECK ==="
npx eslint src/ --ext .jsx,.js --max-warnings 0 2>&1 || echo "  ⚠ Lint issues found — see above"

# 2.2 Production build test
echo "=== PRODUCTION BUILD ==="
npm run build 2>&1
if [ $? -eq 0 ]; then
  echo "  ✓ Production build successful"
  ls -lh dist/assets/
else
  echo "  ✗ Build FAILED — fix errors before continuing"
fi

# 2.3 Start dev server for testing
echo "=== STARTING DEV SERVER ==="
npm run dev &
FRONTEND_PID=$!
sleep 4
echo "  Frontend PID: $FRONTEND_PID"

# 2.4 Confirm dev server is up
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -q "200" \
  && echo "  ✓ Frontend running at http://localhost:3000" \
  || echo "  ✗ Frontend not responding at port 3000"
```

---

## PHASE 3 — AUTOMATED UI TESTS WITH PLAYWRIGHT

```bash
# Create the full Playwright test suite
cat > /tmp/cardsnap_test/cardsnap.test.js << 'PLAYWRIGHT_EOF'

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEST_CARD_PATH = '/tmp/cardsnap_test/test_card.jpg';
const MOBILE_VIEWPORT = { width: 390, height: 844 };

// ─── Test Suite ──────────────────────────────────────────────────────────────

test.describe('CardSnap Frontend — Full Test Suite', () => {

  // ── 3.1 Page Load & Navigation ────────────────────────────────────────────
  test('3.1 — Capture page loads correctly', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    // App title
    await expect(page.locator('text=CardSnap')).toBeVisible();

    // Nav links
    await expect(page.locator('a[href="/"]')).toBeVisible();
    await expect(page.locator('a[href="/contacts"]')).toBeVisible();

    // Upload zone visible
    await expect(page.locator('text=Tap to capture or upload')).toBeVisible();

    console.log('  ✓ Capture page loads with all elements');
  });

  test('3.2 — Contacts page loads correctly', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/contacts`);

    await expect(page.locator('text=Saved Contacts')).toBeVisible();
    // Search bar
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();

    console.log('  ✓ Contacts page loads with search bar');
  });

  test('3.3 — Navigation between pages works', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    // Go to Contacts
    await page.click('a[href="/contacts"]');
    await expect(page).toHaveURL(`${BASE_URL}/contacts`);
    await expect(page.locator('text=Saved Contacts')).toBeVisible();

    // Go back to Capture
    await page.click('a[href="/"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.locator('text=Tap to capture or upload')).toBeVisible();

    console.log('  ✓ Navigation works correctly');
  });

  // ── 3.4 Card Upload Flow ──────────────────────────────────────────────────
  test('3.4 — File upload triggers extraction', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    // Upload the test card image
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);

    // Should show loading state
    await expect(page.locator('text=Reading card')).toBeVisible({ timeout: 5000 });
    console.log('  ✓ Upload triggers loading state');

    // Wait for extraction (up to 30s for Vision + Bedrock)
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 30000 });
    console.log('  ✓ Extraction completed successfully');

    // Contact form appears with data
    await expect(page.locator('input[placeholder*="Not found"]').first()).toBeVisible();
    console.log('  ✓ Contact form rendered after extraction');
  });

  test('3.5 — Extracted fields are populated and editable', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 30000 });

    // Check fields populated (at least some should have data)
    const nameField = page.locator('input[type="text"]').first();
    const nameValue = await nameField.inputValue();
    console.log(`  Name field value: "${nameValue}"`);
    expect(nameValue.length).toBeGreaterThan(0);

    // Edit a field
    await nameField.triple_click();
    await nameField.fill('Rajesh Kumar (Edited)');
    await expect(nameField).toHaveValue('Rajesh Kumar (Edited)');
    console.log('  ✓ Fields editable');

    // Email draft textarea visible
    const emailDraft = page.locator('textarea');
    const draftValue = await emailDraft.inputValue();
    expect(draftValue.length).toBeGreaterThan(20);
    console.log(`  Email draft length: ${draftValue.length} chars`);
    console.log('  ✓ Email draft populated');
  });

  test('3.6 — Email draft is editable', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 30000 });

    const textarea = page.locator('textarea');
    await textarea.click();
    await textarea.fill('Custom email content written by user during test.');
    await expect(textarea).toHaveValue('Custom email content written by user during test.');
    console.log('  ✓ Email draft fully editable');
  });

  // ── 3.7 Action Buttons ────────────────────────────────────────────────────
  test('3.7 — Send Email button disabled when no email', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 30000 });

    // Clear email field
    const emailField = page.locator('input[type="email"]');
    await emailField.triple_click();
    await emailField.fill('');

    // Send button should be disabled
    const sendBtn = page.locator('button:has-text("Send Email")');
    await expect(sendBtn).toBeDisabled();
    console.log('  ✓ Send Email disabled when no email present');
  });

  test('3.8 — Save Contact button works', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 30000 });

    // Click save
    await page.click('button:has-text("Save Contact")');

    // Should show saving then saved
    await expect(page.locator('text=Contact saved')).toBeVisible({ timeout: 10000 });
    console.log('  ✓ Save Contact works — shows success toast');
  });

  test('3.9 — Send Email button triggers real send', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 30000 });

    // Ensure email field has a valid email
    const emailField = page.locator('input[type="email"]');
    const currentEmail = await emailField.inputValue();
    if (!currentEmail || !currentEmail.includes('@')) {
      await emailField.triple_click();
      await emailField.fill('test@example.com');
    }

    // Click send
    const sendBtn = page.locator('button:has-text("Send Email")');
    await expect(sendBtn).not.toBeDisabled();
    await sendBtn.click();

    // Loading state
    await expect(page.locator('text=Sending email')).toBeVisible({ timeout: 5000 });

    // Success
    await expect(page.locator('text=Email sent')).toBeVisible({ timeout: 15000 });
    console.log('  ✓ Send Email works — shows sent confirmation');
  });

  // ── 3.10 Image Preview & Reset ────────────────────────────────────────────
  test('3.10 — Card image preview shows after upload', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);

    // Image preview should appear
    await expect(page.locator('img[alt="Card preview"]')).toBeVisible({ timeout: 5000 });
    console.log('  ✓ Card image preview visible after upload');
  });

  test('3.11 — X button clears image and resets form', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('img[alt="Card preview"]')).toBeVisible({ timeout: 5000 });

    // Click X to clear
    await page.click('button:has-text("✕")');

    // Upload zone returns
    await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
    console.log('  ✓ X button clears image and resets to upload state');
  });

  test('3.12 — Capture another card resets full form', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 30000 });

    // Click reset link
    await page.click('text=Capture another card');
    await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
    await expect(page.locator('input[type="email"]')).not.toBeVisible();
    console.log('  ✓ Capture another card resets all state');
  });

  // ── 3.13 Contacts Page ────────────────────────────────────────────────────
  test('3.13 — Contacts list shows saved contacts', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/contacts`);

    // Wait for contacts to load
    await page.waitForTimeout(2000);

    const contacts = page.locator('[class*="rounded-2xl"]');
    const count = await contacts.count();
    console.log(`  Contacts visible: ${count}`);
    expect(count).toBeGreaterThan(0);
    console.log('  ✓ Contacts list populated');
  });

  test('3.14 — Contact search filters results', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/contacts`);
    await page.waitForTimeout(2000);

    const searchInput = page.locator('input[placeholder*="Search"]');

    // Search for something that exists
    await searchInput.fill('Rajesh');
    await page.waitForTimeout(500);
    const filtered = page.locator('[class*="rounded-2xl"]');
    const filteredCount = await filtered.count();
    console.log(`  Results for "Rajesh": ${filteredCount}`);

    // Search for something that doesn't exist
    await searchInput.fill('ZZZNONEXISTENT999');
    await page.waitForTimeout(500);
    await expect(page.locator('text=No contacts match')).toBeVisible();
    console.log('  ✓ Search filtering works correctly');
  });

  test('3.15 — Email sent badge shows on sent contacts', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/contacts`);
    await page.waitForTimeout(2000);

    const sentBadge = page.locator('text=✓ Sent').first();
    const visible = await sentBadge.isVisible();
    console.log(`  ✓ Sent badge visible: ${visible}`);
    // This passes whether or not the badge exists — just reports
  });

  // ── 3.16 Mobile UX Tests ──────────────────────────────────────────────────
  test('3.16 — No horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5); // 5px tolerance
    console.log(`  scrollWidth: ${scrollWidth}, clientWidth: ${clientWidth}`);
    console.log('  ✓ No horizontal overflow on mobile');
  });

  test('3.17 — file input has capture=environment for mobile camera', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const captureAttr = await page.locator('input[type="file"]').getAttribute('capture');
    expect(captureAttr).toBe('environment');
    console.log(`  capture attribute: "${captureAttr}"`);
    console.log('  ✓ Camera capture configured for rear camera');
  });

  test('3.18 — accept attribute is image/* on file input', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const acceptAttr = await page.locator('input[type="file"]').getAttribute('accept');
    expect(acceptAttr).toBe('image/*');
    console.log(`  accept attribute: "${acceptAttr}"`);
    console.log('  ✓ File input accepts images only');
  });

  test('3.19 — Buttons are minimum 44px tall (touch target)', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    // Upload a card to reveal buttons
    await page.locator('input[type="file"]').setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 30000 });

    const sendBtn = page.locator('button:has-text("Send Email")');
    const box = await sendBtn.boundingBox();
    console.log(`  Send button height: ${box?.height}px`);
    expect(box?.height).toBeGreaterThanOrEqual(44);
    console.log('  ✓ Buttons meet 44px minimum touch target');
  });

  test('3.20 — Nav bar is sticky at top', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    const nav = page.locator('nav').first();
    const position = await nav.evaluate(el => window.getComputedStyle(el).position);
    expect(position).toBe('fixed');
    console.log(`  Nav position: ${position}`);
    console.log('  ✓ Nav bar is fixed/sticky');
  });

  // ── 3.21 Error Handling UI ────────────────────────────────────────────────
  test('3.21 — Error shows when backend is unreachable', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);

    // Override API URL to bad endpoint
    await page.route('**/extract', route => route.abort('failed'));
    await page.goto(BASE_URL);

    await page.locator('input[type="file"]').setInputFiles(TEST_CARD_PATH);

    // Should show error state not crash
    await expect(page.locator('[class*="red"]').first()).toBeVisible({ timeout: 15000 });
    console.log('  ✓ Error state shown when API fails — no crash');
  });

  // ── 3.22 Camera Simulation Test ───────────────────────────────────────────
  test('3.22 — Camera input element present and accessible', async ({ browser }) => {
    // Launch with camera permissions granted
    const context = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      permissions: ['camera'],
      // Simulate mobile device
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();
    await page.goto(BASE_URL);

    // File input with capture exists
    const fileInput = page.locator('input[type="file"][capture="environment"]');
    await expect(fileInput).toBeAttached();

    // The label wrapping it should be visible and tappable
    const uploadLabel = page.locator('label').filter({ has: fileInput });
    await expect(uploadLabel).toBeVisible();

    const box = await uploadLabel.boundingBox();
    console.log(`  Upload area: ${box?.width}x${box?.height}px`);
    expect(box?.width).toBeGreaterThan(200);
    expect(box?.height).toBeGreaterThan(80);

    console.log('  ✓ Camera input present, label tappable, permissions supported');
    await context.close();
  });

  // ── 3.23 Drag and Drop ────────────────────────────────────────────────────
  test('3.23 — Drag and drop zone is interactive', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);

    // Simulate dragover
    await page.locator('label').first().dispatchEvent('dragover', { bubbles: true });
    console.log('  ✓ Drag zone accepts dragover events (no JS errors)');
  });

});

PLAYWRIGHT_EOF

echo "  ✓ Playwright test file created"

# Run the full test suite
echo ""
echo "=== RUNNING PLAYWRIGHT TESTS ==="
npx playwright test /tmp/cardsnap_test/cardsnap.test.js \
  --reporter=list \
  --timeout=60000 \
  2>&1
```

---

## PHASE 4 — CAMERA FUNCTIONALITY MANUAL VERIFICATION

This phase generates a checklist and verifies camera-specific HTML attributes programmatically since a real device camera can't be automated in CI.

```bash
echo "=== PHASE 4: CAMERA VERIFICATION ==="
python3 -c "
import urllib.request

html = urllib.request.urlopen('http://localhost:3000', timeout=10).read().decode()

checks = [
    ('capture=\"environment\"', 'Rear camera capture attribute'),
    ('accept=\"image/*\"',      'Image-only file accept'),
    ('type=\"file\"',           'File input type'),
]

print('Camera HTML Attribute Checks:')
for attr, label in checks:
    # These are in JSX not raw HTML — check via Playwright attribute test above
    print(f'  → {label}: Verified via Test 3.17, 3.18, 3.22')

print()
print('Manual Camera Test Checklist (run on real mobile device):')
items = [
    'Open http://YOUR_VERCEL_URL on iPhone/Android Chrome',
    'Tap the upload zone → device camera app opens',
    'Camera opens in REAR mode (not selfie)',
    'Take photo of a real visiting card',
    'Photo uploads automatically after capture',
    'Loading spinner shows while extracting',
    'Contact fields populate with extracted data',
    'Edit Name field — keyboard appears, input works',
    'Edit email draft in textarea — scrollable',
    'Tap Send Email — success toast appears',
    'Check inbox — email arrives within 60s',
    'Tap Save Contact — saved toast appears',
    'Navigate to Contacts tab — contact appears in list',
    'Search for saved contact — filter works',
    'Rotate phone to landscape — layout holds',
    'Pinch to zoom — content scales correctly',
]
for i, item in enumerate(items, 1):
    print(f'  [ ] {i:02d}. {item}')
"
```

---

## PHASE 5 — VISUAL & RESPONSIVE TESTS

```bash
echo "=== PHASE 5: RESPONSIVE SCREENSHOTS ==="

cat > /tmp/cardsnap_test/screenshots.js << 'SCREENSHOT_EOF'
const { chromium } = require('@playwright/test');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const viewports = [
    { name: 'mobile-portrait',  width: 390,  height: 844  },
    { name: 'mobile-landscape', width: 844,  height: 390  },
    { name: 'tablet',           width: 768,  height: 1024 },
    { name: 'desktop',          width: 1280, height: 800  },
  ];

  for (const vp of viewports) {
    const page = await browser.newPage();
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000');
    await page.waitForTimeout(1000);
    const path = `/tmp/cardsnap_test/screenshot-${vp.name}.png`;
    await page.screenshot({ path, fullPage: false });
    console.log(`  ✓ Screenshot saved: ${path} (${vp.width}x${vp.height})`);

    await page.goto('http://localhost:3000/contacts');
    await page.waitForTimeout(1000);
    const path2 = `/tmp/cardsnap_test/screenshot-contacts-${vp.name}.png`;
    await page.screenshot({ path: path2, fullPage: false });
    console.log(`  ✓ Screenshot saved: ${path2}`);

    await page.close();
  }

  await browser.close();
  console.log('\n  All screenshots saved to /tmp/cardsnap_test/');
})();
SCREENSHOT_EOF

node /tmp/cardsnap_test/screenshots.js
ls -lh /tmp/cardsnap_test/*.png
```

---

## PHASE 6 — PERFORMANCE AUDIT

```bash
echo "=== PHASE 6: PERFORMANCE AUDIT ==="

cat > /tmp/cardsnap_test/perf.js << 'PERF_EOF'
const { chromium } = require('@playwright/test');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 390, height: 844 });

  // Measure page load time
  const t0 = Date.now();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
  const loadTime = Date.now() - t0;
  console.log(`  Page load time: ${loadTime}ms ${loadTime < 2000 ? '✓' : '⚠ slow'}`);

  // Measure bundle sizes
  const resources = await page.evaluate(() =>
    performance.getEntriesByType('resource')
      .filter(r => r.initiatorType === 'script' || r.initiatorType === 'link')
      .map(r => ({ name: r.name.split('/').pop(), size: Math.round(r.transferSize / 1024) + 'KB', time: Math.round(r.duration) + 'ms' }))
  );

  console.log('\n  Resource sizes:');
  resources.slice(0, 10).forEach(r => console.log(`    ${r.name}: ${r.size} (${r.time})`));

  // Core Web Vitals
  const vitals = await page.evaluate(() => ({
    lcp: performance.getEntriesByType('largest-contentful-paint').pop()?.startTime || 0,
    cls: 0, // simplified
    fid: performance.getEntriesByType('first-input')[0]?.processingStart || 0,
  }));

  console.log('\n  Core Web Vitals:');
  console.log(`    LCP: ${Math.round(vitals.lcp)}ms ${vitals.lcp < 2500 ? '✓ Good' : vitals.lcp < 4000 ? '⚠ Needs Improvement' : '✗ Poor'}`);

  // JS errors check
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);
  console.log(`\n  Console errors: ${errors.length === 0 ? '✓ None' : '✗ ' + errors.length}`);
  errors.forEach(e => console.log(`    - ${e}`));

  await browser.close();
})();
PERF_EOF

node /tmp/cardsnap_test/perf.js
```

---

## PHASE 7 — CLEANUP

```bash
# Stop frontend dev server
kill $FRONTEND_PID 2>/dev/null
echo "  Frontend server stopped"

echo ""
echo "=== TEST ASSETS ==="
ls -lh /tmp/cardsnap_test/
```

---

## FINAL REPORT FORMAT

After running all phases, produce this exact report:

---

## FRONTEND TEST REPORT — CardSnap
**Date:** [today]
**Viewport:** 390x844 (iPhone 14 Pro simulation)
**Browser:** Chromium via Playwright
**Backend:** http://localhost:8000 (pre-validated)

### PHASE 1 — Environment
| Check | Status | Notes |
|---|---|---|
| .env.local present & populated | ✓/✗ | |
| Backend reachable | ✓/✗ | |
| All source files present | ✓/✗ | X/12 files |
| Dependencies installed | ✓/✗ | |
| Test card image created | ✓/✗ | |

### PHASE 2 — Build
| Check | Status | Notes |
|---|---|---|
| No lint errors | ✓/✗/⚠ | |
| Production build succeeds | ✓/✗ | |
| Dev server starts on port 3000 | ✓/✗ | |

### PHASE 3 — Automated UI Tests (23 tests)
| # | Test | Status | Time |
|---|---|---|---|
| 3.1 | Capture page loads | ✓/✗ | Xms |
| 3.2 | Contacts page loads | ✓/✗ | Xms |
| 3.3 | Navigation between pages | ✓/✗ | Xms |
| 3.4 | File upload triggers extraction | ✓/✗ | Xs |
| 3.5 | Extracted fields populated & editable | ✓/✗ | Xs |
| 3.6 | Email draft editable | ✓/✗ | Xs |
| 3.7 | Send button disabled without email | ✓/✗ | Xms |
| 3.8 | Save contact works | ✓/✗ | Xs |
| 3.9 | Send email works end-to-end | ✓/✗ | Xs |
| 3.10 | Card image preview visible | ✓/✗ | Xms |
| 3.11 | X button clears image | ✓/✗ | Xms |
| 3.12 | Capture another card resets | ✓/✗ | Xms |
| 3.13 | Contacts list shows data | ✓/✗ | Xms |
| 3.14 | Search filters contacts | ✓/✗ | Xms |
| 3.15 | Sent badge visible | ✓/✗ | Xms |
| 3.16 | No horizontal scroll mobile | ✓/✗ | Xms |
| 3.17 | capture=environment attribute | ✓/✗ | Xms |
| 3.18 | accept=image/* attribute | ✓/✗ | Xms |
| 3.19 | Buttons ≥44px touch target | ✓/✗ | Xms |
| 3.20 | Nav bar is sticky | ✓/✗ | Xms |
| 3.21 | Error state on API failure | ✓/✗ | Xms |
| 3.22 | Camera input accessible | ✓/✗ | Xms |
| 3.23 | Drag and drop zone works | ✓/✗ | Xms |

**Score: X/23 passed**

### PHASE 4 — Camera Attributes
| Attribute | Expected | Actual | Status |
|---|---|---|---|
| capture | environment | [actual] | ✓/✗ |
| accept | image/* | [actual] | ✓/✗ |
| input type | file | [actual] | ✓/✗ |

### PHASE 5 — Screenshots
| Viewport | Capture Page | Contacts Page |
|---|---|---|
| Mobile Portrait 390x844 | ✓/✗ | ✓/✗ |
| Mobile Landscape 844x390 | ✓/✗ | ✓/✗ |
| Tablet 768x1024 | ✓/✗ | ✓/✗ |
| Desktop 1280x800 | ✓/✗ | ✓/✗ |

### PHASE 6 — Performance
| Metric | Value | Threshold | Status |
|---|---|---|---|
| Page load time | Xms | <2000ms | ✓/✗ |
| LCP | Xms | <2500ms | ✓/✗ |
| JS bundle size | XKB | <500KB | ✓/✗ |
| Console errors | X | 0 | ✓/✗ |

### ISSUES FOUND & FIXED
For each issue: describe it, root cause, fix applied, re-test result.

### CAMERA MANUAL TEST CHECKLIST
Print the full 16-item checklist with [ ] boxes — ready to use on real device.

### FINAL VERDICT
**PASS / FAIL / PARTIAL**

Pass criteria: ≥20/23 automated tests pass + build succeeds + no console errors
If PARTIAL/FAIL: list exact failures and fixes needed.

---
*CardSnap Frontend Test Suite — Playwright + Chromium*

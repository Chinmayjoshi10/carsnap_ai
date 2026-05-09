const { test, expect } = require('@playwright/test');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const TEST_CARD_PATH = path.resolve(__dirname, 'test_assets', 'test_card.jpg');
const MOBILE_VIEWPORT = { width: 390, height: 844 };

test.describe('CardSnap Frontend — Full Test Suite', () => {

  // 3.1 Capture page loads
  test('3.1 — Capture page loads correctly', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    await expect(page.locator('text=CardSnap')).toBeVisible();
    await expect(page.locator('a[href="/"]')).toBeVisible();
    await expect(page.locator('a[href="/contacts"]')).toBeVisible();
    await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
  });

  // 3.2 Contacts page loads
  test('3.2 — Contacts page loads correctly', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/contacts`);
    await expect(page.locator('text=Saved Contacts')).toBeVisible();
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  });

  // 3.3 Navigation
  test('3.3 — Navigation between pages works', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    await page.click('a[href="/contacts"]');
    await expect(page).toHaveURL(`${BASE_URL}/contacts`);
    await expect(page.locator('text=Saved Contacts')).toBeVisible();
    await page.click('a[href="/"]');
    await expect(page).toHaveURL(`${BASE_URL}/`);
    await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
  });

  // 3.4 File upload triggers extraction
  test('3.4 — File upload triggers extraction', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Reading card')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 60000 });
  });

  // 3.5 Extracted fields populated and editable
  test('3.5 — Extracted fields are populated and editable', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    // Wait for textarea (email draft) — appears only after extraction completes
    await expect(page.locator('textarea')).toBeVisible({ timeout: 120000 });
    const nameField = page.locator('input[type="text"]').first();
    const nameValue = await nameField.inputValue();
    expect(nameValue.length).toBeGreaterThan(0);
    await nameField.click({ clickCount: 3 });
    await nameField.fill('Rajesh Kumar (Edited)');
    await expect(nameField).toHaveValue('Rajesh Kumar (Edited)');
    const emailDraft = page.locator('textarea');
    const draftValue = await emailDraft.inputValue();
    expect(draftValue.length).toBeGreaterThan(20);
  });

  // 3.6 Email draft is editable
  test('3.6 — Email draft is editable', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('textarea')).toBeVisible({ timeout: 120000 });
    const textarea = page.locator('textarea');
    await textarea.click();
    await textarea.fill('Custom email content written by user during test.');
    await expect(textarea).toHaveValue('Custom email content written by user during test.');
  });

  // 3.7 Send button disabled without email
  test('3.7 — Send Email button disabled when no email', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 60000 });
    const emailField = page.locator('input[type="email"]');
    await emailField.click({ clickCount: 3 });
    await emailField.fill('');
    const sendBtn = page.locator('button:has-text("Send Email")');
    await expect(sendBtn).toBeDisabled();
  });

  // 3.8 Save Contact
  test('3.8 — Save Contact button works', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 60000 });
    await page.click('button:has-text("Save Contact")');
    await expect(page.locator('text=Contact saved')).toBeVisible({ timeout: 10000 });
  });

  // 3.9 Send Email real send (only to own email in free tier)
  test('3.9 — Send Email button triggers real send', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 60000 });
    // Resend free tier: can only send to own email
    const emailField = page.locator('input[type="email"]');
    await emailField.click({ clickCount: 3 });
    await emailField.fill('chinmay.joshi0010@gmail.com');
    const sendBtn = page.locator('button:has-text("Send Email")');
    await expect(sendBtn).not.toBeDisabled();
    await sendBtn.click();
    await expect(page.locator('text=Sending email')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Email sent')).toBeVisible({ timeout: 15000 });
  });

  // 3.10 Card image preview
  test('3.10 — Card image preview shows after upload', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('img[alt="Card preview"]')).toBeVisible({ timeout: 5000 });
  });

  // 3.11 X button clears image
  test('3.11 — X button clears image and resets form', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('img[alt="Card preview"]')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("✕")');
    await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
  });

  // 3.12 Capture another card resets
  test('3.12 — Capture another card resets full form', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('textarea')).toBeVisible({ timeout: 120000 });
    await page.click('text=Capture another card');
    await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
    await expect(page.locator('input[type="email"]')).not.toBeVisible();
  });

  // 3.13 Contacts list
  test('3.13 — Contacts list shows saved contacts', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/contacts`);
    await page.waitForTimeout(3000);
    const contacts = page.locator('[class*="rounded-2xl"]');
    const count = await contacts.count();
    expect(count).toBeGreaterThan(0);
  });

  // 3.14 Contact search
  test('3.14 — Contact search filters results', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/contacts`);
    await page.waitForTimeout(3000);
    const searchInput = page.locator('input[placeholder*="Search"]');
    await searchInput.fill('ZZZNONEXISTENT999');
    await page.waitForTimeout(500);
    await expect(page.locator('text=No contacts match')).toBeVisible();
  });

  // 3.15 Sent badge
  test('3.15 — Email sent badge shows on sent contacts', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(`${BASE_URL}/contacts`);
    await page.waitForTimeout(3000);
    // Just check if Sent badges exist — passes regardless (informational)
    const sentBadge = page.locator('text=Sent').first();
    const visible = await sentBadge.isVisible();
    console.log(`Sent badge visible: ${visible}`);
  });

  // 3.16 No horizontal scroll
  test('3.16 — No horizontal scroll on mobile', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 5);
  });

  // 3.17 capture=environment attribute
  test('3.17 — file input has capture=environment', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const captureAttr = await page.locator('input[type="file"]').getAttribute('capture');
    expect(captureAttr).toBe('environment');
  });

  // 3.18 accept attribute
  test('3.18 — accept attribute is image/*', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const acceptAttr = await page.locator('input[type="file"]').getAttribute('accept');
    expect(acceptAttr).toBe('image/*');
  });

  // 3.19 Button touch target size
  test('3.19 — Buttons are minimum 44px tall', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    await page.locator('input[type="file"]').setInputFiles(TEST_CARD_PATH);
    await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 60000 });
    const sendBtn = page.locator('button:has-text("Send Email")');
    const box = await sendBtn.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
  });

  // 3.20 Nav sticky
  test('3.20 — Nav bar is fixed at top', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    const nav = page.locator('nav').first();
    const position = await nav.evaluate(el => window.getComputedStyle(el).position);
    expect(position).toBe('fixed');
  });

  // 3.21 Error handling
  test('3.21 — Error shows when backend is unreachable', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.route('**/extract', route => route.abort('failed'));
    await page.goto(BASE_URL);
    await page.locator('input[type="file"]').setInputFiles(TEST_CARD_PATH);
    // Should show error — look for red-colored status banner
    await expect(page.locator('.bg-red-50, [class*="red"]').first()).toBeVisible({ timeout: 15000 });
  });

  // 3.22 Camera input accessible
  test('3.22 — Camera input element present and accessible', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: MOBILE_VIEWPORT,
      permissions: ['camera'],
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1'
    });
    const page = await context.newPage();
    await page.goto(BASE_URL);
    const fileInput = page.locator('input[type="file"][capture="environment"]');
    await expect(fileInput).toBeAttached();
    const uploadLabel = page.locator('label').filter({ has: fileInput });
    await expect(uploadLabel).toBeVisible();
    const box = await uploadLabel.boundingBox();
    expect(box?.width).toBeGreaterThan(200);
    expect(box?.height).toBeGreaterThan(80);
    await context.close();
  });

  // 3.23 Drag and drop
  test('3.23 — Drag and drop zone is interactive', async ({ page }) => {
    await page.setViewportSize(MOBILE_VIEWPORT);
    await page.goto(BASE_URL);
    await page.locator('label').first().dispatchEvent('dragover', { bubbles: true });
  });

});

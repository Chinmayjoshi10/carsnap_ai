# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: cardsnap.test.cjs >> CardSnap Frontend — Full Test Suite >> 3.5 — Extracted fields are populated and editable
- Location: cardsnap.test.cjs:51:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('textarea')
Expected: visible
Timeout: 120000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 120000ms
  - waiting for locator('textarea')

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation [ref=e4]:
    - generic [ref=e5]: 📇 CardSnap
    - generic [ref=e6]:
      - link "Capture" [ref=e7] [cursor=pointer]:
        - /url: /
      - link "Contacts" [ref=e8] [cursor=pointer]:
        - /url: /contacts
  - generic [ref=e10]:
    - generic [ref=e12]:
      - img "Card preview" [ref=e13]
      - button "✕" [ref=e14] [cursor=pointer]
    - generic [ref=e15]:
      - generic [ref=e16]: ❌
      - generic [ref=e17]: "AI extraction failed: 'NoneType' object has no attribute 'strip'"
```

# Test source

```ts
  1   | const { test, expect } = require('@playwright/test');
  2   | const path = require('path');
  3   | 
  4   | const BASE_URL = 'http://localhost:3000';
  5   | const TEST_CARD_PATH = path.resolve(__dirname, 'test_assets', 'test_card.jpg');
  6   | const MOBILE_VIEWPORT = { width: 390, height: 844 };
  7   | 
  8   | test.describe('CardSnap Frontend — Full Test Suite', () => {
  9   | 
  10  |   // 3.1 Capture page loads
  11  |   test('3.1 — Capture page loads correctly', async ({ page }) => {
  12  |     await page.setViewportSize(MOBILE_VIEWPORT);
  13  |     await page.goto(BASE_URL);
  14  |     await expect(page.locator('text=CardSnap')).toBeVisible();
  15  |     await expect(page.locator('a[href="/"]')).toBeVisible();
  16  |     await expect(page.locator('a[href="/contacts"]')).toBeVisible();
  17  |     await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
  18  |   });
  19  | 
  20  |   // 3.2 Contacts page loads
  21  |   test('3.2 — Contacts page loads correctly', async ({ page }) => {
  22  |     await page.setViewportSize(MOBILE_VIEWPORT);
  23  |     await page.goto(`${BASE_URL}/contacts`);
  24  |     await expect(page.locator('text=Saved Contacts')).toBeVisible();
  25  |     await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();
  26  |   });
  27  | 
  28  |   // 3.3 Navigation
  29  |   test('3.3 — Navigation between pages works', async ({ page }) => {
  30  |     await page.setViewportSize(MOBILE_VIEWPORT);
  31  |     await page.goto(BASE_URL);
  32  |     await page.click('a[href="/contacts"]');
  33  |     await expect(page).toHaveURL(`${BASE_URL}/contacts`);
  34  |     await expect(page.locator('text=Saved Contacts')).toBeVisible();
  35  |     await page.click('a[href="/"]');
  36  |     await expect(page).toHaveURL(`${BASE_URL}/`);
  37  |     await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
  38  |   });
  39  | 
  40  |   // 3.4 File upload triggers extraction
  41  |   test('3.4 — File upload triggers extraction', async ({ page }) => {
  42  |     await page.setViewportSize(MOBILE_VIEWPORT);
  43  |     await page.goto(BASE_URL);
  44  |     const fileInput = page.locator('input[type="file"]');
  45  |     await fileInput.setInputFiles(TEST_CARD_PATH);
  46  |     await expect(page.locator('text=Reading card')).toBeVisible({ timeout: 5000 });
  47  |     await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 60000 });
  48  |   });
  49  | 
  50  |   // 3.5 Extracted fields populated and editable
  51  |   test('3.5 — Extracted fields are populated and editable', async ({ page }) => {
  52  |     await page.setViewportSize(MOBILE_VIEWPORT);
  53  |     await page.goto(BASE_URL);
  54  |     const fileInput = page.locator('input[type="file"]');
  55  |     await fileInput.setInputFiles(TEST_CARD_PATH);
  56  |     // Wait for textarea (email draft) — appears only after extraction completes
> 57  |     await expect(page.locator('textarea')).toBeVisible({ timeout: 120000 });
      |                                            ^ Error: expect(locator).toBeVisible() failed
  58  |     const nameField = page.locator('input[type="text"]').first();
  59  |     const nameValue = await nameField.inputValue();
  60  |     expect(nameValue.length).toBeGreaterThan(0);
  61  |     await nameField.click({ clickCount: 3 });
  62  |     await nameField.fill('Rajesh Kumar (Edited)');
  63  |     await expect(nameField).toHaveValue('Rajesh Kumar (Edited)');
  64  |     const emailDraft = page.locator('textarea');
  65  |     const draftValue = await emailDraft.inputValue();
  66  |     expect(draftValue.length).toBeGreaterThan(20);
  67  |   });
  68  | 
  69  |   // 3.6 Email draft is editable
  70  |   test('3.6 — Email draft is editable', async ({ page }) => {
  71  |     await page.setViewportSize(MOBILE_VIEWPORT);
  72  |     await page.goto(BASE_URL);
  73  |     const fileInput = page.locator('input[type="file"]');
  74  |     await fileInput.setInputFiles(TEST_CARD_PATH);
  75  |     await expect(page.locator('textarea')).toBeVisible({ timeout: 120000 });
  76  |     const textarea = page.locator('textarea');
  77  |     await textarea.click();
  78  |     await textarea.fill('Custom email content written by user during test.');
  79  |     await expect(textarea).toHaveValue('Custom email content written by user during test.');
  80  |   });
  81  | 
  82  |   // 3.7 Send button disabled without email
  83  |   test('3.7 — Send Email button disabled when no email', async ({ page }) => {
  84  |     await page.setViewportSize(MOBILE_VIEWPORT);
  85  |     await page.goto(BASE_URL);
  86  |     const fileInput = page.locator('input[type="file"]');
  87  |     await fileInput.setInputFiles(TEST_CARD_PATH);
  88  |     await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 60000 });
  89  |     const emailField = page.locator('input[type="email"]');
  90  |     await emailField.click({ clickCount: 3 });
  91  |     await emailField.fill('');
  92  |     const sendBtn = page.locator('button:has-text("Send Email")');
  93  |     await expect(sendBtn).toBeDisabled();
  94  |   });
  95  | 
  96  |   // 3.8 Save Contact
  97  |   test('3.8 — Save Contact button works', async ({ page }) => {
  98  |     await page.setViewportSize(MOBILE_VIEWPORT);
  99  |     await page.goto(BASE_URL);
  100 |     const fileInput = page.locator('input[type="file"]');
  101 |     await fileInput.setInputFiles(TEST_CARD_PATH);
  102 |     await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 60000 });
  103 |     await page.click('button:has-text("Save Contact")');
  104 |     await expect(page.locator('text=Contact saved')).toBeVisible({ timeout: 10000 });
  105 |   });
  106 | 
  107 |   // 3.9 Send Email real send (only to own email in free tier)
  108 |   test('3.9 — Send Email button triggers real send', async ({ page }) => {
  109 |     await page.setViewportSize(MOBILE_VIEWPORT);
  110 |     await page.goto(BASE_URL);
  111 |     const fileInput = page.locator('input[type="file"]');
  112 |     await fileInput.setInputFiles(TEST_CARD_PATH);
  113 |     await expect(page.locator('text=Card read successfully')).toBeVisible({ timeout: 60000 });
  114 |     // Resend free tier: can only send to own email
  115 |     const emailField = page.locator('input[type="email"]');
  116 |     await emailField.click({ clickCount: 3 });
  117 |     await emailField.fill('chinmay.joshi0010@gmail.com');
  118 |     const sendBtn = page.locator('button:has-text("Send Email")');
  119 |     await expect(sendBtn).not.toBeDisabled();
  120 |     await sendBtn.click();
  121 |     await expect(page.locator('text=Sending email')).toBeVisible({ timeout: 5000 });
  122 |     await expect(page.locator('text=Email sent')).toBeVisible({ timeout: 15000 });
  123 |   });
  124 | 
  125 |   // 3.10 Card image preview
  126 |   test('3.10 — Card image preview shows after upload', async ({ page }) => {
  127 |     await page.setViewportSize(MOBILE_VIEWPORT);
  128 |     await page.goto(BASE_URL);
  129 |     const fileInput = page.locator('input[type="file"]');
  130 |     await fileInput.setInputFiles(TEST_CARD_PATH);
  131 |     await expect(page.locator('img[alt="Card preview"]')).toBeVisible({ timeout: 5000 });
  132 |   });
  133 | 
  134 |   // 3.11 X button clears image
  135 |   test('3.11 — X button clears image and resets form', async ({ page }) => {
  136 |     await page.setViewportSize(MOBILE_VIEWPORT);
  137 |     await page.goto(BASE_URL);
  138 |     const fileInput = page.locator('input[type="file"]');
  139 |     await fileInput.setInputFiles(TEST_CARD_PATH);
  140 |     await expect(page.locator('img[alt="Card preview"]')).toBeVisible({ timeout: 5000 });
  141 |     await page.click('button:has-text("✕")');
  142 |     await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
  143 |   });
  144 | 
  145 |   // 3.12 Capture another card resets
  146 |   test('3.12 — Capture another card resets full form', async ({ page }) => {
  147 |     await page.setViewportSize(MOBILE_VIEWPORT);
  148 |     await page.goto(BASE_URL);
  149 |     const fileInput = page.locator('input[type="file"]');
  150 |     await fileInput.setInputFiles(TEST_CARD_PATH);
  151 |     await expect(page.locator('textarea')).toBeVisible({ timeout: 120000 });
  152 |     await page.click('text=Capture another card');
  153 |     await expect(page.locator('text=Tap to capture or upload')).toBeVisible();
  154 |     await expect(page.locator('input[type="email"]')).not.toBeVisible();
  155 |   });
  156 | 
  157 |   // 3.13 Contacts list
```
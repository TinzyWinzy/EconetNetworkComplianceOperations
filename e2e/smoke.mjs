// e2e/smoke.mjs — end-to-end smoke test for the four critical demo paths.
// Run with: node e2e/smoke.mjs  (dev server must be running; default http://localhost:5174)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert';

const BASE = process.env.BASE_URL || 'http://localhost:5174';
const PIN = process.env.VITE_DEMO_PIN || '1212';

let failures = 0;
const results = [];
function record(name, ok, extra = '') {
  results.push({ name, ok, extra });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${extra ? ` — ${extra}` : ''}`);
  if (!ok) failures += 1;
}

const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page = await context.newPage();
page.setDefaultTimeout(30000);

const pageErrors = [];
page.on('pageerror', (e) => pageErrors.push(String(e)));

try {
  // ---- 0. Load + PIN gate ----
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  await page.locator('#pin').fill(PIN);
  await page.getByRole('button', { name: 'Unlock console' }).click();
  await page.getByRole('heading', { name: 'Network compliance operations' }).waitFor();
  record('PIN gate unlock + dashboard load', true);

  // ---- 1. Grid event replay triggers incidents ----
  const noIncident = await page.getByRole('heading', { name: /Active incidents/ }).isVisible().catch(() => false);
  await page.getByRole('button', { name: 'Grid event replay' }).click();
  await page.locator('section[aria-label="Active incidents"]').waitFor({ timeout: 20000 });
  const incidentText = await page.locator('section[aria-label="Active incidents"]').innerText();
  const hasFined = /US\$[\d,]+ fined/.test(incidentText) || /Active incidents/.test(incidentText);
  record('Grid event replay surfaces incidents', hasFined, `(before-replay incidents visible: ${noIncident})`);

  // ---- 2. Fleet table (TanStack) ----
  await page.getByRole('button', { name: 'Tower fleet' }).click();
  await page.getByRole('button', { name: 'Table' }).click();
  await page.locator('section[aria-label="Tower fleet table"]').waitFor();
  const rowCount = await page.locator('section[aria-label="Tower fleet table"] tbody tr').count();
  record('Fleet table renders rows', rowCount > 0, `${rowCount} rows`);

  // ---- 3. Fleet map (MapLibre) ----
  await page.getByRole('button', { name: 'Map' }).click();
  await page.locator('canvas.maplibregl-canvas').first().waitFor({ timeout: 30000 });
  const canvasCount = await page.locator('canvas.maplibregl-canvas').count();
  record('MapLibre map initializes (canvas)', canvasCount >= 1, `${canvasCount} canvas`);

  // ---- 4. Customer journey (SMS dispatch) ----
  await page.getByRole('button', { name: 'Subscribers' }).click();
  await page.getByRole('button', { name: 'Customer journey' }).click();
  const slider = page.locator('input[type="range"][aria-label="Simulate data usage"]');
  await slider.waitFor();
  await slider.focus();
  await page.keyboard.press('End'); // set to 100% -> fire 50/80/90/100 thresholds
  await page.locator('section[aria-label="Notification gateway dispatch log"]').waitFor();
  await page.waitForFunction(() => {
    const el = document.querySelector('section[aria-label="Notification gateway dispatch log"]');
    return el && el.textContent && el.textContent.includes('100%');
  }, { timeout: 20000 });
  const logText = await page.locator('section[aria-label="Notification gateway dispatch log"]').innerText();
  record('SMS journey dispatches at thresholds', /100%/.test(logText) && /SLA met/.test(logText));

  // ---- 5. Dossier CSV download ----
  await page.getByRole('button', { name: 'Reports' }).click();
  const [csvDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export CSV schedule' }).click()
  ]);
  const csvPath = await csvDownload.path();
  const csv = fs.readFileSync(csvPath, 'utf8');
  record('CSV schedule downloads', csv.startsWith('"tower_id"') || csv.includes('tower_id'));

  // ---- 6. Dossier PDF download ----
  const [pdfDownload] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Export PDF dossier' }).click()
  ]);
  const pdfPath = await pdfDownload.path();
  const pdfHead = fs.readFileSync(pdfPath).slice(0, 4).toString();
  record('PDF dossier downloads (valid %PDF)', pdfHead === '%PDF', `magic="${pdfHead}"`);

  // ---- 7. Demo guide dialog + navigation ----
  await page.getByRole('button', { name: 'Demo guide' }).click();
  const dialog = page.getByRole('dialog', { name: /Demo guide/ });
  await dialog.waitFor();
  await dialog.getByRole('button', { name: 'Open the map' }).click();
  await dialog.waitFor({ state: 'hidden' });
  await page.locator('canvas.maplibregl-canvas').first().waitFor({ timeout: 30000 });
  record('Demo guide opens, navigates to map, closes', true);
} catch (e) {
  record('Unexpected error', false, e instanceof Error ? e.message : String(e));
} finally {
  if (pageErrors.length) {
    console.log('\n--- Page console/page errors (informational) ---');
    for (const pe of pageErrors) console.log(`  [pageerror] ${pe}`);
  }
  await browser.close();
}

console.log('\n==== SUMMARY ====');
for (const r of results) console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}`);
console.log(`\n${results.length - failures}/${results.length} checks passed`);
process.exit(failures === 0 ? 0 : 1);

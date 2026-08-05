/**
 * Records mobile walkthrough clips of the portal for the instructional video.
 * Usage: npx tsx scripts/record-walkthrough.ts
 * Outputs raw clips into tmp/video/raw/<section>.webm
 */
import { chromium, Page, BrowserContext } from 'playwright';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';

const BASE = 'http://127.0.0.1:5000';
const OUT = 'tmp/video/raw';
const VIEWPORT = { width: 390, height: 844 }; // iPhone-ish

function token() {
  return jwt.sign({ id: 31, email: 'JRHCONTRACTING@YAHOO.COM', netsuiteCustomerId: '155425' }, process.env.JWT_SECRET!, { expiresIn: '2h' });
}

async function newContext(browser: any, name: string): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    recordVideo: { dir: OUT, size: VIEWPORT },
  });
  await ctx.addInitScript((t: string) => window.localStorage.setItem('auth_token', t), token());
  // Header company name blurred from the very first paint (string form:
  // esbuild's __name helper breaks serialized function init scripts)
  await ctx.addInitScript(`document.addEventListener('DOMContentLoaded', () => {
    const st = document.createElement('style');
    st.textContent = 'span.font-medium.uppercase { filter: blur(7px) !important; }';
    document.head.appendChild(st);
  });`);
  const page = await ctx.newPage();
  (page as any)._clipName = name;
  return { ctx, page };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Blur the company name wherever it appears (privacy for the video).
// Must run in the page after load; re-runs on an interval to catch re-renders.
async function installBlur(page: Page) {
  // Passed as a string: tsx/esbuild injects a __name helper into serialized
  // functions which breaks page.evaluate serialization.
  await page.evaluate(`(() => {
    const RX = /jrh\\s*contracting(\\s*inc\\.?)?/i;
    const blurMatches = () => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes = [];
      let n;
      while ((n = walker.nextNode())) {
        if (RX.test(n.data) && !(n.parentElement && n.parentElement.dataset.blurred)) nodes.push(n);
      }
      for (const tn of nodes) {
        const parent = tn.parentElement;
        const m = tn.data.match(RX);
        if (!parent || !m) continue;
        const frag = document.createDocumentFragment();
        frag.appendChild(document.createTextNode(tn.data.slice(0, m.index)));
        const span = document.createElement('span');
        span.textContent = m[0];
        span.style.filter = 'blur(7px)';
        span.dataset.blurred = '1';
        frag.appendChild(span);
        frag.appendChild(document.createTextNode(tn.data.slice(m.index + m[0].length)));
        parent.replaceChild(frag, tn);
      }
    };
    blurMatches();
    setInterval(blurMatches, 100);
    // React re-renders can replace blurred spans; observer re-blurs instantly
    const mo = new MutationObserver(() => blurMatches());
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    // Header company-name span: permanent CSS blur survives all re-renders
    const st = document.createElement('style');
    st.textContent = 'header span.font-medium.uppercase, span.font-medium.uppercase { filter: blur(7px) !important; }';
    document.head.appendChild(st);
  })()`);
  await sleep(300);
}

// Fake "hand with pointer finger" cursor overlaid on the page.
async function installCursor(page: Page) {
  await page.evaluate(`(() => {
    if (document.getElementById('__tapHand')) return;
    const d = document.createElement('div');
    d.id = '__tapHand';
    d.innerHTML = '<svg width="54" height="54" viewBox="0 0 24 24"><path fill="#F5A623" stroke="#7A4E00" stroke-width="0.6" d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63l-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.38z"/></svg>';
    d.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transform:translate(200px,700px);transition:transform 0.55s cubic-bezier(.4,0,.2,1), scale 0.15s;filter:drop-shadow(0 2px 4px rgba(0,0,0,.35));';
    document.body.appendChild(d);
    window.__moveHand = (x, y) => { d.style.transform = 'translate(' + (x - 8) + 'px,' + (y + 6) + 'px)'; };
    window.__pressHand = (down) => { d.style.scale = down ? '0.8' : '1'; };
  })()`);
}

// Move the hand to the element, press, then really click it.
async function tap(page: Page, locator: any, opts: { timeout?: number } = {}) {
  const box = await locator.boundingBox({ timeout: opts.timeout ?? 5000 }).catch(() => null);
  if (!box) return false;
  const x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.evaluate(`window.__moveHand && window.__moveHand(${x}, ${y})`);
  await sleep(650);
  await page.evaluate(`window.__pressHand && window.__pressHand(true)`);
  await sleep(160);
  await page.evaluate(`window.__pressHand && window.__pressHand(false)`);
  await locator.click({ timeout: opts.timeout ?? 5000 }).catch(() => {});
  return true;
}

async function saveClip(ctx: BrowserContext, page: Page, name: string) {
  const video = page.video();
  await ctx.close();
  if (video) {
    const p = await video.path();
    fs.renameSync(p, path.join(OUT, `${name}.webm`));
    console.log('saved', name);
  }
}

async function smoothScroll(page: Page, px: number, steps = 20) {
  for (let i = 0; i < steps; i++) {
    await page.mouse.wheel(0, px / steps);
    await sleep(50);
  }
}

const timings: Record<string, number> = {};

async function run() {
  fs.rmSync('tmp/video/raw', { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN! });

  // ---- 1. Estimates
  {
    const { ctx, page } = await newContext(browser, 'estimates');
    const t0 = Date.now();
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded' });
    await installBlur(page);
    await installCursor(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(1200);
    // tap Estimates in bottom nav
    await tap(page, page.getByText('Estimates', { exact: true }).last());
    await page.waitForLoadState('networkidle');
    await sleep(1500);
    await smoothScroll(page, 350, 10);
    await sleep(400);
    // open first estimate details
    const row = page.locator('text=/ES\\d{5,}/ >> visible=true').first();
    timings.estimates = (Date.now() - t0) / 1000;
    await tap(page, row); await sleep(1200);
    await page.locator('[role="dialog"] >> text=/\\$\\d/').first().waitFor({ timeout: 15000 }).catch(() => {});
    await sleep(1200); await smoothScroll(page, 500, 12); await sleep(900);
    await saveClip(ctx, page, 'estimates');
  }

  // ---- 2. Sales Orders: tabs active/ready/completed + details
  {
    const { ctx, page } = await newContext(browser, 'orders');
    const t0 = Date.now();
    await page.goto(BASE + '/orders', { waitUntil: 'domcontentloaded' });
    await installBlur(page);
    await installCursor(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(1000);
    for (const tab of ['Active', 'Ready', 'Completed']) {
      const t = page.getByText(tab, { exact: false }).first();
      if (await t.count()) { await tap(page, t); await sleep(1100); }
    }
    const active = page.getByText('Active', { exact: false }).first();
    if (await active.count()) { await tap(page, active); await sleep(800); }
    const row = page.locator('text=/SO\\d{5,}/ >> visible=true').first();
    timings.orders = (Date.now() - t0) / 1000;
    await tap(page, row); await sleep(1200);
    await page.locator('[role="dialog"] >> text=/\\$\\d/').first().waitFor({ timeout: 15000 }).catch(() => {});
    await sleep(1200); await smoothScroll(page, 500, 12); await sleep(800);
    await saveClip(ctx, page, 'orders');
  }

  // ---- 3. Consumers Cash: balance, rebate level, history
  {
    const { ctx, page } = await newContext(browser, 'cash');
    const t0 = Date.now();
    await page.goto(BASE + '/consumers-cash', { waitUntil: 'domcontentloaded' });
    await installBlur(page);
    await installCursor(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(1400);
    timings.cash = (Date.now() - t0) / 1000;
    await smoothScroll(page, 550, 12);
    await sleep(700);
    await smoothScroll(page, 700, 12);
    await sleep(1000);
    await saveClip(ctx, page, 'cash');
  }

  // ---- 4. Get a Project Quote: splash -> tap Quick Quote -> fill form in order
  {
    const { ctx, page } = await newContext(browser, 'quote');
    const t0 = Date.now();
    await page.goto(BASE + '/quick-quote', { waitUntil: 'domcontentloaded' });
    await installBlur(page);
    await installCursor(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    await sleep(1600);
    await smoothScroll(page, 300, 8);
    await sleep(600);
    // tap the Quick Quote button (client-side navigation, no reload flash)
    timings.quote = (Date.now() - t0) / 1000;
    await tap(page, page.getByTestId('button-quick-quote'));
    await page.getByText('Tell us about your project').first().waitFor({ timeout: 15000 }).catch(() => {});
    await installCursor(page);
    await sleep(1000);
    // Fill the form top to bottom.
    const pickSelect = async (trigger: any) => {
      if (!(await tap(page, trigger))) return;
      await sleep(600);
      const opt = page.locator('[role="option"]').first();
      await tap(page, opt);
      await sleep(500);
    };
    const triggers = page.locator('button[role="combobox"]');
    await pickSelect(triggers.nth(0));           // Store
    await pickSelect(triggers.nth(1));           // Salesperson
    await tap(page, page.getByText('Kitchen', { exact: true }).first()); // Project type
    await sleep(500);
    await smoothScroll(page, 350, 8);
    await sleep(300);
    await pickSelect(page.locator('button[role="combobox"] >> visible=true').nth(2)); // Budget
    await pickSelect(page.locator('button[role="combobox"] >> visible=true').nth(3)); // Time frame
    await smoothScroll(page, 400, 8);
    await sleep(900);
    await saveClip(ctx, page, 'quote');
  }

  // ---- 5. Express Bath
  {
    const { ctx, page } = await newContext(browser, 'bath');
    const t0 = Date.now();
    await page.goto(BASE + '/express-bath', { waitUntil: 'domcontentloaded' });
    await installBlur(page);
    await installCursor(page);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.locator('text=/\\$\\d/').first().waitFor({ timeout: 20000 }).catch(() => {});
    await sleep(1200);
    timings.bath = (Date.now() - t0) / 1000;
    await smoothScroll(page, 700, 10);
    await sleep(400);
    await smoothScroll(page, 800, 10);
    await sleep(400);
    await smoothScroll(page, 800, 10);
    await sleep(400);
    await smoothScroll(page, -1200, 12);
    await sleep(700);
    await saveClip(ctx, page, 'bath');
  }

  fs.writeFileSync(path.join(OUT, 'timings.json'), JSON.stringify(timings, null, 2));
  await browser.close();
  console.log('TIMINGS', JSON.stringify(timings));
  console.log('ALL DONE');
}

run().catch((e) => { console.error(e); process.exit(1); });

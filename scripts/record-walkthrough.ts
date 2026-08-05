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

async function run() {
  fs.rmSync('tmp/video/raw', { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN! });

  // ---- 1. Estimates
  {
    const { ctx, page } = await newContext(browser, 'estimates');
    await page.goto(BASE + '/', { waitUntil: 'networkidle' });
    await installBlur(page);
    await sleep(2000);
    // tap Estimates in bottom nav
    await page.getByText('Estimates', { exact: true }).last().click();
    await page.waitForLoadState('networkidle');
    await sleep(2500);
    await smoothScroll(page, 300);
    await sleep(800);
    // open first estimate details
    const row = page.locator('text=/ES\\d{5,}/ >> visible=true').first();
    await row.click({ timeout: 5000 }).catch(() => {}); await sleep(3000); await smoothScroll(page, 400); await sleep(1500);
    await saveClip(ctx, page, 'estimates');
  }

  // ---- 2. Sales Orders: tabs active/ready/completed + details
  {
    const { ctx, page } = await newContext(browser, 'orders');
    await page.goto(BASE + '/orders', { waitUntil: 'networkidle' });
    await installBlur(page);
    await sleep(2500);
    for (const tab of ['Active', 'Ready', 'Completed']) {
      const t = page.getByText(tab, { exact: false }).first();
      if (await t.count()) { await t.click(); await sleep(2200); }
    }
    const active = page.getByText('Active', { exact: false }).first();
    if (await active.count()) { await active.click(); await sleep(1500); }
    const row = page.locator('text=/SO\\d{5,}/ >> visible=true').first();
    await row.click({ timeout: 5000 }).catch(() => {}); await sleep(3000); await smoothScroll(page, 400); await sleep(1200);
    await saveClip(ctx, page, 'orders');
  }

  // ---- 3. Consumers Cash: balance, rebate level, history
  {
    const { ctx, page } = await newContext(browser, 'cash');
    await page.goto(BASE + '/consumers-cash', { waitUntil: 'networkidle' });
    await installBlur(page);
    await sleep(3000);
    await smoothScroll(page, 500);
    await sleep(1500);
    await smoothScroll(page, 600);
    await sleep(2000);
    await saveClip(ctx, page, 'cash');
  }

  // ---- 4. Get a Project Quote: splash + form
  {
    const { ctx, page } = await newContext(browser, 'quote');
    await page.goto(BASE + '/quick-quote', { waitUntil: 'networkidle' });
    await installBlur(page);
    await sleep(3000);
    await smoothScroll(page, 400);
    await sleep(1500);
    // go to the quick quote form
    await page.goto(BASE + '/quick-quote/request', { waitUntil: 'networkidle' });
    await installBlur(page);
    await sleep(2500);
    await smoothScroll(page, 400);
    await sleep(1000);
    const kitchen = page.getByText('Kitchen', { exact: true }).first();
    if (await kitchen.count()) { await kitchen.click(); await sleep(1200); }
    await smoothScroll(page, 500);
    await sleep(1500);
    await saveClip(ctx, page, 'quote');
  }

  // ---- 5. Express Bath
  {
    const { ctx, page } = await newContext(browser, 'bath');
    await page.goto(BASE + '/express-bath', { waitUntil: 'networkidle' });
    await installBlur(page);
    await sleep(3500);
    await smoothScroll(page, 500);
    await sleep(1500);
    await smoothScroll(page, 500);
    await sleep(1500);
    await saveClip(ctx, page, 'bath');
  }

  await browser.close();
  console.log('ALL DONE');
}

run().catch((e) => { console.error(e); process.exit(1); });

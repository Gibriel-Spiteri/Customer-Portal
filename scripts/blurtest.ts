import { chromium } from 'playwright';
import jwt from 'jsonwebtoken';
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN! });
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const t = jwt.sign({ id: 31, email: 'JRHCONTRACTING@YAHOO.COM', netsuiteCustomerId: '155425' }, process.env.JWT_SECRET!, { expiresIn: '2h' });
  await ctx.addInitScript((tok) => window.localStorage.setItem('auth_token', tok), t);
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:5000/', { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 3000));
  const res = await page.evaluate(() => {
    const RX = /jrh\s*contracting(\s*inc\.?)?/i;
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let count = 0; let n: any;
    const nodes: any[] = [];
    while ((n = walker.nextNode())) { if (RX.test(n.data)) nodes.push(n); }
    for (const tn of nodes) {
      const m = tn.data.match(RX);
      const parent = tn.parentElement; if (!parent || !m) continue;
      const frag = document.createDocumentFragment();
      frag.appendChild(document.createTextNode(tn.data.slice(0, m.index)));
      const span = document.createElement('span');
      span.textContent = m[0]; span.style.filter = 'blur(7px)'; span.dataset.blurred = '1';
      frag.appendChild(span);
      frag.appendChild(document.createTextNode(tn.data.slice(m.index + m[0].length)));
      parent.replaceChild(frag, tn);
      count++;
    }
    return count;
  });
  console.log('blurred nodes:', res);
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: 'tmp/video/blurtest.jpg', type: 'jpeg' });
  await browser.close();
})();

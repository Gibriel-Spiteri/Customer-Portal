import { chromium } from 'playwright';
import jwt from 'jsonwebtoken';
import fs from 'fs';
const BASE = 'http://127.0.0.1:5000';
const t = jwt.sign({ id: 31, email: 'JRHCONTRACTING@YAHOO.COM', netsuiteCustomerId: '155425' }, process.env.JWT_SECRET!, { expiresIn: '1h' });
const pages = [['home','/'],['estimates','/estimates'],['orders','/orders'],['cash','/consumers-cash'],['quote','/quick-quote'],['bath','/express-bath']];
(async () => {
  fs.mkdirSync('tmp/desktop', { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN! });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await ctx.addInitScript((tok: string) => window.localStorage.setItem('auth_token', tok), t);
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    await page.goto(BASE + path, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.screenshot({ path: `tmp/desktop/${name}.jpg`, quality: 70, type: 'jpeg' });
    console.log('shot', name);
  }
  await browser.close();
})();

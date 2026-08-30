import { chromium } from "playwright-core"
const dir = "/tmp/claude-0/-home-user/3a747d83-91c5-5f54-84be-7b57ad18f577/scratchpad"
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 2 })
for (const s of ["deck", "kept", "where", "when"]) {
  await page.goto(`http://localhost:3111/preview?s=${s}`, { waitUntil: "domcontentloaded" })
  await page.waitForSelector("main > *", { timeout: 30000 })
  await page.waitForTimeout(1500)
  await page.screenshot({ path: `${dir}/v3-${s}.png` })
  console.log("shot", s)
}
await browser.close()

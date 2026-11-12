import puppeteer from "puppeteer-core";
import { mkdir } from "node:fs/promises";

const shots = [
  ["prompt", 2400],
  ["matcha", 4200],
  ["iced", 7200],
  ["three", 11500],
  ["four", 15200],
  ["sizes", 19000],
  ["oat", 23400],
  ["end", 33000],
];

await mkdir("/tmp/shots", { recursive: true });

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  userDataDir: "/tmp/chrome-coffee-profile",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--force-device-scale-factor=1", "--hide-scrollbars"],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 2076, height: 1440, deviceScaleFactor: 1 });
  for (const [name, at] of shots) {
    const url = `http://127.0.0.1:4317/?at=${at}&shot=1`;
    await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
    await page.waitForFunction(
      () => document.fonts.status === "loaded" && document.querySelector("h1, h2"),
      { timeout: 10000 },
    );
    await new Promise((resolve) => setTimeout(resolve, 250));
    await page.screenshot({ path: `/tmp/shots/${name}.png` });
    console.log("saved", name);
  }
} finally {
  await browser.close();
}

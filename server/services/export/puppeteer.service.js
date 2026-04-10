/**
 * puppeteer.service.js
 *
 * Core PDF generation engine.
 * Launches a headless Chromium instance, navigates to the /print page with
 * query params, waits for the [data-pdf-ready="true"] sentinel, then captures
 * an A4 landscape PDF.
 *
 * The browser is always closed in a finally block — even on error.
 */

import puppeteer from 'puppeteer';

/**
 * @param {object} options
 * @param {string} options.department
 * @param {string} options.year
 * @param {string} options.semester   e.g. "Semester V"
 * @param {string} options.printUrl   Full URL to the /print route (e.g. http://localhost:3000/print)
 * @returns {Promise<Buffer>}
 */
export async function generateTimetablePDF({ department, year, semester, printUrl }) {
  let browser = null;

  try {
    const launchArgs = [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
    ];

    browser = await puppeteer.launch({
      headless: 'new',
      args: launchArgs,
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    });

    const page = await browser.newPage();

    // Set viewport to A4 landscape in device pixels
    await page.setViewport({ width: 1122, height: 794 });

    const url =
      `${printUrl}` +
      `?department=${encodeURIComponent(department)}` +
      `&year=${encodeURIComponent(year)}` +
      `&semester=${encodeURIComponent(semester)}`;

    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

    // Wait for the grid component to signal it has fully rendered
    await page.waitForSelector('[data-pdf-ready="true"]', { timeout: 15_000 });

    const pdfBuffer = await page.pdf({
      format:          'A4',
      landscape:       true,
      printBackground: true, // CRITICAL — captures all Tailwind background colors
      margin: { top: '14mm', bottom: '14mm', left: '10mm', right: '10mm' },
      displayHeaderFooter: true,
      headerTemplate: `
        <div style="font-size:9px; font-family:Inter,sans-serif; width:100%; padding: 0 10mm;
                    display:flex; justify-content:space-between; color:#6b7280; box-sizing:border-box;">
          <span>${department} Department · ${year} · ${semester}</span>
          <span>Smart Timetable Architect</span>
        </div>`,
      footerTemplate: `
        <div style="font-size:8px; font-family:Inter,sans-serif; width:100%; padding: 0 10mm;
                    display:flex; justify-content:space-between; color:#9ca3af; box-sizing:border-box;">
          <span>Generated: <span class="date"></span></span>
          <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
        </div>`,
    });

    return pdfBuffer;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

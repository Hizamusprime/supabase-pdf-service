import puppeteer from "puppeteer";
import { supabase } from "./supabase.js";

const TEMPLATE_BUCKET = "templates";

/**
 * Fetch an HTML template from Supabase Storage and replace
 * {{key}} placeholders with values from the record.
 */
async function renderTemplate(templateName, data) {
  const filePath = `${templateName}.html`;

  const { data: fileData, error } = await supabase.storage
    .from(TEMPLATE_BUCKET)
    .download(filePath);

  if (error) throw new Error(`Template fetch error (${filePath}): ${error.message}`);

  const html = await fileData.text();

  // Replace all {{field_name}} tokens with values from the record
  return html.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    return data[key] !== undefined ? String(data[key]) : "";
  });
}

/**
 * Generate a PDF buffer from a named template and a data record.
 */
export async function generatePDF(templateName, data) {
  const html = await renderTemplate(templateName, data);

  const browser = await puppeteer.launch({
    headless: "new",
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
    ],
  });

  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });

  const pdfBuffer = await page.pdf({
    format: "A4",
    printBackground: true,
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
  });

  await browser.close();
  return pdfBuffer;
}
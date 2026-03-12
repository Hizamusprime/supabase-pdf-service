
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    },
  }
);

const BUCKET = process.env.SUPABASE_BUCKET ?? "PDF_OUTPUT";

export async function fetchRecord(table, id) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  return data;
}

export async function uploadPDF(pdfBuffer, filePath) {
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (error) throw new Error(`Supabase upload error: ${error.message}`);

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function updateJobPdfUrl(jobId, templateName, url) {
  const colMap = {
    quote:        "quote_pdf_url",
    invoice:      "invoice_pdf_url",
    swms:         "swms_pdf_url",
    toolbox_talk: "toolbox_pdf_url",
  };
  const col = colMap[templateName];
  if (!col) return;

  const { error } = await supabase
    .from("jobs")
    .update({ [col]: url })
    .eq("id", jobId);

  if (error) console.error(`Failed to update ${col}:`, error.message);
}

export async function getJob(jobId) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", jobId)
    .single();

  if (error) console.error("Failed to get job:", error.message);
  return data;
}
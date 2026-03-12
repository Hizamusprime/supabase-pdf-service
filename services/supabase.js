import { createClient } from "@supabase/supabase-js";

// Export client so other services (e.g. pdf.js) can share it
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY  // use service role for storage uploads
);

const BUCKET = process.env.SUPABASE_BUCKET ?? "pdfs";

/**
 * Fetch a single record from any table by id.
 */
export async function fetchRecord(table, id) {
  const { data, error } = await supabase
    .from(table)
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw new Error(`Supabase fetch error: ${error.message}`);
  return data;
}

/**
 * Upload a PDF buffer to Supabase Storage.
 * Returns the public URL of the uploaded file.
 */
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
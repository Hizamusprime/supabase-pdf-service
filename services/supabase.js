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
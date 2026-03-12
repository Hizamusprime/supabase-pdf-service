import express from "express";import "dotenv/config";

import { fetchRecord, uploadPDF } from "./services/supabase.js";
import { generatePDF } from "./services/pdf.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check
app.get("/", (req, res) => res.send("PDF Server running ✅"));

// Supabase webhook endpoint
app.post("/webhook", async (req, res) => {
  try {
    const { record, table } = req.body;

    if (!record) {
      return res.status(400).json({ error: "No record in payload" });
    }

    const { id, template_name } = record;

    if (!template_name) {
      return res.status(400).json({ error: "Missing template_name on record" });
    }

    console.log(`📩 Webhook: table=${table}, id=${id}, template=${template_name}`);

    // 1. Fetch full record from Supabase
    const data = await fetchRecord(table, id);

    // 2. Generate PDF from Supabase Storage template + data
    const pdfBuffer = await generatePDF(template_name, data);

    // 3. Upload PDF to Supabase Storage output bucket
    const filePath = `${table}/${template_name}_${id}_${Date.now()}.pdf`;
    const url = await uploadPDF(pdfBuffer, filePath);

    console.log(`✅ PDF uploaded: ${url}`);
    return res.status(200).json({ success: true, url });

  } catch (err) {
    console.error("❌ Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));
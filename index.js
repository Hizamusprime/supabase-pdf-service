
import express from "express";
import { fetchRecord, uploadPDF, updateJobPdfUrl } from "./services/supabase.js";
import { generatePDF } from "./services/pdf.js";

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Map status to which templates to generate
const STATUS_TEMPLATES = {
  new:       ["quote"],
  accepted:  ["toolbox_talk", "swms"],
  completed: ["invoice"],
};

// Health check
app.get("/", (req, res) => res.send("PDF Server running ✅"));

// Supabase webhook endpoint
app.post("/webhook", async (req, res) => {
  try {
    const { record, table } = req.body;

    if (!record) {
      return res.status(400).json({ error: "No record in payload" });
    }

    const { id, status } = record;

    if (!status) {
      return res.status(400).json({ error: "Missing status on record" });
    }

    const templates = STATUS_TEMPLATES[status.toLowerCase()];

    if (!templates) {
      console.log(`⏭️ No PDF needed for status: ${status}`);
      return res.status(200).json({ skipped: true, status });
    }

    console.log(`📩 Webhook: table=${table}, id=${id}, status=${status}, templates=${templates}`);

    // Fetch full record from Supabase
    const data = await fetchRecord(table, id);

    // Generate all PDFs for this status
    const urls = [];
    for (const templateName of templates) {
      const pdfBuffer = await generatePDF(templateName, data);
      const filePath = `${templateName}/${id}_${Date.now()}.pdf`;
      const url = await uploadPDF(pdfBuffer, filePath);
      await updateJobPdfUrl(id, templateName, url);
      urls.push({ template: templateName, url });
      console.log(`✅ ${templateName}.pdf uploaded: ${url}`);
    }

    return res.status(200).json({ success: true, urls });

  } catch (err) {
    console.error("❌ Error:", err.message);
    return res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => console.log(`🚀 Server listening on port ${PORT}`));76 
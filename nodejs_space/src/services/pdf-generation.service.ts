import { Injectable, Logger } from '@nestjs/common';
import { createSupabaseClient } from '../lib/supabase.config';

interface JobData {
  id: string;
  job_id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  abn: string;
  site_supervisor: string;
  site_supervisor_phone: string;
  job_type: string;
  location: string;
  start_date: string;
  start_time: string;
  finish_time: string;
  days: number;
  crew_size: number;
  vehicles: number;
  notes: string;
  requires_tpc: boolean;
  requires_stop_slow: boolean;
  induction_required: boolean;
  labour_rate: number;
  vehicle_rate: number;
  hours_on_site: number;
  billable_hours: number;
  subtotal: number;
  gst: number;
  total_plus_gst: number;
  status: string;
  created_at: string;
  data_json: any;
}

@Injectable()
export class PdfGenerationService {
  private readonly logger = new Logger(PdfGenerationService.name);
  private supabase = createSupabaseClient();

  /**
   * Fetch job data from Supabase
   */
  async fetchJobData(jobId: string): Promise<JobData | null> {
    try {
      const { data, error } = await this.supabase
        .from('jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) {
        this.logger.error(`Failed to fetch job data: ${error.message}`);
        return null;
      }

      return data as JobData;
    } catch (error) {
      this.logger.error(`Error fetching job data: ${error.message}`);
      return null;
    }
  }

  /**
   * Load HTML template from embedded files
   */
  async downloadTemplate(documentType: string): Promise<string | null> {
    try {
      const fs = await import('fs/promises');
      const path = await import('path');
      
      // Construct template path from embedded templates
      const templatePath = path.join(__dirname, '..', 'templates', `${documentType}.html`);
      
      this.logger.log(`Loading embedded template: ${templatePath}`);
      
      const htmlContent = await fs.readFile(templatePath, 'utf-8');
      
      this.logger.log(`Template loaded successfully: ${documentType}.html`);
      return htmlContent;
    } catch (error) {
      this.logger.error(`Error loading template: ${error.message}`);
      return null;
    }
  }

  /**
   * Replace placeholders in HTML template with actual job data
   */
  replacePlaceholders(htmlTemplate: string, jobData: JobData): string {
    let populatedHtml = htmlTemplate;

    // Replace all placeholders with format {{field_name}}
    const placeholderRegex = /\{\{([^}]+)\}\}/g;
    
    populatedHtml = populatedHtml.replace(placeholderRegex, (match, fieldName) => {
      const trimmedFieldName = fieldName.trim();
      
      // Handle nested fields in data_json
      if (trimmedFieldName.startsWith('data_json.')) {
        const jsonPath = trimmedFieldName.substring('data_json.'.length);
        const value = this.getNestedValue(jobData.data_json, jsonPath);
        return value !== undefined && value !== null ? String(value) : '';
      }
      
      // Handle direct fields
      const value = jobData[trimmedFieldName as keyof JobData];
      if (value !== undefined && value !== null) {
        // Format dates
        if (trimmedFieldName.includes('date') && typeof value === 'string') {
          return this.formatDate(value);
        }
        // Format currency
        if (['labour_rate', 'vehicle_rate', 'subtotal', 'gst', 'total_plus_gst'].includes(trimmedFieldName)) {
          return `$${Number(value).toFixed(2)}`;
        }
        // Format booleans
        if (typeof value === 'boolean') {
          return value ? 'Yes' : 'No';
        }
        return String(value);
      }
      
      return '';
    });

    return populatedHtml;
  }

  /**
   * Get nested value from object using dot notation
   */
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Format date string
   */
  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0]; // YYYY-MM-DD format
    } catch {
      return dateString;
    }
  }

  /**
   * Generate PDF from HTML using HTML2PDF API
   */
  async generatePdfFromHtml(htmlContent: string): Promise<Buffer | null> {
    try {
      // Step 1: Create the PDF generation request
      const createResponse = await fetch('https://apps.abacus.ai/api/createConvertHtmlToPdfRequest', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          deployment_token: process.env.ABACUSAI_API_KEY,
          html_content: htmlContent,
          base_url: process.env.APP_ORIGIN || '',
          pdf_options: { 
            format: 'A4',
            print_background: true,
            margin: {
              top: '10mm',
              right: '10mm',
              bottom: '10mm',
              left: '10mm'
            }
          },
        }),
      });

      if (!createResponse.ok) {
        const error = await createResponse.json().catch(() => ({ error: 'Failed to create PDF request' }));
        this.logger.error(`Failed to create PDF request: ${error.error}`);
        return null;
      }

      const { request_id } = await createResponse.json();
      if (!request_id) {
        this.logger.error('No request ID returned from create request');
        return null;
      }

      // Step 2: Poll for status until completion
      const maxAttempts = 300; // 5 minutes max
      let attempts = 0;

      while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

        const statusResponse = await fetch('https://apps.abacus.ai/api/getConvertHtmlToPdfStatus', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ 
            request_id: request_id, 
            deployment_token: process.env.ABACUSAI_API_KEY 
          }),
        });

        const statusResult = await statusResponse.json();
        const status = statusResult?.status || 'FAILED';
        const result = statusResult?.result || null;

        if (status === 'SUCCESS') {
          if (result && result.result) {
            return Buffer.from(result.result, 'base64');
          }
          this.logger.error('PDF generation completed but no result data');
          return null;
        } else if (status === 'FAILED') {
          const errorMsg = result?.error || 'PDF generation failed';
          this.logger.error(`PDF generation failed: ${errorMsg}`);
          return null;
        }
        
        attempts++;
      }

      this.logger.error('PDF generation timed out');
      return null;
    } catch (error) {
      this.logger.error(`Error generating PDF: ${error.message}`);
      return null;
    }
  }

  /**
   * Upload PDF to Supabase storage
   */
  async uploadPdfToStorage(
    pdfBuffer: Buffer,
    fileName: string,
    documentType: string
  ): Promise<string | null> {
    try {
      const year = new Date().getFullYear();
      const storagePath = `${documentType}/${year}/${fileName}`;

      this.logger.log(`Uploading PDF to 'generated PDF' bucket: ${storagePath}`);

      const { error } = await this.supabase.storage
        .from('generated PDF')
        .upload(storagePath, pdfBuffer, {
          contentType: 'application/pdf',
          upsert: true
        });

      if (error) {
        this.logger.error(`Failed to upload PDF: ${error.message}`);
        return null;
      }

      this.logger.log(`PDF uploaded successfully: ${storagePath}`);
      return storagePath;
    } catch (error) {
      this.logger.error(`Error uploading PDF: ${error.message}`);
      return null;
    }
  }

  /**
   * Main PDF generation workflow
   */
  async generatePdf(
    jobId: string,
    documentType: string
  ): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      this.logger.log(`Starting PDF generation for job ${jobId}, type: ${documentType}`);

      // Step 1: Fetch job data
      const jobData = await this.fetchJobData(jobId);
      if (!jobData) {
        return { success: false, error: 'Failed to fetch job data' };
      }

      // Step 2: Download template
      const htmlTemplate = await this.downloadTemplate(documentType);
      if (!htmlTemplate) {
        return { success: false, error: 'Failed to download template' };
      }

      // Step 3: Replace placeholders
      const populatedHtml = this.replacePlaceholders(htmlTemplate, jobData);

      // Step 4: Generate PDF
      const pdfBuffer = await this.generatePdfFromHtml(populatedHtml);
      if (!pdfBuffer) {
        return { success: false, error: 'Failed to generate PDF' };
      }

      // Step 5: Create file name
      const createdDate = this.formatDate(jobData.created_at);
      const sanitizedClientName = jobData.client_name.replace(/[^a-zA-Z0-9]/g, '-');
      const fileName = `${jobData.job_id}-${sanitizedClientName}-${documentType}-${createdDate}.pdf`;

      // Step 6: Upload to storage
      const storagePath = await this.uploadPdfToStorage(pdfBuffer, fileName, documentType);
      if (!storagePath) {
        return { success: false, error: 'Failed to upload PDF' };
      }

      this.logger.log(`PDF generation completed successfully: ${storagePath}`);
      return { success: true, path: storagePath };
    } catch (error) {
      this.logger.error(`PDF generation error: ${error.message}`);
      return { success: false, error: error.message };
    }
  }
}

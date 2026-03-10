import { Controller, Post, Get, Body, Logger, HttpCode } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { WebhookPayloadDto } from './dto/webhook-payload.dto';
import { PdfGenerationService } from '../services/pdf-generation.service';

@ApiTags('Webhooks')
@Controller('webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly pdfService: PdfGenerationService) {}

  @Get('supabase')
  @ApiOperation({ 
    summary: 'Webhook verification endpoint',
    description: 'GET endpoint for webhook verification by Supabase'
  })
  @ApiResponse({ status: 200, description: 'Webhook endpoint is active' })
  verifyWebhook() {
    this.logger.log('Webhook verification request received');
    return {
      success: true,
      message: 'Supabase PDF webhook endpoint is active',
      endpoint: '/webhook/supabase',
      accepts: 'POST requests with Supabase webhook payload'
    };
  }

  @Post('supabase')
  @HttpCode(200)
  @ApiOperation({ 
    summary: 'Supabase webhook handler',
    description: 'Receives Supabase database webhooks and triggers PDF generation based on job lifecycle events'
  })
  @ApiBody({ type: WebhookPayloadDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Webhook processed successfully',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        pdfs_generated: { 
          type: 'array',
          items: {
            type: 'object',
            properties: {
              type: { type: 'string' },
              path: { type: 'string' }
            }
          }
        }
      }
    }
  })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async handleSupabaseWebhook(@Body() payload: WebhookPayloadDto) {
    try {
      this.logger.log(`Received ${payload.type} event for table: ${payload.table}`);

      // Only process events from the 'jobs' table
      if (payload.table !== 'jobs') {
        this.logger.log(`Ignoring event from table: ${payload.table}`);
        return {
          success: true,
          message: 'Event ignored - not from jobs table'
        };
      }

      const jobId = payload.record?.id;
      if (!jobId) {
        this.logger.error('No job ID found in webhook payload');
        return {
          success: false,
          message: 'Missing job ID in payload'
        };
      }

      const generatedPdfs = [];

      // Handle INSERT event - Generate Quote PDF
      if (payload.type === 'INSERT') {
        this.logger.log(`New job created: ${jobId}. Generating Quote PDF...`);
        
        const result = await this.pdfService.generatePdf(jobId, 'quote');
        
        if (result.success) {
          generatedPdfs.push({ type: 'quote', path: result.path });
        } else {
          this.logger.error(`Failed to generate Quote PDF: ${result.error}`);
        }
      }

      // Handle UPDATE event - Check status changes
      if (payload.type === 'UPDATE') {
        const newStatus = payload.record?.status;
        const oldStatus = payload.old_record?.status;

        // Status changed to "Approved" - Generate Tool Talk + SWMS PDFs
        if (newStatus === 'Approved' && oldStatus !== 'Approved') {
          this.logger.log(`Job ${jobId} approved. Generating Tool Talk and SWMS PDFs...`);
          
          // Generate Tool Talk PDF
          const toolTalkResult = await this.pdfService.generatePdf(jobId, 'tool_talk');
          if (toolTalkResult.success) {
            generatedPdfs.push({ type: 'tool_talk', path: toolTalkResult.path });
          } else {
            this.logger.error(`Failed to generate Tool Talk PDF: ${toolTalkResult.error}`);
          }

          // Generate SWMS PDF
          const swmsResult = await this.pdfService.generatePdf(jobId, 'swms');
          if (swmsResult.success) {
            generatedPdfs.push({ type: 'swms', path: swmsResult.path });
          } else {
            this.logger.error(`Failed to generate SWMS PDF: ${swmsResult.error}`);
          }
        }

        // Status changed to "Complete" - Generate Invoice PDF
        if (newStatus === 'Complete' && oldStatus !== 'Complete') {
          this.logger.log(`Job ${jobId} completed. Generating Invoice PDF...`);
          
          const invoiceResult = await this.pdfService.generatePdf(jobId, 'invoice');
          if (invoiceResult.success) {
            generatedPdfs.push({ type: 'invoice', path: invoiceResult.path });
          } else {
            this.logger.error(`Failed to generate Invoice PDF: ${invoiceResult.error}`);
          }
        }
      }

      const responseMessage = generatedPdfs.length > 0 
        ? `Successfully generated ${generatedPdfs.length} PDF(s)` 
        : 'No PDFs generated for this event';

      return {
        success: true,
        message: responseMessage,
        pdfs_generated: generatedPdfs
      };

    } catch (error) {
      this.logger.error(`Error processing webhook: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Error: ${error.message}`
      };
    }
  }
}

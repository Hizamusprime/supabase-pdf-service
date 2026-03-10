import { Module } from '@nestjs/common';
import { WebhookController } from './webhook.controller';
import { PdfGenerationService } from '../services/pdf-generation.service';

@Module({
  controllers: [WebhookController],
  providers: [PdfGenerationService],
})
export class WebhookModule {}

import { IsString, IsObject, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

enum WebhookType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
}

export class WebhookPayloadDto {
  @ApiProperty({ 
    enum: WebhookType, 
    description: 'Type of database event',
    example: 'INSERT'
  })
  @IsEnum(WebhookType)
  type: WebhookType;

  @ApiProperty({ description: 'Table name', example: 'jobs' })
  @IsString()
  table: string;

  @ApiProperty({ description: 'Database schema', example: 'public' })
  @IsString()
  schema: string;

  @ApiProperty({ description: 'New record data' })
  @IsObject()
  record: Record<string, any>;

  @ApiProperty({ description: 'Old record data (for UPDATE events)', required: false })
  @IsObject()
  @IsOptional()
  old_record?: Record<string, any>;
}

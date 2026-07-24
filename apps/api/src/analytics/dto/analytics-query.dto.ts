import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class AnalyticsQueryDto {
  @ApiPropertyOptional({ description: 'Fecha inicio (ISO format)' })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({ description: 'Fecha fin (ISO format)' })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({ description: 'Categoría de producto' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({ description: 'Estado del cliente' })
  @IsOptional()
  @IsString()
  customerState?: string;

  @ApiPropertyOptional({ description: 'Estado del vendedor' })
  @IsOptional()
  @IsString()
  sellerState?: string;

  @ApiPropertyOptional({ description: 'Límite de resultados (Top N)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  limit?: number;
}

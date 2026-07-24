import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateInvestigationDto {
  @ApiProperty({
    description: 'Pregunta empresarial u objetivo de investigación para el equipo multiagente',
    example: '¿Por qué disminuyó la calificación promedio durante febrero de 2018?',
  })
  @IsString()
  @MinLength(10)
  question!: string;

  @ApiPropertyOptional({
    description: 'Fecha de inicio del rango de análisis (ISO String)',
    example: '2018-02-01T00:00:00.000Z',
  })
  @IsOptional()
  @IsString()
  dateFrom?: string;

  @ApiPropertyOptional({
    description: 'Fecha de fin del rango de análisis (ISO String)',
    example: '2018-02-28T23:59:59.999Z',
  })
  @IsOptional()
  @IsString()
  dateTo?: string;

  @ApiPropertyOptional({
    description: 'Lista de IDs de vendedores específicos a analizar',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  sellerIds?: string[];

  @ApiPropertyOptional({
    description: 'Lista de categorías de productos específicas',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  categories?: string[];

  @ApiPropertyOptional({
    description: 'Lista de estados de clientes (ej: SP, RJ, MG)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  customerStates?: string[];
}

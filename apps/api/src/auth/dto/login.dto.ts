import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'demo@commerceops.ai',
    description: 'Email de usuario demo para autenticación JWT',
  })
  @IsEmail()
  email!: string;

  @ApiProperty({
    example: 'demo123',
    description: 'Contraseña del usuario demo',
  })
  @IsString()
  @MinLength(4)
  password!: string;
}

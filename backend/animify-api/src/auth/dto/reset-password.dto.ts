import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty()
  @IsEmail()
  email: string;

  @ApiProperty({ description: 'OTP must already be verified for PASSWORD_RESET' })
  @IsString()
  code: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword: string;
}

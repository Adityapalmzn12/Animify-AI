import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class FcmTokenDto {
  @ApiProperty()
  @IsString()
  @MinLength(10)
  token: string;
}

import { IsString, IsOptional, MinLength, IsUrl } from 'class-validator';

export class UpdateUserDto {
  @IsString()
  @IsOptional()
  @MinLength(2)
  name?: string;

  @IsUrl()
  @IsOptional()
  avatarUrl?: string;
}

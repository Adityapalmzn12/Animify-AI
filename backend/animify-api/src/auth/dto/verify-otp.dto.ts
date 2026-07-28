import { IsEmail, IsNotEmpty, IsString, Length, IsIn } from 'class-validator';

export class VerifyOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @Length(6, 6)
  otp: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['login', 'signup', 'password_reset'])
  purpose: string;
}

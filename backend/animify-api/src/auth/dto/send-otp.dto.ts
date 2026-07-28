import { IsEmail, IsNotEmpty, IsString, IsIn } from 'class-validator';

export class SendOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['login', 'signup', 'password_reset'])
  purpose: string;
}

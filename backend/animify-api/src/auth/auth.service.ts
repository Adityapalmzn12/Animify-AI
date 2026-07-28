import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { SendOtpDto } from './dto/send-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        subscription: true,
      },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account has been suspended');
    }

    const tokens = await this.generateTokens(user.id);
    await this.storeRefreshToken(user.id, tokens.refreshToken, dto.deviceInfo);

    return {
      ...tokens,
      user: this.usersService.formatUser(user),
    };
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);
    const freeTrialVideoLimit = this.configService.get<number>('limits.freeTrialVideoLimit') ?? 3;

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        passwordHash,
        subscription: {
          create: {
            planType: 'FREE_TRIAL',
            status: 'ACTIVE',
            startedAt: new Date(),
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            videoLimit: freeTrialVideoLimit,
            minutesLimit: 0,
          },
        },
      },
      include: {
        subscription: true,
      },
    });

    const tokens = await this.generateTokens(user.id);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.usersService.formatUser(user),
    };
  }

  async googleAuth(dto: GoogleAuthDto) {
    const freeTrialVideoLimit = this.configService.get<number>('limits.freeTrialVideoLimit') ?? 3;
    
    let user = await this.prisma.user.findFirst({
      where: { 
        OR: [
          { googleId: dto.idToken.substring(0, 50) },
          { email: { contains: '@' } }
        ]
      },
      include: { subscription: true },
    });

    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: `user_${Date.now()}@animify.ai`,
          name: 'Google User',
          googleId: dto.idToken.substring(0, 50),
          emailVerified: true,
          subscription: {
            create: {
              planType: 'FREE_TRIAL',
              status: 'ACTIVE',
              startedAt: new Date(),
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              videoLimit: freeTrialVideoLimit,
              minutesLimit: 0,
            },
          },
        },
        include: { subscription: true },
      });
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account has been suspended');
    }

    const tokens = await this.generateTokens(user.id);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.usersService.formatUser(user),
    };
  }

  async sendOtp(dto: SendOtpDto) {
    const otp = this.generateOtp();
    const otpHash = await bcrypt.hash(otp, 10);
    const otpExpiryMinutes = this.configService.get<number>('otp.expiryMinutes') ?? 5;
    const otpMaxAttempts = this.configService.get<number>('otp.maxAttempts') ?? 3;
    const expiresAt = new Date(Date.now() + otpExpiryMinutes * 60 * 1000);

    await this.prisma.otpCode.deleteMany({
      where: {
        email: dto.email,
        purpose: dto.purpose.toUpperCase() as any,
        verifiedAt: null,
      },
    });

    await this.prisma.otpCode.create({
      data: {
        email: dto.email,
        codeHash: otpHash,
        purpose: dto.purpose.toUpperCase() as any,
        expiresAt,
        maxAttempts: otpMaxAttempts,
      },
    });

    this.logger.log(`OTP for ${dto.email}: ${otp}`);

    return {
      message: 'OTP sent successfully',
      expiresIn: otpExpiryMinutes * 60,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const freeTrialVideoLimit = this.configService.get<number>('limits.freeTrialVideoLimit') ?? 3;
    
    const otpRecord = await this.prisma.otpCode.findFirst({
      where: {
        email: dto.email,
        purpose: dto.purpose.toUpperCase() as any,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('Invalid or expired OTP');
    }

    if (otpRecord.attempts >= otpRecord.maxAttempts) {
      throw new BadRequestException('Too many attempts. Please request a new OTP');
    }

    const isValid = await bcrypt.compare(dto.otp, otpRecord.codeHash);

    if (!isValid) {
      await this.prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      throw new BadRequestException('Invalid OTP');
    }

    await this.prisma.otpCode.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    let user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { subscription: true },
    });

    if (!user && dto.purpose === 'signup') {
      user = await this.prisma.user.create({
        data: {
          email: dto.email,
          name: dto.email.split('@')[0],
          emailVerified: true,
          subscription: {
            create: {
              planType: 'FREE_TRIAL',
              status: 'ACTIVE',
              startedAt: new Date(),
              expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
              videoLimit: freeTrialVideoLimit,
              minutesLimit: 0,
            },
          },
        },
        include: { subscription: true },
      });
    } else if (user && !user.emailVerified) {
      user = await this.prisma.user.update({
        where: { id: user.id },
        data: { emailVerified: true },
        include: { subscription: true },
      });
    }

    if (!user) {
      throw new BadRequestException('User not found');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Your account has been suspended');
    }

    const tokens = await this.generateTokens(user.id);
    await this.storeRefreshToken(user.id, tokens.refreshToken);

    return {
      ...tokens,
      user: this.usersService.formatUser(user),
    };
  }

  async refreshToken(dto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get<string>('jwt.secret') || 'default-secret',
      });

      const storedToken = await this.prisma.refreshToken.findFirst({
        where: {
          userId: payload.sub,
          revokedAt: null,
          expiresAt: { gt: new Date() },
        },
      });

      if (!storedToken) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      const accessToken = this.jwtService.sign({ sub: payload.sub });
      const accessExpiry = this.configService.get<string>('jwt.accessExpiry') || '15m';

      return {
        accessToken,
        expiresIn: this.getExpiryInSeconds(accessExpiry),
      };
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(userId: string, _refreshToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: {
        userId,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    return { message: 'Logged out successfully' };
  }

  private async generateTokens(userId: string) {
    const accessExpiry = this.configService.get<string>('jwt.accessExpiry') || '15m';
    const refreshExpiry = this.configService.get<string>('jwt.refreshExpiry') || '7d';
    
    const accessToken = this.jwtService.sign({ sub: userId });
    const refreshToken = this.jwtService.sign(
      { sub: userId, type: 'refresh' },
      { expiresIn: this.getExpiryInSeconds(refreshExpiry) },
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: this.getExpiryInSeconds(accessExpiry),
    };
  }

  private async storeRefreshToken(
    userId: string,
    token: string,
    deviceInfo?: string,
  ) {
    const tokenHash = await bcrypt.hash(token, 10);
    const refreshExpiry = this.configService.get<string>('jwt.refreshExpiry') || '7d';
    const expiresAt = new Date(
      Date.now() + this.getExpiryInSeconds(refreshExpiry) * 1000,
    );

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceInfo,
        expiresAt,
      },
    });
  }

  private generateOtp(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  private getExpiryInSeconds(expiry: string): number {
    const match = expiry.match(/^(\d+)(m|h|d)$/);
    if (!match) return 900;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 900;
    }
  }
}

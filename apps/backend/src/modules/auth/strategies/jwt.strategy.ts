import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private authService: AuthService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'digital-topup-jwt-access-token-secret-replace-in-production-key-998877',
    });
  }

  async validate(payload: { sub: string; email?: string; role: string }) {
    const user = await this.authService.findUserById(payload.sub);

    if (!user || user.isActive === false) {
      throw new UnauthorizedException('User not found or account deactivated');
    }

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      fullName: user.fullName,
      role: user.role,
      wallets: user.wallets || [],
    };
  }
}

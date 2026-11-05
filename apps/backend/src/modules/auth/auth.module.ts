import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { TransactionPinGuard } from './guards/transaction-pin.guard';
import { PoliciesGuard } from './guards/policies.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'digital-topup-jwt-access-token-secret-replace-in-production-key-998877',
      signOptions: { expiresIn: '1d' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, TransactionPinGuard, PoliciesGuard],
  exports: [AuthService, JwtStrategy, PassportModule, TransactionPinGuard, PoliciesGuard],
})
export class AuthModule {}

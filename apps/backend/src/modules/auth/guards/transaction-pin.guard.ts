import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { AuthService } from '../auth.service';
import { REQUIRE_TRANSACTION_PIN_KEY } from '../decorators/require-transaction-pin.decorator';

interface AuthenticatedRequest extends Request {
  user?: { id?: string };
}

@Injectable()
export class TransactionPinGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<boolean>(REQUIRE_TRANSACTION_PIN_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Authentication is required to authorize this transaction.');
    }

    const pin = request.header('x-transaction-pin');
    if (!pin || !/^[0-9]{6}$/.test(pin)) {
      throw new BadRequestException('A valid six-digit x-transaction-pin header is required.');
    }

    await this.authService.verifyTransactionPin(userId, pin);
    return true;
  }
}

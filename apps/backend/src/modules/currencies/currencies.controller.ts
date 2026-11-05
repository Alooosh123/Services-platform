import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CurrenciesService } from './currencies.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CurrencyCode } from '@digital-topup/shared';
import { RequireTransactionPin } from '../auth/decorators/require-transaction-pin.decorator';
import { TransactionPinGuard } from '../auth/guards/transaction-pin.guard';
import { PoliciesGuard } from '../auth/guards/policies.guard';
import { RequirePolicy } from '../auth/decorators/require-policy.decorator';
import { ExchangeCurrencyDto } from './dto/exchange-currency.dto';

@ApiTags('Currencies & Exchange Rates')
@Controller('currencies')
export class CurrenciesController {
  constructor(private readonly currenciesService: CurrenciesService) {}

  @Get()
  @ApiOperation({ summary: 'List all supported currencies (YER, USD, SAR) with Arabic metadata' })
  async getCurrencies() {
    return this.currenciesService.getCurrencies();
  }

  @Get('rates')
  @ApiOperation({ summary: 'List current active FX exchange rates' })
  async getRates() {
    return this.currenciesService.getRates();
  }

  @Get('rate')
  @ApiOperation({ summary: 'Get current exchange rate between two specific currencies' })
  async getRate(
    @Query('from') from: CurrencyCode,
    @Query('to') to: CurrencyCode,
  ) {
    return this.currenciesService.getRate(from, to);
  }

  @Post('exchange')
  @RequireTransactionPin()
  @RequirePolicy('wallet:exchange')
  @UseGuards(JwtAuthGuard, PoliciesGuard, TransactionPinGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Perform double-entry currency exchange between user wallets' })
  async exchange(
    @CurrentUser('id') userId: string,
    @Body() body: ExchangeCurrencyDto,
  ) {
    return this.currenciesService.exchangeCurrency({
      userId,
      fromCurrency: body.fromCurrency,
      toCurrency: body.toCurrency,
      fromAmount: body.fromAmount,
      idempotencyKey: body.idempotencyKey,
    });
  }
}

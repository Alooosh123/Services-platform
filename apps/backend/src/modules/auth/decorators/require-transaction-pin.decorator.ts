import { SetMetadata } from '@nestjs/common';

export const REQUIRE_TRANSACTION_PIN_KEY = 'require_transaction_pin';
export const RequireTransactionPin = () => SetMetadata(REQUIRE_TRANSACTION_PIN_KEY, true);

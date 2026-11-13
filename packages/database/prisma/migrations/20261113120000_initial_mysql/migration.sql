-- CreateTable
CREATE TABLE `agent_product_prices` (
    `id` VARCHAR(191) NOT NULL,
    `subAgentUserId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `retailPrice` DECIMAL(18, 4) NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `agent_product_prices_productId_isActive_idx`(`productId`, `isActive`),
    UNIQUE INDEX `agent_product_prices_subAgentUserId_productId_currency_key`(`subAgentUserId`, `productId`, `currency`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tiers` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `defaultDiscountPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000,
    `dailyTransactionLimit` DECIMAL(18, 4) NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `tiers_code_key`(`code`),
    INDEX `tiers_isActive_displayOrder_idx`(`isActive`, `displayOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `passwordHash` VARCHAR(191) NOT NULL,
    `fullName` VARCHAR(191) NOT NULL,
    `fullNameAr` VARCHAR(191) NULL,
    `role` ENUM('OWNER', 'GENERAL_MANAGER', 'FINANCE_MANAGER', 'SUPPORT', 'FULFILLMENT_OPERATOR', 'AUDITOR', 'CUSTOMER', 'ADMIN', 'FINANCE', 'SUPER_ADMIN', 'RESELLER', 'SUB_AGENT') NOT NULL DEFAULT 'CUSTOMER',
    `status` ENUM('ACTIVE', 'SUSPENDED', 'PENDING_KYC') NOT NULL DEFAULT 'ACTIVE',
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `avatarUrl` VARCHAR(191) NULL,
    `twoFactorSecret` VARCHAR(191) NULL,
    `isTwoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `transactionPinHash` VARCHAR(191) NULL,
    `transactionPinFailedAttempts` INTEGER NOT NULL DEFAULT 0,
    `transactionPinLockedUntil` DATETIME(3) NULL,
    `tierId` VARCHAR(191) NULL,
    `parentAgentId` VARCHAR(191) NULL,
    `agentPricingMode` ENUM('PERCENTAGE', 'CUSTOM_PRICE') NOT NULL DEFAULT 'PERCENTAGE',
    `parentAgentCommissionPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000,
    `emailVerifiedAt` DATETIME(3) NULL,
    `phoneVerifiedAt` DATETIME(3) NULL,
    `verificationCode` VARCHAR(191) NULL,
    `resetPasswordToken` VARCHAR(191) NULL,
    `resetPasswordExpires` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    UNIQUE INDEX `users_phone_key`(`phone`),
    INDEX `users_parentAgentId_idx`(`parentAgentId`),
    INDEX `users_tierId_role_idx`(`tierId`, `role`),
    INDEX `users_status_role_idx`(`status`, `role`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `user_devices` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `deviceFingerprintHash` VARCHAR(191) NOT NULL,
    `deviceName` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `ipAddress` VARCHAR(191) NULL,
    `isTrusted` BOOLEAN NOT NULL DEFAULT false,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `user_devices_userId_isTrusted_idx`(`userId`, `isTrusted`),
    INDEX `user_devices_lastSeenAt_idx`(`lastSeenAt`),
    UNIQUE INDEX `user_devices_userId_deviceFingerprintHash_key`(`userId`, `deviceFingerprintHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `merchant_api_credentials` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `apiKeyHash` VARCHAR(191) NOT NULL,
    `secretHash` VARCHAR(191) NOT NULL,
    `ipWhitelist` JSON NOT NULL,
    `webhookUrl` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastUsedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `merchant_api_credentials_userId_key`(`userId`),
    UNIQUE INDEX `merchant_api_credentials_apiKeyHash_key`(`apiKeyHash`),
    INDEX `merchant_api_credentials_isActive_idx`(`isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `refreshToken` VARCHAR(191) NOT NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_refreshToken_key`(`refreshToken`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `currencies` (
    `code` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `symbol` VARCHAR(191) NOT NULL,
    `symbolAr` VARCHAR(191) NOT NULL,
    `decimals` INTEGER NOT NULL DEFAULT 2,
    `isBase` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`code`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `fx_rates` (
    `id` VARCHAR(191) NOT NULL,
    `fromCurrency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `toCurrency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `rate` DECIMAL(16, 6) NOT NULL,
    `buyMargin` DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    `sellMargin` DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    `feePercentage` DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    `effectiveFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `effectiveTo` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `fx_rates_fromCurrency_toCurrency_effectiveFrom_key`(`fromCurrency`, `toCurrency`, `effectiveFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `currency_exchanges` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `fromCurrency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `toCurrency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `fromAmount` DECIMAL(18, 4) NOT NULL,
    `toAmount` DECIMAL(18, 4) NOT NULL,
    `fxRate` DECIMAL(16, 6) NOT NULL,
    `feeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `ledgerTxId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallets` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `balance` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `lockedBalance` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `creditLimit` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `version` INTEGER NOT NULL DEFAULT 0,
    `isFrozen` BOOLEAN NOT NULL DEFAULT false,
    `frozenReason` VARCHAR(191) NULL,
    `frozenAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wallets_userId_currency_key`(`userId`, `currency`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_ledger_entries` (
    `id` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NOT NULL,
    `entryType` ENUM('CREDIT', 'DEBIT', 'LOCK', 'UNLOCK', 'REFUND', 'COMMISSION') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `balanceBefore` DECIMAL(18, 4) NOT NULL,
    `balanceAfter` DECIMAL(18, 4) NOT NULL,
    `referenceType` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `wallet_ledger_entries_idempotencyKey_key`(`idempotencyKey`),
    INDEX `wallet_ledger_entries_walletId_createdAt_idx`(`walletId`, `createdAt`),
    INDEX `wallet_ledger_entries_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deposit_requests` (
    `id` VARCHAR(191) NOT NULL,
    `depositNumber` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `paymentMethodCode` ENUM('JAIB', 'JAWALI', 'CASH', 'ONE_CASH', 'EASY', 'WALLET', 'CARD', 'BINANCE_PAY', 'USDT_TRC20', 'USDT_BEP20') NOT NULL,
    `referenceNumber` VARCHAR(191) NOT NULL,
    `proofImageUrl` VARCHAR(191) NULL,
    `senderName` VARCHAR(191) NULL,
    `senderPhone` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CREDITED') NOT NULL DEFAULT 'PENDING',
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewNotes` VARCHAR(191) NULL,
    `rejectionReason` VARCHAR(191) NULL,
    `ledgerTxId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `deposit_requests_depositNumber_key`(`depositNumber`),
    INDEX `deposit_requests_userId_status_idx`(`userId`, `status`),
    INDEX `deposit_requests_referenceNumber_idx`(`referenceNumber`),
    INDEX `deposit_requests_paymentMethodCode_status_createdAt_idx`(`paymentMethodCode`, `status`, `createdAt`),
    UNIQUE INDEX `deposit_requests_paymentMethodCode_referenceNumber_key`(`paymentMethodCode`, `referenceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `deposit_status_histories` (
    `id` VARCHAR(191) NOT NULL,
    `depositRequestId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CREDITED') NULL,
    `toStatus` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CREDITED') NOT NULL,
    `changedByUserId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `deposit_status_histories_depositRequestId_idx`(`depositRequestId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_channel_configs` (
    `id` VARCHAR(191) NOT NULL,
    `code` ENUM('JAIB', 'JAWALI', 'CASH', 'ONE_CASH', 'EASY', 'WALLET', 'CARD', 'BINANCE_PAY', 'USDT_TRC20', 'USDT_BEP20') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `accountNumber` VARCHAR(191) NOT NULL,
    `accountHolderName` VARCHAR(191) NOT NULL,
    `instructionsAr` TEXT NOT NULL,
    `supportedCurrencies` JSON NOT NULL,
    `minAmount` DECIMAL(18, 4) NOT NULL DEFAULT 1.0000,
    `maxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 10000000.0000,
    `mode` ENUM('MANUAL', 'API', 'BLOCKED_EXTERNAL', 'DISABLED') NOT NULL DEFAULT 'MANUAL',
    `verificationStatus` ENUM('VERIFIED', 'PENDING_REVIEW', 'REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
    `verifiedByFinanceUserId` VARCHAR(191) NULL,
    `verifiedAt` DATETIME(3) NULL,
    `financeApprovalRequired` BOOLEAN NOT NULL DEFAULT true,
    `feePercentage` DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    `pendingAccountNumber` VARCHAR(191) NULL,
    `pendingInstructionsAr` TEXT NULL,
    `pendingFeePercentage` DECIMAL(6, 4) NULL,
    `pendingProposedByUserId` VARCHAR(191) NULL,
    `pendingProposedAt` DATETIME(3) NULL,
    `pendingChangeReason` TEXT NULL,
    `killSwitchReason` VARCHAR(191) NULL,
    `killSwitchAt` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payment_channel_configs_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `wallet_topups` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `status` ENUM('Created', 'Pending', 'AwaitingVerification', 'Confirmed', 'Failed', 'Expired', 'Reversed', 'Refunded', 'NeedsReconciliation') NOT NULL DEFAULT 'Pending',
    `referenceNumber` VARCHAR(191) NOT NULL,
    `proofImage` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `wallet_topups_paymentMethodId_referenceNumber_key`(`paymentMethodId`, `referenceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE') NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ledger_accounts_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `txNumber` VARCHAR(191) NOT NULL,
    `type` ENUM('TOPUP', 'PURCHASE', 'REFUND', 'EXCHANGE', 'ADJUSTMENT') NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'POSTED',
    `postedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `referenceType` VARCHAR(191) NOT NULL,
    `referenceId` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `isReversal` BOOLEAN NOT NULL DEFAULT false,
    `reversalOfId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ledger_transactions_txNumber_key`(`txNumber`),
    UNIQUE INDEX `ledger_transactions_idempotencyKey_key`(`idempotencyKey`),
    INDEX `ledger_transactions_referenceType_referenceId_idx`(`referenceType`, `referenceId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ledger_entries` (
    `id` VARCHAR(191) NOT NULL,
    `transactionId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NULL,
    `debitAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `creditAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ledger_entries_transactionId_idx`(`transactionId`),
    INDEX `ledger_entries_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_categories` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `parentId` VARCHAR(191) NULL,
    `categoryType` ENUM('GAMES_ID', 'DIGITAL_CARDS', 'TELECOM_TOPUP', 'ISP_INTERNET', 'CUSTOM_SERVICE') NOT NULL DEFAULT 'CUSTOM_SERVICE',
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `icon` VARCHAR(191) NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `service_categories_slug_key`(`slug`),
    INDEX `service_categories_parentId_displayOrder_idx`(`parentId`, `displayOrder`),
    INDEX `service_categories_categoryType_isActive_idx`(`categoryType`, `isActive`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `services` (
    `id` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `categoryId` VARCHAR(191) NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `descriptionAr` VARCHAR(191) NULL,
    `iconUrl` VARCHAR(191) NULL,
    `bannerUrl` VARCHAR(191) NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `services_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_fields` (
    `id` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `fieldKey` VARCHAR(191) NOT NULL,
    `label` VARCHAR(191) NOT NULL,
    `labelAr` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'text',
    `required` BOOLEAN NOT NULL DEFAULT true,
    `validationRegex` VARCHAR(191) NULL,
    `placeholderAr` VARCHAR(191) NULL,
    `helperTextAr` VARCHAR(191) NULL,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `service_fields_serviceId_fieldKey_key`(`serviceId`, `fieldKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `products` (
    `id` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `sku` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NULL,
    `providerProductSku` VARCHAR(191) NULL,
    `isManualFulfillment` BOOLEAN NOT NULL DEFAULT false,
    `requiredFieldsSchema` JSON NULL,
    `fulfillmentType` ENUM('API_DIRECT', 'LOCAL_PIN_VAULT', 'MANUAL') NOT NULL DEFAULT 'API_DIRECT',
    `isAvailable` BOOLEAN NOT NULL DEFAULT true,
    `displayOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `products_sku_key`(`sku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_prices` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `retailPrice` DECIMAL(18, 4) NOT NULL,
    `costPrice` DECIMAL(18, 4) NOT NULL,
    `isAvailable` BOOLEAN NOT NULL DEFAULT true,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_prices_productId_currency_key`(`productId`, `currency`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_tier_prices` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `tierId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `retailPrice` DECIMAL(18, 4) NOT NULL,
    `agentCommissionPercent` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `product_tier_prices_tierId_isActive_idx`(`tierId`, `isActive`),
    UNIQUE INDEX `product_tier_prices_productId_tierId_currency_key`(`productId`, `tierId`, `currency`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_provider_mappings` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `providerProductSku` VARCHAR(191) NOT NULL,
    `providerCost` DECIMAL(18, 4) NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `product_provider_mappings_productId_isActive_priority_idx`(`productId`, `isActive`, `priority`),
    UNIQUE INDEX `product_provider_mappings_productId_providerId_key`(`productId`, `providerId`),
    UNIQUE INDEX `product_provider_mappings_providerId_providerProductSku_key`(`providerId`, `providerProductSku`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pin_vault` (
    `id` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `serialNumber` VARCHAR(191) NULL,
    `batchNumber` VARCHAR(191) NULL,
    `pinCodeCiphertext` VARCHAR(191) NOT NULL,
    `pinCodeHash` VARCHAR(191) NOT NULL,
    `encryptionKeyVersion` VARCHAR(191) NOT NULL,
    `status` ENUM('AVAILABLE', 'RESERVED', 'SOLD') NOT NULL DEFAULT 'AVAILABLE',
    `expiresAt` DATETIME(3) NULL,
    `reservedAt` DATETIME(3) NULL,
    `soldAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `pin_vault_pinCodeHash_key`(`pinCodeHash`),
    INDEX `pin_vault_productId_status_createdAt_idx`(`productId`, `status`, `createdAt`),
    INDEX `pin_vault_orderId_idx`(`orderId`),
    INDEX `pin_vault_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_api_logs` (
    `id` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `operation` VARCHAR(191) NOT NULL,
    `requestPayload` JSON NULL,
    `responsePayload` JSON NULL,
    `httpStatus` INTEGER NULL,
    `success` BOOLEAN NOT NULL DEFAULT false,
    `durationMs` INTEGER NULL,
    `errorCode` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `provider_api_logs_providerId_createdAt_idx`(`providerId`, `createdAt`),
    INDEX `provider_api_logs_orderId_createdAt_idx`(`orderId`, `createdAt`),
    INDEX `provider_api_logs_success_createdAt_idx`(`success`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_methods` (
    `id` VARCHAR(191) NOT NULL,
    `code` ENUM('JAIB', 'JAWALI', 'CASH', 'ONE_CASH', 'EASY', 'WALLET', 'CARD', 'BINANCE_PAY', 'USDT_TRC20', 'USDT_BEP20') NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL DEFAULT 'MANUAL',
    `supportedCurrencies` JSON NOT NULL,
    `feePercentage` DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    `feeFixed` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `minAmount` DECIMAL(18, 4) NOT NULL DEFAULT 1.0000,
    `maxAmount` DECIMAL(18, 4) NOT NULL DEFAULT 10000000.0000,
    `instructionsAr` VARCHAR(191) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `isMock` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `payment_methods_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payments` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `userId` VARCHAR(191) NOT NULL,
    `paymentMethodId` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `providerCurrency` VARCHAR(191) NULL,
    `providerAmount` DECIMAL(18, 6) NULL,
    `status` ENUM('Created', 'Pending', 'AwaitingVerification', 'Confirmed', 'Failed', 'Expired', 'Reversed', 'Refunded', 'NeedsReconciliation') NOT NULL DEFAULT 'Pending',
    `checkoutUrl` VARCHAR(191) NULL,
    `gatewayReference` VARCHAR(191) NULL,
    `providerReference` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `providerEventId` VARCHAR(191) NULL,
    `feeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `ledgerTxId` VARCHAR(191) NULL,
    `proofImage` VARCHAR(191) NULL,
    `payerAccount` VARCHAR(191) NULL,
    `verifiedByUserId` VARCHAR(191) NULL,
    `confirmedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payments_gatewayReference_key`(`gatewayReference`),
    UNIQUE INDEX `payments_providerReference_key`(`providerReference`),
    UNIQUE INDEX `payments_idempotencyKey_key`(`idempotencyKey`),
    INDEX `payments_userId_status_createdAt_idx`(`userId`, `status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payment_webhook_events` (
    `id` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NOT NULL,
    `providerEventId` VARCHAR(191) NOT NULL,
    `paymentId` VARCHAR(191) NULL,
    `payloadHash` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'RECEIVED',
    `errorMessage` VARCHAR(191) NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    INDEX `payment_webhook_events_status_receivedAt_idx`(`status`, `receivedAt`),
    UNIQUE INDEX `payment_webhook_events_provider_providerEventId_key`(`provider`, `providerEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `orders` (
    `id` VARCHAR(191) NOT NULL,
    `orderNumber` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `serviceId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,
    `status` ENUM('AwaitingPayment', 'PaymentReview', 'Paid', 'Queued', 'Processing', 'ManualReview', 'Completed', 'Failed', 'Cancelled', 'RefundPending', 'Refunded', 'ReconciliationRequired') NOT NULL DEFAULT 'AwaitingPayment',
    `snapshotServiceName` VARCHAR(191) NOT NULL,
    `snapshotServiceNameAr` VARCHAR(191) NULL,
    `snapshotProductName` VARCHAR(191) NOT NULL,
    `snapshotProductNameAr` VARCHAR(191) NULL,
    `snapshotCurrency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `snapshotRetailPrice` DECIMAL(18, 4) NOT NULL,
    `snapshotCostPrice` DECIMAL(18, 4) NOT NULL,
    `snapshotProfit` DECIMAL(18, 4) NOT NULL,
    `snapshotBeneficiaryFields` JSON NOT NULL,
    `snapshotPaymentMethodCode` VARCHAR(191) NOT NULL,
    `agentParentUserId` VARCHAR(191) NULL,
    `agentCommissionAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NULL,
    `providerTxId` VARCHAR(191) NULL,
    `voucherCode` VARCHAR(191) NULL,
    `errorMessage` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `orders_orderNumber_key`(`orderNumber`),
    UNIQUE INDEX `orders_idempotencyKey_key`(`idempotencyKey`),
    INDEX `orders_userId_status_idx`(`userId`, `status`),
    INDEX `orders_orderNumber_idx`(`orderNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `order_status_history` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `oldStatus` ENUM('AwaitingPayment', 'PaymentReview', 'Paid', 'Queued', 'Processing', 'ManualReview', 'Completed', 'Failed', 'Cancelled', 'RefundPending', 'Refunded', 'ReconciliationRequired') NOT NULL,
    `newStatus` ENUM('AwaitingPayment', 'PaymentReview', 'Paid', 'Queued', 'Processing', 'ManualReview', 'Completed', 'Failed', 'Cancelled', 'RefundPending', 'Refunded', 'ReconciliationRequired') NOT NULL,
    `reason` VARCHAR(191) NULL,
    `changedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `providers` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('MOCK', 'MANUAL', 'EXTERNAL_API') NOT NULL DEFAULT 'MOCK',
    `baseUrl` VARCHAR(191) NULL,
    `apiKey` VARCHAR(191) NULL,
    `credentialsCiphertext` VARCHAR(191) NULL,
    `priority` INTEGER NOT NULL DEFAULT 100,
    `timeoutMs` INTEGER NOT NULL DEFAULT 30000,
    `balance` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL DEFAULT 'USD',
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `providers_code_key`(`code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `manual_fulfillments` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `assignedOperatorId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `operatorNotes` VARCHAR(191) NULL,
    `proofVoucherCode` VARCHAR(191) NULL,
    `proofScreenshotUrl` VARCHAR(191) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `manual_fulfillments_orderId_key`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `userRole` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `entityName` VARCHAR(191) NOT NULL,
    `entityId` VARCHAR(191) NULL,
    `oldValues` JSON NULL,
    `newValues` JSON NULL,
    `ipAddress` VARCHAR(191) NULL,
    `userAgent` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_entityName_entityId_idx`(`entityName`, `entityId`),
    INDEX `audit_logs_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payout_requests` (
    `id` VARCHAR(191) NOT NULL,
    `payoutNumber` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `walletId` VARCHAR(191) NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `feeAmount` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `channelCode` ENUM('JAIB', 'JAWALI', 'CASH', 'ONE_CASH', 'EASY', 'WALLET', 'CARD', 'BINANCE_PAY', 'USDT_TRC20', 'USDT_BEP20') NOT NULL,
    `destinationAccount` VARCHAR(191) NOT NULL,
    `beneficiaryName` VARCHAR(191) NOT NULL,
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `status` ENUM('REQUESTED', 'APPROVED', 'PROCESSING', 'CONFIRMED', 'FAILED', 'UNKNOWN', 'CANCELLED') NOT NULL DEFAULT 'REQUESTED',
    `approvedByUserId` VARCHAR(191) NULL,
    `approvalNotes` VARCHAR(191) NULL,
    `externalReference` VARCHAR(191) NULL,
    `failureReason` TEXT NULL,
    `ledgerTxId` VARCHAR(191) NULL,
    `executedByUserId` VARCHAR(191) NULL,
    `executedAt` DATETIME(3) NULL,
    `executionNotes` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `payout_requests_payoutNumber_key`(`payoutNumber`),
    UNIQUE INDEX `payout_requests_idempotencyKey_key`(`idempotencyKey`),
    INDEX `payout_requests_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reconciliation_batches` (
    `id` VARCHAR(191) NOT NULL,
    `batchNumber` VARCHAR(191) NOT NULL,
    `channelCode` ENUM('JAIB', 'JAWALI', 'CASH', 'ONE_CASH', 'EASY', 'WALLET', 'CARD', 'BINANCE_PAY', 'USDT_TRC20', 'USDT_BEP20') NULL,
    `statementDate` DATETIME(3) NOT NULL,
    `totalRecords` INTEGER NOT NULL DEFAULT 0,
    `matchedCount` INTEGER NOT NULL DEFAULT 0,
    `discrepancyCount` INTEGER NOT NULL DEFAULT 0,
    `totalAmountMatched` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `totalAmountDiscrepant` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `status` VARCHAR(191) NOT NULL DEFAULT 'COMPLETED',
    `reconciledByUserId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `reconciliation_batches_batchNumber_key`(`batchNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `reconciliation_items` (
    `id` VARCHAR(191) NOT NULL,
    `batchId` VARCHAR(191) NOT NULL,
    `referenceNumber` VARCHAR(191) NOT NULL,
    `expectedAmount` DECIMAL(18, 4) NOT NULL,
    `actualAmount` DECIMAL(18, 4) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `status` ENUM('MATCHED', 'DISCREPANCY', 'UNKNOWN_INTERNAL', 'UNKNOWN_EXTERNAL', 'RESOLVED_MANUAL', 'PENDING_REVIEW') NOT NULL DEFAULT 'PENDING_REVIEW',
    `discrepancyType` ENUM('AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'MISSING_IN_BANK', 'MISSING_IN_INTERNAL', 'DUPLICATE_EXTERNAL', 'TIMING_DIFFERENCE', 'FEE_MISMATCH', 'UNAUTHORIZED_DEBIT') NULL,
    `internalTxId` VARCHAR(191) NULL,
    `notes` TEXT NULL,
    `resolvedAt` DATETIME(3) NULL,
    `resolvedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `reconciliation_items_batchId_status_idx`(`batchId`, `status`),
    INDEX `reconciliation_items_referenceNumber_idx`(`referenceNumber`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_accounts` (
    `id` VARCHAR(191) NOT NULL,
    `providerId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL DEFAULT 'USD',
    `balance` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `creditLimit` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `accountType` ENUM('PREPAID', 'POSTPAID', 'PAY_PER_ORDER') NOT NULL DEFAULT 'PREPAID',
    `lastReconciledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `supplier_accounts_providerId_currency_key`(`providerId`, `currency`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `balanceBefore` DECIMAL(18, 4) NOT NULL,
    `balanceAfter` DECIMAL(18, 4) NOT NULL,
    `referenceId` VARCHAR(191) NULL,
    `ledgerTxId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `supplier_transactions_accountId_idx`(`accountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `service_requests` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NULL,
    `appName` VARCHAR(191) NOT NULL,
    `categorySlug` VARCHAR(191) NULL,
    `suggestedPackages` VARCHAR(191) NULL,
    `playerFieldDetails` VARCHAR(191) NULL,
    `officialWebsiteUrl` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `status` ENUM('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'FULFILLED') NOT NULL DEFAULT 'PENDING',
    `reviewedByUserId` VARCHAR(191) NULL,
    `reviewNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `price_rule_versions` (
    `id` VARCHAR(191) NOT NULL,
    `version` INTEGER NOT NULL DEFAULT 1,
    `scope` ENUM('DEFAULT', 'CATEGORY', 'SERVICE', 'PRODUCT') NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `marginType` ENUM('PERCENTAGE', 'FIXED') NOT NULL,
    `marginValue` DECIMAL(18, 4) NOT NULL,
    `minMargin` DECIMAL(18, 4) NULL,
    `maxMargin` DECIMAL(18, 4) NULL,
    `feeFixed` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `feePercentage` DECIMAL(6, 4) NOT NULL DEFAULT 0.0000,
    `validFrom` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `validTo` DATETIME(3) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `changeReason` VARCHAR(191) NOT NULL,
    `createdByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `price_rule_versions_scope_targetId_idx`(`scope`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_close_reports` (
    `id` VARCHAR(191) NOT NULL,
    `closeDate` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'CLOSED',
    `totalOrdersCount` INTEGER NOT NULL DEFAULT 0,
    `completedOrdersCount` INTEGER NOT NULL DEFAULT 0,
    `failedOrdersCount` INTEGER NOT NULL DEFAULT 0,
    `pendingOrdersCount` INTEGER NOT NULL DEFAULT 0,
    `metricsJson` JSON NOT NULL,
    `isImmutable` BOOLEAN NOT NULL DEFAULT true,
    `closedByUserId` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `closedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `daily_close_reports_closeDate_key`(`closeDate`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `daily_close_adjustments` (
    `id` VARCHAR(191) NOT NULL,
    `reportId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `adjustmentType` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `reason` VARCHAR(191) NOT NULL,
    `ledgerTxId` VARCHAR(191) NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `daily_close_adjustments_reportId_idx`(`reportId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `payout_beneficiaries` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `beneficiaryName` VARCHAR(191) NOT NULL,
    `channelCode` ENUM('JAIB', 'JAWALI', 'CASH', 'ONE_CASH', 'EASY', 'WALLET', 'CARD', 'BINANCE_PAY', 'USDT_TRC20', 'USDT_BEP20') NOT NULL,
    `accountNumber` VARCHAR(191) NOT NULL,
    `verificationStatus` VARCHAR(191) NOT NULL DEFAULT 'VERIFIED',
    `financeApprovedBy` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `payout_beneficiaries_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `owner_payout_transactions` (
    `id` VARCHAR(191) NOT NULL,
    `payoutNumber` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `beneficiaryId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'REQUESTED',
    `idempotencyKey` VARCHAR(191) NOT NULL,
    `approvedByUserId` VARCHAR(191) NULL,
    `approvalNotes` VARCHAR(191) NULL,
    `externalReference` VARCHAR(191) NULL,
    `failureReason` VARCHAR(191) NULL,
    `ledgerTxId` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `owner_payout_transactions_payoutNumber_key`(`payoutNumber`),
    UNIQUE INDEX `owner_payout_transactions_idempotencyKey_key`(`idempotencyKey`),
    INDEX `owner_payout_transactions_userId_idx`(`userId`),
    INDEX `owner_payout_transactions_beneficiaryId_idx`(`beneficiaryId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `owner_earnings_wallets` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL,
    `realizedEarnings` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `lockedEarnings` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `withdrawnEarnings` DECIMAL(18, 4) NOT NULL DEFAULT 0.0000,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `owner_earnings_wallets_userId_currency_key`(`userId`, `currency`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `support_tickets` (
    `id` VARCHAR(191) NOT NULL,
    `ticketNumber` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NOT NULL,
    `priority` VARCHAR(191) NOT NULL DEFAULT 'MEDIUM',
    `status` VARCHAR(191) NOT NULL DEFAULT 'OPEN',
    `subject` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NULL,
    `depositId` VARCHAR(191) NULL,
    `assignedToUserId` VARCHAR(191) NULL,
    `idempotencyKey` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `closedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `support_tickets_ticketNumber_key`(`ticketNumber`),
    UNIQUE INDEX `support_tickets_idempotencyKey_key`(`idempotencyKey`),
    INDEX `support_tickets_userId_idx`(`userId`),
    INDEX `support_tickets_status_idx`(`status`),
    INDEX `support_tickets_category_idx`(`category`),
    INDEX `support_tickets_orderId_idx`(`orderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ticket_messages` (
    `id` VARCHAR(191) NOT NULL,
    `ticketId` VARCHAR(191) NOT NULL,
    `senderUserId` VARCHAR(191) NOT NULL,
    `senderRole` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `attachments` VARCHAR(191) NULL,
    `isInternalNote` BOOLEAN NOT NULL DEFAULT false,
    `idempotencyKey` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ticket_messages_ticketId_idx`(`ticketId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notifications` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `data` JSON NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'UNREAD',
    `channel` VARCHAR(191) NOT NULL DEFAULT 'IN_APP',
    `readAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `notifications_userId_idx`(`userId`),
    INDEX `notifications_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `system_alerts` (
    `id` VARCHAR(191) NOT NULL,
    `alertType` VARCHAR(191) NOT NULL,
    `severity` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` VARCHAR(191) NOT NULL,
    `source` VARCHAR(191) NOT NULL,
    `metrics` JSON NULL,
    `escalationLevel` VARCHAR(191) NOT NULL DEFAULT 'DUTY_ENGINEER',
    `isResolved` BOOLEAN NOT NULL DEFAULT false,
    `resolvedBy` VARCHAR(191) NULL,
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `system_alerts_isResolved_idx`(`isResolved`),
    INDEX `system_alerts_severity_idx`(`severity`),
    INDEX `system_alerts_alertType_idx`(`alertType`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `backup_records` (
    `id` VARCHAR(191) NOT NULL,
    `fileName` VARCHAR(191) NOT NULL,
    `sizeBytes` BIGINT NOT NULL DEFAULT 0,
    `checksumSha256` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'COMPLETED',
    `environment` VARCHAR(191) NOT NULL DEFAULT 'production',
    `tablesIncluded` VARCHAR(191) NOT NULL DEFAULT 'all',
    `recordsCount` INTEGER NOT NULL DEFAULT 0,
    `durationSeconds` INTEGER NOT NULL DEFAULT 0,
    `rtoTargetSeconds` INTEGER NOT NULL DEFAULT 1800,
    `rpoTargetSeconds` INTEGER NOT NULL DEFAULT 300,
    `verifiedAt` DATETIME(3) NULL,
    `verificationNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `backup_records_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pilot_configs` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default-pilot-config',
    `isPilotActive` BOOLEAN NOT NULL DEFAULT true,
    `maxOrderAmountYER` DECIMAL(65, 30) NOT NULL DEFAULT 10000.0,
    `maxOrderAmountUSD` DECIMAL(65, 30) NOT NULL DEFAULT 20.0,
    `maxDailyWalletLimitYER` DECIMAL(65, 30) NOT NULL DEFAULT 50000.0,
    `allowedProductIds` VARCHAR(191) NOT NULL DEFAULT 'ALL',
    `allowedChannelCodes` VARCHAR(191) NOT NULL DEFAULT 'JAIB,JAWALI,ONE_CASH',
    `cohortType` VARCHAR(191) NOT NULL DEFAULT 'TRUSTED_BETA_USERS',
    `whitelistedUserIds` VARCHAR(191) NOT NULL DEFAULT '',
    `goNoGoDecision` VARCHAR(191) NOT NULL DEFAULT 'CONDITIONAL_GO',
    `approvedBy` VARCHAR(191) NULL,
    `approvedAt` DATETIME(3) NULL,
    `launchNotes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `pilot_run_audits` (
    `id` VARCHAR(191) NOT NULL,
    `cycleName` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `depositTxId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `supplierSettlementTxId` VARCHAR(191) NOT NULL,
    `dailyCloseReportId` VARCHAR(191) NOT NULL,
    `payoutRequestId` VARCHAR(191) NULL,
    `currency` VARCHAR(191) NOT NULL,
    `amount` DECIMAL(65, 30) NOT NULL,
    `ledgerBalanced` BOOLEAN NOT NULL DEFAULT true,
    `reconciliationMatched` BOOLEAN NOT NULL DEFAULT true,
    `bankProofMatched` BOOLEAN NOT NULL DEFAULT true,
    `providerProofMatched` BOOLEAN NOT NULL DEFAULT true,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PASSED',
    `detailsJson` JSON NULL,
    `executedBy` VARCHAR(191) NOT NULL DEFAULT 'SYSTEM_PILOT_RUNNER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `pilot_run_audits_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operations_handovers` (
    `id` VARCHAR(191) NOT NULL DEFAULT 'default-handover-pkg',
    `version` VARCHAR(191) NOT NULL DEFAULT '1.0.0-final',
    `status` VARCHAR(191) NOT NULL DEFAULT 'IN_PROGRESS',
    `handedOverAt` DATETIME(3) NULL,
    `technicalLeadSign` JSON NULL,
    `financeControllerSign` JSON NULL,
    `supportLeadSign` JSON NULL,
    `operationsManagerSign` JSON NULL,
    `projectOwnerSign` JSON NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operational_drill_logs` (
    `id` VARCHAR(191) NOT NULL,
    `drillType` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `executedBy` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PASSED',
    `simulatedTargetId` VARCHAR(191) NULL,
    `stepsCompleted` JSON NULL,
    `durationSeconds` INTEGER NOT NULL DEFAULT 0,
    `auditIntegrityVerified` BOOLEAN NOT NULL DEFAULT true,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `operational_drill_logs_drillType_idx`(`drillType`),
    INDEX `operational_drill_logs_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saas_plans` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `nameAr` VARCHAR(191) NOT NULL,
    `billingCycle` ENUM('WEEKLY', 'MONTHLY', 'ANNUAL') NOT NULL,
    `durationDays` INTEGER NOT NULL,
    `priceUsd` DECIMAL(18, 4) NOT NULL,
    `priceYer` DECIMAL(18, 4) NOT NULL,
    `priceSar` DECIMAL(18, 4) NOT NULL,
    `hasFullPermissions` BOOLEAN NOT NULL DEFAULT true,
    `descriptionAr` VARCHAR(191) NOT NULL,
    `featuresJson` JSON NOT NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `saas_plans_billingCycle_key`(`billingCycle`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saas_tenants` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `slug` VARCHAR(191) NOT NULL,
    `domain` VARCHAR(191) NULL,
    `customDomain` VARCHAR(191) NULL,
    `ownerName` VARCHAR(191) NOT NULL,
    `ownerEmail` VARCHAR(191) NOT NULL,
    `ownerPhone` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'PENDING_SETUP', 'SUSPENDED', 'TERMINATED') NOT NULL DEFAULT 'ACTIVE',
    `licenseKey` VARCHAR(191) NOT NULL,
    `brandingConfig` JSON NULL,
    `notes` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `saas_tenants_slug_key`(`slug`),
    UNIQUE INDEX `saas_tenants_domain_key`(`domain`),
    UNIQUE INDEX `saas_tenants_licenseKey_key`(`licenseKey`),
    INDEX `saas_tenants_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saas_subscriptions` (
    `id` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `planId` VARCHAR(191) NOT NULL,
    `billingCycle` ENUM('WEEKLY', 'MONTHLY', 'ANNUAL') NOT NULL,
    `pricePaid` DECIMAL(18, 4) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL DEFAULT 'USD',
    `startDate` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `endDate` DATETIME(3) NOT NULL,
    `autoRenew` BOOLEAN NOT NULL DEFAULT true,
    `status` ENUM('ACTIVE', 'TRIAL', 'PENDING_PAYMENT', 'EXPIRED', 'SUSPENDED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `lastRenewalDate` DATETIME(3) NULL,
    `cancelReason` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `saas_subscriptions_tenantId_idx`(`tenantId`),
    INDEX `saas_subscriptions_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saas_invoices` (
    `id` VARCHAR(191) NOT NULL,
    `invoiceNumber` VARCHAR(191) NOT NULL,
    `tenantId` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NULL,
    `amount` DECIMAL(18, 4) NOT NULL,
    `currency` ENUM('YER', 'USD', 'SAR') NOT NULL DEFAULT 'USD',
    `status` ENUM('PAID', 'PENDING', 'OVERDUE', 'CANCELLED') NOT NULL DEFAULT 'PAID',
    `billingCycle` ENUM('WEEKLY', 'MONTHLY', 'ANNUAL') NOT NULL,
    `paymentMethod` VARCHAR(191) NULL,
    `referenceNumber` VARCHAR(191) NULL,
    `paidAt` DATETIME(3) NULL,
    `dueDate` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `saas_invoices_invoiceNumber_key`(`invoiceNumber`),
    INDEX `saas_invoices_tenantId_idx`(`tenantId`),
    INDEX `saas_invoices_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `network_snapshots` (
    `id` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `deviceIdentity` VARCHAR(191) NULL,
    `routerOsVersion` VARCHAR(191) NULL,
    `cpuLoadPercent` INTEGER NULL,
    `freeMemoryBytes` BIGINT NULL,
    `totalMemoryBytes` BIGINT NULL,
    `uptime` VARCHAR(191) NULL,
    `interfaceCount` INTEGER NOT NULL DEFAULT 0,
    `interfaces` JSON NOT NULL,
    `diagnostics` JSON NOT NULL,
    `observedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `network_snapshots_observedAt_idx`(`observedAt`),
    INDEX `network_snapshots_status_observedAt_idx`(`status`, `observedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `operational_approvals` (
    `id` VARCHAR(191) NOT NULL,
    `approvalType` VARCHAR(191) NOT NULL,
    `targetType` VARCHAR(191) NOT NULL,
    `targetId` VARCHAR(191) NULL,
    `action` VARCHAR(191) NOT NULL,
    `reason` TEXT NOT NULL,
    `requesterRole` VARCHAR(191) NOT NULL,
    `requestedByUserId` VARCHAR(191) NOT NULL,
    `decidedByUserId` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `decision` VARCHAR(191) NULL,
    `decisionNotes` TEXT NULL,
    `executionReference` VARCHAR(191) NULL,
    `executionNotes` TEXT NULL,
    `executedByUserId` VARCHAR(191) NULL,
    `executedAt` DATETIME(3) NULL,
    `requestedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `decidedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `operational_approvals_approvalType_status_requestedAt_idx`(`approvalType`, `status`, `requestedAt`),
    INDEX `operational_approvals_targetType_targetId_idx`(`targetType`, `targetId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `agent_product_prices` ADD CONSTRAINT `agent_product_prices_subAgentUserId_fkey` FOREIGN KEY (`subAgentUserId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `agent_product_prices` ADD CONSTRAINT `agent_product_prices_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `tiers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_parentAgentId_fkey` FOREIGN KEY (`parentAgentId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `user_devices` ADD CONSTRAINT `user_devices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `merchant_api_credentials` ADD CONSTRAINT `merchant_api_credentials_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `currency_exchanges` ADD CONSTRAINT `currency_exchanges_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallets` ADD CONSTRAINT `wallets_currency_fkey` FOREIGN KEY (`currency`) REFERENCES `currencies`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_ledger_entries` ADD CONSTRAINT `wallet_ledger_entries_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposit_requests` ADD CONSTRAINT `deposit_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposit_requests` ADD CONSTRAINT `deposit_requests_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `wallets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposit_requests` ADD CONSTRAINT `deposit_requests_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposit_status_histories` ADD CONSTRAINT `deposit_status_histories_depositRequestId_fkey` FOREIGN KEY (`depositRequestId`) REFERENCES `deposit_requests`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `deposit_status_histories` ADD CONSTRAINT `deposit_status_histories_changedByUserId_fkey` FOREIGN KEY (`changedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_topups` ADD CONSTRAINT `wallet_topups_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_topups` ADD CONSTRAINT `wallet_topups_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `wallets`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `wallet_topups` ADD CONSTRAINT `wallet_topups_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_accounts` ADD CONSTRAINT `ledger_accounts_currency_fkey` FOREIGN KEY (`currency`) REFERENCES `currencies`(`code`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_transactionId_fkey` FOREIGN KEY (`transactionId`) REFERENCES `ledger_transactions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `ledger_accounts`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ledger_entries` ADD CONSTRAINT `ledger_entries_walletId_fkey` FOREIGN KEY (`walletId`) REFERENCES `wallets`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_categories` ADD CONSTRAINT `service_categories_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `service_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `services` ADD CONSTRAINT `services_categoryId_fkey` FOREIGN KEY (`categoryId`) REFERENCES `service_categories`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_fields` ADD CONSTRAINT `service_fields_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `products` ADD CONSTRAINT `products_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `providers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_prices` ADD CONSTRAINT `product_prices_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_tier_prices` ADD CONSTRAINT `product_tier_prices_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_tier_prices` ADD CONSTRAINT `product_tier_prices_tierId_fkey` FOREIGN KEY (`tierId`) REFERENCES `tiers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_provider_mappings` ADD CONSTRAINT `product_provider_mappings_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_provider_mappings` ADD CONSTRAINT `product_provider_mappings_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pin_vault` ADD CONSTRAINT `pin_vault_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pin_vault` ADD CONSTRAINT `pin_vault_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_api_logs` ADD CONSTRAINT `provider_api_logs_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `providers`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_api_logs` ADD CONSTRAINT `provider_api_logs_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payments` ADD CONSTRAINT `payments_paymentMethodId_fkey` FOREIGN KEY (`paymentMethodId`) REFERENCES `payment_methods`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payment_webhook_events` ADD CONSTRAINT `payment_webhook_events_paymentId_fkey` FOREIGN KEY (`paymentId`) REFERENCES `payments`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_agentParentUserId_fkey` FOREIGN KEY (`agentParentUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_serviceId_fkey` FOREIGN KEY (`serviceId`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `orders` ADD CONSTRAINT `orders_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `providers`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `order_status_history` ADD CONSTRAINT `order_status_history_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manual_fulfillments` ADD CONSTRAINT `manual_fulfillments_orderId_fkey` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `manual_fulfillments` ADD CONSTRAINT `manual_fulfillments_assignedOperatorId_fkey` FOREIGN KEY (`assignedOperatorId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `payout_requests` ADD CONSTRAINT `payout_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reconciliation_items` ADD CONSTRAINT `reconciliation_items_batchId_fkey` FOREIGN KEY (`batchId`) REFERENCES `reconciliation_batches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_accounts` ADD CONSTRAINT `supplier_accounts_providerId_fkey` FOREIGN KEY (`providerId`) REFERENCES `providers`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_transactions` ADD CONSTRAINT `supplier_transactions_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `supplier_accounts`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `service_requests` ADD CONSTRAINT `service_requests_reviewedByUserId_fkey` FOREIGN KEY (`reviewedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `price_rule_versions` ADD CONSTRAINT `price_rule_versions_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `daily_close_adjustments` ADD CONSTRAINT `daily_close_adjustments_reportId_fkey` FOREIGN KEY (`reportId`) REFERENCES `daily_close_reports`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `owner_payout_transactions` ADD CONSTRAINT `owner_payout_transactions_beneficiaryId_fkey` FOREIGN KEY (`beneficiaryId`) REFERENCES `payout_beneficiaries`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ticket_messages` ADD CONSTRAINT `ticket_messages_ticketId_fkey` FOREIGN KEY (`ticketId`) REFERENCES `support_tickets`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saas_subscriptions` ADD CONSTRAINT `saas_subscriptions_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `saas_tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saas_subscriptions` ADD CONSTRAINT `saas_subscriptions_planId_fkey` FOREIGN KEY (`planId`) REFERENCES `saas_plans`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saas_invoices` ADD CONSTRAINT `saas_invoices_tenantId_fkey` FOREIGN KEY (`tenantId`) REFERENCES `saas_tenants`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saas_invoices` ADD CONSTRAINT `saas_invoices_subscriptionId_fkey` FOREIGN KEY (`subscriptionId`) REFERENCES `saas_subscriptions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operational_approvals` ADD CONSTRAINT `operational_approvals_requestedByUserId_fkey` FOREIGN KEY (`requestedByUserId`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `operational_approvals` ADD CONSTRAINT `operational_approvals_decidedByUserId_fkey` FOREIGN KEY (`decidedByUserId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

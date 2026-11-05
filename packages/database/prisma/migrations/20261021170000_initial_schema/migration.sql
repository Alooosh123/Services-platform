-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('OWNER', 'GENERAL_MANAGER', 'FINANCE_MANAGER', 'SUPPORT', 'FULFILLMENT_OPERATOR', 'AUDITOR', 'CUSTOMER', 'ADMIN', 'FINANCE', 'SUPER_ADMIN', 'RESELLER', 'SUB_AGENT');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'PENDING_KYC');

-- CreateEnum
CREATE TYPE "ServiceCategoryType" AS ENUM ('GAMES_ID', 'DIGITAL_CARDS', 'TELECOM_TOPUP', 'ISP_INTERNET', 'CUSTOM_SERVICE');

-- CreateEnum
CREATE TYPE "FulfillmentType" AS ENUM ('API_DIRECT', 'LOCAL_PIN_VAULT', 'MANUAL');

-- CreateEnum
CREATE TYPE "PinVaultStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'SOLD');

-- CreateEnum
CREATE TYPE "WalletLedgerEntryType" AS ENUM ('CREDIT', 'DEBIT', 'LOCK', 'UNLOCK', 'REFUND', 'COMMISSION');

-- CreateEnum
CREATE TYPE "DepositStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'CREDITED');

-- CreateEnum
CREATE TYPE "CurrencyCode" AS ENUM ('YER', 'USD', 'SAR');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('Created', 'Pending', 'AwaitingVerification', 'Confirmed', 'Failed', 'Expired', 'Reversed', 'Refunded', 'NeedsReconciliation');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('AwaitingPayment', 'PaymentReview', 'Paid', 'Queued', 'Processing', 'ManualReview', 'Completed', 'Failed', 'Cancelled', 'RefundPending', 'Refunded', 'ReconciliationRequired');

-- CreateEnum
CREATE TYPE "PaymentChannelCode" AS ENUM ('JAIB', 'JAWALI', 'CASH', 'ONE_CASH', 'EASY', 'WALLET');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "LedgerTransactionType" AS ENUM ('TOPUP', 'PURCHASE', 'REFUND', 'EXCHANGE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "ProviderType" AS ENUM ('MOCK', 'MANUAL', 'EXTERNAL_API');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'CONFIRMED', 'FAILED', 'UNKNOWN', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReconciliationStatus" AS ENUM ('MATCHED', 'DISCREPANCY', 'UNKNOWN_INTERNAL', 'UNKNOWN_EXTERNAL', 'RESOLVED_MANUAL', 'PENDING_REVIEW');

-- CreateEnum
CREATE TYPE "DiscrepancyType" AS ENUM ('AMOUNT_MISMATCH', 'CURRENCY_MISMATCH', 'MISSING_IN_BANK', 'MISSING_IN_INTERNAL', 'DUPLICATE_EXTERNAL', 'TIMING_DIFFERENCE', 'FEE_MISMATCH', 'UNAUTHORIZED_DEBIT');

-- CreateEnum
CREATE TYPE "PaymentChannelMode" AS ENUM ('MANUAL', 'API', 'BLOCKED_EXTERNAL', 'DISABLED');

-- CreateEnum
CREATE TYPE "SupplierAccountType" AS ENUM ('PREPAID', 'POSTPAID', 'PAY_PER_ORDER');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'FULFILLED');

-- CreateEnum
CREATE TYPE "PriceRuleScope" AS ENUM ('DEFAULT', 'CATEGORY', 'SERVICE', 'PRODUCT');

-- CreateEnum
CREATE TYPE "MarginType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "ChannelVerificationStatus" AS ENUM ('VERIFIED', 'PENDING_REVIEW', 'REJECTED');

-- CreateEnum
CREATE TYPE "SaaSBillingCycle" AS ENUM ('WEEKLY', 'MONTHLY', 'ANNUAL');

-- CreateEnum
CREATE TYPE "SaaSSubscriptionStatus" AS ENUM ('ACTIVE', 'TRIAL', 'PENDING_PAYMENT', 'EXPIRED', 'SUSPENDED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SaaSTenantStatus" AS ENUM ('ACTIVE', 'PENDING_SETUP', 'SUSPENDED', 'TERMINATED');

-- CreateEnum
CREATE TYPE "SaaSInvoiceStatus" AS ENUM ('PAID', 'PENDING', 'OVERDUE', 'CANCELLED');

-- CreateTable
CREATE TABLE "tiers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "defaultDiscountPercent" DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
    "dailyTransactionLimit" DECIMAL(18,4),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "fullNameAr" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'CUSTOMER',
    "status" "AccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "avatarUrl" TEXT,
    "twoFactorSecret" TEXT,
    "isTwoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "transactionPinHash" TEXT,
    "tierId" TEXT,
    "parentAgentId" TEXT,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "verificationCode" TEXT,
    "resetPasswordToken" TEXT,
    "resetPasswordExpires" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_devices" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "deviceFingerprintHash" TEXT NOT NULL,
    "deviceName" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "isTrusted" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_api_credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "apiKeyHash" TEXT NOT NULL,
    "secretHash" TEXT NOT NULL,
    "ipWhitelist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "webhookUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchant_api_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshToken" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currencies" (
    "code" "CurrencyCode" NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "symbolAr" TEXT NOT NULL,
    "decimals" INTEGER NOT NULL DEFAULT 2,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currencies_pkey" PRIMARY KEY ("code")
);

-- CreateTable
CREATE TABLE "fx_rates" (
    "id" TEXT NOT NULL,
    "fromCurrency" "CurrencyCode" NOT NULL,
    "toCurrency" "CurrencyCode" NOT NULL,
    "rate" DECIMAL(16,6) NOT NULL,
    "buyMargin" DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    "sellMargin" DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    "feePercentage" DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fx_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "currency_exchanges" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "fromCurrency" "CurrencyCode" NOT NULL,
    "toCurrency" "CurrencyCode" NOT NULL,
    "fromAmount" DECIMAL(18,4) NOT NULL,
    "toAmount" DECIMAL(18,4) NOT NULL,
    "fxRate" DECIMAL(16,6) NOT NULL,
    "feeAmount" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "currency_exchanges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "lockedBalance" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "creditLimit" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "version" INTEGER NOT NULL DEFAULT 0,
    "isFrozen" BOOLEAN NOT NULL DEFAULT false,
    "frozenReason" TEXT,
    "frozenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_ledger_entries" (
    "id" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "entryType" "WalletLedgerEntryType" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "balanceBefore" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_requests" (
    "id" TEXT NOT NULL,
    "depositNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "paymentMethodCode" "PaymentChannelCode" NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "proofImageUrl" TEXT,
    "senderName" TEXT,
    "senderPhone" TEXT,
    "status" "DepositStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewNotes" TEXT,
    "rejectionReason" TEXT,
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deposit_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deposit_status_histories" (
    "id" TEXT NOT NULL,
    "depositRequestId" TEXT NOT NULL,
    "fromStatus" "DepositStatus",
    "toStatus" "DepositStatus" NOT NULL,
    "changedByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deposit_status_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_channel_configs" (
    "id" TEXT NOT NULL,
    "code" "PaymentChannelCode" NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "instructionsAr" TEXT NOT NULL,
    "supportedCurrencies" JSONB NOT NULL,
    "minAmount" DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
    "maxAmount" DECIMAL(18,4) NOT NULL DEFAULT 10000000.0000,
    "mode" "PaymentChannelMode" NOT NULL DEFAULT 'MANUAL',
    "verificationStatus" "ChannelVerificationStatus" NOT NULL DEFAULT 'VERIFIED',
    "verifiedByFinanceUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "financeApprovalRequired" BOOLEAN NOT NULL DEFAULT false,
    "pendingAccountNumber" TEXT,
    "pendingInstructionsAr" TEXT,
    "pendingFeePercentage" DECIMAL(6,4),
    "killSwitchReason" TEXT,
    "killSwitchAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_channel_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_topups" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'Pending',
    "referenceNumber" TEXT NOT NULL,
    "proofImage" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "wallet_topups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_transactions" (
    "id" TEXT NOT NULL,
    "txNumber" TEXT NOT NULL,
    "type" "LedgerTransactionType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "postedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "referenceType" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "idempotencyKey" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "isReversal" BOOLEAN NOT NULL DEFAULT false,
    "reversalOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ledger_entries" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "walletId" TEXT,
    "debitAmount" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "creditAmount" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "currency" "CurrencyCode" NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "categoryType" "ServiceCategoryType" NOT NULL DEFAULT 'CUSTOM_SERVICE',
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "icon" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "services" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "description" TEXT,
    "descriptionAr" TEXT,
    "iconUrl" TEXT,
    "bannerUrl" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_fields" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'text',
    "required" BOOLEAN NOT NULL DEFAULT true,
    "validationRegex" TEXT,
    "placeholderAr" TEXT,
    "helperTextAr" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "service_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "providerId" TEXT,
    "providerProductSku" TEXT,
    "isManualFulfillment" BOOLEAN NOT NULL DEFAULT false,
    "requiredFieldsSchema" JSONB,
    "fulfillmentType" "FulfillmentType" NOT NULL DEFAULT 'API_DIRECT',
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_prices" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "retailPrice" DECIMAL(18,4) NOT NULL,
    "costPrice" DECIMAL(18,4) NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_tier_prices" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "retailPrice" DECIMAL(18,4) NOT NULL,
    "agentCommissionPercent" DECIMAL(7,4) NOT NULL DEFAULT 0.0000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_tier_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_provider_mappings" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "providerProductSku" TEXT NOT NULL,
    "providerCost" DECIMAL(18,4),
    "priority" INTEGER NOT NULL DEFAULT 100,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_provider_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pin_vault" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "orderId" TEXT,
    "serialNumber" TEXT,
    "batchNumber" TEXT,
    "pinCodeCiphertext" TEXT NOT NULL,
    "pinCodeHash" TEXT NOT NULL,
    "encryptionKeyVersion" TEXT NOT NULL,
    "status" "PinVaultStatus" NOT NULL DEFAULT 'AVAILABLE',
    "expiresAt" TIMESTAMP(3),
    "reservedAt" TIMESTAMP(3),
    "soldAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pin_vault_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_api_logs" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "orderId" TEXT,
    "operation" TEXT NOT NULL,
    "requestPayload" JSONB,
    "responsePayload" JSONB,
    "httpStatus" INTEGER,
    "success" BOOLEAN NOT NULL DEFAULT false,
    "durationMs" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_api_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_methods" (
    "id" TEXT NOT NULL,
    "code" "PaymentChannelCode" NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'MANUAL',
    "supportedCurrencies" JSONB NOT NULL DEFAULT '["YER","USD","SAR"]',
    "feePercentage" DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    "feeFixed" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "minAmount" DECIMAL(18,4) NOT NULL DEFAULT 1.0000,
    "maxAmount" DECIMAL(18,4) NOT NULL DEFAULT 10000000.0000,
    "instructionsAr" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isMock" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT,
    "userId" TEXT NOT NULL,
    "paymentMethodId" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'Pending',
    "gatewayReference" TEXT,
    "proofImage" TEXT,
    "payerAccount" TEXT,
    "verifiedByUserId" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'AwaitingPayment',
    "snapshotServiceName" TEXT NOT NULL,
    "snapshotServiceNameAr" TEXT,
    "snapshotProductName" TEXT NOT NULL,
    "snapshotProductNameAr" TEXT,
    "snapshotCurrency" "CurrencyCode" NOT NULL,
    "snapshotRetailPrice" DECIMAL(18,4) NOT NULL,
    "snapshotCostPrice" DECIMAL(18,4) NOT NULL,
    "snapshotProfit" DECIMAL(18,4) NOT NULL,
    "snapshotBeneficiaryFields" JSONB NOT NULL,
    "snapshotPaymentMethodCode" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "providerId" TEXT,
    "providerTxId" TEXT,
    "voucherCode" TEXT,
    "errorMessage" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_status_history" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "oldStatus" "OrderStatus" NOT NULL,
    "newStatus" "OrderStatus" NOT NULL,
    "reason" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "providers" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ProviderType" NOT NULL DEFAULT 'MOCK',
    "baseUrl" TEXT,
    "apiKey" TEXT,
    "credentialsCiphertext" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "timeoutMs" INTEGER NOT NULL DEFAULT 30000,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manual_fulfillments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "assignedOperatorId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "operatorNotes" TEXT,
    "proofVoucherCode" TEXT,
    "proofScreenshotUrl" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "manual_fulfillments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "userRole" TEXT,
    "action" TEXT NOT NULL,
    "entityName" TEXT NOT NULL,
    "entityId" TEXT,
    "oldValues" JSONB,
    "newValues" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_requests" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "walletId" TEXT,
    "currency" "CurrencyCode" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "feeAmount" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "channelCode" "PaymentChannelCode" NOT NULL,
    "destinationAccount" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "approvedByUserId" TEXT,
    "approvalNotes" TEXT,
    "externalReference" TEXT,
    "failureReason" TEXT,
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_batches" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "channelCode" "PaymentChannelCode",
    "statementDate" TIMESTAMP(3) NOT NULL,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "discrepancyCount" INTEGER NOT NULL DEFAULT 0,
    "totalAmountMatched" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "totalAmountDiscrepant" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "reconciledByUserId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reconciliation_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reconciliation_items" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "referenceNumber" TEXT NOT NULL,
    "expectedAmount" DECIMAL(18,4) NOT NULL,
    "actualAmount" DECIMAL(18,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "status" "ReconciliationStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "discrepancyType" "DiscrepancyType",
    "internalTxId" TEXT,
    "notes" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reconciliation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_accounts" (
    "id" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "creditLimit" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "accountType" "SupplierAccountType" NOT NULL DEFAULT 'PREPAID',
    "lastReconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_transactions" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "balanceBefore" DECIMAL(18,4) NOT NULL,
    "balanceAfter" DECIMAL(18,4) NOT NULL,
    "referenceId" TEXT,
    "ledgerTxId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "appName" TEXT NOT NULL,
    "categorySlug" TEXT,
    "suggestedPackages" TEXT,
    "playerFieldDetails" TEXT,
    "officialWebsiteUrl" TEXT,
    "notes" TEXT,
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedByUserId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "price_rule_versions" (
    "id" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "scope" "PriceRuleScope" NOT NULL,
    "targetId" TEXT,
    "marginType" "MarginType" NOT NULL,
    "marginValue" DECIMAL(18,4) NOT NULL,
    "minMargin" DECIMAL(18,4),
    "maxMargin" DECIMAL(18,4),
    "feeFixed" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "feePercentage" DECIMAL(6,4) NOT NULL DEFAULT 0.0000,
    "validFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "changeReason" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "price_rule_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_close_reports" (
    "id" TEXT NOT NULL,
    "closeDate" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CLOSED',
    "totalOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "completedOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "failedOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "pendingOrdersCount" INTEGER NOT NULL DEFAULT 0,
    "metricsJson" JSONB NOT NULL,
    "isImmutable" BOOLEAN NOT NULL DEFAULT true,
    "closedByUserId" TEXT,
    "notes" TEXT,
    "closedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_close_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_close_adjustments" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "adjustmentType" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "reason" TEXT NOT NULL,
    "ledgerTxId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_close_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payout_beneficiaries" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "beneficiaryName" TEXT NOT NULL,
    "channelCode" "PaymentChannelCode" NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "verificationStatus" TEXT NOT NULL DEFAULT 'VERIFIED',
    "financeApprovedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payout_beneficiaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_payout_transactions" (
    "id" TEXT NOT NULL,
    "payoutNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "beneficiaryId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'REQUESTED',
    "idempotencyKey" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "approvalNotes" TEXT,
    "externalReference" TEXT,
    "failureReason" TEXT,
    "ledgerTxId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_payout_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "owner_earnings_wallets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "realizedEarnings" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "lockedEarnings" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "withdrawnEarnings" DECIMAL(18,4) NOT NULL DEFAULT 0.0000,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "owner_earnings_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "support_tickets" (
    "id" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "subject" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "orderId" TEXT,
    "depositId" TEXT,
    "assignedToUserId" TEXT,
    "idempotencyKey" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_tickets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_messages" (
    "id" TEXT NOT NULL,
    "ticketId" TEXT NOT NULL,
    "senderUserId" TEXT NOT NULL,
    "senderRole" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attachments" TEXT,
    "isInternalNote" BOOLEAN NOT NULL DEFAULT false,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "status" TEXT NOT NULL DEFAULT 'UNREAD',
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_alerts" (
    "id" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "metrics" JSONB,
    "escalationLevel" TEXT NOT NULL DEFAULT 'DUTY_ENGINEER',
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "backup_records" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "sizeBytes" BIGINT NOT NULL DEFAULT 0,
    "checksumSha256" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "environment" TEXT NOT NULL DEFAULT 'production',
    "tablesIncluded" TEXT NOT NULL DEFAULT 'all',
    "recordsCount" INTEGER NOT NULL DEFAULT 0,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "rtoTargetSeconds" INTEGER NOT NULL DEFAULT 1800,
    "rpoTargetSeconds" INTEGER NOT NULL DEFAULT 300,
    "verifiedAt" TIMESTAMP(3),
    "verificationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "backup_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pilot_configs" (
    "id" TEXT NOT NULL DEFAULT 'default-pilot-config',
    "isPilotActive" BOOLEAN NOT NULL DEFAULT true,
    "maxOrderAmountYER" DECIMAL(65,30) NOT NULL DEFAULT 10000.0,
    "maxOrderAmountUSD" DECIMAL(65,30) NOT NULL DEFAULT 20.0,
    "maxDailyWalletLimitYER" DECIMAL(65,30) NOT NULL DEFAULT 50000.0,
    "allowedProductIds" TEXT NOT NULL DEFAULT 'ALL',
    "allowedChannelCodes" TEXT NOT NULL DEFAULT 'JAIB,JAWALI,ONE_CASH',
    "cohortType" TEXT NOT NULL DEFAULT 'TRUSTED_BETA_USERS',
    "whitelistedUserIds" TEXT NOT NULL DEFAULT '',
    "goNoGoDecision" TEXT NOT NULL DEFAULT 'CONDITIONAL_GO',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "launchNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pilot_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pilot_run_audits" (
    "id" TEXT NOT NULL,
    "cycleName" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "depositTxId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "supplierSettlementTxId" TEXT NOT NULL,
    "dailyCloseReportId" TEXT NOT NULL,
    "payoutRequestId" TEXT,
    "currency" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "ledgerBalanced" BOOLEAN NOT NULL DEFAULT true,
    "reconciliationMatched" BOOLEAN NOT NULL DEFAULT true,
    "bankProofMatched" BOOLEAN NOT NULL DEFAULT true,
    "providerProofMatched" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'PASSED',
    "detailsJson" JSONB,
    "executedBy" TEXT NOT NULL DEFAULT 'SYSTEM_PILOT_RUNNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pilot_run_audits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operations_handovers" (
    "id" TEXT NOT NULL DEFAULT 'default-handover-pkg',
    "version" TEXT NOT NULL DEFAULT '1.0.0-final',
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "handedOverAt" TIMESTAMP(3),
    "technicalLeadSign" JSONB,
    "financeControllerSign" JSONB,
    "supportLeadSign" JSONB,
    "operationsManagerSign" JSONB,
    "projectOwnerSign" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "operations_handovers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "operational_drill_logs" (
    "id" TEXT NOT NULL,
    "drillType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "executedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PASSED',
    "simulatedTargetId" TEXT,
    "stepsCompleted" JSONB,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "auditIntegrityVerified" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operational_drill_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_plans" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameAr" TEXT NOT NULL,
    "billingCycle" "SaaSBillingCycle" NOT NULL,
    "durationDays" INTEGER NOT NULL,
    "priceUsd" DECIMAL(18,4) NOT NULL,
    "priceYer" DECIMAL(18,4) NOT NULL,
    "priceSar" DECIMAL(18,4) NOT NULL,
    "hasFullPermissions" BOOLEAN NOT NULL DEFAULT true,
    "descriptionAr" TEXT NOT NULL,
    "featuresJson" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_tenants" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "domain" TEXT,
    "customDomain" TEXT,
    "ownerName" TEXT NOT NULL,
    "ownerEmail" TEXT NOT NULL,
    "ownerPhone" TEXT NOT NULL,
    "status" "SaaSTenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "licenseKey" TEXT NOT NULL,
    "brandingConfig" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_subscriptions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "billingCycle" "SaaSBillingCycle" NOT NULL,
    "pricePaid" DECIMAL(18,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3) NOT NULL,
    "autoRenew" BOOLEAN NOT NULL DEFAULT true,
    "status" "SaaSSubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "lastRenewalDate" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "saas_invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "subscriptionId" TEXT,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "CurrencyCode" NOT NULL DEFAULT 'USD',
    "status" "SaaSInvoiceStatus" NOT NULL DEFAULT 'PAID',
    "billingCycle" "SaaSBillingCycle" NOT NULL,
    "paymentMethod" TEXT,
    "referenceNumber" TEXT,
    "paidAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saas_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tiers_code_key" ON "tiers"("code");

-- CreateIndex
CREATE INDEX "tiers_isActive_displayOrder_idx" ON "tiers"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_parentAgentId_idx" ON "users"("parentAgentId");

-- CreateIndex
CREATE INDEX "users_tierId_role_idx" ON "users"("tierId", "role");

-- CreateIndex
CREATE INDEX "users_status_role_idx" ON "users"("status", "role");

-- CreateIndex
CREATE INDEX "user_devices_userId_isTrusted_idx" ON "user_devices"("userId", "isTrusted");

-- CreateIndex
CREATE INDEX "user_devices_lastSeenAt_idx" ON "user_devices"("lastSeenAt");

-- CreateIndex
CREATE UNIQUE INDEX "user_devices_userId_deviceFingerprintHash_key" ON "user_devices"("userId", "deviceFingerprintHash");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_api_credentials_userId_key" ON "merchant_api_credentials"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_api_credentials_apiKeyHash_key" ON "merchant_api_credentials"("apiKeyHash");

-- CreateIndex
CREATE INDEX "merchant_api_credentials_isActive_idx" ON "merchant_api_credentials"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_refreshToken_key" ON "sessions"("refreshToken");

-- CreateIndex
CREATE UNIQUE INDEX "fx_rates_fromCurrency_toCurrency_effectiveFrom_key" ON "fx_rates"("fromCurrency", "toCurrency", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_currency_key" ON "wallets"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_ledger_entries_idempotencyKey_key" ON "wallet_ledger_entries"("idempotencyKey");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_walletId_createdAt_idx" ON "wallet_ledger_entries"("walletId", "createdAt");

-- CreateIndex
CREATE INDEX "wallet_ledger_entries_referenceType_referenceId_idx" ON "wallet_ledger_entries"("referenceType", "referenceId");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_requests_depositNumber_key" ON "deposit_requests"("depositNumber");

-- CreateIndex
CREATE INDEX "deposit_requests_userId_status_idx" ON "deposit_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "deposit_requests_referenceNumber_idx" ON "deposit_requests"("referenceNumber");

-- CreateIndex
CREATE INDEX "deposit_requests_paymentMethodCode_status_createdAt_idx" ON "deposit_requests"("paymentMethodCode", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "deposit_requests_paymentMethodCode_referenceNumber_key" ON "deposit_requests"("paymentMethodCode", "referenceNumber");

-- CreateIndex
CREATE INDEX "deposit_status_histories_depositRequestId_idx" ON "deposit_status_histories"("depositRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_channel_configs_code_key" ON "payment_channel_configs"("code");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_topups_paymentMethodId_referenceNumber_key" ON "wallet_topups"("paymentMethodId", "referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_accounts_code_key" ON "ledger_accounts"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_txNumber_key" ON "ledger_transactions"("txNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ledger_transactions_idempotencyKey_key" ON "ledger_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ledger_transactions_referenceType_referenceId_idx" ON "ledger_transactions"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "ledger_entries_transactionId_idx" ON "ledger_entries"("transactionId");

-- CreateIndex
CREATE INDEX "ledger_entries_accountId_idx" ON "ledger_entries"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_slug_key" ON "service_categories"("slug");

-- CreateIndex
CREATE INDEX "service_categories_parentId_displayOrder_idx" ON "service_categories"("parentId", "displayOrder");

-- CreateIndex
CREATE INDEX "service_categories_categoryType_isActive_idx" ON "service_categories"("categoryType", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "services_slug_key" ON "services"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "service_fields_serviceId_fieldKey_key" ON "service_fields"("serviceId", "fieldKey");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_prices_productId_currency_key" ON "product_prices"("productId", "currency");

-- CreateIndex
CREATE INDEX "product_tier_prices_tierId_isActive_idx" ON "product_tier_prices"("tierId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "product_tier_prices_productId_tierId_currency_key" ON "product_tier_prices"("productId", "tierId", "currency");

-- CreateIndex
CREATE INDEX "product_provider_mappings_productId_isActive_priority_idx" ON "product_provider_mappings"("productId", "isActive", "priority");

-- CreateIndex
CREATE UNIQUE INDEX "product_provider_mappings_productId_providerId_key" ON "product_provider_mappings"("productId", "providerId");

-- CreateIndex
CREATE UNIQUE INDEX "product_provider_mappings_providerId_providerProductSku_key" ON "product_provider_mappings"("providerId", "providerProductSku");

-- CreateIndex
CREATE UNIQUE INDEX "pin_vault_pinCodeHash_key" ON "pin_vault"("pinCodeHash");

-- CreateIndex
CREATE INDEX "pin_vault_productId_status_createdAt_idx" ON "pin_vault"("productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "pin_vault_orderId_idx" ON "pin_vault"("orderId");

-- CreateIndex
CREATE INDEX "pin_vault_expiresAt_idx" ON "pin_vault"("expiresAt");

-- CreateIndex
CREATE INDEX "provider_api_logs_providerId_createdAt_idx" ON "provider_api_logs"("providerId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_api_logs_orderId_createdAt_idx" ON "provider_api_logs"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_api_logs_success_createdAt_idx" ON "provider_api_logs"("success", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payment_methods_code_key" ON "payment_methods"("code");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNumber_key" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotencyKey_key" ON "orders"("idempotencyKey");

-- CreateIndex
CREATE INDEX "orders_userId_status_idx" ON "orders"("userId", "status");

-- CreateIndex
CREATE INDEX "orders_orderNumber_idx" ON "orders"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "providers_code_key" ON "providers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "manual_fulfillments_orderId_key" ON "manual_fulfillments"("orderId");

-- CreateIndex
CREATE INDEX "audit_logs_entityName_entityId_idx" ON "audit_logs"("entityName", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_payoutNumber_key" ON "payout_requests"("payoutNumber");

-- CreateIndex
CREATE UNIQUE INDEX "payout_requests_idempotencyKey_key" ON "payout_requests"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payout_requests_userId_status_idx" ON "payout_requests"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "reconciliation_batches_batchNumber_key" ON "reconciliation_batches"("batchNumber");

-- CreateIndex
CREATE INDEX "reconciliation_items_batchId_status_idx" ON "reconciliation_items"("batchId", "status");

-- CreateIndex
CREATE INDEX "reconciliation_items_referenceNumber_idx" ON "reconciliation_items"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_accounts_providerId_currency_key" ON "supplier_accounts"("providerId", "currency");

-- CreateIndex
CREATE INDEX "supplier_transactions_accountId_idx" ON "supplier_transactions"("accountId");

-- CreateIndex
CREATE INDEX "price_rule_versions_scope_targetId_idx" ON "price_rule_versions"("scope", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "daily_close_reports_closeDate_key" ON "daily_close_reports"("closeDate");

-- CreateIndex
CREATE INDEX "daily_close_adjustments_reportId_idx" ON "daily_close_adjustments"("reportId");

-- CreateIndex
CREATE INDEX "payout_beneficiaries_userId_idx" ON "payout_beneficiaries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_payout_transactions_payoutNumber_key" ON "owner_payout_transactions"("payoutNumber");

-- CreateIndex
CREATE UNIQUE INDEX "owner_payout_transactions_idempotencyKey_key" ON "owner_payout_transactions"("idempotencyKey");

-- CreateIndex
CREATE INDEX "owner_payout_transactions_userId_idx" ON "owner_payout_transactions"("userId");

-- CreateIndex
CREATE INDEX "owner_payout_transactions_beneficiaryId_idx" ON "owner_payout_transactions"("beneficiaryId");

-- CreateIndex
CREATE UNIQUE INDEX "owner_earnings_wallets_userId_currency_key" ON "owner_earnings_wallets"("userId", "currency");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_ticketNumber_key" ON "support_tickets"("ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "support_tickets_idempotencyKey_key" ON "support_tickets"("idempotencyKey");

-- CreateIndex
CREATE INDEX "support_tickets_userId_idx" ON "support_tickets"("userId");

-- CreateIndex
CREATE INDEX "support_tickets_status_idx" ON "support_tickets"("status");

-- CreateIndex
CREATE INDEX "support_tickets_category_idx" ON "support_tickets"("category");

-- CreateIndex
CREATE INDEX "support_tickets_orderId_idx" ON "support_tickets"("orderId");

-- CreateIndex
CREATE INDEX "ticket_messages_ticketId_idx" ON "ticket_messages"("ticketId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_status_idx" ON "notifications"("status");

-- CreateIndex
CREATE INDEX "system_alerts_isResolved_idx" ON "system_alerts"("isResolved");

-- CreateIndex
CREATE INDEX "system_alerts_severity_idx" ON "system_alerts"("severity");

-- CreateIndex
CREATE INDEX "system_alerts_alertType_idx" ON "system_alerts"("alertType");

-- CreateIndex
CREATE INDEX "backup_records_status_idx" ON "backup_records"("status");

-- CreateIndex
CREATE INDEX "pilot_run_audits_status_idx" ON "pilot_run_audits"("status");

-- CreateIndex
CREATE INDEX "operational_drill_logs_drillType_idx" ON "operational_drill_logs"("drillType");

-- CreateIndex
CREATE INDEX "operational_drill_logs_status_idx" ON "operational_drill_logs"("status");

-- CreateIndex
CREATE UNIQUE INDEX "saas_plans_billingCycle_key" ON "saas_plans"("billingCycle");

-- CreateIndex
CREATE UNIQUE INDEX "saas_tenants_slug_key" ON "saas_tenants"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "saas_tenants_domain_key" ON "saas_tenants"("domain");

-- CreateIndex
CREATE UNIQUE INDEX "saas_tenants_licenseKey_key" ON "saas_tenants"("licenseKey");

-- CreateIndex
CREATE INDEX "saas_tenants_status_idx" ON "saas_tenants"("status");

-- CreateIndex
CREATE INDEX "saas_subscriptions_tenantId_idx" ON "saas_subscriptions"("tenantId");

-- CreateIndex
CREATE INDEX "saas_subscriptions_status_idx" ON "saas_subscriptions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "saas_invoices_invoiceNumber_key" ON "saas_invoices"("invoiceNumber");

-- CreateIndex
CREATE INDEX "saas_invoices_tenantId_idx" ON "saas_invoices"("tenantId");

-- CreateIndex
CREATE INDEX "saas_invoices_status_idx" ON "saas_invoices"("status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "tiers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_parentAgentId_fkey" FOREIGN KEY ("parentAgentId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_devices" ADD CONSTRAINT "user_devices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_api_credentials" ADD CONSTRAINT "merchant_api_credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "currency_exchanges" ADD CONSTRAINT "currency_exchanges_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_ledger_entries" ADD CONSTRAINT "wallet_ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_requests" ADD CONSTRAINT "deposit_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_requests" ADD CONSTRAINT "deposit_requests_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_requests" ADD CONSTRAINT "deposit_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_status_histories" ADD CONSTRAINT "deposit_status_histories_depositRequestId_fkey" FOREIGN KEY ("depositRequestId") REFERENCES "deposit_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deposit_status_histories" ADD CONSTRAINT "deposit_status_histories_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_topups" ADD CONSTRAINT "wallet_topups_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_accounts" ADD CONSTRAINT "ledger_accounts_currency_fkey" FOREIGN KEY ("currency") REFERENCES "currencies"("code") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "ledger_transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ledger_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_categories" ADD CONSTRAINT "service_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "service_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_fields" ADD CONSTRAINT "service_fields_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_prices" ADD CONSTRAINT "product_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tier_prices" ADD CONSTRAINT "product_tier_prices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_tier_prices" ADD CONSTRAINT "product_tier_prices_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "tiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_provider_mappings" ADD CONSTRAINT "product_provider_mappings_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_provider_mappings" ADD CONSTRAINT "product_provider_mappings_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pin_vault" ADD CONSTRAINT "pin_vault_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pin_vault" ADD CONSTRAINT "pin_vault_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_api_logs" ADD CONSTRAINT "provider_api_logs_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_api_logs" ADD CONSTRAINT "provider_api_logs_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "payment_methods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_status_history_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_fulfillments" ADD CONSTRAINT "manual_fulfillments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manual_fulfillments" ADD CONSTRAINT "manual_fulfillments_assignedOperatorId_fkey" FOREIGN KEY ("assignedOperatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payout_requests" ADD CONSTRAINT "payout_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reconciliation_items" ADD CONSTRAINT "reconciliation_items_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "reconciliation_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_accounts" ADD CONSTRAINT "supplier_accounts_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "providers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "supplier_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_reviewedByUserId_fkey" FOREIGN KEY ("reviewedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "price_rule_versions" ADD CONSTRAINT "price_rule_versions_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_close_adjustments" ADD CONSTRAINT "daily_close_adjustments_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "daily_close_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "owner_payout_transactions" ADD CONSTRAINT "owner_payout_transactions_beneficiaryId_fkey" FOREIGN KEY ("beneficiaryId") REFERENCES "payout_beneficiaries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_messages" ADD CONSTRAINT "ticket_messages_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "support_tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_subscriptions" ADD CONSTRAINT "saas_subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "saas_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "saas_tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saas_invoices" ADD CONSTRAINT "saas_invoices_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "saas_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

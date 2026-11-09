export enum UserRole {
  OWNER = 'OWNER',
  GENERAL_MANAGER = 'GENERAL_MANAGER',
  FINANCE_MANAGER = 'FINANCE_MANAGER',
  SUPPORT = 'SUPPORT',
  FULFILLMENT_OPERATOR = 'FULFILLMENT_OPERATOR',
  AUDITOR = 'AUDITOR',
  CUSTOMER = 'CUSTOMER',
  SUPER_ADMIN = 'SUPER_ADMIN',
  ADMIN = 'ADMIN',
  FINANCE = 'FINANCE',
  RESELLER = 'RESELLER',
  SUB_AGENT = 'SUB_AGENT',
  PAYMENT_AGENT = 'PAYMENT_AGENT',
}

export enum CurrencyCode {
  YER = 'YER',
  USD = 'USD',
  SAR = 'SAR',
}

export enum DepositStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  CREDITED = 'CREDITED',
}

export enum PaymentStatus {
  Created = 'Created',
  Pending = 'Pending',
  AwaitingVerification = 'AwaitingVerification',
  Confirmed = 'Confirmed',
  Failed = 'Failed',
  Expired = 'Expired',
  Reversed = 'Reversed',
  Refunded = 'Refunded',
  NeedsReconciliation = 'NeedsReconciliation',
}

export enum OrderStatus {
  AwaitingPayment = 'AwaitingPayment',
  PaymentReview = 'PaymentReview',
  Paid = 'Paid',
  Queued = 'Queued',
  Processing = 'Processing',
  ManualReview = 'ManualReview',
  Completed = 'Completed',
  Failed = 'Failed',
  Cancelled = 'Cancelled',
  RefundPending = 'RefundPending',
  Refunded = 'Refunded',
  ReconciliationRequired = 'ReconciliationRequired',
}

export enum PaymentChannelCode {
  JAIB = 'JAIB',
  JAWALI = 'JAWALI',
  CASH = 'CASH',
  ONE_CASH = 'ONE_CASH',
  EASY = 'EASY',
  WALLET = 'WALLET',
  CARD = 'CARD',
  BINANCE_PAY = 'BINANCE_PAY',
  USDT_TRC20 = 'USDT_TRC20',
  USDT_BEP20 = 'USDT_BEP20',
}

export enum LedgerAccountType {
  ASSET = 'ASSET',
  LIABILITY = 'LIABILITY',
  EQUITY = 'EQUITY',
  REVENUE = 'REVENUE',
  EXPENSE = 'EXPENSE',
}

export enum LedgerTransactionType {
  TOPUP = 'TOPUP',
  PURCHASE = 'PURCHASE',
  REFUND = 'REFUND',
  EXCHANGE = 'EXCHANGE',
  ADJUSTMENT = 'ADJUSTMENT',
}
export const LedgerEntryType = LedgerTransactionType;
export type LedgerEntryType = LedgerTransactionType;

export enum DynamicFieldInputType {
  TEXT = 'text',
  NUMBER = 'number',
  SELECT = 'select',
}

export enum ProviderType {
  MOCK = 'MOCK',
  MANUAL = 'MANUAL',
  EXTERNAL_API = 'EXTERNAL_API',
}

export enum ProductType {
  DIRECT_TOPUP = 'DIRECT_TOPUP',
  VOUCHER = 'VOUCHER',
  GIFT_CARD = 'GIFT_CARD',
  GAME_DIRECT_TOPUP = 'GAME_DIRECT_TOPUP',
}

// ----------------------------------------------------
// PHASE 04: SERVICE ACCOUNTS, CONSENT & AI RISK
// ----------------------------------------------------
export enum ServiceAccountStatus {
  VERIFIED_OAUTH = 'VERIFIED_OAUTH',
  VERIFIED_PROVIDER = 'VERIFIED_PROVIDER',
  REFERENCE_ONLY = 'REFERENCE_ONLY',
  UNSUPPORTED = 'UNSUPPORTED',
  REVOKED = 'REVOKED',
}

export enum OfficialLinkMethod {
  REFERENCE_INPUT = 'REFERENCE_INPUT',
  PROVIDER_QUERY_CHECK = 'PROVIDER_QUERY_CHECK',
  OAUTH_PKCE = 'OAUTH_PKCE',
  UNSUPPORTED = 'UNSUPPORTED',
}

export enum AccountReviewStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  NEEDS_INFO = 'NEEDS_INFO',
}

export enum RiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
}

export enum AiRecommendation {
  AUTO_APPROVE = 'AUTO_APPROVE',
  HUMAN_REVIEW = 'HUMAN_REVIEW',
  REJECT = 'REJECT',
}

// ----------------------------------------------------
// PHASE 05: PAYMENT AUTOMATION, SETTLEMENT & RECONCILIATION
// ----------------------------------------------------
export enum PayoutStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
  CANCELLED = 'CANCELLED',
}

export enum ReconciliationStatus {
  MATCHED = 'MATCHED',
  DISCREPANCY = 'DISCREPANCY',
  UNKNOWN_INTERNAL = 'UNKNOWN_INTERNAL',
  UNKNOWN_EXTERNAL = 'UNKNOWN_EXTERNAL',
  RESOLVED_MANUAL = 'RESOLVED_MANUAL',
  PENDING_REVIEW = 'PENDING_REVIEW',
}

export enum DiscrepancyType {
  AMOUNT_MISMATCH = 'AMOUNT_MISMATCH',
  CURRENCY_MISMATCH = 'CURRENCY_MISMATCH',
  MISSING_IN_BANK = 'MISSING_IN_BANK',
  MISSING_IN_INTERNAL = 'MISSING_IN_INTERNAL',
  DUPLICATE_EXTERNAL = 'DUPLICATE_EXTERNAL',
  TIMING_DIFFERENCE = 'TIMING_DIFFERENCE',
  FEE_MISMATCH = 'FEE_MISMATCH',
  UNAUTHORIZED_DEBIT = 'UNAUTHORIZED_DEBIT',
}

export enum PaymentChannelMode {
  MANUAL = 'MANUAL',
  API = 'API',
  BLOCKED_EXTERNAL = 'BLOCKED_EXTERNAL',
  DISABLED = 'DISABLED',
}

export enum SupplierAccountType {
  PREPAID = 'PREPAID',
  POSTPAID = 'POSTPAID',
  PAY_PER_ORDER = 'PAY_PER_ORDER',
}

export enum SupplierTransactionType {
  PREPAID_TOPUP = 'PREPAID_TOPUP',
  ORDER_FULFILLMENT = 'ORDER_FULFILLMENT',
  REFUND = 'REFUND',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum ServiceRequestStatus {
  PENDING = 'PENDING',
  UNDER_REVIEW = 'UNDER_REVIEW',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  FULFILLED = 'FULFILLED',
}

export enum PriceRuleScope {
  DEFAULT = 'DEFAULT',
  CATEGORY = 'CATEGORY',
  SERVICE = 'SERVICE',
  PRODUCT = 'PRODUCT',
}

export enum MarginType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED = 'FIXED',
}

export enum ChannelVerificationStatus {
  VERIFIED = 'VERIFIED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REJECTED = 'REJECTED',
}

export enum DailyCloseStatus {
  OPEN = 'OPEN',
  PRELIMINARY = 'PRELIMINARY',
  CLOSED = 'CLOSED',
  ADJUSTED = 'ADJUSTED',
}

export enum OwnerPayoutStatus {
  REQUESTED = 'REQUESTED',
  APPROVED = 'APPROVED',
  PROCESSING = 'PROCESSING',
  CONFIRMED = 'CONFIRMED',
  FAILED = 'FAILED',
  UNKNOWN = 'UNKNOWN',
}

export enum BeneficiaryVerificationStatus {
  VERIFIED = 'VERIFIED',
  PENDING_REVIEW = 'PENDING_REVIEW',
  REJECTED = 'REJECTED',
}

// ----------------------------------------------------
// Phase 08 Enums: Support Tickets & Notifications
// ----------------------------------------------------

export enum TicketStatus {
  OPEN = 'OPEN',
  IN_PROGRESS = 'IN_PROGRESS',
  WAITING_FOR_CUSTOMER = 'WAITING_FOR_CUSTOMER',
  RESOLVED = 'RESOLVED',
  CLOSED = 'CLOSED',
}

export enum TicketPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

export enum TicketCategory {
  ORDER_ISSUE = 'ORDER_ISSUE',
  DEPOSIT_ISSUE = 'DEPOSIT_ISSUE',
  ACCOUNT_ISSUE = 'ACCOUNT_ISSUE',
  REFUND_REQUEST = 'REFUND_REQUEST',
  GENERAL_INQUIRY = 'GENERAL_INQUIRY',
}

export enum NotificationType {
  ORDER_UPDATE = 'ORDER_UPDATE',
  DEPOSIT_CONFIRMED = 'DEPOSIT_CONFIRMED',
  PAYOUT_UPDATE = 'PAYOUT_UPDATE',
  SECURITY_ALERT = 'SECURITY_ALERT',
  SUPPORT_REPLY = 'SUPPORT_REPLY',
  SYSTEM_ANNOUNCEMENT = 'SYSTEM_ANNOUNCEMENT',
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  SMS = 'SMS',
  EMAIL = 'EMAIL',
}

export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

// ----------------------------------------------------
// Phase 09 Enums: Security, Anti-Fraud & Privacy
// ----------------------------------------------------

export enum SecurityIncidentType {
  BOLA_VIOLATION_ATTEMPT = 'BOLA_VIOLATION_ATTEMPT',
  SUSPICIOUS_VELOCITY = 'SUSPICIOUS_VELOCITY',
  UNAUTHORIZED_STAFF_ACTION = 'UNAUTHORIZED_STAFF_ACTION',
  WEBHOOK_FORGERY_ATTEMPT = 'WEBHOOK_FORGERY_ATTEMPT',
  WEBHOOK_REPLAY_ATTEMPT = 'WEBHOOK_REPLAY_ATTEMPT',
  SIM_SWAP_RISK = 'SIM_SWAP_RISK',
  BRUTE_FORCE_ATTEMPT = 'BRUTE_FORCE_ATTEMPT',
  PROMPT_INJECTION_BLOCKED = 'PROMPT_INJECTION_BLOCKED',
  WALLET_FROZEN = 'WALLET_FROZEN',
  WALLET_UNFROZEN = 'WALLET_UNFROZEN',
}

export enum FraudRiskLevel {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum PrivacyActionType {
  DATA_EXPORT = 'DATA_EXPORT',
  DELETION_REQUEST = 'DELETION_REQUEST',
  ANONYMIZATION_COMPLETED = 'ANONYMIZATION_COMPLETED',
  TOKENS_PURGED = 'TOKENS_PURGED',
}

// ----------------------------------------------------
// Phase 10 Enums: Production Readiness, Health, Monitoring & Backup
// ----------------------------------------------------

export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
}

export enum SystemAlertSeverity {
  INFO = 'INFO',
  WARNING = 'WARNING',
  CRITICAL = 'CRITICAL',
}

export enum SystemAlertType {
  DB_LOCKS_HIGH = 'DB_LOCKS_HIGH',
  QUEUE_LAG_HIGH = 'QUEUE_LAG_HIGH',
  DEPOSIT_MISMATCH = 'DEPOSIT_MISMATCH',
  UNKNOWN_PROVIDER_ORDERS = 'UNKNOWN_PROVIDER_ORDERS',
  PAYOUT_FAILURES = 'PAYOUT_FAILURES',
  HTTP_5XX_ELEVATED = 'HTTP_5XX_ELEVATED',
  LOW_SUPPLIER_BALANCE = 'LOW_SUPPLIER_BALANCE',
  RECONCILIATION_VARIANCE = 'RECONCILIATION_VARIANCE',
  GATEWAY_OUTAGE = 'GATEWAY_OUTAGE',
}

export enum BackupStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  VERIFIED = 'VERIFIED',
}

export enum DeploymentEnvironment {
  DEVELOPMENT = 'DEVELOPMENT',
  STAGING = 'STAGING',
  PRODUCTION = 'PRODUCTION',
}

// ----------------------------------------------------
// Phase 11 Enums: Pilot Rollout & Go/No-Go Decision Gate (AT-21)
// ----------------------------------------------------

export enum PilotLaunchStatus {
  NOT_STARTED = 'NOT_STARTED',
  PILOT_ACTIVE = 'PILOT_ACTIVE',
  GO_DECISION_PENDING = 'GO_DECISION_PENDING',
  APPROVED_FOR_PUBLIC_LAUNCH = 'APPROVED_FOR_PUBLIC_LAUNCH',
  HALTED_ROLLBACK = 'HALTED_ROLLBACK',
}

export enum PilotDecisionGateStatus {
  GO = 'GO',
  NO_GO = 'NO_GO',
  CONDITIONAL_GO = 'CONDITIONAL_GO',
}

export enum PilotCohortType {
  INTERNAL_STAFF = 'INTERNAL_STAFF',
  TRUSTED_BETA_USERS = 'TRUSTED_BETA_USERS',
  PUBLIC_PILOT = 'PUBLIC_PILOT',
}

// ----------------------------------------------------
// Phase 12 Enums: Operations Handover, Runbooks & KPIs
// ----------------------------------------------------

export enum HandoverStatus {
  IN_PROGRESS = 'IN_PROGRESS',
  TRANSFERRED = 'TRANSFERRED',
  ACCEPTED_BY_OWNER = 'ACCEPTED_BY_OWNER',
}

export enum RunbookCategory {
  FINANCE_DEPOSIT_REJECT = 'FINANCE_DEPOSIT_REJECT',
  FULFILLMENT_UNKNOWN = 'FULFILLMENT_UNKNOWN',
  PROVIDER_OUTAGE = 'PROVIDER_OUTAGE',
  WRONG_PAYOUT = 'WRONG_PAYOUT',
  REFUND_DISPUTE = 'REFUND_DISPUTE',
  WORKER_LAG = 'WORKER_LAG',
}

export enum MaintenanceCadence {
  DAILY = 'DAILY',
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
}

// ----------------------------------------------------
// Phase 13 Enums: SaaS Platform & Subscription Management (Super Admin)
// ----------------------------------------------------

export enum SaaSBillingCycle {
  WEEKLY = 'WEEKLY',   // اشتراك أسبوعي
  MONTHLY = 'MONTHLY', // اشتراك شهري
  ANNUAL = 'ANNUAL',   // اشتراك سنوي
}

export enum SaaSSubscriptionStatus {
  ACTIVE = 'ACTIVE',
  TRIAL = 'TRIAL',
  PENDING_PAYMENT = 'PENDING_PAYMENT',
  EXPIRED = 'EXPIRED',
  SUSPENDED = 'SUSPENDED',
  CANCELLED = 'CANCELLED',
}

export enum SaaSTenantStatus {
  ACTIVE = 'ACTIVE',
  PENDING_SETUP = 'PENDING_SETUP',
  SUSPENDED = 'SUSPENDED',
  TERMINATED = 'TERMINATED',
}

export enum SaaSInvoiceStatus {
  PAID = 'PAID',
  PENDING = 'PENDING',
  OVERDUE = 'OVERDUE',
  CANCELLED = 'CANCELLED',
}

export enum PinVaultStatus {
  AVAILABLE = 'AVAILABLE',
  RESERVED = 'RESERVED',
  SOLD = 'SOLD',
}

export enum FulfillmentType {
  API_DIRECT = 'API_DIRECT',
  LOCAL_PIN_VAULT = 'LOCAL_PIN_VAULT',
  MANUAL = 'MANUAL',
}


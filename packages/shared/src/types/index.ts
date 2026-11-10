import {
  UserRole,
  CurrencyCode,
  OrderStatus,
  PaymentStatus,
  PaymentChannelCode,
  LedgerAccountType,
  LedgerTransactionType,
  DynamicFieldInputType,
  PayoutStatus,
  ReconciliationStatus,
  DiscrepancyType,
  PaymentChannelMode,
  PaymentSenderIdentifierType,
  SupplierAccountType,
  SupplierTransactionType,
  ServiceRequestStatus,
  PriceRuleScope,
  MarginType,
  ChannelVerificationStatus,
  DailyCloseStatus,
  OwnerPayoutStatus,
  BeneficiaryVerificationStatus,
  TicketStatus,
  TicketPriority,
  TicketCategory,
  NotificationType,
  NotificationChannel,
  NotificationStatus,
  SecurityIncidentType,
  FraudRiskLevel,
  PrivacyActionType,
  HealthStatus,
  SystemAlertSeverity,
  SystemAlertType,
  BackupStatus,
  DeploymentEnvironment,
  PilotLaunchStatus,
  PilotDecisionGateStatus,
  PilotCohortType,
  HandoverStatus,
  RunbookCategory,
  MaintenanceCadence,
  SaaSBillingCycle,
  SaaSSubscriptionStatus,
  SaaSTenantStatus,
  SaaSInvoiceStatus,
  PinVaultStatus,
  FulfillmentType,
} from '../enums';

export interface DynamicFieldDefinition {
  key: string;
  label: string;
  labelAr?: string;
  type: DynamicFieldInputType;
  required: boolean;
  validationRegex?: string;
  placeholder?: string;
  placeholderAr?: string;
  options?: Array<{ label: string; value: string }>;
  helperText?: string;
  helperTextAr?: string;
}

export interface PlayerValidationRequest {
  serviceId: string;
  fields: Record<string, string>;
}

export interface PlayerValidationResponse {
  isValid: boolean;
  playerName?: string;
  zoneName?: string;
  rawResponse?: Record<string, any>;
  errorMessage?: string;
}

export interface OrderSnapshot {
  serviceName: string;
  serviceNameAr?: string;
  productName: string;
  productNameAr?: string;
  currency: CurrencyCode;
  retailPrice: number;
  costPrice: number;
  feeAmount: number;
  beneficiaryFields: Record<string, string>;
  paymentMethodCode: PaymentChannelCode;
}

export interface DoubleEntryItem {
  accountCode: string;
  walletId?: string;
  debitAmount: number;
  creditAmount: number;
  currency: CurrencyCode;
  notes?: string;
}

export interface DoubleEntryTransactionPayload {
  txNumber: string;
  type: LedgerTransactionType;
  referenceType: string;
  referenceId: string;
  idempotencyKey?: string;
  notes?: string;
  createdByUserId?: string;
  entries: DoubleEntryItem[]; // MUST SUM(debit) == SUM(credit)
}

export interface CurrencyExchangePayload {
  userId: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  fromAmount: number;
  idempotencyKey: string;
}

export interface TopupProviderOrderRequest {
  orderId: string;
  orderNumber?: string;
  providerSku: string;
  fields?: Record<string, string>;
  playerFields?: Record<string, string>;
  amount?: number;
  currency?: string;
  idempotencyKey?: string;
}

export interface TopupProviderOrderResponse {
  success: boolean;
  providerTransactionId?: string;
  providerOrderId?: string;
  pinCode?: string;
  serialNumber?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  rawResponse?: Record<string, any>;
  errorMessage?: string;
  errorCode?: string;
}

export interface ProviderBalanceResponse {
  currency: string;
  balance: number;
  lastCheckedAt?: Date;
  provider?: string;
  lastUpdated?: string;
  rawResponse?: Record<string, any>;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface CreateDepositRequestDto {
  currency: CurrencyCode;
  amount: number;
  paymentMethodCode: PaymentChannelCode;
  referenceNumber: string;
  proofImageUrl?: string;
  senderName?: string;
  senderPhone?: string;
  idempotencyKey?: string;
}

export interface DepositReviewDto {
  reviewNotes?: string;
  rejectionReason?: string;
}

export interface WalletFreezeDto {
  walletId: string;
  isFrozen: boolean;
  reason: string;
}

export interface AdminCreateStaffDto {
  fullName: string;
  email?: string;
  phone?: string;
  password: string;
  role: UserRole;
}

export interface PaymentChannelCapabilities {
  depositConfirm: boolean;
  transactionLookup: boolean;
  payout: boolean;
  balance: boolean;
  reconcile: boolean;
}

export interface PaymentChannelInfo {
  code: PaymentChannelCode;
  name: string;
  nameAr: string;
  accountNumber: string;
  accountHolderName: string;
  instructionsAr: string;
  supportedCurrencies: CurrencyCode[];
  minAmount: number;
  maxAmount: number;
  isActive: boolean;
  mode?: PaymentChannelMode;
  capabilities?: PaymentChannelCapabilities;
  dailyLimit?: number;
  feePercentage?: number;
  feeFixed?: number;
  isVerifiedLegal?: boolean;
  senderIdentifierType?: PaymentSenderIdentifierType;
}

export interface CreateCheckoutDto {
  productId?: string;
  packageId?: string;
  currency?: CurrencyCode;
  playerFields: Record<string, string>;
  idempotencyKey: string;
  paymentMethod?: PaymentChannelCode;
  notes?: string;
}

export interface ManualFulfillmentDto {
  voucherCode?: string;
  proofScreenshotUrl?: string;
  operatorNotes?: string;
}

export interface OrderRefundDto {
  reason: string;
  releaseOnly?: boolean;
}

export interface UpdateProviderDto {
  name?: string;
  baseUrl?: string;
  /** Legacy single-key field; encrypted at rest and never returned in clear text. */
  apiKey?: string;
  /** Multi-field credentials such as merchantId, clientId, apiSecret and webhookSecret. Encrypted at rest. */
  credentials?: Record<string, string>;
  isActive?: boolean;
  type?: string;
}

export interface ProviderPerformanceMetrics {
  providerId: string;
  providerCode: string;
  providerName: string;
  totalOrders: number;
  completedOrders: number;
  failedOrders: number;
  manualReviewOrders: number;
  successRate: number;
  averageExecutionTimeMs: number;
  currentBalance: number;
  currency: string;
}

// ----------------------------------------------------
// PHASE 05: WEBHOOKS, PAYOUTS, SUPPLIER & RECONCILIATION
// ----------------------------------------------------
export interface InboundWebhookPayload {
  channelCode: PaymentChannelCode;
  transactionReference: string;
  amount: number;
  currency: CurrencyCode;
  beneficiaryAccount: string;
  senderAccount?: string;
  senderName?: string;
  senderPhone?: string;
  signature?: string;
  timestamp?: string | number;
  rawPayload?: Record<string, any>;
}

export interface DepositConfirmResult {
  success: boolean;
  status: 'CREDITED' | 'MANUAL_REVIEW' | 'DUPLICATE' | 'REJECTED';
  depositNumber?: string;
  message: string;
  ledgerTxId?: string;
  discrepancy?: string;
}

export interface OutboundPayoutPayload {
  payoutId: string;
  payoutNumber: string;
  channelCode: PaymentChannelCode;
  destinationAccount: string;
  beneficiaryName: string;
  amount: number;
  currency: CurrencyCode;
  idempotencyKey: string;
  reason?: string;
}

export interface PayoutResult {
  success: boolean;
  status: 'CONFIRMED' | 'FAILED' | 'UNKNOWN' | 'BLOCKED_EXTERNAL';
  externalReference?: string;
  message: string;
  rawResponse?: Record<string, any>;
}

export interface CreatePayoutDto {
  currency: CurrencyCode;
  amount: number;
  channelCode: PaymentChannelCode;
  destinationAccount: string;
  beneficiaryName: string;
  idempotencyKey: string;
  reason?: string;
}

export interface ApprovePayoutDto {
  reviewNotes?: string;
  externalReference?: string;
  isManualTransferConfirmed?: boolean;
}

export interface SupplierDepositDto {
  providerId: string;
  currency: CurrencyCode;
  amount: number;
  referenceNumber: string;
  transferProofUrl?: string;
  notes?: string;
}

export interface StatementItemDto {
  referenceNumber: string;
  amount: number;
  currency: CurrencyCode;
  type?: 'DEPOSIT' | 'PAYOUT' | 'PROVIDER_CHARGE';
  date?: string;
  notes?: string;
}

export interface RunReconciliationDto {
  channelCode?: PaymentChannelCode;
  statementDate: string; // YYYY-MM-DD
  externalStatements: StatementItemDto[];
}

export interface ReconciliationBatchSummary {
  batchId: string;
  batchNumber: string;
  statementDate: string;
  totalRecords: number;
  matchedCount: number;
  discrepancyCount: number;
  totalAmountMatched: number;
  totalAmountDiscrepant: number;
  discrepancies: Array<{
    id: string;
    referenceNumber: string;
    expectedAmount: number;
    actualAmount: number;
    currency: string;
    type: DiscrepancyType;
    status: ReconciliationStatus;
    notes?: string;
  }>;
}

// ----------------------------------------------------
// PHASE 06: DYNAMIC CATALOG, PRICING & CHANNELS
// ----------------------------------------------------
export interface CreateServiceRequestDto {
  appName: string;
  categorySlug?: string;
  suggestedPackages?: string;
  playerFieldDetails?: string;
  officialWebsiteUrl?: string;
  notes?: string;
}

export interface UpdateServiceRequestStatusDto {
  status: ServiceRequestStatus;
  reviewNotes?: string;
}

export interface CreatePriceRuleDto {
  scope: PriceRuleScope;
  targetId?: string;
  marginType: MarginType;
  marginValue: number;
  minMargin?: number;
  maxMargin?: number;
  feeFixed?: number;
  feePercentage?: number;
  validFrom?: string;
  validTo?: string;
  changeReason: string;
}

export interface PricePreviewDto {
  costPrice: number;
  costCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  scope?: PriceRuleScope;
  targetId?: string;
}

export interface PricePreviewResult {
  costPrice: number;
  costCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  fxRateUsed: number;
  calculatedFees: number;
  appliedMargin: number;
  marginType: MarginType;
  recommendedRetailPrice: number;
  netEstimatedProfit: number;
  profitPercentage: number;
  matchedRuleId?: string;
  matchedScope: PriceRuleScope;
}

export interface CreateDynamicChannelDto {
  code: PaymentChannelCode;
  name: string;
  nameAr: string;
  accountNumber: string;
  accountHolderName: string;
  instructionsAr: string;
  supportedCurrencies: CurrencyCode[];
  minAmount: number;
  maxAmount: number;
  mode?: PaymentChannelMode;
  senderIdentifierType?: PaymentSenderIdentifierType;
  isLegalVerified?: boolean;
}

export interface ApproveChannelChangeDto {
  approved: boolean;
  financeNotes?: string;
}

// ----------------------------------------------------
// PHASE 07: DAILY CLOSE, OWNER EARNINGS & PAYOUTS
// ----------------------------------------------------
export interface CurrencyCloseMetrics {
  currency: CurrencyCode;
  totalOrdersCount: number;
  completedOrdersCount: number;
  failedOrdersCount: number;
  pendingOrdersCount: number;
  grossSales: number;
  supplierCost: number;
  channelFees: number;
  estimatedProfit: number;
  realizedProfit: number;
  totalDepositsAmount: number;
  totalPayoutsAmount: number;
  customerWalletLiabilities: number;
  supplierPayables: number;
  operatingReserve: number;
  actualCashBalance: number;
  withdrawableLiquidity: number;
}

export interface CreateDailyCloseDto {
  closeDate: string; // YYYY-MM-DD
  notes?: string;
  forcePreliminary?: boolean;
}

export interface DailyCloseSnapshot {
  id: string;
  closeDate: string; // YYYY-MM-DD
  status: DailyCloseStatus;
  metricsByCurrency: Record<CurrencyCode, CurrencyCloseMetrics>;
  isImmutable: boolean;
  closedByUserId?: string;
  closedAt: string;
  adjustments?: DailyCloseAdjustmentDto[];
}

export interface DailyCloseAdjustmentDto {
  id: string;
  reportId: string;
  currency: CurrencyCode;
  adjustmentType: string;
  amount: number;
  reason: string;
  ledgerTxId?: string;
  approvedByUserId?: string;
  createdAt: string;
}

export interface CreatePayoutBeneficiaryDto {
  beneficiaryName: string;
  channelCode: PaymentChannelCode;
  accountNumber: string;
  notes?: string;
}

export interface PayoutBeneficiaryDto {
  id: string;
  userId: string;
  beneficiaryName: string;
  channelCode: PaymentChannelCode;
  accountNumber: string;
  verificationStatus: BeneficiaryVerificationStatus;
  isVerified: boolean;
  financeApprovedBy?: string;
  createdAt: string;
}

export interface OwnerPayoutRequestDto {
  beneficiaryId: string;
  currency: CurrencyCode;
  amount: number;
  totpCode: string;
  idempotencyKey: string;
  notes?: string;
}

export interface ApproveOwnerPayoutDto {
  approved: boolean;
  financeNotes?: string;
  externalProofRef?: string;
}

// ----------------------------------------------------
// Phase 08 Types: Support Tickets & Notifications
// ----------------------------------------------------

export interface CreateSupportTicketDto {
  category: TicketCategory;
  priority?: TicketPriority;
  subject: string;
  description: string;
  orderId?: string;
  depositId?: string;
  idempotencyKey?: string;
}

export interface AddTicketMessageDto {
  message: string;
  attachments?: string[];
  isInternalNote?: boolean;
  idempotencyKey?: string;
}

export interface UpdateTicketStatusDto {
  status: TicketStatus;
  resolutionNotes?: string;
}

export interface ResolveDisputeRefundDto {
  approved: boolean;
  refundAmount?: number;
  reason: string;
  notes?: string;
}

export interface TicketMessageDto {
  id: string;
  ticketId: string;
  senderUserId: string;
  senderRole: UserRole;
  senderName?: string;
  message: string;
  attachments?: string[];
  isInternalNote: boolean;
  createdAt: string;
}

export interface SupportTicketDto {
  id: string;
  ticketNumber: string;
  userId: string;
  customerName?: string;
  customerPhone?: string;
  category: TicketCategory;
  priority: TicketPriority;
  status: TicketStatus;
  subject: string;
  description: string;
  orderId?: string;
  depositId?: string;
  assignedToUserId?: string;
  assignedAgentName?: string;
  messagesCount: number;
  messages?: TicketMessageDto[];
  resolvedAt?: string;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationDto {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  data?: Record<string, any>;
  status: NotificationStatus;
  channel: NotificationChannel;
  createdAt: string;
  readAt?: string;
}

// ----------------------------------------------------
// Phase 09: Security, Anti-Fraud & Privacy Interfaces
// ----------------------------------------------------

export interface FreezeWalletDto {
  reason: string;
  durationHours?: number;
  notes?: string;
}

export interface UnfreezeWalletDto {
  reason: string;
}

export interface SecurityIncidentDto {
  id: string;
  type: SecurityIncidentType;
  severity: FraudRiskLevel;
  targetEntity?: string;
  targetEntityId?: string;
  userId?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  createdAt: string;
}

export interface UserDataExportDto {
  exportDate: string;
  user: {
    id: string;
    fullName: string;
    email?: string | null;
    phone?: string | null;
    role: string;
    isVerified: boolean;
    createdAt: string;
  };
  wallets: Array<{
    id: string;
    currency: CurrencyCode;
    balance: number;
    lockedBalance: number;
    isFrozen: boolean;
    frozenReason?: string | null;
  }>;
  orders: any[];
  deposits: any[];
  payouts: any[];
  supportTickets: any[];
  consents: any[];
}

export interface AccountDeletionRequestDto {
  confirmPhrase: string; // e.g. "CONFIRM_DELETE"
  reason?: string;
}

export interface AccountDeletionResultDto {
  success: boolean;
  message: string;
  anonymizedUserId: string;
  preservedLedgerRecordsCount: number;
}

export interface PurgeTokensResultDto {
  purgedSessionsCount: number;
  purgedTokensCount: number;
  timestamp: string;
}

// ----------------------------------------------------
// Phase 10 Interfaces: Health, Monitoring, Alerts & DR
// ----------------------------------------------------

export interface SystemServiceHealth {
  status: HealthStatus;
  latencyMs: number;
  activeConnections?: number;
  activeLocks?: number;
  details?: string;
}

export interface SystemHealthStatus {
  status: HealthStatus;
  timestamp: string;
  uptimeSeconds: number;
  environment: string;
  version: string;
  services: {
    database: SystemServiceHealth;
    redis: { status: HealthStatus; latencyMs: number; details?: string };
    queue: { status: HealthStatus; pendingJobs: number; lagSeconds: number; details?: string };
    memory: { status: HealthStatus; heapUsedMb: number; heapTotalMb: number; rssMb: number };
  };
}

export interface SystemTelemetryMetrics {
  timestamp: string;
  uptimeSeconds: number;
  http: {
    totalRequests: number;
    success2xx: number;
    clientErrors4xx: number;
    serverErrors5xx: number;
    errorRatePercent: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
  };
  operations: {
    activeDbLocks: number;
    queueLagSeconds: number;
    depositMismatchesCount: number;
    unknownProviderOrdersCount: number;
    payoutFailuresCount: number;
    unbalancedLedgerTransactionsCount: number;
  };
  reconciliation: {
    lastReconciledAt?: string;
    status: string;
    dailyVarianceYER: number;
    dailyVarianceUSD: number;
    dailyVarianceSAR: number;
    pendingAlertsCount: number;
  };
}

export interface SystemAlertDto {
  id: string;
  type: SystemAlertType;
  severity: SystemAlertSeverity;
  title: string;
  message: string;
  source: string;
  metrics?: Record<string, any>;
  escalationLevel: string; // 'DUTY_ENGINEER' | 'FINANCE_MANAGER' | 'GENERAL_MANAGER'
  isResolved: boolean;
  createdAt: string;
  resolvedAt?: string;
}

export interface BackupRecordDto {
  id: string;
  fileName: string;
  sizeBytes: number;
  checksumSha256: string;
  status: BackupStatus;
  environment: string;
  tablesIncluded: string[];
  recordsCount: number;
  durationSeconds: number;
  rtoSecondsTarget?: number;
  rpoSecondsTarget?: number;
  verifiedAt?: string;
  verificationNotes?: string;
  createdAt: string;
}

export interface DisasterRecoveryDrillResultDto {
  drillId: string;
  environment: string;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  rtoTargetSeconds: number; // target: 1800 (30m)
  rpoTargetSeconds: number; // target: 300 (5m)
  rtoAchieved: boolean;
  rpoAchieved: boolean;
  ledgerBalanceBefore: { debitSum: number; creditSum: number };
  ledgerBalanceAfter: { debitSum: number; creditSum: number };
  isBalanceConserved: boolean;
  dataIntegrityVerified: boolean;
  signature: string;
}

export interface OutageSimulationConfigDto {
  serviceTarget: 'PAYMENT_GATEWAY' | 'FULFILLMENT_PROVIDER' | 'SMS_GATEWAY' | 'BACKGROUND_WORKER';
  simulationMode: 'SAFE_FAILOVER' | 'MOCK_TIMEOUT' | 'DISCONNECT';
  expectedState: 'UNKNOWN' | 'MANUAL_REVIEW' | 'BLOCKED_EXTERNAL';
}

// ----------------------------------------------------
// Phase 11 Interfaces: Pilot Rollout & Go/No-Go Decision Gate (AT-21)
// ----------------------------------------------------

export interface PilotConfigurationDto {
  id: string;
  isPilotActive: boolean;
  maxOrderAmountYER: number;
  maxOrderAmountUSD: number;
  maxDailyWalletLimitYER: number;
  allowedProductIds: string[];
  allowedChannelCodes: PaymentChannelCode[];
  cohortType: PilotCohortType;
  whitelistedUserIds: string[];
  goNoGoDecision: PilotDecisionGateStatus;
  approvedBy?: string;
  approvedAt?: string;
  launchNotes?: string;
  updatedAt: string;
}

export interface PilotVerificationCycleResultDto {
  cycleId: string;
  cycleName: string;
  timestamp: string;
  currency: CurrencyCode;
  amount: number;
  depositTxId: string;
  walletCreditEntryId: string;
  orderId: string;
  fulfillmentStatus: OrderStatus;
  externalProviderRef: string;
  supplierSettlementTxId: string;
  dailyCloseReportId: string;
  payoutRequestId?: string;
  ledgerBalanceProof: {
    totalDebits: number;
    totalCredits: number;
    isBalanced: boolean;
  };
  bankProofMatched: boolean;
  providerProofMatched: boolean;
  reconciliationDiscrepancies: number;
  overallStatus: 'PASSED' | 'FAILED' | 'WARNING';
  notes: string;
}

export interface GoNoGoAssessmentResultDto {
  decision: PilotDecisionGateStatus;
  assessedAt: string;
  version: string;
  gateChecks: {
    doubleEntryLedgerBalanced: boolean;
    securitySecretsAuditPassed: boolean;
    reconciliationZeroMismatch: boolean;
    emergencyKillSwitchReady: boolean;
    disasterRecoveryVerified: boolean;
    at21PilotCyclePassed: boolean;
    nfrPerformanceWithinSLO: boolean;
  };
  signOffs: {
    technicalLead: { approved: boolean; name: string; signedAt?: string };
    financeController: { approved: boolean; name: string; signedAt?: string };
    generalManager: { approved: boolean; name: string; signedAt?: string };
  };
  blockers: string[];
  summary: string;
}

// ----------------------------------------------------
// Phase 12 Interfaces: Operations Handover, Runbooks & KPIs
// ----------------------------------------------------

export interface RunbookItemDto {
  id: string;
  code: string;
  category: RunbookCategory;
  titleAr: string;
  descriptionAr: string;
  triggerConditionAr: string;
  immediateStepsAr: string[];
  escalationRole: string;
  verificationCheckAr: string;
  targetSlaMinutes: number;
}

export interface OperationalKpiDashboardDto {
  timestamp: string;
  providerFulfillmentSuccessRate: number;
  refundRatePercent: number;
  reconciliationMismatchesCount: number;
  reconciliationMismatchesAmountYER: number;
  supportSlaAvgResponseMinutes: number;
  detectedFraudBlockedCount: number;
  averageGrossMarginPercent: number;
  dailyCompletedOrdersCount: number;
  dailyTradingVolumeYER: number;
  uptimeSlaPercent: number;
}

export interface OperationalDrillResultDto {
  drillId: string;
  drillType: 'SUPPORT_FAILED_ORDER_DIAGNOSIS' | 'NEW_STAFF_DAILY_CLOSE' | 'HISTORICAL_RECONCILIATION_AUDIT';
  title: string;
  executedBy: string;
  timestamp: string;
  status: 'PASSED' | 'FAILED';
  simulatedOrderOrReportId: string;
  stepsCompleted: string[];
  auditIntegrityVerified: boolean;
  durationSeconds: number;
  notes: string;
}

export interface HandoverSignOffPackageDto {
  packageId: string;
  version: string;
  status: HandoverStatus;
  handedOverAt?: string;
  repositoriesDelivered: {
    backendApi: string;
    webAdmin: string;
    webCustomer: string;
    databaseMigrations: string;
    docsAndRunbooks: string;
  };
  signOffs: {
    technicalLead: { signed: boolean; name: string; signedAt?: string; notes?: string };
    financeController: { signed: boolean; name: string; signedAt?: string; notes?: string };
    supportLead: { signed: boolean; name: string; signedAt?: string; notes?: string };
    operationsManager: { signed: boolean; name: string; signedAt?: string; notes?: string };
    projectOwner: { signed: boolean; name: string; signedAt?: string; notes?: string };
  };
  checklistCompletedCount: number;
  totalChecklistItems: number;
}

// ----------------------------------------------------
// Phase 13 Interfaces: SaaS Multi-Tenant & Subscription Management (Super Admin)
// ----------------------------------------------------

export interface SaaSFeatureItem {
  key: string;
  name: string;
  nameAr: string;
  included: boolean; // Always true across all tiers (equal permissions invariant)
  descriptionAr: string;
}

export interface SaaSPlanDto {
  id: string;
  name: string;
  nameAr: string;
  billingCycle: SaaSBillingCycle;
  durationDays: number;
  priceUsd: number;
  priceYer: number;
  priceSar: number;
  hasFullPermissions: boolean; // true - all tiers have 100% equal capabilities
  descriptionAr: string;
  features: SaaSFeatureItem[];
  isActive: boolean;
  sortOrder: number;
  activeSubscribersCount?: number;
}

export interface SaaSTenantDto {
  id: string;
  name: string;
  slug: string;
  domain?: string;
  customDomain?: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  status: SaaSTenantStatus;
  licenseKey: string;
  notes?: string;
  currentSubscription?: SaaSSubscriptionDto;
  createdAt: string;
  updatedAt: string;
}

export interface SaaSSubscriptionDto {
  id: string;
  tenantId: string;
  tenantName?: string;
  planId: string;
  planName?: string;
  billingCycle: SaaSBillingCycle;
  pricePaid: number;
  currency: CurrencyCode;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  status: SaaSSubscriptionStatus;
  daysRemaining: number;
  lastRenewalDate?: string;
  createdAt: string;
}

export interface SaaSInvoiceDto {
  id: string;
  invoiceNumber: string;
  tenantId: string;
  tenantName?: string;
  subscriptionId?: string;
  amount: number;
  currency: CurrencyCode;
  status: SaaSInvoiceStatus;
  billingCycle: SaaSBillingCycle;
  paymentMethod?: string;
  referenceNumber?: string;
  paidAt?: string;
  dueDate: string;
  createdAt: string;
}

export interface SaaSKpiDashboardDto {
  timestamp: string;
  totalTenantsCount: number;
  activeSubscribersCount: number;
  monthlyRecurringRevenueUsd: number;
  annualRunRateUsd: number;
  weeklySubscriptionsCount: number;
  monthlySubscriptionsCount: number;
  annualSubscriptionsCount: number;
  expiredSubscriptionsCount: number;
  pendingInvoicesAmountUsd: number;
  retentionRatePercent: number;
  equalPermissionsPolicyEnforced: boolean; // Confirms invariant that all tiers have identical permissions
}

export interface SaaSPermissionsAuditDto {
  verifiedAt: string;
  invariantPassed: boolean;
  policyDeclaration: string;
  tiersEvaluated: Array<{
    billingCycle: SaaSBillingCycle;
    priceUsd: number;
    priceYer: number;
    permissionsCount: number;
    allModulesAccessible: boolean;
  }>;
}

// ----------------------------------------------------
// Stage 11 Interfaces: Encrypted Local PIN Vault Engine
// ----------------------------------------------------

export interface PinVaultItemDto {
  pinCode: string;
  serialNumber?: string;
  batchNumber?: string;
  expiresAt?: string;
}

export interface ImportPinsBatchRequest {
  productId: string;
  pins: PinVaultItemDto[];
}

export interface ImportPinsBatchResponse {
  success: boolean;
  importedCount: number;
  productId: string;
  batchNumber?: string;
  failedCount?: number;
}

export interface DispensedPinResult {
  id: string;
  pinCode: string;
  serialNumber?: string | null;
  expiresAt?: string | null;
}

export interface ProductInventorySummary {
  productId: string;
  productName: string;
  productNameAr?: string;
  sku: string;
  availableCount: number;
  reservedCount: number;
  soldCount: number;
  totalCount: number;
  isLowStock: boolean;
  lowStockThreshold: number;
}

export interface LowStockAlertItem {
  productId: string;
  productName: string;
  sku: string;
  availableCount: number;
  threshold: number;
  alertedAt: string;
}



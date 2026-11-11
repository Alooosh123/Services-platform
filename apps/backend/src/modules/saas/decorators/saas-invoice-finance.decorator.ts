import { SetMetadata } from '@nestjs/common';

export const SAAS_INVOICE_FINANCE_ACCESS_KEY = 'saasInvoiceFinanceAccess';

/**
 * Marks the one SaaS operation where a Finance Manager may inspect/update
 * cross-tenant SaaS billing records after explicit role authorization.
 */
export const SaaSInvoiceFinanceAccess = () =>
  SetMetadata(SAAS_INVOICE_FINANCE_ACCESS_KEY, true);

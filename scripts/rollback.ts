/**
 * Phase 10: Safe Rollback Execution and Verification Script
 * P10 Requirement 3 & AR-16: Automated rollback without dropping or corrupting financial data.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('===============================================================');
  console.log('🛡️ Starting release health and ledger diagnostic (no deployment action)...');
  console.log('===============================================================');

  // Deployment rollback must be performed by the deployment platform.
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('✅ Database connectivity: RESPONSIVE');
  } catch (err: any) {
    console.error(`❌ Database connectivity FAILED: ${err.message}`);
    process.exitCode = 2;
    return;
  }

  let totals: any[];
  try {
    totals = await prisma.$queryRaw`
      SELECT
        COALESCE(SUM("debitAmount"), 0)::float as "debitSum",
        COALESCE(SUM("creditAmount"), 0)::float as "creditSum"
      FROM "ledger_entries";
    `;
  } catch (err: any) {
    console.error(`❌ Ledger integrity check FAILED: ${err.message}`);
    process.exitCode = 2;
    return;
  }

  const debitSum = totals[0]?.debitSum || 0;
  const creditSum = totals[0]?.creditSum || 0;
  const variance = Math.abs(debitSum - creditSum);

  console.log(`   Ledger Debit:  ${debitSum}`);
  console.log(`   Ledger Credit: ${creditSum}`);
  console.log(`   Variance:      ${variance}`);

  const isLedgerBalanced = variance < 0.0001;

  if (!isLedgerBalanced) {
    console.error('❌ Ledger is unbalanced. No rollback was attempted; escalate and use the deployment platform.');
    process.exitCode = 2;
    return;
  }

  console.log('===============================================================');
  console.log('✅ Connectivity and ledger checks passed. This diagnostic did not perform a rollback.');
  console.log('A deployment rollback must be explicitly executed by the configured deployment platform.');
  console.log('===============================================================');
}

main()
  .catch((e) => {
    console.error('Rollback script error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

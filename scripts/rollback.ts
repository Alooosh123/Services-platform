import { Prisma, PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Release health diagnostic (read-only; no deployment rollback is attempted).');
  await prisma.$queryRaw`SELECT 1`;
  const totals = await prisma.ledgerEntry.groupBy({
    by: ['currency'],
    _sum: { debitAmount: true, creditAmount: true },
  });
  let healthy = true;
  for (const row of totals) {
    const debit = row._sum.debitAmount ?? new Prisma.Decimal(0);
    const credit = row._sum.creditAmount ?? new Prisma.Decimal(0);
    const variance = debit.minus(credit).abs();
    console.log(`${row.currency}: debit=${debit.toString()} credit=${credit.toString()} variance=${variance.toString()}`);
    if (variance.greaterThan(new Prisma.Decimal('0.0001'))) healthy = false;
  }
  if (!healthy) {
    console.error('Ledger imbalance detected. Stop release and escalate to finance; no data has been changed.');
    process.exitCode = 2;
    return;
  }
  console.log('Database connection and per-currency double-entry totals are balanced.');
  console.log('This command is a diagnostic only. Deployment rollback must be executed by the deployment platform.');
}

main().catch((error: unknown) => {
  console.error('Release health diagnostic failed:', error instanceof Error ? error.message : error);
  process.exitCode = 2;
}).finally(async () => {
  await prisma.$disconnect();
});

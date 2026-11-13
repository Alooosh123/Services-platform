CREATE TYPE "AgentPricingMode" AS ENUM ('PERCENTAGE', 'CUSTOM_PRICE');

ALTER TABLE "users"
ADD COLUMN "agentPricingMode" "AgentPricingMode" NOT NULL DEFAULT 'PERCENTAGE',
ADD COLUMN "parentAgentCommissionPercent" DECIMAL(7,4) NOT NULL DEFAULT 0.0000;

ALTER TABLE "orders"
ADD COLUMN "agentParentUserId" TEXT,
ADD COLUMN "agentCommissionAmount" DECIMAL(18,4) NOT NULL DEFAULT 0.0000;

CREATE TABLE "agent_product_prices" (
    "id" TEXT NOT NULL,
    "subAgentUserId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "currency" "CurrencyCode" NOT NULL,
    "retailPrice" DECIMAL(18,4) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_product_prices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "agent_product_prices_subAgentUserId_productId_currency_key"
ON "agent_product_prices"("subAgentUserId", "productId", "currency");

CREATE INDEX "agent_product_prices_productId_isActive_idx"
ON "agent_product_prices"("productId", "isActive");

CREATE INDEX "orders_agentParentUserId_idx" ON "orders"("agentParentUserId");

ALTER TABLE "agent_product_prices"
ADD CONSTRAINT "agent_product_prices_subAgentUserId_fkey"
FOREIGN KEY ("subAgentUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "agent_product_prices"
ADD CONSTRAINT "agent_product_prices_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "orders"
ADD CONSTRAINT "orders_agentParentUserId_fkey"
FOREIGN KEY ("agentParentUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

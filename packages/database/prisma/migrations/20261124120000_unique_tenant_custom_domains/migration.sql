-- A custom storefront domain must resolve to one tenant only.
CREATE UNIQUE INDEX "saas_tenants_customDomain_key"
  ON "saas_tenants"("customDomain");

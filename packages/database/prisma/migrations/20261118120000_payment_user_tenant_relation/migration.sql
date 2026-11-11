-- Link payment rows to their owner so request-scoped tenant filters can protect them.
ALTER TABLE "payments"
  ADD CONSTRAINT "payments_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

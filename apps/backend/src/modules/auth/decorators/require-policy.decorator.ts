import { SetMetadata } from '@nestjs/common';

export const REQUIRED_POLICY_KEY = 'required_policy';
export type PolicyAction = 'orders:create' | 'wallet:exchange';

export const RequirePolicy = (policy: PolicyAction) => SetMetadata(REQUIRED_POLICY_KEY, policy);

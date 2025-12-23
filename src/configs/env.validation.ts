import { z } from 'zod';

/**
 * Custom boolean schema that properly handles string values 'true' and 'false'
 */
const booleanSchema = z.preprocess((val) => {
  if (typeof val === 'string') {
    const lower = val.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;
    return val;
  }
  return val;
}, z.boolean());

/**
 * Preprocesses environment variables to handle edge cases:
 * - Empty strings converted to null for nullable fields
 * - Empty strings converted to undefined for optional fields
 */
function preprocessEnv(env: Record<string, unknown>): Record<string, unknown> {
  const processed = { ...env };

  const nullableFields = new Set([
    'RELAY_WS_URL',
    'RELAY_AUTH_KEY',
    'NEAR_NETWORK_ID',
    'NEAR_NODE_URL',
    'NEAR_NODE_URLS',
  ]);

  const optionalFields = new Set([
    'SOLVER_REGISTRY_CONTRACT',
    'SOLVER_POOL_ID',
    'NEAR_ACCOUNT_ID',
    'NEAR_PRIVATE_KEY',
    'MARGIN_PERCENT',
  ]);

  for (const [key, value] of Object.entries(processed)) {
    if (value === '') {
      if (nullableFields.has(key)) {
        processed[key] = null;
      } else if (optionalFields.has(key)) {
        processed[key] = undefined;
      }
    }
  }

  return processed;
}

/**
 * Base schema defining all environment variables with their types and defaults.
 * Conditional validation is applied via superRefine.
 */
const baseEnvSchema = z
  .object({
    APP_PORT: z.coerce.number().default(3000),

    LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

    RELAY_WS_URL: z.string().nullable().default(null),
    RELAY_AUTH_KEY: z.string().nullable().default(null),

    TEE_ENABLED: booleanSchema.default(false),

    SOLVER_REGISTRY_CONTRACT: z.string().optional(),
    SOLVER_POOL_ID: z.coerce.number().int().optional(),

    NEAR_ACCOUNT_ID: z.string().optional(),
    NEAR_PRIVATE_KEY: z.string().optional(),

    NEAR_NETWORK_ID: z.enum(['mainnet', 'testnet']).nullable().default(null),
    NEAR_NODE_URL: z.string().nullable().default(null),
    NEAR_NODE_URLS: z.string().nullable().default(null),

    AMM_TOKEN1_ID: z.string().min(1, 'AMM_TOKEN1_ID is required'),
    AMM_TOKEN2_ID: z.string().min(1, 'AMM_TOKEN2_ID is required'),

    MARGIN_PERCENT: z.coerce.number().positive().optional(),
  })
  .passthrough();

/**
 * Environment validation schema with conditional logic based on TEE_ENABLED.
 *
 * When TEE_ENABLED is true:
 * - SOLVER_REGISTRY_CONTRACT, SOLVER_POOL_ID, MARGIN_PERCENT are required
 *
 * When TEE_ENABLED is false:
 * - NEAR_ACCOUNT_ID, NEAR_PRIVATE_KEY are required
 * - MARGIN_PERCENT defaults to 0.3
 */
export const envVariablesValidationSchema = baseEnvSchema
  .superRefine((data, ctx) => {
    if (data.TEE_ENABLED) {
      // TEE mode validation
      if (
        !data.SOLVER_REGISTRY_CONTRACT ||
        data.SOLVER_REGISTRY_CONTRACT.trim() === ''
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SOLVER_REGISTRY_CONTRACT'],
          message:
            'SOLVER_REGISTRY_CONTRACT is required when TEE_ENABLED is true',
        });
      }

      if (data.SOLVER_POOL_ID === undefined || data.SOLVER_POOL_ID === null) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['SOLVER_POOL_ID'],
          message: 'SOLVER_POOL_ID is required when TEE_ENABLED is true',
        });
      }

      if (!data.MARGIN_PERCENT) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['MARGIN_PERCENT'],
          message: 'MARGIN_PERCENT is required when TEE_ENABLED is true',
        });
      }
    } else {
      // Non-TEE mode validation
      if (!data.NEAR_ACCOUNT_ID || data.NEAR_ACCOUNT_ID.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NEAR_ACCOUNT_ID'],
          message: 'NEAR_ACCOUNT_ID is required when TEE_ENABLED is false',
        });
      }

      if (!data.NEAR_PRIVATE_KEY || data.NEAR_PRIVATE_KEY.trim() === '') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['NEAR_PRIVATE_KEY'],
          message: 'NEAR_PRIVATE_KEY is required when TEE_ENABLED is false',
        });
      }
    }
  })
  .transform((data) => {
    // Apply MARGIN_PERCENT default for non-TEE mode after validation
    if (!data.TEE_ENABLED && data.MARGIN_PERCENT === undefined) {
      return { ...data, MARGIN_PERCENT: 0.3 };
    }
    return data;
  });

/**
 * TypeScript type inferred from the validated schema.
 * Use this type for type-safe access to environment variables.
 */
export type EnvVariables = z.infer<typeof envVariablesValidationSchema>;

export { preprocessEnv };

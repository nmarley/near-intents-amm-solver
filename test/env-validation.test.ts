import { describe, expect, test } from 'bun:test';
import {
  envVariablesValidationSchema,
  preprocessEnv,
} from '../src/configs/env.validation';

describe('Environment Validation', () => {
  describe('Basic field validation', () => {
    test('should validate with all required fields', () => {
      const validEnv = {
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(validEnv),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.APP_PORT).toBe(3000);
        expect(result.data.LOG_LEVEL).toBe('info');
        expect(result.data.MARGIN_PERCENT).toBe(0.3);
      }
    });

    test('should apply defaults correctly', () => {
      const minimalEnv = {
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(minimalEnv),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.APP_PORT).toBe(3000);
        expect(result.data.LOG_LEVEL).toBe('info');
        expect(result.data.TEE_ENABLED).toBe(false);
      }
    });

    test('should fail when required AMM_TOKEN fields are missing', () => {
      const invalidEnv = {
        TEE_ENABLED: 'false',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(invalidEnv),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPaths = result.error.issues.map((e) => e.path[0]);
        expect(errorPaths).toContain('AMM_TOKEN1_ID');
        expect(errorPaths).toContain('AMM_TOKEN2_ID');
      }
    });

    test('should fail when non-TEE required fields are missing', () => {
      const invalidEnv = {
        TEE_ENABLED: 'false',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(invalidEnv),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPaths = result.error.issues.map((e) => e.path[0]);
        expect(errorPaths).toContain('NEAR_ACCOUNT_ID');
        expect(errorPaths).toContain('NEAR_PRIVATE_KEY');
      }
    });
  });

  describe('TEE mode validation', () => {
    test('should require TEE-specific fields when TEE_ENABLED is true', () => {
      const teeEnv = {
        TEE_ENABLED: 'true',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(teeEnv),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPaths = result.error.issues.map((e) => e.path[0]);
        expect(errorPaths).toContain('SOLVER_REGISTRY_CONTRACT');
        expect(errorPaths).toContain('SOLVER_POOL_ID');
        expect(errorPaths).toContain('MARGIN_PERCENT');
      }
    });

    test('should validate successfully with all TEE fields', () => {
      const teeEnv = {
        TEE_ENABLED: 'true',
        SOLVER_REGISTRY_CONTRACT: 'registry.near',
        SOLVER_POOL_ID: '0',
        MARGIN_PERCENT: '0.5',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(teeEnv),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.SOLVER_POOL_ID).toBe(0);
        expect(result.data.MARGIN_PERCENT).toBe(0.5);
        expect(result.data.TEE_ENABLED).toBe(true);
      }
    });

    test('should not require non-TEE fields when TEE_ENABLED is true', () => {
      const teeEnv = {
        TEE_ENABLED: 'true',
        SOLVER_REGISTRY_CONTRACT: 'registry.near',
        SOLVER_POOL_ID: '1',
        MARGIN_PERCENT: '1.0',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(teeEnv),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Non-TEE mode validation', () => {
    test('should require non-TEE fields when TEE_ENABLED is false', () => {
      const nonTeeEnv = {
        TEE_ENABLED: 'false',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(nonTeeEnv),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const errorPaths = result.error.issues.map((e) => e.path[0]);
        expect(errorPaths).toContain('NEAR_ACCOUNT_ID');
        expect(errorPaths).toContain('NEAR_PRIVATE_KEY');
      }
    });

    test('should apply default MARGIN_PERCENT in non-TEE mode', () => {
      const nonTeeEnv = {
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(nonTeeEnv),
      );
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.MARGIN_PERCENT).toBe(0.3);
      }
    });

    test('should not require TEE fields when TEE_ENABLED is false', () => {
      const nonTeeEnv = {
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(nonTeeEnv),
      );
      expect(result.success).toBe(true);
    });
  });

  describe('Type coercion', () => {
    test('should coerce string numbers to numbers', () => {
      const env = {
        APP_PORT: '8080',
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
        MARGIN_PERCENT: '1.5',
      };

      const result = envVariablesValidationSchema.safeParse(preprocessEnv(env));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.APP_PORT).toBe(8080);
        expect(typeof result.data.APP_PORT).toBe('number');
        expect(result.data.MARGIN_PERCENT).toBe(1.5);
        expect(typeof result.data.MARGIN_PERCENT).toBe('number');
      }
    });

    test('should coerce string booleans to booleans', () => {
      const env = {
        TEE_ENABLED: 'true',
        SOLVER_REGISTRY_CONTRACT: 'registry.near',
        SOLVER_POOL_ID: '1',
        MARGIN_PERCENT: '0.5',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(preprocessEnv(env));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.TEE_ENABLED).toBe(true);
        expect(typeof result.data.TEE_ENABLED).toBe('boolean');
      }
    });

    test('should handle default TEE_ENABLED value', () => {
      const env = {
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(preprocessEnv(env));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.TEE_ENABLED).toBe(false);
        expect(typeof result.data.TEE_ENABLED).toBe('boolean');
      }
    });
  });

  describe('Enum validation', () => {
    test('should validate LOG_LEVEL enum', () => {
      const validLevels = ['error', 'warn', 'info', 'debug'];

      for (const level of validLevels) {
        const env = {
          LOG_LEVEL: level,
          TEE_ENABLED: 'false',
          NEAR_ACCOUNT_ID: 'test.near',
          NEAR_PRIVATE_KEY: 'ed25519:test',
          AMM_TOKEN1_ID: 'token1.near',
          AMM_TOKEN2_ID: 'token2.near',
        };

        const result = envVariablesValidationSchema.safeParse(
          preprocessEnv(env),
        );
        expect(result.success).toBe(true);
      }
    });

    test('should reject invalid LOG_LEVEL', () => {
      const env = {
        LOG_LEVEL: 'invalid',
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(preprocessEnv(env));
      expect(result.success).toBe(false);
    });

    test('should validate NEAR_NETWORK_ID enum', () => {
      const validNetworks = ['mainnet', 'testnet'];

      for (const network of validNetworks) {
        const env = {
          NEAR_NETWORK_ID: network,
          TEE_ENABLED: 'false',
          NEAR_ACCOUNT_ID: 'test.near',
          NEAR_PRIVATE_KEY: 'ed25519:test',
          AMM_TOKEN1_ID: 'token1.near',
          AMM_TOKEN2_ID: 'token2.near',
        };

        const result = envVariablesValidationSchema.safeParse(
          preprocessEnv(env),
        );
        expect(result.success).toBe(true);
      }
    });

    test('should reject invalid NEAR_NETWORK_ID', () => {
      const env = {
        NEAR_NETWORK_ID: 'invalid',
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(preprocessEnv(env));
      expect(result.success).toBe(false);
    });
  });

  describe('Nullable fields', () => {
    test('should allow empty strings for nullable fields', () => {
      const env = {
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
        RELAY_WS_URL: '',
        RELAY_AUTH_KEY: '',
        NEAR_NODE_URL: '',
      };

      const result = envVariablesValidationSchema.safeParse(preprocessEnv(env));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.RELAY_WS_URL).toBeNull();
        expect(result.data.RELAY_AUTH_KEY).toBeNull();
        expect(result.data.NEAR_NODE_URL).toBeNull();
      }
    });

    test('should allow nullable fields to be null', () => {
      const env = {
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
        RELAY_WS_URL: null,
        NEAR_NETWORK_ID: null,
      };

      const result = envVariablesValidationSchema.safeParse(preprocessEnv(env));
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.RELAY_WS_URL).toBeNull();
        expect(result.data.NEAR_NETWORK_ID).toBeNull();
      }
    });
  });

  describe('Unknown fields', () => {
    test('should allow unknown environment variables', () => {
      const env = {
        TEE_ENABLED: 'false',
        NEAR_ACCOUNT_ID: 'test.near',
        NEAR_PRIVATE_KEY: 'ed25519:test',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
        SOME_RANDOM_VAR: 'value',
        ANOTHER_VAR: '123',
      };

      const result = envVariablesValidationSchema.safeParse(preprocessEnv(env));
      expect(result.success).toBe(true);
    });
  });

  describe('Error messages', () => {
    test('should provide clear error messages for multiple failures', () => {
      const invalidEnv = {
        LOG_LEVEL: 'invalid',
        TEE_ENABLED: 'false',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(invalidEnv),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.length).toBeGreaterThan(0);
        const errorPaths = result.error.issues.map((e) => e.path[0]);
        expect(errorPaths.length).toBeGreaterThan(1);
      }
    });

    test('should provide contextual error messages for conditional validation', () => {
      const teeEnv = {
        TEE_ENABLED: 'true',
        AMM_TOKEN1_ID: 'token1.near',
        AMM_TOKEN2_ID: 'token2.near',
      };

      const result = envVariablesValidationSchema.safeParse(
        preprocessEnv(teeEnv),
      );
      expect(result.success).toBe(false);
      if (!result.success) {
        const messages = result.error.issues.map((e) => e.message);
        expect(
          messages.some((msg) => msg.includes('when TEE_ENABLED is true')),
        ).toBe(true);
      }
    });
  });

  describe('Preprocessing', () => {
    test('preprocessEnv should convert empty strings correctly', () => {
      const env = {
        RELAY_WS_URL: '',
        SOLVER_REGISTRY_CONTRACT: '',
        NORMAL_VAR: 'value',
      };

      const processed = preprocessEnv(env);
      expect(processed.RELAY_WS_URL).toBeNull();
      expect(processed.SOLVER_REGISTRY_CONTRACT).toBeUndefined();
      expect(processed.NORMAL_VAR).toBe('value');
    });
  });
});

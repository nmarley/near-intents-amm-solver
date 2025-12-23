import { configDotenv } from 'dotenv';
import { z } from 'zod';
import {
  envVariablesValidationSchema,
  preprocessEnv,
} from '../configs/env.validation';

export function loadEnv() {
  configDotenv({
    path: `./env/${!process.env.NODE_ENV ? '.env.production' : `.env.${process.env.NODE_ENV}`}`,
  });

  try {
    const envVars = envVariablesValidationSchema.parse(
      preprocessEnv(process.env as Record<string, unknown>),
    );

    Object.entries(envVars).forEach(([key, value]) => {
      process.env[key] = `${value}`;
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      const formattedErrors = error.issues
        .map((issue) => {
          const path = issue.path.join('.');
          return `  - ${path}: ${issue.message}`;
        })
        .join('\n');

      throw new Error(`Environment validation failed:\n${formattedErrors}`);
    }
    throw error;
  }
}

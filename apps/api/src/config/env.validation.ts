import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3001),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_EXPIRES_IN: z.string().min(1).default("15m"),
  JWT_ACCESS_SECRET: z.string().min(32),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000")
});

export function validateEnv(config: Record<string, unknown>): Record<string, unknown> {
  return envSchema.parse(config);
}

/**
 * Parsed and validated environment.
 *
 * Fails loudly at startup with the names of the missing variables, rather
 * than letting a missing value surface later as a connection error or an
 * undefined interpolated into a URL.
 *
 * Variables are grouped by the phase that introduces them, matching
 * `docs/dev-plan.md` §4 and `.env.example`. A variable a phase does not need
 * yet is declared optional here and made required when its phase arrives.
 */

import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_TIMEZONE: z.string().min(1).default('America/New_York'),

  // Phase 1 — persistence and admin authentication
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET must be at least 32 characters'),
  APP_URL: z
    .string()
    .url('APP_URL must be an absolute URL')
    .refine((value) => !value.endsWith('/'), 'APP_URL must not end with a trailing slash'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  EMAIL_FROM: z.string().min(1, 'EMAIL_FROM is required'),

  // Phase 3 onward. Optional until the phase that needs them.
  LINK_RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(30),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  PHOTO_SIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().optional(),
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY: z.string().optional(),
  GOOGLE_CALENDAR_ID: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  DIGEST_LOCAL_HOUR: z.coerce.number().int().min(0).max(23).default(7),
})

export type Env = z.infer<typeof schema>

let cached: Env | null = null

/**
 * Read and validate the environment.
 *
 * Not evaluated at module load: importing this file must not throw, or a
 * migration script and a unit test both become impossible to run without a
 * full environment. Call it from the place that needs a value.
 */
export function env(): Env {
  if (cached !== null) return cached

  const parsed = schema.safeParse(process.env)
  if (!parsed.success) {
    const problems = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n')
    throw new Error(`Environment is not valid:\n${problems}\n\nSee .env.example.`)
  }

  cached = parsed.data
  return cached
}

/** Reset the cache. Tests only. */
export function resetEnvCache(): void {
  cached = null
}

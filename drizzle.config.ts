// drizzle-kit runs outside Next.js, which is the only thing that loads .env
// on its own. Without this, DATABASE_URL is undefined and every command fails
// against a connection string of "undefined".
import 'dotenv/config'

import { defineConfig } from 'drizzle-kit'

// Migrations are the only way to change the schema. Never run a push
// command against any database. See AGENTS.md.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DATABASE_URL! },
  strict: true,
  verbose: true,
})

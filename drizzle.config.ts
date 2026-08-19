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

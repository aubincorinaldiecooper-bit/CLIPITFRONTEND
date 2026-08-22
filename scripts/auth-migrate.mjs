/**
 * Creates Better Auth's tables before the app starts, the same way the
 * backend applies its own migrations at boot: idempotent DDL, run every
 * start, no separate deploy step to forget.
 *
 * The shapes mirror Better Auth 1.x's core schema exactly — camelCase column
 * names, quoted, because that is what its queries emit. If better-auth is
 * ever upgraded across a schema change, regenerate this with
 * `npx @better-auth/cli generate` and compare.
 *
 * No DATABASE_URL means sign-in is not configured; the app still starts and
 * runs guest-only rather than refusing to boot over an optional feature.
 */
import { Client } from "pg"

const url = process.env.DATABASE_URL
if (!url) {
  console.log("auth-migrate: DATABASE_URL is not set — sign-in stays off, app runs guest-only")
  process.exit(0)
}

const ddl = `
CREATE TABLE IF NOT EXISTS "user" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL UNIQUE,
  "emailVerified" BOOLEAN NOT NULL,
  "image" TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  "id" TEXT PRIMARY KEY,
  "expiresAt" TIMESTAMP NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "account" (
  "id" TEXT PRIMARY KEY,
  "accountId" TEXT NOT NULL,
  "providerId" TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken" TEXT,
  "refreshToken" TEXT,
  "idToken" TEXT,
  "accessTokenExpiresAt" TIMESTAMP,
  "refreshTokenExpiresAt" TIMESTAMP,
  "scope" TEXT,
  "password" TEXT,
  "createdAt" TIMESTAMP NOT NULL,
  "updatedAt" TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS "verification" (
  "id" TEXT PRIMARY KEY,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP,
  "updatedAt" TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session" ("userId");
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification" ("identifier");
`

const client = new Client({ connectionString: url })
await client.connect()
try {
  await client.query(ddl)
  console.log("auth-migrate: Better Auth tables are ready")
} finally {
  await client.end()
}

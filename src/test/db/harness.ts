import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// An in-process Postgres that mimics the parts of Supabase the migrations rely on:
// the auth schema, auth.uid(), the anon / authenticated / service_role roles and
// Supabase's default table privileges (which grant everything to those roles, so
// migrations must revoke what they do not want to expose).

const MIGRATIONS_DIR = join(process.cwd(), "drizzle", "migrations");

const SUPABASE_STUBS = `
CREATE ROLE anon NOLOGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE service_role NOLOGIN BYPASSRLS;
CREATE SCHEMA auth;
CREATE TABLE auth.users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), email text, email_confirmed_at timestamptz);
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
GRANT SELECT ON auth.users TO service_role;
GRANT EXECUTE ON FUNCTION auth.uid(), auth.jwt() TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
`;

export type Actor = { user: string } | "service" | "anon";

export interface TestDb {
  pg: PGlite;
  /** Insert a user into the auth.users stub and return its id. */
  addUser(email?: string): Promise<string>;
  /** Run one statement as the actor, in its own transaction. Errors propagate. */
  query<T = Record<string, unknown>>(actor: Actor, sql: string, params?: unknown[]): Promise<T[]>;
  /** Run several statements as the actor inside one transaction. */
  transaction<T>(actor: Actor, fn: (run: Run) => Promise<T>): Promise<T>;
  /** Run SQL as the database owner, bypassing every grant and policy (fixtures only). */
  admin<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  close(): Promise<void>;
}

type Run = <T = Record<string, unknown>>(sql: string, params?: unknown[]) => Promise<T[]>;

function actorSql(actor: Actor): string {
  if (actor === "service") return "SET LOCAL ROLE service_role";
  if (actor === "anon") return "SET LOCAL ROLE anon";
  const id = actor.user;
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("actor user id must be a uuid");
  return `SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '${id}', true)`;
}

function migrationFiles(): string[] {
  const journal = JSON.parse(readFileSync(join(MIGRATIONS_DIR, "meta", "_journal.json"), "utf8")) as {
    entries: { tag: string }[];
  };
  return journal.entries.map((entry) => join(MIGRATIONS_DIR, `${entry.tag}.sql`));
}

export async function createDb(options: { migrate?: boolean } = {}): Promise<TestDb> {
  const pg = new PGlite();
  await pg.exec(SUPABASE_STUBS);
  if (options.migrate !== false) {
    for (const file of migrationFiles()) await pg.exec(readFileSync(file, "utf8"));
  }

  async function transaction<T>(actor: Actor, fn: (run: Run) => Promise<T>): Promise<T> {
    return pg.transaction(async (tx) => {
      await tx.exec(actorSql(actor));
      const run: Run = async (sql, params) => (await tx.query(sql, params)).rows as never;
      return fn(run);
    });
  }

  return {
    pg,
    async addUser(email = `user-${Math.random().toString(36).slice(2)}@example.com`) {
      const { rows } = await pg.query<{ id: string }>(
        "INSERT INTO auth.users (email, email_confirmed_at) VALUES ($1, now()) RETURNING id",
        [email],
      );
      return rows[0].id;
    },
    query: (actor, sql, params) => transaction(actor, (run) => run(sql, params)),
    transaction,
    async admin(sql, params) {
      return (await pg.query(sql, params)).rows as never;
    },
    close: () => pg.close(),
  };
}

/** Resolve with the thrown error message, or fail if the promise resolves. */
export async function rejection(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("expected the statement to be rejected, but it succeeded");
}

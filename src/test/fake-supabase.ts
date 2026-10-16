import type { Db } from "@/lib/studio.server";

// A recording stand-in for the Supabase client, used to check the shape of the queries a server module
// builds (which table, filters, columns) and how it maps results. Database rules are tested against real
// SQL in src/test/db instead.

export type Call = { table?: string; fn?: string; args?: unknown[]; steps: [string, unknown[]][] };
type Result = {
  data?: unknown;
  error?: { code?: string; message?: string } | null;
  count?: number | null;
};

export function fakeSupabase(script: (call: Call) => Result | undefined) {
  const calls = [] as unknown as [Call, ...Call[]];
  calls.length = 0;
  const run = (call: Call) => {
    calls.push(call);
    const result = script(call) ?? {};
    return Promise.resolve({
      data: result.data ?? null,
      error: result.error ?? null,
      count: result.count ?? null,
    });
  };
  const builder = (call: Call): unknown =>
    new Proxy(() => undefined, {
      get(_target, property: string) {
        if (property === "then") {
          const promise = run(call);
          return promise.then.bind(promise);
        }
        return (...args: unknown[]) =>
          builder({ ...call, steps: [...call.steps, [property, args]] });
      },
    });
  const client = {
    from: (table: string) => builder({ table, steps: [] }),
    rpc: (fn: string, args?: unknown) => builder({ fn, args: [args], steps: [] }),
  };
  return { client: client as unknown as Db, calls };
}

export const stepsOf = (call: Call, name: string) =>
  call.steps.filter(([step]) => step === name).map(([, args]) => args);

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type Db = SupabaseClient<Database>;
export type StudioContext = { supabase: Db; userId: string };
/** The studio is the owner's account (KTD1): its id is the signed-in user's id. */
export type Studio = StudioContext & { studioId: string };

type ErrorLike = Pick<PostgrestError, "code" | "message"> | { code?: string; message?: string };

/**
 * Turn a database error into something safe to show an owner. Messages raised on purpose by our SQL
 * functions (SQLSTATE P0001) are written for people and pass through; everything else is replaced so no
 * table, column or constraint name leaks.
 */
export function friendlyError(
  error: ErrorLike,
  fallback = "Something went wrong. Please try again.",
): Error {
  switch (error.code) {
    case "P0001":
      return new Error(error.message || fallback);
    case "23505":
      return new Error("That already exists.");
    case "23503":
      return new Error("That record doesn't exist, or belongs to another studio.");
    case "23514":
    case "22P02":
    case "22007":
    case "22008":
      return new Error("One of the values is not allowed.");
    case "42501":
      return new Error("You don't have access to that.");
    default:
      return new Error(fallback);
  }
}

/** Return the data of a Supabase result, or throw a friendly error. */
export function unwrap<T>(
  result: { data: T | null; error: ErrorLike | null },
  fallback?: string,
): T {
  if (result.error) throw friendlyError(result.error, fallback);
  if (result.data === null) throw new Error(fallback ?? "That record was not found.");
  return result.data;
}

/** Make sure the signed-in owner has a studio profile row (created with default plan and billing values). */
export async function ensureStudio(context: StudioContext): Promise<Studio> {
  const { error } = await context.supabase
    .from("studio_profiles")
    .upsert({ user_id: context.userId }, { onConflict: "user_id", ignoreDuplicates: true });
  if (error) throw friendlyError(error, "Could not load your studio.");
  return { ...context, studioId: context.userId };
}

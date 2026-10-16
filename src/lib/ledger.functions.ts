import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generateChargesInput, paymentInput } from "@/lib/schemas";
import { isoDate, uuid, validate, voidReason } from "@/lib/validators";

const voidInput = z.object({ id: uuid, reason: voidReason });
const periodInput = z.object({ period: isoDate });

export const generateCharges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(generateChargesInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/ledger.server")).generateCharges(context, data),
  );

export const recordPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(paymentInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/ledger.server")).recordPayment(context, data),
  );

export const voidCharge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(voidInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/ledger.server")).voidCharge(context, data),
  );

export const voidPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(voidInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/ledger.server")).voidPayment(context, data),
  );

export const getLedgerStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(periodInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/ledger.server")).getLedgerStatus(context, data),
  );

export const getOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(periodInput))
  .handler(async ({ data, context }) =>
    (await import("@/lib/ledger.server")).getOverview(context, data),
  );

export const getStudentLedger = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator(validate(z.object({ studentId: uuid })))
  .handler(async ({ data, context }) =>
    (await import("@/lib/ledger.server")).getStudentLedger(context, data),
  );

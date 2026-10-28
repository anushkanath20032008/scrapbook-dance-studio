import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { validate } from "@/lib/validators";

// Whether the photo option should be shown. Only a yes or no: nothing about the key or the provider.
export const getImportCapabilities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => ({
    photo: (await import("@/lib/photo-import.server")).photoReadingAvailable(),
  }));

// Owner only: the database function that takes the page quota refuses anyone who is not a studio owner.
// The base64 limit is the largest photo the reading service takes (about 5 MB).
export const readDancersFromPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    validate(
      z.object({
        image: z.string().min(1, "Choose a photo").max(6_990_508, "That photo is too large"),
        mediaType: z.enum(["image/jpeg", "image/png", "image/webp"], {
          message: "Use a JPEG, PNG or WebP photo",
        }),
      }),
    ),
  )
  .handler(async ({ data, context }) =>
    (await import("@/lib/photo-import.server")).readDancersFromPhoto(context, data),
  );

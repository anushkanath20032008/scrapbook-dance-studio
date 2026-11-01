-- A reminder reuses one private link per dancer, so the link text it sends has to be recoverable.
-- Only links the studio's own reminders create carry it; links made by hand keep their hash only.
-- Owner-only: the existing row policies on family_links already limit reads to the studio.
ALTER TABLE public.family_links ADD COLUMN IF NOT EXISTS reminder_token text;

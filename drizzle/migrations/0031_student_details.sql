-- More about each dancer, all optional and owner-held: an email, the day they joined, an emergency contact and a
-- short note. Purely additive; the existing owner-only row policies on students already cover the new columns.
-- No health information is collected.

ALTER TABLE public.students
  ADD COLUMN email text CHECK (email IS NULL OR (length(email) <= 200 AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  ADD COLUMN joined_on date,
  ADD COLUMN emergency_name text CHECK (emergency_name IS NULL OR length(emergency_name) <= 120),
  ADD COLUMN emergency_phone text CHECK (emergency_phone IS NULL OR emergency_phone ~ '^\+?[0-9[:space:]-]{10,18}$'),
  ADD COLUMN note text CHECK (note IS NULL OR length(note) <= 500);

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false;

-- Mark existing profiles that have all required fields as completed
UPDATE public.profiles
SET profile_completed = true
WHERE avatar_url IS NOT NULL
  AND phone IS NOT NULL
  AND bio IS NOT NULL
  AND (location IS NOT NULL OR location_city IS NOT NULL);
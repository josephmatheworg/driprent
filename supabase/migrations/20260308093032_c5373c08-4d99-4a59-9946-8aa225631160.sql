
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_city text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_state text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_country text;

-- Migrate existing location data: try to split "city, state, country" format
UPDATE public.profiles 
SET 
  location_city = TRIM(split_part(location, ',', 1)),
  location_state = TRIM(split_part(location, ',', 2)),
  location_country = TRIM(split_part(location, ',', 3))
WHERE location IS NOT NULL AND location != '';

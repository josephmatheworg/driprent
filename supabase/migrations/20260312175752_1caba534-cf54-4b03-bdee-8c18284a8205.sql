
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS latitude double precision DEFAULT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS longitude double precision DEFAULT NULL;

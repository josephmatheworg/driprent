
ALTER TYPE public.rental_status ADD VALUE IF NOT EXISTS 'awaiting_payment';
ALTER TYPE public.rental_status ADD VALUE IF NOT EXISTS 'expired';

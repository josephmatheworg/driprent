-- Add exclusion-like check via trigger to prevent overlapping confirmed/active rentals
CREATE OR REPLACE FUNCTION public.prevent_overlapping_bookings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _overlap_count integer;
BEGIN
  -- Only check when status becomes confirmed or active
  IF NEW.status NOT IN ('confirmed', 'active') THEN
    RETURN NEW;
  END IF;

  -- Check for overlapping confirmed/active rentals on the same fit
  SELECT count(*) INTO _overlap_count
  FROM rentals
  WHERE fit_id = NEW.fit_id
    AND id != NEW.id
    AND status IN ('confirmed', 'active')
    AND start_date <= NEW.end_date
    AND end_date >= NEW.start_date;

  IF _overlap_count > 0 THEN
    RAISE EXCEPTION 'Cannot confirm: overlapping booking exists for this outfit on the selected dates.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$;

-- Run BEFORE the auto_cancel trigger to catch overlaps first
DROP TRIGGER IF EXISTS prevent_overlap_booking ON public.rentals;
CREATE TRIGGER prevent_overlap_booking
  BEFORE INSERT OR UPDATE ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_overlapping_bookings();
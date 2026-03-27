
-- Remove duplicate triggers that cause double notifications
DROP TRIGGER IF EXISTS on_rental_created ON public.rentals;
DROP TRIGGER IF EXISTS on_rental_status_changed ON public.rentals;

-- Update auto_cancel to also handle date-overlap conflicts (not just same outfit pending)
CREATE OR REPLACE FUNCTION public.auto_cancel_competing_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _competing record;
  _fit_title text;
  _owner_username text;
BEGIN
  -- Only fire when status changes to 'accepted'
  IF NEW.status != 'accepted' OR OLD.status = 'accepted' THEN
    RETURN NEW;
  END IF;

  SELECT f.title INTO _fit_title FROM fits f WHERE f.id = NEW.fit_id;
  SELECT p.username INTO _owner_username FROM profiles p WHERE p.id = NEW.owner_id;

  -- Cancel all other pending requests for the same outfit
  FOR _competing IN
    SELECT id, renter_id
    FROM rentals
    WHERE fit_id = NEW.fit_id
      AND id != NEW.id
      AND status = 'pending'
  LOOP
    UPDATE rentals SET status = 'cancelled' WHERE id = _competing.id;

    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
      _competing.renter_id,
      'Request Declined',
      'Your rental request for "' || COALESCE(_fit_title, 'an outfit') || '" was declined because ' || _owner_username || ' accepted another renter.',
      'rental_rejected',
      jsonb_build_object('rental_id', _competing.id, 'fit_id', NEW.fit_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$;


-- Fix: Change unique index to only enforce one confirmed/active deal per outfit
DROP INDEX IF EXISTS idx_one_active_deal_per_outfit;
CREATE UNIQUE INDEX idx_one_active_deal_per_outfit
  ON public.rentals (fit_id)
  WHERE status IN ('confirmed', 'active');

-- Update auto_cancel to also fire when confirming (not just accepting)
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
  -- Fire when status changes to 'accepted' OR 'confirmed'
  IF NEW.status = 'accepted' AND OLD.status != 'accepted' THEN
    SELECT f.title INTO _fit_title FROM fits f WHERE f.id = NEW.fit_id;
    SELECT p.username INTO _owner_username FROM profiles p WHERE p.id = NEW.owner_id;

    FOR _competing IN
      SELECT id, renter_id FROM rentals
      WHERE fit_id = NEW.fit_id AND id != NEW.id AND status = 'pending'
    LOOP
      UPDATE rentals SET status = 'cancelled' WHERE id = _competing.id;
      INSERT INTO notifications (user_id, title, message, type, metadata)
      VALUES (_competing.renter_id, 'Request Declined',
        'Your rental request for "' || COALESCE(_fit_title, 'an outfit') || '" was declined because ' || _owner_username || ' accepted another renter.',
        'rental_rejected', jsonb_build_object('rental_id', _competing.id, 'fit_id', NEW.fit_id));
    END LOOP;
  END IF;

  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    -- Before confirming, cancel all other non-completed rentals for this outfit
    FOR _competing IN
      SELECT id, renter_id FROM rentals
      WHERE fit_id = NEW.fit_id AND id != NEW.id AND status IN ('pending', 'accepted')
    LOOP
      UPDATE rentals SET status = 'cancelled' WHERE id = _competing.id;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger exists
DROP TRIGGER IF EXISTS auto_cancel_competing ON public.rentals;
CREATE TRIGGER auto_cancel_competing
  BEFORE UPDATE ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cancel_competing_requests();

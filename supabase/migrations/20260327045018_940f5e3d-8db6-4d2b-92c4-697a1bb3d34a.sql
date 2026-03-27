
CREATE OR REPLACE FUNCTION public.auto_cancel_competing_requests()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _competing record;
  _fit_title text;
  _owner_username text;
BEGIN
  -- Only auto-cancel when status changes to 'confirmed' (not 'accepted')
  IF NEW.status = 'confirmed' AND OLD.status != 'confirmed' THEN
    SELECT f.title INTO _fit_title FROM fits f WHERE f.id = NEW.fit_id;
    SELECT p.username INTO _owner_username FROM profiles p WHERE p.id = NEW.owner_id;

    -- Cancel all other pending/accepted rentals for this outfit with overlapping dates
    FOR _competing IN
      SELECT id, renter_id, status FROM rentals
      WHERE fit_id = NEW.fit_id
        AND id != NEW.id
        AND status IN ('pending', 'accepted')
        AND start_date <= NEW.end_date
        AND end_date >= NEW.start_date
    LOOP
      UPDATE rentals SET status = 'cancelled' WHERE id = _competing.id;
      INSERT INTO notifications (user_id, title, message, type, metadata)
      VALUES (_competing.renter_id, 'Request Declined',
        'Your rental request for "' || COALESCE(_fit_title, 'an outfit') || '" was declined because ' || _owner_username || ' confirmed another renter.',
        'rental_rejected', jsonb_build_object('rental_id', _competing.id, 'fit_id', NEW.fit_id));
    END LOOP;
  END IF;

  RETURN NEW;
END;
$function$;

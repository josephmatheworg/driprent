CREATE OR REPLACE FUNCTION public.notify_rental_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner_username text;
  _renter_username text;
  _fit_title text;
  _notif_title text;
  _notif_message text;
  _notif_type text;
  _target_user_id uuid;
  _meta jsonb;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT p.username INTO _owner_username FROM profiles p WHERE p.id = NEW.owner_id;
  SELECT p.username INTO _renter_username FROM profiles p WHERE p.id = NEW.renter_id;
  SELECT f.title INTO _fit_title FROM fits f WHERE f.id = NEW.fit_id;

  _meta := jsonb_build_object('rental_id', NEW.id, 'fit_id', NEW.fit_id, 'renter_id', NEW.renter_id, 'owner_id', NEW.owner_id);

  IF NEW.status = 'accepted' THEN
    _target_user_id := NEW.renter_id;
    _notif_title := 'Request Accepted';
    _notif_message := 'Your rental request for "' || _fit_title || '" has been accepted by ' || _owner_username || '. You can now message them.';
    _notif_type := 'rental_approved';
  ELSIF NEW.status = 'confirmed' THEN
    _target_user_id := NEW.renter_id;
    _notif_title := 'Deal Confirmed';
    _notif_message := _owner_username || ' confirmed the deal for "' || _fit_title || '". Dates are locked in.';
    _notif_type := 'rental_confirmed';
  ELSIF NEW.status = 'completed' THEN
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.renter_id, 'Rental Completed',
      'The rental for "' || _fit_title || '" is complete. Leave a review!',
      'rental_completed', _meta
    );
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.owner_id, 'Rental Completed',
      'The rental for "' || _fit_title || '" is complete. Leave a review!',
      'rental_completed', _meta
    );
    RETURN NEW;
  ELSIF NEW.status = 'cancelled' AND OLD.status = 'pending' THEN
    _target_user_id := NEW.renter_id;
    _notif_title := 'Request Rejected';
    _notif_message := 'Your rental request for "' || _fit_title || '" has been declined by ' || _owner_username || '.';
    _notif_type := 'rental_rejected';
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, title, message, type, metadata)
  VALUES (_target_user_id, _notif_title, _notif_message, _notif_type, _meta);
  RETURN NEW;
END;
$$;

-- Ensure trigger exists
DROP TRIGGER IF EXISTS on_rental_status_change ON public.rentals;
CREATE TRIGGER on_rental_status_change
  AFTER UPDATE ON public.rentals
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_rental_status_change();
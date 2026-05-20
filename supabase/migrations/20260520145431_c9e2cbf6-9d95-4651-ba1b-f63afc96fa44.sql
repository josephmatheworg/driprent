
-- Add cancelled_by column to rentals to distinguish who cancelled
ALTER TABLE public.rentals ADD COLUMN IF NOT EXISTS cancelled_by uuid;

-- Trigger: prevent a renter from having more than one active request for the same outfit
CREATE OR REPLACE FUNCTION public.prevent_duplicate_renter_requests()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _existing integer;
BEGIN
  IF NEW.status IN ('pending'::public.rental_status, 'accepted'::public.rental_status, 'awaiting_payment'::public.rental_status, 'confirmed'::public.rental_status, 'active'::public.rental_status) THEN
    SELECT count(*) INTO _existing
    FROM rentals
    WHERE fit_id = NEW.fit_id
      AND renter_id = NEW.renter_id
      AND id <> COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND status IN ('pending'::public.rental_status, 'accepted'::public.rental_status, 'awaiting_payment'::public.rental_status, 'confirmed'::public.rental_status, 'active'::public.rental_status);
    IF _existing > 0 THEN
      RAISE EXCEPTION 'You already have an active request for this fit.'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_duplicate_renter_requests_trg ON public.rentals;
CREATE TRIGGER prevent_duplicate_renter_requests_trg
BEFORE INSERT ON public.rentals
FOR EACH ROW EXECUTE FUNCTION public.prevent_duplicate_renter_requests();

-- Update notify_rental_status_change to send proper notification when renter cancels
CREATE OR REPLACE FUNCTION public.notify_rental_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  IF NEW.status = 'accepted'::public.rental_status THEN
    _target_user_id := NEW.renter_id;
    _notif_title := 'Request Accepted';
    _notif_message := 'Your rental request for "' || _fit_title || '" has been accepted by ' || _owner_username || '. You can now message them.';
    _notif_type := 'rental_approved';
  ELSIF NEW.status = 'awaiting_payment'::public.rental_status THEN
    _target_user_id := NEW.renter_id;
    _notif_title := 'Pay Advance to Confirm';
    _notif_message := 'Pay ₹' || COALESCE(NEW.advance_amount::text, '') || ' advance within 5 minutes to confirm your booking for "' || _fit_title || '".';
    _notif_type := 'payment_pending';
  ELSIF NEW.status = 'confirmed'::public.rental_status THEN
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (NEW.renter_id, 'Booking Confirmed', 'Booking confirmed successfully for "' || _fit_title || '".', 'rental_confirmed', _meta);
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (NEW.owner_id, 'Booking Confirmed', 'Payment received from ' || _renter_username || '. Booking confirmed for "' || _fit_title || '".', 'rental_confirmed', _meta);
    RETURN NEW;
  ELSIF NEW.status = 'expired'::public.rental_status THEN
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (NEW.renter_id, 'Booking Expired', 'Booking expired due to payment timeout for "' || _fit_title || '".', 'rental_expired', _meta);
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (NEW.owner_id, 'Booking Expired', 'Booking expired due to payment timeout for "' || _fit_title || '".', 'rental_expired', _meta);
    RETURN NEW;
  ELSIF NEW.status = 'completed'::public.rental_status THEN
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (NEW.renter_id, 'Rental Completed', 'The rental for "' || _fit_title || '" is complete. Leave a review!', 'rental_completed', _meta);
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (NEW.owner_id, 'Rental Completed', 'The rental for "' || _fit_title || '" is complete. Leave a review!', 'rental_completed', _meta);
    RETURN NEW;
  ELSIF NEW.status = 'cancelled'::public.rental_status AND OLD.status IN ('pending'::public.rental_status, 'accepted'::public.rental_status) THEN
    IF NEW.cancelled_by IS NOT NULL AND NEW.cancelled_by = NEW.renter_id THEN
      _target_user_id := NEW.owner_id;
      _notif_title := 'Request Cancelled';
      _notif_message := _renter_username || ' cancelled their rental request for "' || _fit_title || '".';
      _notif_type := 'rental_cancelled';
    ELSE
      _target_user_id := NEW.renter_id;
      _notif_title := 'Request Rejected';
      _notif_message := 'Your rental request for "' || _fit_title || '" has been declined by ' || _owner_username || '.';
      _notif_type := 'rental_rejected';
    END IF;
  ELSE
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, title, message, type, metadata)
  VALUES (_target_user_id, _notif_title, _notif_message, _notif_type, _meta);
  RETURN NEW;
END;
$function$;

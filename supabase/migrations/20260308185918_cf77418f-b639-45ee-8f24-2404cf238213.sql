
-- Add 'accepted' and 'completed' to rental_status enum
ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'accepted';
ALTER TYPE rental_status ADD VALUE IF NOT EXISTS 'completed';

-- Add review_tags column to reviews
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS review_tags text[] DEFAULT '{}';

-- Unique constraint: one review per rental per reviewer per type
ALTER TABLE reviews ADD CONSTRAINT unique_review_per_rental_type UNIQUE (rental_id, reviewer_id, review_type);

-- Update the status change trigger to handle 'accepted' and 'completed'
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
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  SELECT p.username INTO _owner_username FROM profiles p WHERE p.id = NEW.owner_id;
  SELECT p.username INTO _renter_username FROM profiles p WHERE p.id = NEW.renter_id;
  SELECT f.title INTO _fit_title FROM fits f WHERE f.id = NEW.fit_id;

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
    -- Notify both users
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.renter_id,
      'Rental Completed',
      'The rental for "' || _fit_title || '" is complete. Leave a review!',
      'rental_completed',
      jsonb_build_object('rental_id', NEW.id, 'fit_id', NEW.fit_id)
    );
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.owner_id,
      'Rental Completed',
      'The rental for "' || _fit_title || '" is complete. Leave a review!',
      'rental_completed',
      jsonb_build_object('rental_id', NEW.id, 'fit_id', NEW.fit_id)
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
  VALUES (
    _target_user_id,
    _notif_title,
    _notif_message,
    _notif_type,
    jsonb_build_object('rental_id', NEW.id, 'fit_id', NEW.fit_id)
  );
  RETURN NEW;
END;
$function$;

-- Create trigger if not exists
DROP TRIGGER IF EXISTS on_rental_status_change ON rentals;
CREATE TRIGGER on_rental_status_change
  AFTER UPDATE ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION notify_rental_status_change();

-- Create trigger for new rentals if not exists
DROP TRIGGER IF EXISTS on_rental_request ON rentals;
CREATE TRIGGER on_rental_request
  AFTER INSERT ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION notify_rental_request();

-- Create trigger for new messages if not exists
DROP TRIGGER IF EXISTS on_new_message ON messages;
CREATE TRIGGER on_new_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

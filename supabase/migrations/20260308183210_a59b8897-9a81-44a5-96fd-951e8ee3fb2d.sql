
-- Trigger function: create notification when a rental request is created
CREATE OR REPLACE FUNCTION public.notify_rental_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _renter_username text;
  _fit_title text;
  _start_date text;
  _end_date text;
BEGIN
  SELECT p.username INTO _renter_username FROM profiles p WHERE p.id = NEW.renter_id;
  SELECT f.title INTO _fit_title FROM fits f WHERE f.id = NEW.fit_id;
  _start_date := to_char(NEW.start_date, 'Mon DD');
  _end_date := to_char(NEW.end_date, 'Mon DD, YYYY');

  INSERT INTO notifications (user_id, title, message, type, metadata)
  VALUES (
    NEW.owner_id,
    'Rental Request',
    _renter_username || ' wants to rent your outfit "' || _fit_title || '" from ' || _start_date || ' to ' || _end_date || '.',
    'rental_request',
    jsonb_build_object('rental_id', NEW.id, 'fit_id', NEW.fit_id, 'renter_id', NEW.renter_id, 'fit_title', _fit_title, 'renter_username', _renter_username)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_rental_created
  AFTER INSERT ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION notify_rental_request();

-- Trigger function: notify on rental status change
CREATE OR REPLACE FUNCTION public.notify_rental_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _owner_username text;
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
  SELECT f.title INTO _fit_title FROM fits f WHERE f.id = NEW.fit_id;

  IF NEW.status = 'confirmed' THEN
    _target_user_id := NEW.renter_id;
    _notif_title := 'Request Accepted';
    _notif_message := 'Your rental request for "' || _fit_title || '" has been accepted by ' || _owner_username || '. You can now message them.';
    _notif_type := 'rental_approved';
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
$$;

CREATE TRIGGER on_rental_status_changed
  AFTER UPDATE ON rentals
  FOR EACH ROW
  EXECUTE FUNCTION notify_rental_status_change();

-- Trigger function: notify on new message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _sender_username text;
  _recipient_id uuid;
  _conv record;
BEGIN
  SELECT p.username INTO _sender_username FROM profiles p WHERE p.id = NEW.sender_id;
  SELECT * INTO _conv FROM conversations WHERE id = NEW.conversation_id;

  IF _conv.user1_id = NEW.sender_id THEN
    _recipient_id := _conv.user2_id;
  ELSE
    _recipient_id := _conv.user1_id;
  END IF;

  INSERT INTO notifications (user_id, title, message, type, metadata)
  VALUES (
    _recipient_id,
    'New Message',
    'New message from ' || _sender_username,
    'message',
    jsonb_build_object('conversation_id', NEW.conversation_id, 'sender_id', NEW.sender_id)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_message_created
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION notify_new_message();

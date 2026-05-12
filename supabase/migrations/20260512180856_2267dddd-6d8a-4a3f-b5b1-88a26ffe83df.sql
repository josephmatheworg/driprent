
ALTER TABLE public.rentals
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS advance_amount numeric,
  ADD COLUMN IF NOT EXISTS lender_upi text,
  ADD COLUMN IF NOT EXISTS payment_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS razorpay_order_id text,
  ADD COLUMN IF NOT EXISTS razorpay_payment_id text,
  ADD COLUMN IF NOT EXISTS payment_timestamp timestamptz;

CREATE INDEX IF NOT EXISTS idx_rentals_payment_deadline
  ON public.rentals (payment_deadline);

CREATE INDEX IF NOT EXISTS idx_rentals_razorpay_order
  ON public.rentals (razorpay_order_id);

-- Update sync trigger so awaiting_payment also blocks the calendar
CREATE OR REPLACE FUNCTION public.sync_fit_booked_ranges_from_rentals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if (tg_op = 'DELETE') then
    perform set_config('row_security', 'off', true);
    delete from public.fit_booked_ranges where rental_id = old.id;
    return old;
  end if;

  if (new.status in ('confirmed'::public.rental_status, 'active'::public.rental_status, 'awaiting_payment'::public.rental_status)) then
    perform set_config('row_security', 'off', true);
    insert into public.fit_booked_ranges (rental_id, fit_id, start_date, end_date)
    values (new.id, new.fit_id, new.start_date, new.end_date)
    on conflict (rental_id)
    do update set
      fit_id = excluded.fit_id,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      updated_at = now();
  else
    perform set_config('row_security', 'off', true);
    delete from public.fit_booked_ranges where rental_id = new.id;
  end if;

  return new;
end;
$function$;

-- Update overlap-prevention trigger to also block on awaiting_payment
CREATE OR REPLACE FUNCTION public.prevent_overlapping_bookings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _overlap_count integer;
BEGIN
  IF NEW.status NOT IN ('confirmed'::public.rental_status, 'active'::public.rental_status, 'awaiting_payment'::public.rental_status) THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO _overlap_count
  FROM rentals
  WHERE fit_id = NEW.fit_id
    AND id != NEW.id
    AND status IN ('confirmed'::public.rental_status, 'active'::public.rental_status, 'awaiting_payment'::public.rental_status)
    AND start_date <= NEW.end_date
    AND end_date >= NEW.start_date;

  IF _overlap_count > 0 THEN
    RAISE EXCEPTION 'Cannot reserve: overlapping booking exists for this outfit on the selected dates.'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$function$;

-- Update notify trigger
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
  ELSIF NEW.status = 'cancelled'::public.rental_status AND OLD.status = 'pending'::public.rental_status THEN
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
$function$;

-- Restrict get_rental_owner_contact: only return contact when paid+confirmed
CREATE OR REPLACE FUNCTION public.get_rental_owner_contact(_rental_id uuid)
 RETURNS TABLE(phone text, latitude double precision, longitude double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.phone, p.latitude, p.longitude
  FROM public.rentals r
  JOIN public.profiles p ON p.id = r.owner_id
  WHERE r.id = _rental_id
    AND r.status IN ('confirmed'::public.rental_status, 'active'::public.rental_status)
    AND r.payment_status = 'paid'
    AND r.renter_id = public.get_profile_id_for_auth(auth.uid())
$function$;

-- Enable cron + http extensions for auto-expiry job
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

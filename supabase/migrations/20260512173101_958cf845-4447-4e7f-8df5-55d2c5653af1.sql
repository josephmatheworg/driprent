-- 1) Restrict profiles to authenticated users only
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
CREATE POLICY "Authenticated users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- 2) Hide stripe_payment_intent_id from API consumers (service role retains access)
REVOKE SELECT (stripe_payment_intent_id) ON public.rentals FROM anon, authenticated;

-- 3) Secure RPC for renter to fetch lender contact details on confirmed rentals
CREATE OR REPLACE FUNCTION public.get_rental_owner_contact(_rental_id uuid)
RETURNS TABLE(phone text, latitude double precision, longitude double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.phone, p.latitude, p.longitude
  FROM public.rentals r
  JOIN public.profiles p ON p.id = r.owner_id
  WHERE r.id = _rental_id
    AND r.status IN ('confirmed'::public.rental_status, 'active'::public.rental_status)
    AND r.renter_id = public.get_profile_id_for_auth(auth.uid())
$$;

GRANT EXECUTE ON FUNCTION public.get_rental_owner_contact(uuid) TO authenticated;

-- 4) Explicit deny INSERT on notifications for client roles
-- (SECURITY DEFINER triggers and the service role bypass RLS, so system-generated
-- notifications keep working.)
CREATE POLICY "Clients cannot insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);
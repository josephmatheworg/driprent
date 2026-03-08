-- Allow conversation participants to update last_message_at
CREATE POLICY "Users can update their own conversations"
ON public.conversations
FOR UPDATE
TO authenticated
USING (
  (user1_id = get_profile_id_for_auth(auth.uid()))
  OR (user2_id = get_profile_id_for_auth(auth.uid()))
);

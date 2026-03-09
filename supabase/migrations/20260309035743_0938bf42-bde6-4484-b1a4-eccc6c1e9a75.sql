-- Create function to add user to deleted_by_users array
CREATE OR REPLACE FUNCTION public.delete_conversation_for_user(_conversation_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.conversations
  SET deleted_by_users = array_append(deleted_by_users, _user_id)
  WHERE id = _conversation_id
    AND NOT (_user_id = ANY(deleted_by_users));
END;
$$;
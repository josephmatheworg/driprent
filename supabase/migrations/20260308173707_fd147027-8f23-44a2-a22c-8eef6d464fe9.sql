
-- Create conversations table
CREATE TABLE public.conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user1_id, user2_id)
);

-- Create messages table
CREATE TABLE public.messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message_text TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check conversation membership
CREATE OR REPLACE FUNCTION public.is_conversation_member(_user_id uuid, _conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversations c
    JOIN public.profiles p ON p.user_id = _user_id
    WHERE c.id = _conversation_id
      AND (c.user1_id = p.id OR c.user2_id = p.id)
  )
$$;

-- Create security definer function to check if user is in conversation by profile id
CREATE OR REPLACE FUNCTION public.get_profile_id_for_auth(_auth_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE user_id = _auth_id LIMIT 1
$$;

-- Conversations RLS: users can see their own conversations
CREATE POLICY "Users can view their own conversations"
ON public.conversations FOR SELECT
TO authenticated
USING (
  user1_id = public.get_profile_id_for_auth(auth.uid()) OR
  user2_id = public.get_profile_id_for_auth(auth.uid())
);

-- Users can create conversations they're part of
CREATE POLICY "Users can create conversations"
ON public.conversations FOR INSERT
TO authenticated
WITH CHECK (
  user1_id = public.get_profile_id_for_auth(auth.uid()) OR
  user2_id = public.get_profile_id_for_auth(auth.uid())
);

-- Messages RLS: users can view messages in their conversations
CREATE POLICY "Users can view messages in their conversations"
ON public.messages FOR SELECT
TO authenticated
USING (public.is_conversation_member(auth.uid(), conversation_id));

-- Users can send messages in their conversations
CREATE POLICY "Users can send messages in their conversations"
ON public.messages FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = public.get_profile_id_for_auth(auth.uid()) AND
  public.is_conversation_member(auth.uid(), conversation_id)
);

-- Users can mark messages as read in their conversations
CREATE POLICY "Users can update messages in their conversations"
ON public.messages FOR UPDATE
TO authenticated
USING (public.is_conversation_member(auth.uid(), conversation_id));

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;

-- Create index for performance
CREATE INDEX idx_messages_conversation_id ON public.messages(conversation_id, created_at);
CREATE INDEX idx_conversations_user1 ON public.conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON public.conversations(user2_id);

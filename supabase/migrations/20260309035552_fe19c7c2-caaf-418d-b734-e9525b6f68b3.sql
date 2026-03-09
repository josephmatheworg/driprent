-- Add deleted_by_users array to conversations table for soft delete
ALTER TABLE public.conversations
ADD COLUMN deleted_by_users uuid[] NOT NULL DEFAULT '{}';

-- Create index for efficient filtering
CREATE INDEX idx_conversations_deleted_by ON public.conversations USING GIN (deleted_by_users);
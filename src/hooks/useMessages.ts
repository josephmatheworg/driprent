import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  message_text: string;
  is_read: boolean;
  created_at: string;
}

export function useMessages(conversationId: string | null) {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const currentConvoRef = useRef(conversationId);

  // Keep ref in sync
  useEffect(() => {
    currentConvoRef.current = conversationId;
  }, [conversationId]);

  const fetchMessages = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching messages:', error);
    }

    // Only set if still on same conversation
    if (currentConvoRef.current === conversationId) {
      setMessages((data as Message[]) || []);
      setLoading(false);
    }
  }, [conversationId]);

  // Mark unread as read
  const markAsRead = useCallback(async () => {
    if (!conversationId || !profile) return;
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .eq('is_read', false)
      .neq('sender_id', profile.id);
  }, [conversationId, profile?.id]);

  // Fetch messages and mark as read when conversation changes
  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    fetchMessages().then(() => markAsRead());
  }, [conversationId, fetchMessages, markAsRead]);

  // Realtime subscription - stable deps to prevent re-subscribing
  useEffect(() => {
    if (!conversationId) return;

    const channelName = `msgs-${conversationId}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (currentConvoRef.current !== conversationId) return;
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.some(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          markAsRead();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (currentConvoRef.current !== conversationId) return;
          const updated = payload.new as Message;
          setMessages(prev =>
            prev.map(m => m.id === updated.id ? updated : m)
          );
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  const sendMessage = async (text: string) => {
    if (!conversationId || !profile || !text.trim()) return;

    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender_id: profile.id,
      message_text: text.trim(),
    });

    if (error) {
      console.error('Error sending message:', error);
      return;
    }

    // Update conversation last_message_at
    await supabase
      .from('conversations')
      .update({ last_message_at: new Date().toISOString() })
      .eq('id', conversationId);
  };

  return { messages, loading, sendMessage, refetch: fetchMessages };
}

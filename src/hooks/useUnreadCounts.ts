import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadCounts() {
  const { profile } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isFetchingRef = useRef(false);

  const fetchCounts = useCallback(async () => {
    if (!profile || isFetchingRef.current) return;
    isFetchingRef.current = true;

    try {
      // Unread messages
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`);

      if (convos && convos.length > 0) {
        const convoIds = convos.map(c => c.id);
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convoIds)
          .eq('is_read', false)
          .neq('sender_id', profile.id);
        setUnreadMessages(count || 0);
      } else {
        setUnreadMessages(0);
      }

      // Unread notifications
      const { count: notifCount } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('read', false);
      setUnreadNotifications(notifCount || 0);
    } finally {
      isFetchingRef.current = false;
    }
  }, [profile?.id]);

  // Debounced fetch to prevent rapid-fire loops
  const debouncedFetch = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchCounts();
    }, 500);
  }, [fetchCounts]);

  useEffect(() => {
    fetchCounts();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [profile?.id]);

  // Realtime updates
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel(`unread-counts-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => debouncedFetch())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, () => debouncedFetch())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [profile?.id, debouncedFetch]);

  return { unreadMessages, unreadNotifications, refetch: fetchCounts };
}

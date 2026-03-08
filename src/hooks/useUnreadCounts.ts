import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export function useUnreadCounts() {
  const { profile } = useAuth();
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);

  const fetchCounts = async () => {
    if (!profile) return;

    // Unread messages: messages in my conversations not sent by me, not read
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
    }

    // Unread notifications
    const { count: notifCount } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('read', false);
    setUnreadNotifications(notifCount || 0);
  };

  useEffect(() => {
    fetchCounts();
  }, [profile?.id]);

  // Realtime updates
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('unread-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => fetchCounts())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchCounts())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  return { unreadMessages, unreadNotifications, refetch: fetchCounts };
}

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ConversationWithDetails {
  id: string;
  user1_id: string;
  user2_id: string;
  last_message_at: string;
  created_at: string;
  other_user: {
    id: string;
    username: string;
    avatar_url: string | null;
  };
  last_message?: {
    message_text: string;
    sender_id: string;
    created_at: string;
  };
  unread_count: number;
}

export function useConversations() {
  const { profile } = useAuth();
  const [conversations, setConversations] = useState<ConversationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchConversations = async () => {
    if (!profile) return;
    setLoading(true);

    const { data: convos, error } = await supabase
      .from('conversations')
      .select('*')
      .or(`user1_id.eq.${profile.id},user2_id.eq.${profile.id}`)
      .not('deleted_by_users', 'cs', `{${profile.id}}`)
      .order('last_message_at', { ascending: false });

    if (error || !convos) {
      setLoading(false);
      return;
    }

    const otherUserIds = convos.map(c =>
      c.user1_id === profile.id ? c.user2_id : c.user1_id
    );

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, avatar_url')
      .in('id', otherUserIds);

    const profileMap = new Map(
      (profiles || []).map(p => [p.id, p])
    );

    const detailed: ConversationWithDetails[] = [];

    for (const c of convos) {
      const otherId = c.user1_id === profile.id ? c.user2_id : c.user1_id;
      const otherProfile = profileMap.get(otherId);
      if (!otherProfile) continue;

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('message_text, sender_id, created_at')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .eq('is_read', false)
        .neq('sender_id', profile.id);

      detailed.push({
        ...c,
        other_user: otherProfile,
        last_message: lastMsg || undefined,
        unread_count: count || 0,
      });
    }

    setConversations(detailed);
    setLoading(false);
  };

  useEffect(() => {
    fetchConversations();
  }, [profile?.id]);

  // Realtime: re-fetch on new messages
  useEffect(() => {
    if (!profile) return;

    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'messages' },
        () => fetchConversations()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  return { conversations, loading, refetch: fetchConversations };
}

export async function getOrCreateConversation(myProfileId: string, otherProfileId: string): Promise<string | null> {
  // Check both orderings
  const { data: existing } = await supabase
    .from('conversations')
    .select('id')
    .or(
      `and(user1_id.eq.${myProfileId},user2_id.eq.${otherProfileId}),and(user1_id.eq.${otherProfileId},user2_id.eq.${myProfileId})`
    )
    .maybeSingle();

  if (existing) return existing.id;

  // Create new
  const { data, error } = await supabase
    .from('conversations')
    .insert({ user1_id: myProfileId, user2_id: otherProfileId })
    .select('id')
    .single();

  if (error) return null;
  return data.id;
}

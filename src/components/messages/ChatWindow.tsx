import { useState, useRef, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Handshake } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmDealPanel } from '@/components/chat/ConfirmDealPanel';

interface ChatWindowProps {
  conversationId: string;
  otherUser: { id: string; username: string; avatar_url: string | null };
}

export function ChatWindow({ conversationId, otherUser }: ChatWindowProps) {
  const { profile } = useAuth();
  const { messages, loading, sendMessage } = useMessages(conversationId);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [acceptedRental, setAcceptedRental] = useState<any>(null);
  const [showConfirmDeal, setShowConfirmDeal] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Check if there's an accepted rental between the two users
  useEffect(() => {
    if (!profile) return;
    const fetchAcceptedRental = async () => {
      const { data } = await supabase
        .from('rentals')
        .select('id, fit_id, start_date, end_date, owner_id, fits(title)')
        .or(`and(owner_id.eq.${profile.id},renter_id.eq.${otherUser.id}),and(owner_id.eq.${otherUser.id},renter_id.eq.${profile.id})`)
        .eq('status', 'accepted' as any)
        .limit(1)
        .maybeSingle();
      if (data) {
        setAcceptedRental({
          ...data,
          fit_title: (data as any).fits?.title,
        });
      } else {
        setAcceptedRental(null);
      }
    };
    fetchAcceptedRental();
  }, [profile?.id, otherUser.id, conversationId]);

  const handleSend = async () => {
    if (!text.trim()) return;
    const msg = text;
    setText('');
    await sendMessage(msg);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const isOwner = acceptedRental && profile && acceptedRental.owner_id === profile.id;

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={otherUser.avatar_url || ''} />
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {otherUser.username?.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{otherUser.username}</span>
        </div>
        {isOwner && acceptedRental && (
          <Button
            size="sm"
            variant="terracotta"
            className="gap-1.5"
            onClick={() => setShowConfirmDeal(true)}
          >
            <Handshake className="h-4 w-4" /> Confirm Deal
          </Button>
        )}
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="flex flex-col gap-3">
          {loading && <p className="text-center text-sm text-muted-foreground">Loading…</p>}
          {messages.map((msg) => {
            const isMine = msg.sender_id === profile?.id;
            return (
              <div key={msg.id} className={cn('flex', isMine ? 'justify-end' : 'justify-start')}>
                <div className="flex max-w-[75%] items-end gap-2">
                  {!isMine && (
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={otherUser.avatar_url || ''} />
                      <AvatarFallback className="text-[10px]">{otherUser.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div>
                    <div
                      className={cn(
                        'rounded-2xl px-3.5 py-2 text-sm',
                        isMine
                          ? 'rounded-br-sm bg-primary text-primary-foreground'
                          : 'rounded-bl-sm bg-accent text-accent-foreground'
                      )}
                    >
                      {msg.message_text}
                    </div>
                    <p className={cn('mt-1 text-[10px] text-muted-foreground', isMine && 'text-right')}>
                      {format(new Date(msg.created_at), 'h:mm a')}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            className="flex-1"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!text.trim()}
            className="shrink-0"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Confirm Deal Dialog */}
      {acceptedRental && (
        <ConfirmDealPanel
          open={showConfirmDeal}
          onOpenChange={setShowConfirmDeal}
          rental={acceptedRental}
          onConfirmed={() => setAcceptedRental(null)}
        />
      )}
    </div>
  );
}

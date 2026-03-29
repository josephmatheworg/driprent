import { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMessages } from '@/hooks/useMessages';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { ConfirmDealPanel } from '@/components/chat/ConfirmDealPanel';
import { ChatSettingsPanel } from '@/components/chat/ChatSettingsPanel';
import { DealSummaryCard } from '@/components/chat/DealSummaryCard';
import { ReviewDialog } from '@/components/reviews/ReviewDialog';

interface ChatWindowProps {
  conversationId: string;
  otherUser: { id: string; username: string; avatar_url: string | null };
}

export function ChatWindow({ conversationId, otherUser }: ChatWindowProps) {
  const { profile } = useAuth();
  const { messages, loading, sendMessage } = useMessages(conversationId);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const [rental, setRental] = useState<any>(null);
  const [showConfirmDeal, setShowConfirmDeal] = useState(false);
  const [chatLocked, setChatLocked] = useState(false);
  const [lockMessage, setLockMessage] = useState('Rental completed. Request again to continue.');
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [hasReviewed, setHasReviewed] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchRental = useCallback(async () => {
    if (!profile) return;
    
    // Fetch the most relevant rental between these two users
    const { data: allRentals } = await supabase
      .from('rentals')
      .select('id, fit_id, start_date, end_date, owner_id, renter_id, status, fits(title), owner:profiles!rentals_owner_id_fkey(latitude, longitude, phone)')
      .or(`and(owner_id.eq.${profile.id},renter_id.eq.${otherUser.id}),and(owner_id.eq.${otherUser.id},renter_id.eq.${profile.id})`)
      .in('status', ['accepted', 'confirmed', 'active', 'completed', 'returned', 'cancelled'] as any)
      .order('updated_at', { ascending: false });

    if (allRentals && allRentals.length > 0) {
      // Prioritize active > confirmed > accepted > terminal states
      const priorityOrder = ['active', 'confirmed', 'accepted', 'completed', 'returned', 'cancelled'];
      const sorted = [...allRentals].sort((a, b) => {
        return priorityOrder.indexOf((a as any).status) - priorityOrder.indexOf((b as any).status);
      });
      const best = sorted[0] as any;
      const ownerProfile = best.owner;
      const status = best.status;

      if (['completed', 'returned'].includes(status)) {
        // Keep rental data for review/directions context
        setRental({
          ...best,
          fit_title: best.fits?.title,
          owner_latitude: ownerProfile?.latitude ?? null,
          owner_longitude: ownerProfile?.longitude ?? null,
          owner_phone: ownerProfile?.phone ?? null,
        });
        setChatLocked(true);
        setLockMessage('Rental completed. Request again to continue.');
        // Check if current user already reviewed
        const isRenter = best.renter_id === profile.id;
        if (isRenter) {
          const { count } = await supabase
            .from('reviews')
            .select('id', { count: 'exact', head: true })
            .eq('rental_id', best.id)
            .eq('reviewer_id', profile.id);
          setHasReviewed((count ?? 0) > 0);
        }
      } else if (status === 'cancelled') {
        // Check if there's a confirmed deal for this outfit with someone else (meaning this user was rejected)
        setRental(null);
        setChatLocked(true);
        setLockMessage('This rental request was declined. Send a new request to continue.');
      } else {
        setRental({
          ...best,
          fit_title: best.fits?.title,
          owner_latitude: ownerProfile?.latitude ?? null,
          owner_longitude: ownerProfile?.longitude ?? null,
          owner_phone: ownerProfile?.phone ?? null,
        });
        setChatLocked(false);
      }
    } else {
      setRental(null);
      setChatLocked(false);
    }
  }, [profile?.id, otherUser.id]);

  useEffect(() => {
    fetchRental();

    // Realtime: re-fetch rental when status changes
    if (!profile) return;
    const channel = supabase
      .channel(`rental-status-${profile.id}-${otherUser.id}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rentals' }, () => {
        fetchRental();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchRental, conversationId]);

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

  const handleDealConfirmed = async () => {
    // Send a system-style message about the confirmation
    if (rental) {
      const start = format(new Date(rental.start_date), 'MMM d');
      const end = format(new Date(rental.end_date), 'MMM d, yyyy');
      await sendMessage(`✅ Deal confirmed for ${start} to ${end}.`);
    }
    fetchRental();
  };

  const isOwner = rental && profile && rental.owner_id === profile.id;
  const isRenter = rental && profile && rental.renter_id === profile.id;
  const canReview = isRenter && rental && ['completed', 'returned'].includes(rental.status) && !hasReviewed;

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
        {rental && !['completed', 'returned', 'cancelled'].includes(rental.status) && (
          <ChatSettingsPanel
            rental={rental}
            isOwner={!!isOwner}
            onConfirmDeal={() => setShowConfirmDeal(true)}
            onRentalUpdated={fetchRental}
          />
        )}
      </div>

      {/* Deal Summary Card - show for confirmed, active, and completed */}
      {rental && rental.status === 'confirmed' && (
        <DealSummaryCard
          fitTitle={rental.fit_title}
          startDate={rental.start_date}
          endDate={rental.end_date}
          status={rental.status}
          ownerLatitude={isRenter ? rental.owner_latitude : null}
          ownerLongitude={isRenter ? rental.owner_longitude : null}
          ownerPhone={isRenter ? rental.owner_phone : null}
        />
      )}

      {/* Messages */}
      <div className="relative flex-1 overflow-y-auto">
        <div className="flex min-h-full flex-col justify-end p-4">
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
                          'rounded-2xl px-3.5 py-2 text-sm break-words',
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
        </div>
      </div>

      {/* Input */}
      {chatLocked ? (
        <div className="border-t border-border p-4 pb-[env(safe-area-inset-bottom,0.75rem)] text-center space-y-2">
          <p className="text-sm text-muted-foreground">{lockMessage}</p>
          {canReview && (
            <Button variant="terracotta" size="sm" onClick={() => setShowReviewDialog(true)}>
              ⭐ Rate & Review
            </Button>
          )}
          {hasReviewed && rental && ['completed', 'returned'].includes(rental.status) && isRenter && (
            <p className="text-xs text-muted-foreground">✅ You've already reviewed this rental</p>
          )}
        </div>
      ) : (
        <div className="border-t border-border p-3 pb-[env(safe-area-inset-bottom,0.75rem)]">
          <div className="flex items-center gap-2">
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message…"
              className="flex-1 min-h-[44px]"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!text.trim()}
              className="shrink-0 h-11 w-11"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Deal Dialog */}
      {rental && !['completed', 'returned', 'cancelled'].includes(rental.status) && (
        <ConfirmDealPanel
          open={showConfirmDeal}
          onOpenChange={setShowConfirmDeal}
          rental={rental}
          onConfirmed={handleDealConfirmed}
        />
      )}

      {/* Review Dialog */}
      {canReview && rental && (
        <ReviewDialog
          open={showReviewDialog}
          onOpenChange={setShowReviewDialog}
          rentalId={rental.id}
          reviewType="owner"
          reviewedUserId={rental.owner_id}
          reviewedFitId={rental.fit_id}
          onReviewSubmitted={() => { setHasReviewed(true); fetchRental(); }}
        />
      )}
    </div>
  );
}

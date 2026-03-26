import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, Check, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { getOrCreateConversation } from '@/hooks/useConversations';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface NotificationDropdownProps {
  unreadCount: number;
  onRead: () => void;
}

export function NotificationDropdown({ unreadCount, onRead }: NotificationDropdownProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const fetchNotifications = async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false })
      .limit(20);
    setNotifications((data as Notification[]) || []);
  };

  useEffect(() => {
    if (open) {
      fetchNotifications().then(() => {
        // Auto-mark non-actionable notifications as read when dropdown opens
        if (profile) {
          supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', profile.id)
            .eq('read', false)
            .neq('type', 'rental_request')
            .then(() => {
              setNotifications(prev =>
                prev.map(n => n.type === 'rental_request' ? n : { ...n, read: true })
              );
              onRead();
            });
        }
      });
    }
  }, [open, profile?.id]);

  const markAllRead = async () => {
    if (!profile) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', profile.id)
      .eq('read', false);
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    onRead();
  };

  const handleAcceptRequest = async (n: Notification) => {
    if (!profile) return;
    const rentalId = n.metadata?.rental_id as string;
    const renterId = n.metadata?.renter_id as string;
    if (!rentalId) return;

    setProcessingId(n.id);

    // Update rental status to accepted
    const { error } = await supabase
      .from('rentals')
      .update({ status: 'accepted' as any })
      .eq('id', rentalId);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to accept', description: error.message });
      setProcessingId(null);
      return;
    }

    // Create conversation between owner and renter
    if (renterId) {
      await getOrCreateConversation(profile.id, renterId);
    }

    // Mark this notification as read
    await supabase.from('notifications').update({ read: true }).eq('id', n.id);

    toast({ title: 'Request accepted', description: 'A conversation has been created.' });
    setProcessingId(null);
    fetchNotifications();
    onRead();
  };

  const handleRejectRequest = async (n: Notification) => {
    if (!profile) return;
    const rentalId = n.metadata?.rental_id as string;
    if (!rentalId) return;

    setProcessingId(n.id);

    const { error } = await supabase
      .from('rentals')
      .update({ status: 'cancelled' })
      .eq('id', rentalId);

    if (error) {
      toast({ variant: 'destructive', title: 'Failed to reject', description: error.message });
      setProcessingId(null);
      return;
    }

    await supabase.from('notifications').update({ read: true }).eq('id', n.id);

    toast({ title: 'Request rejected' });
    setProcessingId(null);
    fetchNotifications();
    onRead();
  };

  const getLink = (n: Notification) => {
    const meta = n.metadata || {};
    if (n.type === 'message') {
      const convId = meta.conversation_id as string;
      return convId ? `/messages?conversation=${convId}` : '/messages';
    }
    if (n.type === 'request_reply') {
      const reqId = meta.request_id as string;
      return reqId ? `/request/${reqId}` : '/outfit-requests';
    }
    if (n.type === 'rental_approved' || n.type === 'rental_rejected') return '/rentals';
    if (n.type === 'rental_confirmed' || n.type === 'rental_completed') return '/rentals';
    return '#';
  };

  const isRentalRequest = (n: Notification) => n.type === 'rental_request' && !n.read;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between border-b border-border px-3 py-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline">
              Mark all read
            </button>
          )}
        </div>
        <ScrollArea className="max-h-96">
          {notifications.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">
              No notifications yet
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={cn(
                  'flex flex-col gap-1 px-3 py-2.5 border-b border-border last:border-0',
                  !n.read && 'bg-primary/5'
                )}
              >
                {isRentalRequest(n) ? (
                  <>
                    <span className="text-sm font-semibold">{n.title}</span>
                    <span className="text-xs text-muted-foreground">{n.message}</span>
                    <div className="mt-1.5 flex gap-2">
                      <Button
                        size="sm"
                        variant="terracotta"
                        className="h-7 gap-1 text-xs"
                        disabled={processingId === n.id}
                        onClick={() => handleAcceptRequest(n)}
                      >
                        <Check className="h-3 w-3" /> Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 gap-1 text-xs"
                        disabled={processingId === n.id}
                        onClick={() => handleRejectRequest(n)}
                      >
                        <X className="h-3 w-3" /> Reject
                      </Button>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </span>
                  </>
                ) : (
                  <DropdownMenuItem asChild className="cursor-pointer p-0">
                    <Link to={getLink(n)} className="flex flex-col gap-0.5">
                      <span className={cn('text-sm', !n.read && 'font-semibold')}>{n.title}</span>
                      <span className="text-xs text-muted-foreground line-clamp-2">{n.message}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                      </span>
                    </Link>
                  </DropdownMenuItem>
                )}
              </div>
            ))
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

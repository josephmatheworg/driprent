import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import type { ConversationWithDetails } from '@/hooks/useConversations';
import { formatDistanceToNow } from 'date-fns';
import { MoreVertical, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface ConversationListProps {
  conversations: ConversationWithDetails[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => Promise<boolean>;
}

export function ConversationList({ conversations, activeId, onSelect, onDelete }: ConversationListProps) {
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!deleteId || !onDelete) return;
    setDeleting(true);
    const success = await onDelete(deleteId);
    setDeleting(false);
    setDeleteId(null);
    if (success) {
      toast.success('Conversation deleted');
    } else {
      toast.error('Failed to delete conversation');
    }
  };

  if (conversations.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-sm text-muted-foreground">No conversations yet. Message an outfit owner to get started!</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="h-full">
        <div className="flex flex-col">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={cn(
                'group relative flex items-center gap-3 border-b border-border px-4 py-3 text-left transition-colors hover:bg-accent',
                activeId === conv.id && 'bg-accent',
                conv.unread_count > 0 && 'bg-primary/5'
              )}
            >
              <button
                onClick={() => onSelect(conv.id)}
                className="flex flex-1 items-center gap-3"
              >
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={conv.other_user.avatar_url || ''} />
                  <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                    {conv.other_user.username?.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between">
                    <span className={cn('text-sm', conv.unread_count > 0 ? 'font-semibold text-foreground' : 'font-medium text-foreground')}>
                      {conv.other_user.username}
                    </span>
                    {conv.last_message && (
                      <span className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(conv.last_message.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                  <p className={cn(
                    'truncate text-xs',
                    conv.unread_count > 0 ? 'font-medium text-foreground' : 'text-muted-foreground'
                  )}>
                    {conv.last_message?.message_text || 'No messages yet'}
                  </p>
                </div>
                {conv.unread_count > 0 && (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                    {conv.unread_count}
                  </span>
                )}
              </button>

              {onDelete && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="shrink-0 rounded p-1 opacity-0 transition-opacity hover:bg-muted group-hover:opacity-100">
                      <MoreVertical className="h-4 w-4 text-muted-foreground" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => setDeleteId(conv.id)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Conversation
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this conversation? This will only remove it from your view. The other participant will still be able to see it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

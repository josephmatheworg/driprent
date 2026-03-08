import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { ConversationList } from '@/components/messages/ConversationList';
import { ChatWindow } from '@/components/messages/ChatWindow';
import { useConversations } from '@/hooks/useConversations';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { ArrowLeft, MessageSquare } from 'lucide-react';

export default function Messages() {
  const [searchParams] = useSearchParams();
  const initialConvo = searchParams.get('conversation');
  const { conversations, loading } = useConversations();
  const [activeId, setActiveId] = useState<string | null>(initialConvo);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (initialConvo) setActiveId(initialConvo);
  }, [initialConvo]);

  const activeConvo = conversations.find(c => c.id === activeId);

  // Mobile: show either list or chat
  const showList = !isMobile || !activeId;
  const showChat = !isMobile || !!activeId;

  return (
    <Layout hideFooter>
      <div className="container mx-auto flex h-[calc(100dvh-4rem)] max-w-6xl overflow-hidden">
        {/* Conversation List */}
        {showList && (
          <div className={`flex flex-col border-r border-border ${isMobile ? 'w-full' : 'w-80 shrink-0'}`}>
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <MessageSquare className="h-5 w-5 text-primary" />
              <h2 className="font-display text-xl">MESSAGES</h2>
            </div>
            {loading ? (
              <div className="flex flex-1 items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading…</p>
              </div>
            ) : (
              <ConversationList
                conversations={conversations}
                activeId={activeId}
                onSelect={setActiveId}
              />
            )}
          </div>
        )}

        {/* Chat Window */}
        {showChat && (
          <div className="flex flex-1 flex-col">
            {activeConvo ? (
              <>
                {isMobile && (
                  <div className="border-b border-border px-2 py-1">
                    <Button variant="ghost" size="sm" onClick={() => setActiveId(null)}>
                      <ArrowLeft className="mr-1 h-4 w-4" /> Back
                    </Button>
                  </div>
                )}
                <ChatWindow
                  conversationId={activeConvo.id}
                  otherUser={activeConvo.other_user}
                />
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-center">
                <div>
                  <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">Select a conversation to start chatting</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

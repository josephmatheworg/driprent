import { useState, useEffect, useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import type { OutfitRequest, RequestReply, Fit } from '@/types/database';
import { Calendar, MapPin, IndianRupee, MessageSquare, Clock, ArrowLeft, Send, ExternalLink, ImagePlus } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [request, setRequest] = useState<OutfitRequest | null>(null);
  const [replies, setReplies] = useState<RequestReply[]>([]);
  const [myFits, setMyFits] = useState<Fit[]>([]);
  const [loading, setLoading] = useState(true);

  // Reply form
  const [comment, setComment] = useState('');
  const [selectedFitId, setSelectedFitId] = useState<string>('none');
  const [submitting, setSubmitting] = useState(false);
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const fetchRequest = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('outfit_requests')
      .select(`*, user:profiles!outfit_requests_user_id_fkey(*)`)
      .eq('id', id)
      .single();

    if (!error && data) setRequest(data as unknown as OutfitRequest);
  }, [id]);

  const fetchReplies = useCallback(async () => {
    if (!id) return;
    const { data, error } = await supabase
      .from('request_replies')
      .select(`*, user:profiles!request_replies_user_id_fkey(*), outfit:fits!request_replies_outfit_id_fkey(*)`)
      .eq('request_id', id)
      .order('created_at', { ascending: false });

    if (!error && data) setReplies(data as unknown as RequestReply[]);
  }, [id]);

  const fetchMyFits = useCallback(async () => {
    if (!profile) return;
    const { data } = await supabase
      .from('fits')
      .select('*')
      .eq('owner_id', profile.id)
      .eq('is_available', true);
    if (data) setMyFits(data as unknown as Fit[]);
  }, [profile]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      await Promise.all([fetchRequest(), fetchReplies()]);
      setLoading(false);
    };
    load();
  }, [fetchRequest, fetchReplies]);

  useEffect(() => {
    if (profile) fetchMyFits();
  }, [profile, fetchMyFits]);

  // Realtime replies
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`replies-${id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'request_replies', filter: `request_id=eq.${id}` }, () => {
        fetchReplies();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, fetchReplies]);

  const handleReplyImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ variant: 'destructive', title: 'File too large', description: 'Max 5MB allowed.' });
        return;
      }
      setReplyImage(file);
      setReplyImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSubmitReply = async () => {
    if (!profile) {
      toast({ variant: 'destructive', title: 'Sign in required', description: 'Please sign in to reply.' });
      return;
    }

    // Must attach an outfit OR upload an image
    if (selectedFitId === 'none' && !replyImage) {
      toast({ variant: 'destructive', title: 'Outfit image is required to respond.', description: 'Please attach one of your listed outfits or upload an outfit image.' });
      return;
    }

    if (comment.trim().length > 500) {
      toast({ variant: 'destructive', title: 'Too long', description: 'Comment must be under 500 characters.' });
      return;
    }

    setSubmitting(true);
    try {
      let uploadedImageUrl: string | null = null;

      // Upload image if provided (and no fit selected)
      if (replyImage && selectedFitId === 'none') {
        setUploading(true);
        const ext = replyImage.name.split('.').pop();
        const filePath = `${profile.id}/${Date.now()}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('requests')
          .upload(filePath, replyImage);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('requests').getPublicUrl(filePath);
        uploadedImageUrl = urlData.publicUrl;
        setUploading(false);
      }

      const { error } = await supabase.from('request_replies').insert({
        request_id: id!,
        user_id: profile.id,
        comment: comment.trim() || (selectedFitId !== 'none' ? 'Check out my outfit!' : 'Here is my outfit suggestion.'),
        outfit_id: selectedFitId !== 'none' ? selectedFitId : null,
      });
      if (error) throw error;
      setComment('');
      setSelectedFitId('none');
      setReplyImage(null);
      setReplyImagePreview(null);
      toast({ title: 'Reply posted!' });
      await fetchReplies();
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Failed', description: err.message });
    } finally {
      setSubmitting(false);
      setUploading(false);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-primary/10 text-primary border-primary/20';
      case 'negotiating': return 'bg-drip-gold/10 text-drip-gold border-drip-gold/20';
      case 'fulfilled': return 'bg-muted text-muted-foreground border-border';
      case 'closed': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return '';
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="h-96 animate-pulse rounded-2xl bg-muted" />
        </div>
      </Layout>
    );
  }

  if (!request) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-20 text-center">
          <h1 className="font-display text-4xl text-foreground">REQUEST NOT FOUND</h1>
          <Button asChild variant="outline" className="mt-4">
            <Link to="/requests">Back to Requests</Link>
          </Button>
        </div>
      </Layout>
    );
  }

  const isOwner = profile?.id === request.user_id;

  return (
    <Layout>
      <div className="container mx-auto max-w-4xl px-4 py-8">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/requests')} className="mb-6">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Requests
        </Button>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Image */}
            {request.reference_image_url && (
              <div className="overflow-hidden rounded-2xl">
                <img
                  src={request.reference_image_url}
                  alt={request.title}
                  className="w-full max-h-96 object-cover"
                />
              </div>
            )}

            {/* Title & Status */}
            <div>
              <div className="flex items-start justify-between gap-4">
                <h1 className="font-display text-3xl text-foreground sm:text-4xl">{request.title.toUpperCase()}</h1>
                <Badge className={`${statusColor(request.status)} border shrink-0`}>
                  {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                </Badge>
              </div>
              {request.description && (
                <p className="mt-4 text-muted-foreground whitespace-pre-wrap">{request.description}</p>
              )}
            </div>

            {/* Details */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{request.size}</Badge>
              <Badge variant="secondary" className="capitalize">{request.category}</Badge>
            </div>

            <div className="space-y-2 text-sm text-muted-foreground">
              {request.date_needed && (
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>Needed by {new Date(request.date_needed).toLocaleDateString()}</span>
                </div>
              )}
              {request.budget && (
                <div className="flex items-center gap-2">
                  <IndianRupee className="h-4 w-4" />
                  <span>₹{request.budget}/day budget</span>
                </div>
              )}
              {request.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4" />
                  <span>{request.location}</span>
                </div>
              )}
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4" />
                <span>Posted {formatDistanceToNow(new Date(request.created_at), { addSuffix: true })}</span>
              </div>
            </div>

            {/* Replies Section */}
            <div className="border-t border-border pt-6">
              <h2 className="font-display text-2xl text-foreground">
                REPLIES ({replies.length})
              </h2>

              {/* Reply Form */}
              {user && !isOwner && request.status === 'open' && (
                <div className="mt-6 rounded-xl border border-border bg-card p-4 space-y-4">
                  <p className="text-sm font-medium text-foreground">Respond with your outfit</p>
                  <p className="text-xs text-muted-foreground">You must attach one of your listed outfits to respond.</p>

                  {myFits.length > 0 ? (
                    <div>
                      <Label>Select Your Outfit *</Label>
                      <Select value={selectedFitId} onValueChange={setSelectedFitId}>
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select an outfit" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Select an outfit —</SelectItem>
                          {myFits.map((fit) => (
                            <SelectItem key={fit.id} value={fit.id}>
                              {fit.title} — ₹{fit.daily_price}/day
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  ) : (
                    <div className="rounded-lg border border-border bg-muted/50 p-4 text-center">
                      <p className="text-sm text-muted-foreground">You don't have any listed outfits yet.</p>
                      <Button asChild variant="outline" size="sm" className="mt-2">
                        <Link to="/upload">Upload an Outfit</Link>
                      </Button>
                    </div>
                  )}

                  {/* Outfit preview */}
                  {selectedFitId !== 'none' && (() => {
                    const fit = myFits.find(f => f.id === selectedFitId);
                    if (!fit) return null;
                    return (
                      <div className="flex gap-3 rounded-lg border border-border bg-muted/50 p-3">
                        <img src={fit.images?.[0] || '/placeholder.svg'} alt={fit.title} className="h-16 w-16 rounded-lg object-cover" />
                        <div>
                          <p className="font-medium text-sm text-foreground">{fit.title}</p>
                          <p className="text-xs text-muted-foreground">₹{fit.daily_price}/day</p>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <Label>Message (optional)</Label>
                    <Textarea
                      placeholder="Add a message about your outfit..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="mt-1.5"
                    />
                  </div>

                  <Button
                    onClick={handleSubmitReply}
                    disabled={submitting || uploading || (selectedFitId === 'none' && myFits.length > 0)}
                    variant="terracotta"
                  >
                    <Send className="mr-2 h-4 w-4" />
                    {submitting || uploading ? 'Posting...' : 'Submit Reply'}
                  </Button>
                </div>
              )}

              {/* Reply List */}
              <div className="mt-6 space-y-4">
                {replies.length === 0 ? (
                  <p className="text-muted-foreground text-sm">No replies yet. Be the first to respond!</p>
                ) : (
                  replies.map((reply) => (
                    <Card key={reply.id} className="border-border">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-3">
                          <Avatar className="h-8 w-8 shrink-0">
                            <AvatarImage src={reply.user?.avatar_url || ''} />
                            <AvatarFallback className="text-xs">
                              {reply.user?.username?.charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium text-foreground">{reply.user?.username}</span>
                              <span className="text-xs text-muted-foreground">
                                {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="mt-1 text-sm text-muted-foreground whitespace-pre-wrap">{reply.comment}</p>

                            {/* Attached outfit */}
                            {reply.outfit && (
                              <div className="mt-3 flex gap-3 rounded-lg border border-border bg-muted/50 p-3">
                                <img
                                  src={reply.outfit.images?.[0] || '/placeholder.svg'}
                                  alt={reply.outfit.title}
                                  className="h-16 w-16 rounded-lg object-cover"
                                />
                                <div className="flex-1 min-w-0">
                                  <p className="font-medium text-sm text-foreground truncate">{reply.outfit.title}</p>
                                  <p className="text-xs text-muted-foreground">₹{reply.outfit.daily_price}/day</p>
                                  <div className="mt-1 flex gap-2">
                                    <Button asChild size="sm" variant="outline" className="h-7 text-xs">
                                      <Link to={`/fit/${reply.outfit.id}`}>
                                        <ExternalLink className="mr-1 h-3 w-3" /> View Outfit
                                      </Link>
                                    </Button>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Chat with owner button — visible to request owner */}
                            {isOwner && reply.user_id !== profile?.id && (
                              <Button asChild size="sm" variant="ghost" className="mt-2 h-7 text-xs">
                                <Link to="/messages">
                                  <MessageSquare className="mr-1 h-3 w-3" /> Chat With Owner
                                </Link>
                              </Button>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Requester Profile */}
            <Card className="border-border">
              <CardContent className="p-4">
                <h3 className="font-semibold text-sm text-foreground mb-3">Requested by</h3>
                {request.user && (
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={request.user.avatar_url || ''} />
                      <AvatarFallback>{request.user.username?.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-medium text-sm text-foreground">{request.user.username}</p>
                      {request.user.location && (
                        <p className="text-xs text-muted-foreground">{request.user.location}</p>
                      )}
                    </div>
                  </div>
                )}

                {user && !isOwner && (
                  <Button asChild variant="outline" size="sm" className="mt-4 w-full">
                    <Link to="/messages">
                      <MessageSquare className="mr-2 h-4 w-4" /> Chat With Requester
                    </Link>
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Quick Info */}
            <Card className="border-border">
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold text-sm text-foreground">Quick Info</h3>
                <div className="text-sm text-muted-foreground space-y-2">
                  <div className="flex justify-between">
                    <span>Status</span>
                    <Badge className={`${statusColor(request.status)} border text-xs`}>
                      {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Replies</span>
                    <span className="font-medium text-foreground">{replies.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size</span>
                    <span className="font-medium text-foreground">{request.size}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Category</span>
                    <span className="font-medium text-foreground capitalize">{request.category}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}

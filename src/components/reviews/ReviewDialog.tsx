import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

const RENTER_TAGS = [
  'Returned on time',
  'Returned late',
  'Took good care of outfit',
  'Outfit returned damaged',
  'Good communication',
];

const OWNER_TAGS = [
  'Outfit exactly as described',
  'Clean outfit',
  'Friendly owner',
  'Late response',
  'Misleading listing',
];

interface ReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rentalId: string;
  reviewType: 'owner' | 'renter'; // who is being reviewed
  reviewedUserId: string;
  reviewedFitId?: string;
  onReviewSubmitted: () => void;
}

export function ReviewDialog({
  open,
  onOpenChange,
  rentalId,
  reviewType,
  reviewedUserId,
  reviewedFitId,
  onReviewSubmitted,
}: ReviewDialogProps) {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const tags = reviewType === 'renter' ? RENTER_TAGS : OWNER_TAGS;

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = async () => {
    if (!profile || rating === 0) {
      toast({ variant: 'destructive', title: 'Please select a rating' });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from('reviews').insert({
      rental_id: rentalId,
      reviewer_id: profile.id,
      reviewed_user_id: reviewedUserId,
      reviewed_fit_id: reviewedFitId || null,
      rating,
      review_type: reviewType,
      comment: comment.trim() || null,
      review_tags: selectedTags,
    });

    setSubmitting(false);

    if (error) {
      if (error.code === '23505') {
        toast({ variant: 'destructive', title: 'Already reviewed', description: 'You have already left a review for this rental.' });
      } else {
        toast({ variant: 'destructive', title: 'Review failed', description: error.message });
      }
      return;
    }

    toast({ title: 'Review submitted!', description: 'Thank you for your feedback.' });
    onOpenChange(false);
    onReviewSubmitted();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Leave a Review</DialogTitle>
          <DialogDescription>
            Rate the {reviewType === 'renter' ? 'renter' : 'outfit owner'}
          </DialogDescription>
        </DialogHeader>

        {/* Star Rating */}
        <div className="flex items-center justify-center gap-1 py-2">
          {[1, 2, 3, 4, 5].map(star => (
            <button
              key={star}
              type="button"
              onMouseEnter={() => setHoverRating(star)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(star)}
              className="p-0.5"
            >
              <Star
                className={cn(
                  'h-8 w-8 transition-colors',
                  (hoverRating || rating) >= star
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-muted-foreground/30'
                )}
              />
            </button>
          ))}
        </div>
        {rating > 0 && (
          <p className="text-center text-sm text-muted-foreground">{rating}/5 stars</p>
        )}

        {/* Tags */}
        <div>
          <p className="mb-2 text-sm font-medium">Select tags (optional)</p>
          <div className="flex flex-wrap gap-2">
            {tags.map(tag => (
              <Badge
                key={tag}
                variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                className="cursor-pointer select-none"
                onClick={() => toggleTag(tag)}
              >
                {tag}
              </Badge>
            ))}
          </div>
        </div>

        {/* Comment */}
        <div>
          <p className="mb-2 text-sm font-medium">Comment (optional)</p>
          <Textarea
            value={comment}
            onChange={e => setComment(e.target.value)}
            placeholder="Share your experience..."
            maxLength={500}
          />
        </div>

        <Button onClick={handleSubmit} disabled={submitting || rating === 0}>
          {submitting ? 'Submitting...' : 'Submit Review'}
        </Button>
      </DialogContent>
    </Dialog>
  );
}

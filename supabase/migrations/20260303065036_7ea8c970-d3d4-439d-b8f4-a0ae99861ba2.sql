
CREATE TABLE public.outfits (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    item_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.outfits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own outfits"
ON public.outfits FOR SELECT
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can create their own outfits"
ON public.outfits FOR INSERT
WITH CHECK (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own outfits"
ON public.outfits FOR UPDATE
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own outfits"
ON public.outfits FOR DELETE
USING (user_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));

CREATE TRIGGER update_outfits_updated_at
BEFORE UPDATE ON public.outfits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

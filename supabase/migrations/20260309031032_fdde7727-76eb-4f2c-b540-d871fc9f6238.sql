
-- Create request_category enum
CREATE TYPE public.request_category AS ENUM ('menswear', 'womenswear', 'unisex');

-- Create request_status enum
CREATE TYPE public.request_status AS ENUM ('open', 'negotiating', 'fulfilled', 'closed');

-- Create outfit_requests table
CREATE TABLE public.outfit_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  reference_image_url TEXT,
  size TEXT NOT NULL,
  category request_category NOT NULL DEFAULT 'unisex',
  date_needed DATE,
  budget NUMERIC,
  location TEXT,
  status request_status NOT NULL DEFAULT 'open',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create request_replies table
CREATE TABLE public.request_replies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID NOT NULL REFERENCES public.outfit_requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outfit_id UUID REFERENCES public.fits(id) ON DELETE SET NULL,
  comment TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.outfit_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.request_replies ENABLE ROW LEVEL SECURITY;

-- Outfit requests policies
CREATE POLICY "Outfit requests are viewable by everyone"
  ON public.outfit_requests FOR SELECT
  USING (true);

CREATE POLICY "Users can create their own outfit requests"
  ON public.outfit_requests FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can update their own outfit requests"
  ON public.outfit_requests FOR UPDATE
  USING (user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can delete their own outfit requests"
  ON public.outfit_requests FOR DELETE
  USING (user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Request replies policies
CREATE POLICY "Request replies are viewable by everyone"
  ON public.request_replies FOR SELECT
  USING (true);

CREATE POLICY "Users can create replies"
  ON public.request_replies FOR INSERT
  WITH CHECK (user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid()));

CREATE POLICY "Users can delete their own replies"
  ON public.request_replies FOR DELETE
  USING (user_id IN (SELECT id FROM profiles WHERE profiles.user_id = auth.uid()));

-- Create storage bucket for request images
INSERT INTO storage.buckets (id, name, public) VALUES ('requests', 'requests', true);

-- Storage policies for requests bucket
CREATE POLICY "Anyone can view request images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'requests');

CREATE POLICY "Authenticated users can upload request images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'requests' AND auth.role() = 'authenticated');

CREATE POLICY "Users can delete their own request images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'requests' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Trigger for updated_at
CREATE TRIGGER update_outfit_requests_updated_at
  BEFORE UPDATE ON public.outfit_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Notification trigger for new replies
CREATE OR REPLACE FUNCTION public.notify_request_reply()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _replier_username text;
  _request_title text;
  _request_owner_id uuid;
BEGIN
  SELECT p.username INTO _replier_username FROM profiles p WHERE p.id = NEW.user_id;
  SELECT r.title, r.user_id INTO _request_title, _request_owner_id FROM outfit_requests r WHERE r.id = NEW.request_id;

  IF _request_owner_id != NEW.user_id THEN
    INSERT INTO notifications (user_id, title, message, type, metadata)
    VALUES (
      _request_owner_id,
      'New Reply',
      _replier_username || ' replied to your outfit request "' || _request_title || '".',
      'request_reply',
      jsonb_build_object('request_id', NEW.request_id, 'reply_id', NEW.id)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_request_reply_created
  AFTER INSERT ON public.request_replies
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_request_reply();

-- Enable realtime for replies
ALTER PUBLICATION supabase_realtime ADD TABLE public.request_replies;

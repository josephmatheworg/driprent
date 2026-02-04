-- Create enums for categories and status
CREATE TYPE public.fit_category AS ENUM ('dresses', 'suits', 'streetwear', 'formal', 'casual', 'accessories', 'shoes', 'outerwear', 'vintage', 'designer');
CREATE TYPE public.fit_size AS ENUM ('XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL');
CREATE TYPE public.rental_status AS ENUM ('pending', 'confirmed', 'active', 'returned', 'cancelled', 'disputed');
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Create profiles table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    location TEXT,
    phone TEXT,
    rating DECIMAL(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create user_roles table for admin management
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Create fits table
CREATE TABLE public.fits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    category fit_category NOT NULL,
    size fit_size NOT NULL,
    brand TEXT,
    color TEXT,
    daily_price DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    images TEXT[] NOT NULL DEFAULT '{}',
    available_from DATE NOT NULL DEFAULT CURRENT_DATE,
    available_to DATE,
    is_available BOOLEAN NOT NULL DEFAULT true,
    condition TEXT DEFAULT 'Excellent',
    care_instructions TEXT,
    total_rentals INTEGER DEFAULT 0,
    rating DECIMAL(3,2) DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rentals table
CREATE TABLE public.rentals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fit_id UUID REFERENCES public.fits(id) ON DELETE CASCADE NOT NULL,
    renter_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    owner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_days INTEGER NOT NULL,
    rental_fee DECIMAL(10,2) NOT NULL,
    deposit_amount DECIMAL(10,2) NOT NULL,
    service_fee DECIMAL(10,2) NOT NULL DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL,
    status rental_status NOT NULL DEFAULT 'pending',
    stripe_payment_intent_id TEXT,
    agreement_accepted BOOLEAN DEFAULT false,
    agreement_accepted_at TIMESTAMP WITH TIME ZONE,
    return_notes TEXT,
    returned_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create reviews table
CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    rental_id UUID REFERENCES public.rentals(id) ON DELETE CASCADE NOT NULL,
    reviewer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    reviewed_user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reviewed_fit_id UUID REFERENCES public.fits(id) ON DELETE CASCADE,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    review_type TEXT NOT NULL CHECK (review_type IN ('fit', 'renter', 'owner')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create notifications table
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL,
    read BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create has_role function for admin checks
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles
FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" ON public.profiles
FOR UPDATE USING (auth.uid() = user_id);

-- User roles policies
CREATE POLICY "Users can view their own roles" ON public.user_roles
FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Fits policies
CREATE POLICY "Fits are viewable by everyone" ON public.fits
FOR SELECT USING (true);

CREATE POLICY "Users can insert their own fits" ON public.fits
FOR INSERT WITH CHECK (owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own fits" ON public.fits
FOR UPDATE USING (owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can delete their own fits" ON public.fits
FOR DELETE USING (owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Rentals policies
CREATE POLICY "Users can view their own rentals" ON public.rentals
FOR SELECT USING (
    renter_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
);

CREATE POLICY "Users can create rentals" ON public.rentals
FOR INSERT WITH CHECK (renter_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Owners can update rental status" ON public.rentals
FOR UPDATE USING (
    owner_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    renter_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()) OR
    public.has_role(auth.uid(), 'admin')
);

-- Reviews policies
CREATE POLICY "Reviews are viewable by everyone" ON public.reviews
FOR SELECT USING (true);

CREATE POLICY "Users can create reviews for their rentals" ON public.reviews
FOR INSERT WITH CHECK (reviewer_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Notifications policies
CREATE POLICY "Users can view their own notifications" ON public.notifications
FOR SELECT USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can update their own notifications" ON public.notifications
FOR UPDATE USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fits_updated_at
    BEFORE UPDATE ON public.fits
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rentals_updated_at
    BEFORE UPDATE ON public.rentals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (user_id, username, full_name, avatar_url)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', SPLIT_PART(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
        NEW.raw_user_meta_data->>'avatar_url'
    );
    
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new user signup
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();

-- Create storage bucket for fit images
INSERT INTO storage.buckets (id, name, public) VALUES ('fits', 'fits', true);

-- Storage policies for fit images
CREATE POLICY "Fit images are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'fits');

CREATE POLICY "Users can upload fit images"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'fits' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own fit images"
ON storage.objects FOR UPDATE
USING (bucket_id = 'fits' AND auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete their own fit images"
ON storage.objects FOR DELETE
USING (bucket_id = 'fits' AND auth.uid() IS NOT NULL);
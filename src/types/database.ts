export type FitCategory = 'dresses' | 'suits' | 'streetwear' | 'formal' | 'casual' | 'accessories' | 'shoes' | 'outerwear' | 'vintage' | 'designer';
export type FitSize = 'XXS' | 'XS' | 'S' | 'M' | 'L' | 'XL' | 'XXL' | '3XL';
export type RentalStatus = 'pending' | 'accepted' | 'confirmed' | 'active' | 'returned' | 'cancelled' | 'disputed' | 'completed';
export type RequestCategory = 'menswear' | 'womenswear' | 'unisex';
export type RequestStatus = 'open' | 'negotiating' | 'fulfilled' | 'closed';

export interface Profile {
  id: string;
  user_id: string;
  username: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  location: string | null;
  location_city: string | null;
  location_state: string | null;
  location_country: string | null;
  latitude: number | null;
  longitude: number | null;
  phone: string | null;
  date_of_birth: string | null;
  gender: string | null;
  rating: number;
  total_reviews: number;
  profile_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Fit {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  category: FitCategory;
  size: FitSize;
  brand: string | null;
  color: string | null;
  daily_price: number;
  deposit_amount: number;
  images: string[];
  available_from: string;
  available_to: string | null;
  is_available: boolean;
  condition: string | null;
  care_instructions: string | null;
  total_rentals: number;
  rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
  owner?: Profile;
}

export interface Rental {
  id: string;
  fit_id: string;
  renter_id: string;
  owner_id: string;
  start_date: string;
  end_date: string;
  total_days: number;
  rental_fee: number;
  deposit_amount: number;
  service_fee: number;
  total_amount: number;
  status: RentalStatus;
  stripe_payment_intent_id: string | null;
  agreement_accepted: boolean;
  agreement_accepted_at: string | null;
  return_notes: string | null;
  returned_at: string | null;
  created_at: string;
  updated_at: string;
  fit?: Fit;
  renter?: Profile;
  owner?: Profile;
}

export interface Review {
  id: string;
  rental_id: string;
  reviewer_id: string;
  reviewed_user_id: string | null;
  reviewed_fit_id: string | null;
  rating: number;
  comment: string | null;
  review_type: 'fit' | 'renter' | 'owner';
  created_at: string;
  reviewer?: Profile;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface OutfitRequest {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  reference_image_url: string | null;
  size: string;
  category: RequestCategory;
  date_needed: string | null;
  budget: number | null;
  location: string | null;
  status: RequestStatus;
  created_at: string;
  updated_at: string;
  user?: Profile;
  reply_count?: number;
}

export interface RequestReply {
  id: string;
  request_id: string;
  user_id: string;
  outfit_id: string | null;
  comment: string;
  created_at: string;
  user?: Profile;
  outfit?: Fit;
}

export const CATEGORIES: { value: FitCategory; label: string }[] = [
  { value: 'dresses', label: 'Dresses' },
  { value: 'suits', label: 'Suits' },
  { value: 'streetwear', label: 'Streetwear' },
  { value: 'formal', label: 'Formal' },
  { value: 'casual', label: 'Casual' },
  { value: 'accessories', label: 'Accessories' },
  { value: 'shoes', label: 'Shoes' },
  { value: 'outerwear', label: 'Outerwear' },
  { value: 'vintage', label: 'Vintage' },
  { value: 'designer', label: 'Designer' },
];

export const SIZES: { value: FitSize; label: string }[] = [
  { value: 'XXS', label: 'XXS' },
  { value: 'XS', label: 'XS' },
  { value: 'S', label: 'S' },
  { value: 'M', label: 'M' },
  { value: 'L', label: 'L' },
  { value: 'XL', label: 'XL' },
  { value: 'XXL', label: 'XXL' },
  { value: '3XL', label: '3XL' },
];

export const REQUEST_CATEGORIES: { value: RequestCategory; label: string }[] = [
  { value: 'menswear', label: 'Menswear' },
  { value: 'womenswear', label: 'Womenswear' },
  { value: 'unisex', label: 'Unisex' },
];

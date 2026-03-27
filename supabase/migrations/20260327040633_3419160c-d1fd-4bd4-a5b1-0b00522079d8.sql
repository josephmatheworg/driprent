CREATE UNIQUE INDEX idx_one_active_deal_per_outfit
  ON public.rentals (fit_id)
  WHERE status IN ('accepted', 'confirmed', 'active');
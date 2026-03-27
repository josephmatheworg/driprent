
-- Auto-update profile and fit ratings when a review is inserted
CREATE OR REPLACE FUNCTION public.update_ratings_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _avg_rating numeric;
  _count integer;
BEGIN
  -- Update reviewed user's profile rating
  IF NEW.reviewed_user_id IS NOT NULL THEN
    SELECT COALESCE(AVG(rating), 0), COUNT(*) INTO _avg_rating, _count
    FROM reviews WHERE reviewed_user_id = NEW.reviewed_user_id;

    UPDATE profiles SET rating = ROUND(_avg_rating, 2), total_reviews = _count
    WHERE id = NEW.reviewed_user_id;
  END IF;

  -- Update reviewed fit's rating
  IF NEW.reviewed_fit_id IS NOT NULL THEN
    SELECT COALESCE(AVG(rating), 0), COUNT(*) INTO _avg_rating, _count
    FROM reviews WHERE reviewed_fit_id = NEW.reviewed_fit_id;

    UPDATE fits SET rating = ROUND(_avg_rating, 2), total_reviews = _count
    WHERE id = NEW.reviewed_fit_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS on_review_inserted ON reviews;
CREATE TRIGGER on_review_inserted
  AFTER INSERT ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_ratings_on_review();

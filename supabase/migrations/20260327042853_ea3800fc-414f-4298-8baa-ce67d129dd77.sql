-- Remove duplicate message notification trigger (keep on_new_message, drop on_message_created)
DROP TRIGGER IF EXISTS on_message_created ON public.messages;

-- Remove duplicate auto_cancel trigger (keep the BEFORE one, drop the AFTER one)
DROP TRIGGER IF EXISTS trg_auto_cancel_competing_requests ON public.rentals;
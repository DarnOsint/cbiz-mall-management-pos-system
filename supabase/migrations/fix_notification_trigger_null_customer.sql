-- Fix: notify_order_status_change() trigger inserts into notifications
-- with user_id = NEW.customer_id, which is NULL for dine-in table orders.
-- Skip notification when customer_id is NULL.
CREATE OR REPLACE FUNCTION public.notify_order_status_change()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_status_label TEXT;
  v_title TEXT;
  v_body TEXT;
BEGIN
  -- Only notify for customer-facing orders (online/mobile orders with a customer_id)
  IF NEW.customer_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_status_label := CASE NEW.status
    WHEN 'open' THEN 'Order Placed'
    WHEN 'preparing' THEN 'Being Prepared'
    WHEN 'ready' THEN 'Ready'
    WHEN 'dispatched' THEN 'Out for Delivery'
    WHEN 'delivered' THEN 'Delivered'
    WHEN 'cancelled' THEN 'Cancelled'
    WHEN 'paid' THEN 'Completed'
    ELSE NEW.status
  END;

  v_title := 'Order ' || v_status_label;
  v_body := 'Your order #' || COALESCE(NEW.order_number, substring(NEW.id::text, 1, 8)) || ' is ' || v_status_label;

  INSERT INTO public.notifications (user_id, title, body, data)
  VALUES (
    NEW.customer_id,
    v_title,
    v_body,
    jsonb_build_object('orderId', NEW.id, 'status', NEW.status)
  );

  RETURN NEW;
END;
$function$;

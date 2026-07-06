-- Fix: recalculate_order_total() trigger referenced void_qty on order_items
-- which doesn't exist. Replaced with return_requested/return_accepted filter.
CREATE OR REPLACE FUNCTION recalculate_order_total()
RETURNS TRIGGER AS $$
DECLARE
  real_total numeric;
BEGIN
  -- Only recalculate when status changes to 'paid'
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT COALESCE(SUM(total_price), 0)
      INTO real_total
      FROM order_items
     WHERE order_id = NEW.id
       AND return_requested IS NOT TRUE
       AND return_accepted IS NOT TRUE;

    -- Only override if client total differs by more than 1 currency unit (floating point tolerance)
    IF ABS(real_total - NEW.total_amount) > 1 THEN
      NEW.total_amount := real_total;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

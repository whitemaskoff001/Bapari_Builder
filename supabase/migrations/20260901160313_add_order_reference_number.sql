/*
# Add Order Reference Number

1. Changes to existing tables
- `orders`: adds `reference_number` column (text, unique) — a human-readable order code
  like "BAP010926ST001" (BAP + DD + MM + YY + first/last initials of buyer + daily sequence).

2. Modified functions
- `place_order`: now generates the reference_number automatically and returns it alongside
  order_id and access_token. The format is:
    BAP + DD + MM + YY + <first letter of name> + <last letter of name> + 3-digit daily sequence
  Example: Order placed on 2026-09-01 by "Sifat" → BAP010926ST001
- `get_order_by_access_token`: now includes reference_number in the returned JSON.
- New function `get_order_by_reference`: looks up an order by its short reference number.

3. Security
- reference_number is read-only (generated server-side, never client-supplied).
- New function granted to anon + authenticated for public order tracking.
- Unique constraint on reference_number prevents duplicates.
*/

-- Add reference_number column to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS reference_number text;

CREATE INDEX IF NOT EXISTS idx_orders_reference_number ON orders(reference_number);

-- Must drop place_order first because return type changed (added reference_number column)
DROP FUNCTION IF EXISTS place_order(text, text, text, text, jsonb);

-- ============================================================
-- Recreate place_order with reference_number generation
-- ============================================================
CREATE OR REPLACE FUNCTION place_order(
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_delivery_address text,
  p_items jsonb
)
RETURNS TABLE (
  order_id uuid,
  access_token text,
  reference_number text
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_access_token text;
  v_reference text;
  v_item jsonb;
  v_date_part text;
  v_initials text;
  v_seq int;
  v_clean_name text;
  v_first_char text;
  v_last_char text;
BEGIN
  IF p_buyer_name IS NULL OR trim(p_buyer_name) = '' THEN
    RAISE EXCEPTION 'Name is required';
  END IF;
  IF p_buyer_email IS NULL OR trim(p_buyer_email) = '' THEN
    RAISE EXCEPTION 'Email is required';
  END IF;
  IF p_buyer_phone IS NULL OR trim(p_buyer_phone) = '' THEN
    RAISE EXCEPTION 'Phone is required';
  END IF;
  IF p_delivery_address IS NULL OR trim(p_delivery_address) = '' THEN
    RAISE EXCEPTION 'Delivery address is required';
  END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'At least one item is required';
  END IF;

  -- Build date part: DDMMYY
  v_date_part := to_char(now(), 'DDMMYY');

  -- Extract initials from buyer name (first and last alpha character, uppercased)
  v_clean_name := upper(regexp_replace(p_buyer_name, '[^a-zA-Z]', '', 'g'));
  v_first_char := CASE WHEN length(v_clean_name) > 0 THEN substr(v_clean_name, 1, 1) ELSE 'X' END;
  v_last_char := CASE WHEN length(v_clean_name) > 1 THEN substr(v_clean_name, length(v_clean_name), 1) ELSE v_first_char END;
  v_initials := v_first_char || v_last_char;

  -- Get daily sequence: count orders created today + 1
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM orders
  WHERE created_at >= date_trunc('day', now())
    AND created_at < date_trunc('day', now()) + interval '1 day';

  -- Build reference: BAP + DDMMYY + Initials + 3-digit sequence
  v_reference := 'BAP' || v_date_part || v_initials || lpad(v_seq::text, 3, '0');

  INSERT INTO orders (buyer_name, buyer_email, buyer_phone, delivery_address, reference_number)
  VALUES (p_buyer_name, lower(p_buyer_email), p_buyer_phone, p_delivery_address, v_reference)
  RETURNING id, access_token INTO v_order_id, v_access_token;

  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (order_id, category_id, category_name, quantity, unit, option_selections)
    VALUES (
      v_order_id,
      NULLIF(v_item->>'category_id', '')::uuid,
      v_item->>'category_name',
      COALESCE(NULLIF(v_item->>'quantity', '')::numeric, 0),
      v_item->>'unit',
      COALESCE(v_item->'option_selections', '{}'::jsonb)
    );
  END LOOP;

  -- Create notifications for all staff
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    p.id,
    'new_order',
    'New Order Received',
    'Order ' || v_reference || ' from ' || p_buyer_name || ' (' || p_buyer_phone || ')',
    jsonb_build_object('order_id', v_order_id, 'reference_number', v_reference)
  FROM profiles p;

  RETURN QUERY SELECT v_order_id, v_access_token, v_reference;
END;
$$;

-- Drop and recreate get_order_by_access_token (return shape changed: added reference_number)
DROP FUNCTION IF EXISTS get_order_by_access_token(text);

CREATE OR REPLACE FUNCTION get_order_by_access_token(p_access_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order record;
  v_items jsonb;
  v_deal jsonb;
BEGIN
  SELECT * INTO v_order FROM orders WHERE access_token = p_access_token;
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'category_name', oi.category_name,
      'quantity', oi.quantity,
      'unit', oi.unit,
      'option_selections', oi.option_selections
    )
  ), '[]'::jsonb) INTO v_items
  FROM order_items oi WHERE oi.order_id = v_order.id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'status', d.status,
      'total_price', d.total_price,
      'down_payment', d.down_payment,
      'total_paid', d.total_paid,
      'remaining_balance', d.remaining_balance,
      'buyer_token', d.buyer_token
    )
  ), '[]'::jsonb) INTO v_deal
  FROM deals d WHERE d.order_id = v_order.id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'reference_number', v_order.reference_number,
    'buyer_name', v_order.buyer_name,
    'buyer_email', v_order.buyer_email,
    'buyer_phone', v_order.buyer_phone,
    'delivery_address', v_order.delivery_address,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'items', v_items,
    'deals', v_deal
  );
END;
$$;

-- ============================================================
-- NEW: get_order_by_reference — public lookup by short reference
-- ============================================================
CREATE OR REPLACE FUNCTION get_order_by_reference(p_reference_number text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order record;
  v_items jsonb;
  v_deal jsonb;
BEGIN
  SELECT * INTO v_order FROM orders WHERE reference_number = upper(trim(p_reference_number));
  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', oi.id,
      'category_name', oi.category_name,
      'quantity', oi.quantity,
      'unit', oi.unit,
      'option_selections', oi.option_selections
    )
  ), '[]'::jsonb) INTO v_items
  FROM order_items oi WHERE oi.order_id = v_order.id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', d.id,
      'status', d.status,
      'total_price', d.total_price,
      'down_payment', d.down_payment,
      'total_paid', d.total_paid,
      'remaining_balance', d.remaining_balance,
      'buyer_token', d.buyer_token
    )
  ), '[]'::jsonb) INTO v_deal
  FROM deals d WHERE d.order_id = v_order.id;

  RETURN jsonb_build_object(
    'id', v_order.id,
    'reference_number', v_order.reference_number,
    'buyer_name', v_order.buyer_name,
    'buyer_email', v_order.buyer_email,
    'buyer_phone', v_order.buyer_phone,
    'delivery_address', v_order.delivery_address,
    'status', v_order.status,
    'created_at', v_order.created_at,
    'items', v_items,
    'deals', v_deal
  );
END;
$$;

-- Re-grant execute on all recreated/new functions
GRANT EXECUTE ON FUNCTION place_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_by_access_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_by_reference TO anon, authenticated;

-- Add unique constraint on reference_number
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'orders_reference_number_key'
  ) THEN
    ALTER TABLE orders ADD CONSTRAINT orders_reference_number_key UNIQUE (reference_number);
  END IF;
END $$;

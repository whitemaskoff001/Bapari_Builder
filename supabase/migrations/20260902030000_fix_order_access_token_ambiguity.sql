-- Fix ambiguous access_token reference in place_order and restore EXECUTE grants.
-- RETURNS TABLE (access_token text) makes "access_token" a PL/pgSQL variable, so
-- RETURNING access_token from the INSERT is ambiguous and every order fails with 42702.

DROP FUNCTION IF EXISTS place_order(text, text, text, text, jsonb);

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

  -- BAP + DDMMYY + first and last letter of buyer name + 3-digit daily sequence
  -- Example: Sifat on 2026-09-02, first order of the day → BAP020926ST001
  v_date_part := to_char(now(), 'DDMMYY');
  v_clean_name := upper(regexp_replace(p_buyer_name, '[^a-zA-Z]', '', 'g'));
  v_first_char := CASE WHEN length(v_clean_name) > 0 THEN substr(v_clean_name, 1, 1) ELSE 'X' END;
  v_last_char := CASE WHEN length(v_clean_name) > 1 THEN substr(v_clean_name, length(v_clean_name), 1) ELSE v_first_char END;
  v_initials := v_first_char || v_last_char;

  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM orders
  WHERE created_at >= date_trunc('day', now())
    AND created_at < date_trunc('day', now()) + interval '1 day';

  v_reference := 'BAP' || v_date_part || v_initials || lpad(v_seq::text, 3, '0');

  INSERT INTO orders (buyer_name, buyer_email, buyer_phone, delivery_address, reference_number)
  VALUES (p_buyer_name, lower(p_buyer_email), p_buyer_phone, p_delivery_address, v_reference)
  RETURNING id INTO v_order_id;

  SELECT o.access_token INTO v_access_token
  FROM orders o
  WHERE o.id = v_order_id;

  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    INSERT INTO order_items (order_id, category_id, category_name, quantity, unit, option_selections)
    VALUES (
      v_order_id,
      NULLIF(v_item->>'category_id', '')::uuid,
      v_item->>'category_name',
      COALESCE((v_item->>'quantity')::numeric, 0),
      COALESCE(v_item->>'unit', ''),
      COALESCE(v_item->'option_selections', '{}'::jsonb)
    );
  END LOOP;

  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    p.id,
    'new_order',
    'New Order Received',
    'Order ' || v_reference || ' from ' || p_buyer_name || ' (' || p_buyer_phone || ')',
    jsonb_build_object('order_id', v_order_id, 'reference_number', v_reference)
  FROM profiles p
  WHERE p.role IN ('admin', 'seller');

  RETURN QUERY SELECT v_order_id, v_access_token, v_reference;
END;
$$;

GRANT EXECUTE ON FUNCTION place_order(text, text, text, text, jsonb) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_by_access_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_by_reference(text) TO anon, authenticated;

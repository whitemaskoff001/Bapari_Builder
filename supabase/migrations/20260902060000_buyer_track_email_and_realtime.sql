-- Buyer email opens Track order with the BAP reference already filled.
-- Enable Realtime so staff pages update without a manual refresh.

DO $$
BEGIN
  ALTER TABLE notifications REPLICA IDENTITY FULL;
  ALTER TABLE orders REPLICA IDENTITY FULL;
  ALTER TABLE order_items REPLICA IDENTITY FULL;
  ALTER TABLE deals REPLICA IDENTITY FULL;
  ALTER TABLE payments REPLICA IDENTITY FULL;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE orders;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE deals;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE payments;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
  v_token text;
  v_reference text;
  v_item jsonb;
  v_date_part text;
  v_initials text;
  v_seq int;
  v_clean_name text;
  v_first_char text;
  v_last_char text;
  v_items_text text;
  v_details text;
  v_open_url text;
BEGIN
  IF p_buyer_name IS NULL OR trim(p_buyer_name) = '' THEN RAISE EXCEPTION 'Name is required'; END IF;
  IF p_buyer_email IS NULL OR trim(p_buyer_email) = '' THEN RAISE EXCEPTION 'Email is required'; END IF;
  IF p_buyer_phone IS NULL OR trim(p_buyer_phone) = '' THEN RAISE EXCEPTION 'Phone is required'; END IF;
  IF p_delivery_address IS NULL OR trim(p_delivery_address) = '' THEN RAISE EXCEPTION 'Delivery address is required'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'At least one item is required'; END IF;

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

  SELECT o.access_token INTO v_token FROM orders o WHERE o.id = v_order_id;

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

  v_items_text := format_order_items(v_order_id);
  v_details :=
    'Reference: ' || v_reference || E'\n'
    || 'Name: ' || p_buyer_name || E'\n'
    || 'Phone: ' || p_buyer_phone || E'\n'
    || 'Email: ' || p_buyer_email || E'\n'
    || 'Delivery address: ' || p_delivery_address || E'\n\n'
    || 'Materials:' || E'\n' || v_items_text;
  v_open_url := site_link('manage/pending/' || v_order_id::text);

  PERFORM notify_all_staff(
    'new_order',
    'New order ' || v_reference || ' — tap to open',
    v_details || E'\n\nCall the buyer, then Pick or Reject.',
    jsonb_build_object(
      'order_id', v_order_id,
      'reference_number', v_reference,
      'tab', 'pending',
      'action', 'review',
      'buyer_name', p_buyer_name,
      'buyer_phone', p_buyer_phone,
      'buyer_email', lower(p_buyer_email),
      'delivery_address', p_delivery_address,
      'items_text', v_items_text
    )
  );

  PERFORM dispatch_email(
    lower(p_buyer_email),
    'Waiting for confirmation — ' || v_reference,
    'Hi ' || p_buyer_name || ',' || E'\n\n'
      || 'We received your materials request. Status: Waiting for confirmation.' || E'\n'
      || 'Our team will call you at ' || p_buyer_phone || '.' || E'\n\n'
      || v_details || E'\n\n'
      || 'Click the button below to open tracking. Your reference is already applied — no need to paste it.' || E'\n'
      || 'Reference: ' || v_reference,
    site_link('status/' || v_reference),
    'Track this order'
  );
  PERFORM email_all_staff(
    'New order ' || v_reference || ' — open to review',
    'A buyer sent a materials request. Open this notice to see every line, then Pick or Reject.' || E'\n\n' || v_details,
    v_open_url,
    'Open this order'
  );

  RETURN QUERY SELECT v_order_id, v_token, v_reference;
END;
$$;

GRANT EXECUTE ON FUNCTION place_order(text, text, text, text, jsonb) TO anon, authenticated;

-- Order lifecycle after place_order: deal terms, staff confirm, payments,
-- catalog reseed, email dispatch, and token lookup for modifications.
-- Down payment is "pay now", not money already received. Paid starts at 0.

CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE TABLE IF NOT EXISTS app_config (
  key text PRIMARY KEY,
  value text NOT NULL
);

INSERT INTO app_config (key, value) VALUES
  ('public_site_url', 'https://whitemaskoff001.github.io/Bapari_Builder'),
  ('functions_email_url', 'https://oddbplwvymcogcqbfpgj.supabase.co/functions/v1/send-notification-email')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;

CREATE OR REPLACE FUNCTION dispatch_email(
  p_to_email text,
  p_subject text,
  p_body text,
  p_action_url text DEFAULT NULL,
  p_action_label text DEFAULT NULL,
  p_prices jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_url text;
BEGIN
  IF p_to_email IS NULL OR trim(p_to_email) = '' THEN
    RETURN;
  END IF;

  SELECT value INTO v_url FROM app_config WHERE key = 'functions_email_url';
  IF v_url IS NULL THEN
    RETURN;
  END IF;

  PERFORM net.http_post(
    url := v_url,
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := jsonb_build_object(
      'to_email', p_to_email,
      'subject', p_subject,
      'body', p_body,
      'action_url', p_action_url,
      'action_label', p_action_label,
      'prices', p_prices
    )
  );
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'dispatch_email failed: %', SQLERRM;
END;
$$;

CREATE OR REPLACE FUNCTION site_link(p_hash text)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT rtrim((SELECT value FROM app_config WHERE key = 'public_site_url'), '/')
    || '/#' || ltrim(p_hash, '#');
$$;

CREATE OR REPLACE FUNCTION notify_all_staff(p_type text, p_title text, p_message text, p_data jsonb)
RETURNS void
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT id, p_type, p_title, p_message, p_data
  FROM profiles
  WHERE role IN ('admin', 'seller');
$$;

CREATE OR REPLACE FUNCTION email_all_staff(
  p_subject text, p_body text, p_action_url text DEFAULT NULL, p_action_label text DEFAULT NULL, p_prices jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN SELECT email FROM profiles WHERE role IN ('admin', 'seller') AND email IS NOT NULL AND email <> '' LOOP
    PERFORM dispatch_email(r.email, p_subject, p_body, p_action_url, p_action_label, p_prices);
  END LOOP;
END;
$$;

-- Recreate place_order so it also emails buyer + staff with the BAP reference.
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
  v_token text;
  v_reference text;
  v_item jsonb;
  v_date_part text;
  v_initials text;
  v_seq int;
  v_clean_name text;
  v_first_char text;
  v_last_char text;
  v_lines text := '';
  v_track_url text;
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
    v_lines := v_lines || chr(10) || '• ' || COALESCE(v_item->>'quantity', '0') || ' '
      || COALESCE(v_item->>'unit', '') || ' ' || COALESCE(v_item->>'category_name', '');
  END LOOP;

  PERFORM notify_all_staff(
    'new_order',
    'New Order ' || v_reference,
    'Order ' || v_reference || ' from ' || p_buyer_name || ' (' || p_buyer_phone || ')',
    jsonb_build_object('order_id', v_order_id, 'reference_number', v_reference)
  );

  v_track_url := site_link('status');
  PERFORM dispatch_email(
    lower(p_buyer_email),
    'Order received — ' || v_reference,
    'Hi ' || p_buyer_name || ',' || chr(10) || chr(10)
      || 'We received your materials request. Our team will call you at ' || p_buyer_phone || '.' || chr(10) || chr(10)
      || 'Your order reference: ' || v_reference || chr(10)
      || 'Use this reference on the Track order page.' || chr(10) || chr(10)
      || 'Materials:' || v_lines || chr(10) || chr(10)
      || 'Delivery address: ' || p_delivery_address || chr(10) || chr(10)
      || 'Status: Waiting for confirmation.',
    v_track_url,
    'Track your order'
  );
  PERFORM email_all_staff(
    'New order ' || v_reference,
    'New request from ' || p_buyer_name || chr(10)
      || 'Phone: ' || p_buyer_phone || chr(10)
      || 'Email: ' || p_buyer_email || chr(10)
      || 'Address: ' || p_delivery_address || chr(10)
      || 'Reference: ' || v_reference || chr(10)
      || 'Materials:' || v_lines,
    site_link(''),
    'Open dashboard'
  );

  RETURN QUERY SELECT v_order_id, v_token, v_reference;
END;
$$;

GRANT EXECUTE ON FUNCTION place_order(text, text, text, text, jsonb) TO anon, authenticated;

-- Terms: paid stays 0. down_payment is the requested pay-now amount.
CREATE OR REPLACE FUNCTION set_deal_terms(
  p_deal_id uuid,
  p_total_price numeric,
  p_down_payment numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_order record;
  v_prices jsonb;
  v_deal_url text;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  IF p_total_price IS NULL OR p_total_price <= 0 THEN
    RAISE EXCEPTION 'Total price must be greater than 0';
  END IF;
  IF p_down_payment IS NULL OR p_down_payment < 0 THEN
    RAISE EXCEPTION 'Down payment cannot be negative';
  END IF;
  IF p_down_payment > p_total_price THEN
    RAISE EXCEPTION 'Down payment cannot exceed total price';
  END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status <> 'pending_terms' THEN
    RAISE EXCEPTION 'Deal terms were already sent';
  END IF;

  UPDATE deals SET
    total_price = p_total_price,
    down_payment = p_down_payment,
    total_paid = 0,
    remaining_balance = p_total_price,
    status = 'terms_sent'
  WHERE id = p_deal_id;

  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;
  v_prices := jsonb_build_object(
    'total_price', p_total_price,
    'paid_now', p_down_payment,
    'paid_to_date', 0,
    'remaining', p_total_price
  );
  v_deal_url := site_link('deal/' || v_deal.buyer_token);

  PERFORM dispatch_email(
    v_order.buyer_email,
    'Deal terms for ' || COALESCE(v_order.reference_number, 'your order'),
    'Hi ' || v_order.buyer_name || ',' || chr(10) || chr(10)
      || 'Please review the offer for order ' || COALESCE(v_order.reference_number, '') || '.' || chr(10)
      || 'Total price: ' || p_total_price || chr(10)
      || 'Pay now: ' || p_down_payment || chr(10)
      || 'Remaining later: ' || (p_total_price - p_down_payment) || chr(10) || chr(10)
      || 'Nothing has been paid yet. Paid so far: 0.',
    v_deal_url,
    'Review and accept',
    v_prices
  );
  PERFORM notify_all_staff(
    'terms_sent',
    'Terms sent — ' || COALESCE(v_order.reference_number, ''),
    'Waiting for the buyer to accept terms for ' || COALESCE(v_order.reference_number, ''),
    jsonb_build_object('deal_id', p_deal_id, 'reference_number', v_order.reference_number)
  );
END;
$$;

CREATE OR REPLACE FUNCTION confirm_deal_as_staff(p_deal_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_token text;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  SELECT seller_token INTO v_token FROM deals WHERE id = p_deal_id;
  IF v_token IS NULL THEN RAISE EXCEPTION 'Deal not found'; END IF;
  RETURN seller_confirm_deal(v_token);
END;
$$;

CREATE OR REPLACE FUNCTION seller_confirm_deal(p_seller_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_order record;
  v_prices jsonb;
  v_url text;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE seller_token = p_seller_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status != 'buyer_accepted' THEN
    RAISE EXCEPTION 'Deal is not awaiting seller confirmation';
  END IF;

  UPDATE deals
  SET status = 'active', seller_confirmed_at = now()
  WHERE id = v_deal.id;

  UPDATE orders SET status = 'deal_created' WHERE id = v_deal.order_id;
  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;

  v_prices := jsonb_build_object(
    'total_price', v_deal.total_price,
    'paid_now', 0,
    'paid_to_date', 0,
    'remaining', v_deal.total_price
  );
  v_url := site_link('deal/' || v_deal.buyer_token);

  PERFORM notify_all_staff(
    'deal_confirmed',
    'Agreement active — ' || COALESCE(v_order.reference_number, ''),
    'Order ' || COALESCE(v_order.reference_number, '') || ' is confirmed. Total: ' || v_deal.total_price
      || ', paid: 0, remaining: ' || v_deal.total_price,
    jsonb_build_object('deal_id', v_deal.id, 'reference_number', v_order.reference_number)
  );

  PERFORM dispatch_email(
    v_order.buyer_email,
    'Agreement confirmed — ' || COALESCE(v_order.reference_number, ''),
    'Hi ' || v_order.buyer_name || ',' || chr(10) || chr(10)
      || 'Your agreement for ' || COALESCE(v_order.reference_number, '') || ' is now active.' || chr(10)
      || 'Total price: ' || v_deal.total_price || chr(10)
      || 'Paid so far: 0' || chr(10)
      || 'Remaining: ' || v_deal.total_price || chr(10) || chr(10)
      || 'Pay now (when delivery happens): ' || v_deal.down_payment || chr(10)
      || 'Left for later: ' || (v_deal.total_price - v_deal.down_payment),
    v_url,
    'View agreement',
    v_prices
  );
  PERFORM email_all_staff(
    'Agreement confirmed — ' || COALESCE(v_order.reference_number, ''),
    'Order ' || COALESCE(v_order.reference_number, '') || ' is active.' || chr(10)
      || 'Buyer: ' || v_order.buyer_name || ' (' || v_order.buyer_phone || ')' || chr(10)
      || 'Total: ' || v_deal.total_price || chr(10)
      || 'Paid: 0' || chr(10)
      || 'Remaining: ' || v_deal.total_price,
    v_url,
    'View agreement',
    v_prices
  );

  RETURN jsonb_build_object('success', true, 'reference_number', v_order.reference_number);
END;
$$;

CREATE OR REPLACE FUNCTION buyer_accept_deal(p_buyer_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_order record;
  v_confirm_url text;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE buyer_token = p_buyer_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status != 'terms_sent' THEN
    RAISE EXCEPTION 'Deal is not awaiting buyer response';
  END IF;

  UPDATE deals SET status = 'buyer_accepted' WHERE id = v_deal.id;
  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;
  v_confirm_url := site_link('confirm/' || v_deal.seller_token);

  PERFORM notify_all_staff(
    'deal_accepted',
    'Buyer accepted — ' || COALESCE(v_order.reference_number, ''),
    'Buyer accepted terms for ' || COALESCE(v_order.reference_number, '') || '. Confirm the agreement.',
    jsonb_build_object('deal_id', v_deal.id, 'seller_token', v_deal.seller_token, 'reference_number', v_order.reference_number)
  );
  PERFORM email_all_staff(
    'Buyer accepted ' || COALESCE(v_order.reference_number, '') || ' — please confirm',
    'The buyer accepted the offer. Confirm the agreement to make it active.',
    v_confirm_url,
    'Confirm agreement'
  );
  PERFORM dispatch_email(
    v_order.buyer_email,
    'We received your acceptance — ' || COALESCE(v_order.reference_number, ''),
    'Hi ' || v_order.buyer_name || ',' || chr(10) || chr(10)
      || 'Thanks. Our team will confirm the agreement from their side. You will get another email with the three prices (total, paid, remaining) once they confirm.',
    site_link('deal/' || v_deal.buyer_token),
    'View terms'
  );

  RETURN jsonb_build_object('success', true, 'seller_token', v_deal.seller_token);
END;
$$;

CREATE OR REPLACE FUNCTION record_payment(
  p_deal_id uuid,
  p_amount numeric,
  p_photo_url text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_order record;
  v_new_total_paid numeric;
  v_new_remaining numeric;
  v_prices jsonb;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN RAISE EXCEPTION 'Payment amount must be greater than 0'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status NOT IN ('active', 'seller_confirmed') THEN RAISE EXCEPTION 'Deal is not active'; END IF;

  v_new_total_paid := v_deal.total_paid + p_amount;
  v_new_remaining := v_deal.total_price - v_new_total_paid;
  IF v_new_remaining < 0 THEN RAISE EXCEPTION 'Payment exceeds remaining balance'; END IF;

  INSERT INTO payments (deal_id, amount, photo_url, recorded_by, note)
  VALUES (p_deal_id, p_amount, COALESCE(p_photo_url, ''), auth.uid(), COALESCE(p_note, ''));

  UPDATE deals SET
    total_paid = v_new_total_paid,
    remaining_balance = v_new_remaining,
    status = CASE WHEN v_new_remaining = 0 THEN 'done' ELSE status END
  WHERE id = p_deal_id;

  IF v_new_remaining = 0 THEN
    UPDATE orders SET status = 'completed' WHERE id = v_deal.order_id;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;
  v_prices := jsonb_build_object(
    'total_price', v_deal.total_price,
    'paid_now', p_amount,
    'paid_to_date', v_new_total_paid,
    'remaining', v_new_remaining
  );

  PERFORM notify_all_staff(
    'payment_recorded',
    'Payment on ' || COALESCE(v_order.reference_number, ''),
    'Paid now: ' || p_amount || '. Paid to date: ' || v_new_total_paid || '. Remaining: ' || v_new_remaining,
    jsonb_build_object('deal_id', p_deal_id, 'reference_number', v_order.reference_number)
  );
  PERFORM dispatch_email(
    v_order.buyer_email,
    'Payment recorded — ' || COALESCE(v_order.reference_number, ''),
    'Hi ' || v_order.buyer_name || ',' || chr(10) || chr(10)
      || 'A payment was recorded for order ' || COALESCE(v_order.reference_number, '') || '.' || chr(10)
      || COALESCE(p_note, ''),
    site_link('deal/' || v_deal.buyer_token),
    'View agreement',
    v_prices
  );
  PERFORM email_all_staff(
    'Payment recorded — ' || COALESCE(v_order.reference_number, ''),
    'Buyer: ' || v_order.buyer_name || chr(10) || COALESCE(p_note, ''),
    site_link('deal/' || v_deal.buyer_token),
    'View agreement',
    v_prices
  );

  RETURN jsonb_build_object(
    'total_paid', v_new_total_paid,
    'remaining_balance', v_new_remaining,
    'is_done', v_new_remaining = 0
  );
END;
$$;

DROP FUNCTION IF EXISTS propose_modification(uuid, jsonb, numeric);

CREATE OR REPLACE FUNCTION propose_modification(
  p_deal_id uuid,
  p_new_items jsonb,
  p_new_total_price numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mod_id uuid;
  v_mod_token text;
  v_deal record;
  v_order record;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status NOT IN ('active', 'seller_confirmed') THEN RAISE EXCEPTION 'Deal is not active'; END IF;

  INSERT INTO deal_modifications (deal_id, proposed_by, new_items, new_total_price)
  VALUES (p_deal_id, auth.uid(), p_new_items, p_new_total_price)
  RETURNING id, buyer_token INTO v_mod_id, v_mod_token;

  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;
  PERFORM notify_all_staff(
    'modification_proposed',
    'Change proposed — ' || COALESCE(v_order.reference_number, ''),
    'Waiting for the buyer to accept a quantity/price change.',
    jsonb_build_object('deal_id', p_deal_id, 'mod_id', v_mod_id)
  );
  PERFORM dispatch_email(
    v_order.buyer_email,
    'Updated materials for ' || COALESCE(v_order.reference_number, ''),
    'Hi ' || v_order.buyer_name || ',' || chr(10) || chr(10)
      || 'Our team proposed a change. New total: ' || p_new_total_price || '.' || chr(10)
      || 'Please accept or reject the change.',
    site_link('mod/' || v_mod_token),
    'Review change',
    jsonb_build_object('total_price', p_new_total_price, 'paid_now', 0, 'paid_to_date', v_deal.total_paid, 'remaining', p_new_total_price - v_deal.total_paid)
  );

  RETURN jsonb_build_object('id', v_mod_id, 'buyer_token', v_mod_token);
END;
$$;

-- Token lookup: deal buyer token OR pending modification token.
CREATE OR REPLACE FUNCTION get_deal_by_buyer_token(p_buyer_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_mod record;
  v_items jsonb;
  v_payments jsonb;
  v_modifications jsonb;
  v_order record;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE buyer_token = p_buyer_token;
  IF NOT FOUND THEN
    SELECT * INTO v_mod FROM deal_modifications WHERE buyer_token = p_buyer_token AND status = 'pending';
    IF NOT FOUND THEN RETURN NULL; END IF;
    SELECT * INTO v_deal FROM deals WHERE id = v_mod.deal_id;
    IF NOT FOUND THEN RETURN NULL; END IF;
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', oi.id, 'category_name', oi.category_name, 'quantity', oi.quantity, 'unit', oi.unit, 'option_selections', oi.option_selections
  )), '[]'::jsonb) INTO v_items
  FROM order_items oi WHERE oi.order_id = v_deal.order_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'amount', p.amount, 'created_at', p.created_at, 'note', p.note
  ) ORDER BY p.created_at), '[]'::jsonb) INTO v_payments
  FROM payments p WHERE p.deal_id = v_deal.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', dm.id, 'status', dm.status, 'new_total_price', dm.new_total_price, 'new_items', dm.new_items, 'buyer_token', dm.buyer_token
  )), '[]'::jsonb) INTO v_modifications
  FROM deal_modifications dm WHERE dm.deal_id = v_deal.id AND dm.status = 'pending';

  RETURN jsonb_build_object(
    'id', v_deal.id,
    'order_id', v_deal.order_id,
    'reference_number', v_order.reference_number,
    'buyer_name', v_order.buyer_name,
    'status', v_deal.status,
    'total_price', v_deal.total_price,
    'down_payment', v_deal.down_payment,
    'total_paid', v_deal.total_paid,
    'remaining_balance', v_deal.remaining_balance,
    'items', v_items,
    'payments', v_payments,
    'pending_modifications', v_modifications
  );
END;
$$;

GRANT EXECUTE ON FUNCTION set_deal_terms(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_deal_as_staff(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION seller_confirm_deal(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION buyer_accept_deal(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION record_payment(uuid, numeric, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION propose_modification(uuid, jsonb, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION get_deal_by_buyer_token(text) TO anon, authenticated;

-- Catalog: Brick, Cement, Sand, Rebar with the option groups from the spec.
INSERT INTO categories (id, name, description, image_url, display_order)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Brick', 'Reliable masonry essentials for durable walls and structures.', 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=900', 1),
  ('22222222-2222-2222-2222-222222222222', 'Cement', 'High-strength cement for foundations, finishing, and structural work.', 'https://images.pexels.com/photos/162500/pexels-photo-162500.jpeg?auto=compress&cs=tinysrgb&w=900', 2),
  ('33333333-3333-3333-3333-333333333333', 'Sand', 'Clean, consistent sand for mixing, plastering, and finishing.', 'https://images.pexels.com/photos/220182/pexels-photo-220182.jpeg?auto=compress&cs=tinysrgb&w=900', 3),
  ('44444444-4444-4444-4444-444444444444', 'Rebar', 'Reinforcement steel bar for columns, slabs, and structural work.', 'https://images.pexels.com/photos/162553/pexels-photo-162553.jpeg?auto=compress&cs=tinysrgb&w=900', 4)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  display_order = EXCLUDED.display_order;

-- Sand: Quality (not Company). Rebar: Company (not Quality). Cement: Company.
UPDATE category_option_groups SET name = 'Quality'
WHERE id = 'ffffffff-ffff-ffff-ffff-ffffffffffff' AND name IS DISTINCT FROM 'Quality';

UPDATE category_option_groups SET name = 'Company'
WHERE id IN ('dddddddd-dddd-dddd-dddd-dddddddddddd', '13131313-1313-1313-1313-131313131313');

INSERT INTO category_option_groups (id, category_id, name, display_order)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Unit', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Quality', 2),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Unit', 1),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Company', 2),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', 'Unit', 1),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', 'Quality', 2),
  ('12121212-1212-1212-1212-121212121212', '44444444-4444-4444-4444-444444444444', 'Unit', 1),
  ('13131313-1313-1313-1313-131313131313', '44444444-4444-4444-4444-444444444444', 'Company', 2)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, category_id = EXCLUDED.category_id;

INSERT INTO category_options (id, group_id, label, display_order)
VALUES
  ('1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Piece', 1),
  ('1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pallet', 2),
  ('1e1e1e1e-1e1e-1e1e-1e1e-1e1e1e1e1e1e', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Ton', 3),
  ('1c1c1c1c-1c1c-1c1c-1c1c-1c1c1c1c1c1c', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Standard', 1),
  ('1d1d1d1d-1d1d-1d1d-1d1d-1d1d1d1d1d1d', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Premium', 2),
  ('2a2a2a2a-2a2a-2a2a-2a2a-2a2a2a2a2a2a', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Bag', 1),
  ('2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Ton', 2),
  ('2c2c2c2c-2c2c-2c2c-2c2c-2c2c2c2c2c2c', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Shah Cement', 1),
  ('2d2d2d2d-2d2d-2d2d-2d2d-2d2d2d2d2d2d', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Crown Cement', 2),
  ('2e2e2e2e-2e2e-2e2e-2e2e-2e2e2e2e2e2e', 'dddddddd-dddd-dddd-dddd-dddddddddddd', 'Fresh Cement', 3),
  ('3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a3a', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'CFT', 1),
  ('3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Truck', 2),
  ('3c3c3c3c-3c3c-3c3c-3c3c-3c3c3c3c3c3c', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Coarse', 1),
  ('3d3d3d3d-3d3d-3d3d-3d3d-3d3d3d3d3d3d', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Fine', 2),
  ('3e3e3e3e-3e3e-3e3e-3e3e-3e3e3e3e3e3e', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Sylhet', 3),
  ('4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '12121212-1212-1212-1212-121212121212', 'Ton', 1),
  ('4b4b4b4b-4b4b-4b4b-4b4b-4b4b4b4b4b4b', '12121212-1212-1212-1212-121212121212', 'Bar', 2),
  ('4c4c4c4c-4c4c-4c4c-4c4c-4c4c4c4c4c4c', '12121212-1212-1212-1212-121212121212', 'kg', 3),
  ('4d4d4d4d-4d4d-4d4d-4d4d-4d4d4d4d4d4d', '13131313-1313-1313-1313-131313131313', 'BSRM', 1),
  ('4e4e4e4e-4e4e-4e4e-4e4e-4e4e4e4e4e4e', '13131313-1313-1313-1313-131313131313', 'KSRM', 2),
  ('4f4f4f4f-4f4f-4f4f-4f4f-4f4f4f4f4f4f', '13131313-1313-1313-1313-131313131313', 'AKS', 3)
ON CONFLICT (id) DO UPDATE SET label = EXCLUDED.label, group_id = EXCLUDED.group_id, display_order = EXCLUDED.display_order;

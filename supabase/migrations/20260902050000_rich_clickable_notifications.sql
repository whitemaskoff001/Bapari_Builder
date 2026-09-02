-- Rich, clickable staff/buyer notifications and emails.
-- Staff notices store tab/action/ids so the UI can open the exact page.

CREATE OR REPLACE FUNCTION format_order_items(p_order_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(string_agg(
    '• ' || COALESCE(oi.quantity::text, '0') || ' ' || COALESCE(oi.unit, '') || ' ' || oi.category_name
    || CASE
         WHEN oi.option_selections IS NULL OR oi.option_selections = '{}'::jsonb THEN ''
         ELSE ' [' || (
           SELECT string_agg(e.key || ': ' || e.value, ', ')
           FROM jsonb_each_text(oi.option_selections) e
         ) || ']'
       END,
    E'\n'
    ORDER BY oi.created_at
  ), '(no items)')
  FROM order_items oi
  WHERE oi.order_id = p_order_id;
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
  FOR r IN
    SELECT email FROM profiles
    WHERE role IN ('admin', 'seller')
      AND email IS NOT NULL
      AND email <> ''
      AND email NOT ILIKE '%@example.com'
  LOOP
    PERFORM dispatch_email(r.email, p_subject, p_body, p_action_url, p_action_label, p_prices);
  END LOOP;
END;
$$;

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
    v_details || E'\n\nCall the buyer, then Accept or Reject.',
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
      || 'Track anytime with this reference on the Track order page.',
    site_link('status'),
    'Track your order'
  );
  PERFORM email_all_staff(
    'New order ' || v_reference || ' — open to review',
    'A buyer sent a materials request. Open this notice to see every line, then call them and Accept or Reject.' || E'\n\n' || v_details,
    v_open_url,
    'Open this order'
  );

  RETURN QUERY SELECT v_order_id, v_token, v_reference;
END;
$$;

GRANT EXECUTE ON FUNCTION place_order(text, text, text, text, jsonb) TO anon, authenticated;

CREATE OR REPLACE FUNCTION accept_order(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal_id uuid;
  v_order record;
  v_items_text text;
  v_details text;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Order not found'; END IF;
  IF v_order.status NOT IN ('picked_up', 'pending') THEN
    RAISE EXCEPTION 'Order cannot be accepted in current state';
  END IF;

  IF v_order.picked_up_by IS NULL THEN
    UPDATE orders SET status = 'accepted', picked_up_by = auth.uid() WHERE id = p_order_id;
  ELSE
    UPDATE orders SET status = 'accepted' WHERE id = p_order_id;
  END IF;

  INSERT INTO deals (order_id, seller_id, status)
  VALUES (p_order_id, auth.uid(), 'pending_terms')
  RETURNING id INTO v_deal_id;

  v_items_text := format_order_items(p_order_id);
  v_details :=
    'Reference: ' || COALESCE(v_order.reference_number, '') || E'\n'
    || 'Name: ' || v_order.buyer_name || E'\n'
    || 'Phone: ' || v_order.buyer_phone || E'\n'
    || 'Email: ' || v_order.buyer_email || E'\n'
    || 'Delivery address: ' || v_order.delivery_address || E'\n\n'
    || 'Materials:' || E'\n' || v_items_text;

  PERFORM notify_all_staff(
    'order_accepted',
    'Set prices for ' || COALESCE(v_order.reference_number, '') || ' — tap to open',
    'Order accepted. Open this to send total price, pay now, and amount left later (calculated automatically).' || E'\n\n' || v_details,
    jsonb_build_object(
      'order_id', p_order_id,
      'deal_id', v_deal_id,
      'reference_number', v_order.reference_number,
      'tab', 'ongoing',
      'action', 'set_terms',
      'buyer_name', v_order.buyer_name,
      'buyer_phone', v_order.buyer_phone,
      'items_text', v_items_text
    )
  );
  PERFORM email_all_staff(
    'Set prices for ' || COALESCE(v_order.reference_number, ''),
    'The order was accepted. Open this page to enter the whole price, what they pay now, and what is left later.' || E'\n\n' || v_details,
    site_link('manage/terms/' || v_deal_id::text),
    'Open and set prices'
  );

  RETURN v_deal_id;
END;
$$;

GRANT EXECUTE ON FUNCTION accept_order(uuid) TO authenticated;

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
  v_items_text text;
  v_left numeric;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  IF p_total_price IS NULL OR p_total_price <= 0 THEN RAISE EXCEPTION 'Total price must be greater than 0'; END IF;
  IF p_down_payment IS NULL OR p_down_payment < 0 THEN RAISE EXCEPTION 'Down payment cannot be negative'; END IF;
  IF p_down_payment > p_total_price THEN RAISE EXCEPTION 'Down payment cannot exceed total price'; END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status <> 'pending_terms' THEN RAISE EXCEPTION 'Deal terms were already sent'; END IF;

  v_left := p_total_price - p_down_payment;

  UPDATE deals SET
    total_price = p_total_price,
    down_payment = p_down_payment,
    total_paid = 0,
    remaining_balance = p_total_price,
    status = 'terms_sent'
  WHERE id = p_deal_id;

  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;
  v_items_text := format_order_items(v_deal.order_id);
  v_prices := jsonb_build_object(
    'total_price', p_total_price,
    'paid_now', p_down_payment,
    'paid_to_date', 0,
    'remaining', v_left
  );
  v_deal_url := site_link('deal/' || v_deal.buyer_token);

  PERFORM dispatch_email(
    v_order.buyer_email,
    'Offer for ' || COALESCE(v_order.reference_number, 'your order') || ' — accept or deny',
    'Hi ' || v_order.buyer_name || ',' || E'\n\n'
      || 'Please review this offer. You can accept or deny it on the page below.' || E'\n\n'
      || 'Reference: ' || COALESCE(v_order.reference_number, '') || E'\n'
      || 'Phone: ' || v_order.buyer_phone || E'\n'
      || 'Delivery address: ' || v_order.delivery_address || E'\n\n'
      || 'Materials:' || E'\n' || v_items_text || E'\n\n'
      || 'Total price: ' || p_total_price || E'\n'
      || 'Pay now: ' || p_down_payment || E'\n'
      || 'Left for later: ' || v_left || E'\n'
      || 'Paid so far: 0',
    v_deal_url,
    'Review and accept or deny',
    v_prices
  );
  PERFORM notify_all_staff(
    'terms_sent',
    'Offer sent to buyer — ' || COALESCE(v_order.reference_number, ''),
    'Waiting for the buyer to accept or deny.' || E'\n\n'
      || 'Total: ' || p_total_price || E'\nPay now: ' || p_down_payment || E'\nLeft later: ' || v_left || E'\nPaid so far: 0' || E'\n\n'
      || v_items_text,
    jsonb_build_object(
      'order_id', v_order.id,
      'deal_id', p_deal_id,
      'reference_number', v_order.reference_number,
      'tab', 'ongoing',
      'action', 'view',
      'buyer_token', v_deal.buyer_token
    )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION set_deal_terms(uuid, numeric, numeric) TO authenticated;

CREATE OR REPLACE FUNCTION buyer_accept_deal(p_buyer_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_order record;
  v_confirm_url text;
  v_items_text text;
  v_prices jsonb;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE buyer_token = p_buyer_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status != 'terms_sent' THEN RAISE EXCEPTION 'Deal is not awaiting buyer response'; END IF;

  UPDATE deals SET status = 'buyer_accepted' WHERE id = v_deal.id;
  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;
  v_items_text := format_order_items(v_deal.order_id);
  v_confirm_url := site_link('confirm/' || v_deal.seller_token);
  v_prices := jsonb_build_object(
    'total_price', v_deal.total_price,
    'paid_now', v_deal.down_payment,
    'paid_to_date', 0,
    'remaining', v_deal.total_price
  );

  PERFORM notify_all_staff(
    'deal_accepted',
    'Buyer accepted ' || COALESCE(v_order.reference_number, '') || ' — tap to confirm',
    'The buyer accepted. Confirm the order from this notice or from your email to start the agreement.' || E'\n\n'
      || 'Reference: ' || COALESCE(v_order.reference_number, '') || E'\n'
      || 'Name: ' || v_order.buyer_name || E'\nPhone: ' || v_order.buyer_phone || E'\n'
      || 'Total: ' || v_deal.total_price || E'\nPay now: ' || v_deal.down_payment || E'\nPaid so far: 0' || E'\nRemaining: ' || v_deal.total_price || E'\n\n'
      || v_items_text,
    jsonb_build_object(
      'order_id', v_order.id,
      'deal_id', v_deal.id,
      'reference_number', v_order.reference_number,
      'tab', 'ongoing',
      'action', 'confirm',
      'seller_token', v_deal.seller_token
    )
  );
  PERFORM email_all_staff(
    'Buyer accepted ' || COALESCE(v_order.reference_number, '') || ' — confirm the order',
    'The buyer accepted the offer. Open the button below and confirm the order. After you confirm, the agreement starts with paid = 0.' || E'\n\n'
      || 'Name: ' || v_order.buyer_name || E'\nPhone: ' || v_order.buyer_phone || E'\nEmail: ' || v_order.buyer_email || E'\n'
      || 'Address: ' || v_order.delivery_address || E'\n\n'
      || v_items_text,
    v_confirm_url,
    'Confirm the order',
    v_prices
  );
  PERFORM dispatch_email(
    v_order.buyer_email,
    'We received your acceptance — ' || COALESCE(v_order.reference_number, ''),
    'Hi ' || v_order.buyer_name || ',' || E'\n\n'
      || 'A notification was sent to the seller. They should confirm the order from their email. After they confirm, you will get the agreement with total price, paid (0 the first time), and remaining.',
    site_link('deal/' || v_deal.buyer_token),
    'View offer'
  );

  RETURN jsonb_build_object('success', true, 'seller_token', v_deal.seller_token);
END;
$$;

GRANT EXECUTE ON FUNCTION buyer_accept_deal(text) TO anon, authenticated;

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
  v_items_text text;
  v_body text;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE seller_token = p_seller_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status != 'buyer_accepted' THEN RAISE EXCEPTION 'Deal is not awaiting seller confirmation'; END IF;

  UPDATE deals SET status = 'active', seller_confirmed_at = now() WHERE id = v_deal.id;
  UPDATE orders SET status = 'deal_created' WHERE id = v_deal.order_id;
  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;
  v_items_text := format_order_items(v_deal.order_id);

  v_prices := jsonb_build_object(
    'total_price', v_deal.total_price,
    'paid_now', 0,
    'paid_to_date', 0,
    'remaining', v_deal.total_price
  );
  v_url := site_link('deal/' || v_deal.buyer_token);
  v_body :=
    'The agreement is now active.' || E'\n\n'
    || 'Reference: ' || COALESCE(v_order.reference_number, '') || E'\n'
    || 'Name: ' || v_order.buyer_name || E'\nPhone: ' || v_order.buyer_phone || E'\nEmail: ' || v_order.buyer_email || E'\n'
    || 'Delivery address: ' || v_order.delivery_address || E'\n\n'
    || 'Materials:' || E'\n' || v_items_text || E'\n\n'
    || 'Total price: ' || v_deal.total_price || E'\n'
    || 'Paid so far: 0' || E'\n'
    || 'Remaining: ' || v_deal.total_price || E'\n'
    || 'Pay now (on delivery): ' || v_deal.down_payment || E'\n'
    || 'Left for later: ' || (v_deal.total_price - v_deal.down_payment);

  PERFORM notify_all_staff(
    'deal_confirmed',
    'Agreement active — ' || COALESCE(v_order.reference_number, '') || ' — tap to open',
    v_body,
    jsonb_build_object(
      'order_id', v_order.id,
      'deal_id', v_deal.id,
      'reference_number', v_order.reference_number,
      'tab', 'ongoing',
      'action', 'pay',
      'buyer_token', v_deal.buyer_token
    )
  );
  PERFORM dispatch_email(
    v_order.buyer_email,
    'Agreement started — ' || COALESCE(v_order.reference_number, ''),
    'Hi ' || v_order.buyer_name || ',' || E'\n\n' || v_body,
    v_url,
    'Open agreement page',
    v_prices
  );
  PERFORM email_all_staff(
    'Agreement started — ' || COALESCE(v_order.reference_number, ''),
    v_body,
    site_link('manage/ongoing/' || v_deal.id::text),
    'Open agreement',
    v_prices
  );

  RETURN jsonb_build_object('success', true, 'reference_number', v_order.reference_number);
END;
$$;

GRANT EXECUTE ON FUNCTION seller_confirm_deal(text) TO anon, authenticated;

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
  v_items_text text;
  v_body text;
  v_tab text;
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
  v_items_text := format_order_items(v_deal.order_id);
  v_prices := jsonb_build_object(
    'total_price', v_deal.total_price,
    'paid_now', p_amount,
    'paid_to_date', v_new_total_paid,
    'remaining', v_new_remaining
  );
  v_tab := CASE WHEN v_new_remaining = 0 THEN 'done' ELSE 'ongoing' END;
  v_body :=
    'Reference: ' || COALESCE(v_order.reference_number, '') || E'\n'
    || 'Name: ' || v_order.buyer_name || E'\nPhone: ' || v_order.buyer_phone || E'\nEmail: ' || v_order.buyer_email || E'\n'
    || 'Delivery address: ' || v_order.delivery_address || E'\n\n'
    || 'Materials:' || E'\n' || v_items_text || E'\n\n'
    || 'Total cost: ' || v_deal.total_price || E'\n'
    || 'Paid now: ' || p_amount || E'\n'
    || 'Paid until now: ' || v_new_total_paid || E'\n'
    || 'Left: ' || v_new_remaining
    || CASE WHEN COALESCE(p_note, '') <> '' THEN E'\nNote: ' || p_note ELSE '' END
    || CASE WHEN v_new_remaining = 0 THEN E'\n\nThis deal is finished. All payments are settled.' ELSE '' END;

  PERFORM notify_all_staff(
    'payment_recorded',
    'Payment on ' || COALESCE(v_order.reference_number, '') || ' — tap to open',
    v_body,
    jsonb_build_object(
      'order_id', v_order.id,
      'deal_id', p_deal_id,
      'reference_number', v_order.reference_number,
      'tab', v_tab,
      'action', 'view'
    )
  );
  PERFORM dispatch_email(
    v_order.buyer_email,
    'Payment recorded — ' || COALESCE(v_order.reference_number, ''),
    'Hi ' || v_order.buyer_name || ',' || E'\n\n' || v_body,
    site_link('deal/' || v_deal.buyer_token),
    'View agreement',
    v_prices
  );
  PERFORM email_all_staff(
    'Payment recorded — ' || COALESCE(v_order.reference_number, ''),
    v_body,
    site_link('manage/' || v_tab || '/' || p_deal_id::text),
    'Open deal',
    v_prices
  );

  RETURN jsonb_build_object(
    'total_paid', v_new_total_paid,
    'remaining_balance', v_new_remaining,
    'is_done', v_new_remaining = 0
  );
END;
$$;

GRANT EXECUTE ON FUNCTION record_payment(uuid, numeric, text, text) TO authenticated;

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
  v_lines text := '';
  v_item jsonb;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN RAISE EXCEPTION 'Not authorized'; END IF;
  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Deal not found'; END IF;
  IF v_deal.status NOT IN ('active', 'seller_confirmed') THEN RAISE EXCEPTION 'Deal is not active'; END IF;

  INSERT INTO deal_modifications (deal_id, proposed_by, new_items, new_total_price)
  VALUES (p_deal_id, auth.uid(), p_new_items, p_new_total_price)
  RETURNING id, buyer_token INTO v_mod_id, v_mod_token;

  FOR v_item IN SELECT jsonb_array_elements(p_new_items) LOOP
    v_lines := v_lines || E'\n• ' || COALESCE(v_item->>'quantity', '0') || ' '
      || COALESCE(v_item->>'unit', '') || ' ' || COALESCE(v_item->>'category_name', '');
  END LOOP;

  SELECT * INTO v_order FROM orders WHERE id = v_deal.order_id;
  PERFORM notify_all_staff(
    'modification_proposed',
    'Change sent to buyer — ' || COALESCE(v_order.reference_number, ''),
    'Waiting for the buyer to accept the quantity change from their email.' || E'\nNew total: ' || p_new_total_price || E'\n' || v_lines,
    jsonb_build_object(
      'order_id', v_order.id,
      'deal_id', p_deal_id,
      'mod_id', v_mod_id,
      'reference_number', v_order.reference_number,
      'tab', 'ongoing',
      'action', 'view'
    )
  );
  PERFORM dispatch_email(
    v_order.buyer_email,
    'Please accept a materials change — ' || COALESCE(v_order.reference_number, ''),
    'Hi ' || v_order.buyer_name || ',' || E'\n\n'
      || 'Our team proposed more or less product. You must accept or deny this change.' || E'\n'
      || 'New total: ' || p_new_total_price || E'\nPaid so far: ' || v_deal.total_paid || E'\n'
      || 'Remaining if you accept: ' || (p_new_total_price - v_deal.total_paid) || E'\n'
      || 'Updated materials:' || v_lines,
    site_link('mod/' || v_mod_token),
    'Accept or deny this change',
    jsonb_build_object(
      'total_price', p_new_total_price,
      'paid_now', 0,
      'paid_to_date', v_deal.total_paid,
      'remaining', p_new_total_price - v_deal.total_paid
    )
  );

  RETURN jsonb_build_object('id', v_mod_id, 'buyer_token', v_mod_token);
END;
$$;

GRANT EXECUTE ON FUNCTION propose_modification(uuid, jsonb, numeric) TO authenticated;

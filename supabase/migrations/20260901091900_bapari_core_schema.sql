/*
# Bapari Builders - Core Schema and Security Setup

This migration creates the complete database schema for the Bapari Builders
construction materials marketplace, including product catalog, order workflow,
deal negotiation, payment tracking, notifications, and editable site content.

## 1. Extensions
- pgcrypto: for password hashing (crypt, gen_salt)

## 2. New Tables
- profiles: Staff profiles linked to auth.users (admin/seller roles)
- categories: Product categories (Brick, Sand, Rebar, Cement, etc.)
- category_option_groups: Configurable option types per category (Quantity Unit, Company, Quality)
- category_options: Individual choices within option groups
- orders: Buyer orders with contact and delivery info
- order_items: Individual product lines in an order
- deals: Negotiated agreements with pricing and payment tracking
- payments: Partial payment records with optional receipt photo
- deal_modifications: Proposed order changes requiring buyer approval
- notifications: In-app notifications for staff
- site_content: Editable website text and images (for admin edit mode)

## 3. Security
- RLS enabled on all tables
- SECURITY DEFINER functions for privileged operations
- Role-based access control via get_user_role() / is_admin() helpers
- Buyer access via access tokens (no login required)
- Column-level privileges on profiles (role column not client-writable)

## 4. Triggers
- Auto-create profile on user signup (handle_new_user)
- Auto-update updated_at timestamps on orders, deals, site_content

## 5. Storage
- payment-receipts bucket for payment receipt photos
*/

-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- PROFILES TABLE
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'seller' CHECK (role IN ('admin', 'seller')),
  display_name text DEFAULT '',
  phone text DEFAULT '',
  avatar_url text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CATEGORIES TABLE (Products)
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  image_url text DEFAULT '',
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CATEGORY OPTION GROUPS TABLE
-- Configurable option types per category (e.g., "Quantity Unit", "Company", "Quality")
-- ============================================================
CREATE TABLE IF NOT EXISTS category_option_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE category_option_groups ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- CATEGORY OPTIONS TABLE
-- Individual choices within an option group (e.g., "kg", "Ton", "Company A")
-- ============================================================
CREATE TABLE IF NOT EXISTS category_options (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES category_option_groups(id) ON DELETE CASCADE,
  label text NOT NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE category_options ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ORDERS TABLE
-- Buyer orders with contact and delivery information
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_name text NOT NULL,
  buyer_email text NOT NULL,
  buyer_phone text NOT NULL,
  delivery_address text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'picked_up', 'accepted', 'rejected', 'deal_created', 'completed'
  )),
  picked_up_by uuid REFERENCES profiles(id),
  notes text DEFAULT '',
  access_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_picked_up_by ON orders(picked_up_by);

-- ============================================================
-- ORDER ITEMS TABLE
-- Each product line in an order
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  category_id uuid REFERENCES categories(id),
  category_name text NOT NULL,
  quantity numeric DEFAULT 0,
  unit text DEFAULT '',
  option_selections jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items(order_id);

-- ============================================================
-- DEALS TABLE
-- Negotiated agreement with pricing and payment tracking
-- ============================================================
CREATE TABLE IF NOT EXISTS deals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  seller_id uuid REFERENCES profiles(id),
  status text NOT NULL DEFAULT 'pending_terms' CHECK (status IN (
    'pending_terms', 'terms_sent', 'buyer_accepted', 'seller_confirmed',
    'active', 'done', 'buyer_rejected', 'cancelled'
  )),
  total_price numeric NOT NULL DEFAULT 0,
  down_payment numeric NOT NULL DEFAULT 0,
  total_paid numeric NOT NULL DEFAULT 0,
  remaining_balance numeric NOT NULL DEFAULT 0,
  buyer_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  seller_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  seller_confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_deals_order_id ON deals(order_id);
CREATE INDEX IF NOT EXISTS idx_deals_status ON deals(status);
CREATE INDEX IF NOT EXISTS idx_deals_seller_id ON deals(seller_id);

-- ============================================================
-- PAYMENTS TABLE
-- Partial payment records with optional receipt photo
-- ============================================================
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  photo_url text DEFAULT '',
  recorded_by uuid REFERENCES profiles(id),
  note text DEFAULT '',
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payments_deal_id ON payments(deal_id);

-- ============================================================
-- DEAL MODIFICATIONS TABLE
-- Proposed order changes that require buyer approval via email
-- ============================================================
CREATE TABLE IF NOT EXISTS deal_modifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id uuid NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  proposed_by uuid REFERENCES profiles(id),
  new_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  new_total_price numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  buyer_token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE deal_modifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_deal_mods_deal_id ON deal_modifications(deal_id);

-- ============================================================
-- NOTIFICATIONS TABLE
-- In-app notifications for sellers and admins
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL,
  title text NOT NULL,
  message text DEFAULT '',
  data jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- SITE CONTENT TABLE
-- Editable website text and images for admin edit mode
-- ============================================================
CREATE TABLE IF NOT EXISTS site_content (
  key text PRIMARY KEY,
  value text DEFAULT '',
  image_url text DEFAULT '',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE site_content ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile when a new auth user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, email, role, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    'seller',
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Auto-update updated_at on orders
CREATE OR REPLACE FUNCTION update_orders_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_orders_updated_at();

-- Auto-update updated_at on deals
CREATE OR REPLACE FUNCTION update_deals_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_deals_updated_at ON deals;
CREATE TRIGGER trg_deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_deals_updated_at();

-- Auto-update updated_at on site_content
CREATE OR REPLACE FUNCTION update_site_content_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_site_content_updated_at ON site_content;
CREATE TRIGGER trg_site_content_updated_at
  BEFORE UPDATE ON site_content
  FOR EACH ROW EXECUTE FUNCTION update_site_content_updated_at();

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Get the current authenticated user's role
CREATE OR REPLACE FUNCTION get_user_role()
RETURNS text
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid();
$$;

-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin');
$$;

-- ============================================================
-- SECURITY DEFINER FUNCTIONS - STAFF MANAGEMENT
-- ============================================================

-- Create a new staff account (admin only)
CREATE OR REPLACE FUNCTION create_staff_account(
  p_email text,
  p_password text,
  p_role text DEFAULT 'seller',
  p_display_name text DEFAULT NULL,
  p_phone text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  IF p_password IS NULL OR length(p_password) < 6 THEN
    RAISE EXCEPTION 'Password must be at least 6 characters';
  END IF;

  INSERT INTO auth.users (
    id, email, encrypted_password, role, aud,
    email_confirmed_at, created_at, updated_at,
    raw_user_meta_data
  )
  VALUES (
    gen_random_uuid(),
    lower(p_email),
    crypt(p_password, gen_salt('bf')),
    'authenticated',
    'authenticated',
    now(),
    now(),
    now(),
    jsonb_build_object('display_name', p_display_name, 'phone', p_phone)
  )
  RETURNING id INTO v_user_id;

  -- Update the profile created by trigger with correct role
  UPDATE profiles
  SET role = p_role, display_name = COALESCE(p_display_name, ''), phone = COALESCE(p_phone, '')
  WHERE id = v_user_id;

  RETURN v_user_id;
END;
$$;

-- Update a staff account (admin only)
CREATE OR REPLACE FUNCTION update_staff_account(
  p_user_id uuid,
  p_email text DEFAULT NULL,
  p_role text DEFAULT NULL,
  p_display_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_password text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_role IS NOT NULL AND p_role NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  -- Update auth.users if email or password changed
  IF p_email IS NOT NULL OR p_password IS NOT NULL THEN
    UPDATE auth.users SET
      email = COALESCE(lower(p_email), email),
      encrypted_password = CASE WHEN p_password IS NOT NULL AND length(p_password) >= 6
        THEN crypt(p_password, gen_salt('bf'))
        ELSE encrypted_password END,
      updated_at = now()
    WHERE id = p_user_id;
  END IF;

  -- Update profile
  UPDATE profiles SET
    email = COALESCE(lower(p_email), email),
    role = COALESCE(p_role, role),
    display_name = COALESCE(p_display_name, display_name),
    phone = COALESCE(p_phone, phone)
  WHERE id = p_user_id;
END;
$$;

-- Delete a staff account (admin only)
CREATE OR REPLACE FUNCTION delete_staff_account(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public, auth
AS $$
BEGIN
  IF get_user_role() != 'admin' THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own account';
  END IF;

  DELETE FROM auth.users WHERE id = p_user_id;
END;
$$;

-- ============================================================
-- SECURITY DEFINER FUNCTIONS - BUYER FACING (anon accessible)
-- ============================================================

-- Place a new order (buyer, no login required)
CREATE OR REPLACE FUNCTION place_order(
  p_buyer_name text,
  p_buyer_email text,
  p_buyer_phone text,
  p_delivery_address text,
  p_items jsonb
)
RETURNS TABLE (
  order_id uuid,
  access_token text
)
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_access_token text;
  v_item jsonb;
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

  INSERT INTO orders (buyer_name, buyer_email, buyer_phone, delivery_address)
  VALUES (p_buyer_name, lower(p_buyer_email), p_buyer_phone, p_delivery_address)
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
    'Order from ' || p_buyer_name || ' (' || p_buyer_phone || ')',
    jsonb_build_object('order_id', v_order_id)
  FROM profiles p;

  RETURN QUERY SELECT v_order_id, v_access_token;
END;
$$;

-- Get order status by access token (buyer, no login required)
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

-- Get deal details by buyer token (buyer, no login required)
CREATE OR REPLACE FUNCTION get_deal_by_buyer_token(p_buyer_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
  v_items jsonb;
  v_payments jsonb;
  v_modifications jsonb;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE buyer_token = p_buyer_token;
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
  FROM order_items oi WHERE oi.order_id = v_deal.order_id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', p.id,
      'amount', p.amount,
      'created_at', p.created_at,
      'note', p.note
    )
  ), '[]'::jsonb) INTO v_payments
  FROM payments p WHERE p.deal_id = v_deal.id;

  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', dm.id,
      'status', dm.status,
      'new_total_price', dm.new_total_price,
      'new_items', dm.new_items,
      'buyer_token', dm.buyer_token
    )
  ), '[]'::jsonb) INTO v_modifications
  FROM deal_modifications dm WHERE dm.deal_id = v_deal.id AND dm.status = 'pending';

  RETURN jsonb_build_object(
    'id', v_deal.id,
    'order_id', v_deal.order_id,
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

-- Buyer accepts deal terms
CREATE OR REPLACE FUNCTION buyer_accept_deal(p_buyer_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE buyer_token = p_buyer_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF v_deal.status != 'terms_sent' THEN
    RAISE EXCEPTION 'Deal is not awaiting buyer response';
  END IF;

  UPDATE deals SET status = 'buyer_accepted' WHERE id = v_deal.id;

  -- Notify all staff
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    p.id,
    'deal_accepted',
    'Deal Terms Accepted',
    'Buyer has accepted the deal terms. Please confirm from your email.',
    jsonb_build_object('deal_id', v_deal.id, 'seller_token', v_deal.seller_token)
  FROM profiles p;

  RETURN jsonb_build_object('success', true, 'seller_token', v_deal.seller_token);
END;
$$;

-- Buyer rejects deal terms
CREATE OR REPLACE FUNCTION buyer_reject_deal(p_buyer_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE buyer_token = p_buyer_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF v_deal.status != 'terms_sent' THEN
    RAISE EXCEPTION 'Deal is not awaiting buyer response';
  END IF;

  UPDATE deals SET status = 'buyer_rejected' WHERE id = v_deal.id;

  -- Notify all staff
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    p.id,
    'deal_rejected',
    'Deal Terms Rejected',
    'Buyer has rejected the deal terms.',
    jsonb_build_object('deal_id', v_deal.id)
  FROM profiles p;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Seller confirms deal from email link
CREATE OR REPLACE FUNCTION seller_confirm_deal(p_seller_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal record;
BEGIN
  SELECT * INTO v_deal FROM deals WHERE seller_token = p_seller_token;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF v_deal.status != 'buyer_accepted' THEN
    RAISE EXCEPTION 'Deal is not awaiting seller confirmation';
  END IF;

  UPDATE deals
  SET status = 'active', seller_confirmed_at = now()
  WHERE id = v_deal.id;

  UPDATE orders SET status = 'deal_created' WHERE id = v_deal.order_id;

  -- Notify all staff
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    p.id,
    'deal_confirmed',
    'Deal Confirmed - Agreement Active',
    'The deal has been confirmed and is now active. Total: ' || v_deal.total_price || ', Down: ' || v_deal.down_payment || ', Remaining: ' || v_deal.remaining_balance,
    jsonb_build_object('deal_id', v_deal.id)
  FROM profiles p;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Buyer accepts a deal modification
CREATE OR REPLACE FUNCTION buyer_accept_modification(p_buyer_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mod record;
  v_deal record;
  v_item jsonb;
BEGIN
  SELECT * INTO v_mod FROM deal_modifications WHERE buyer_token = p_buyer_token AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modification not found or already processed';
  END IF;

  SELECT * INTO v_deal FROM deals WHERE id = v_mod.deal_id;

  -- Apply the modification: update deal total and remaining
  UPDATE deals SET
    total_price = v_mod.new_total_price,
    remaining_balance = v_mod.new_total_price - total_paid
  WHERE id = v_mod.deal_id;

  -- Update order items: delete old, insert new
  DELETE FROM order_items WHERE order_id = v_deal.order_id;
  FOR v_item IN SELECT jsonb_array_elements(v_mod.new_items) LOOP
    INSERT INTO order_items (order_id, category_id, category_name, quantity, unit, option_selections)
    VALUES (
      v_deal.order_id,
      NULLIF(v_item->>'category_id', '')::uuid,
      v_item->>'category_name',
      COALESCE(NULLIF(v_item->>'quantity', '')::numeric, 0),
      v_item->>'unit',
      COALESCE(v_item->'option_selections', '{}'::jsonb)
    );
  END LOOP;

  UPDATE deal_modifications SET status = 'accepted' WHERE id = v_mod.id;

  -- Notify all staff
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    p.id,
    'modification_accepted',
    'Order Modification Accepted',
    'Buyer has accepted the order modification. New total: ' || v_mod.new_total_price,
    jsonb_build_object('deal_id', v_mod.deal_id)
  FROM profiles p;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Buyer rejects a deal modification
CREATE OR REPLACE FUNCTION buyer_reject_modification(p_buyer_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mod record;
BEGIN
  SELECT * INTO v_mod FROM deal_modifications WHERE buyer_token = p_buyer_token AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Modification not found or already processed';
  END IF;

  UPDATE deal_modifications SET status = 'rejected' WHERE id = v_mod.id;

  -- Notify all staff
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    p.id,
    'modification_rejected',
    'Order Modification Rejected',
    'Buyer has rejected the order modification.',
    jsonb_build_object('deal_id', v_mod.deal_id)
  FROM profiles p;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- SECURITY DEFINER FUNCTIONS - SELLER/ADMIN OPERATIONS
-- ============================================================

-- Pick up a pending order
CREATE OR REPLACE FUNCTION pick_up_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE orders
  SET status = 'picked_up', picked_up_by = auth.uid()
  WHERE id = p_order_id AND status = 'pending';
END;
$$;

-- Accept an order and create a deal
CREATE OR REPLACE FUNCTION accept_order(p_order_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_deal_id uuid;
  v_order record;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_order FROM orders WHERE id = p_order_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Order not found';
  END IF;

  IF v_order.status NOT IN ('picked_up', 'pending') THEN
    RAISE EXCEPTION 'Order cannot be accepted in current state';
  END IF;

  -- Ensure the caller has picked up the order (or is admin)
  IF v_order.picked_up_by IS NULL THEN
    UPDATE orders SET status = 'accepted', picked_up_by = auth.uid() WHERE id = p_order_id;
  ELSE
    UPDATE orders SET status = 'accepted' WHERE id = p_order_id;
  END IF;

  INSERT INTO deals (order_id, seller_id, status)
  VALUES (p_order_id, auth.uid(), 'pending_terms')
  RETURNING id INTO v_deal_id;

  RETURN v_deal_id;
END;
$$;

-- Reject an order
CREATE OR REPLACE FUNCTION reject_order(p_order_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE orders SET status = 'rejected' WHERE id = p_order_id;
END;
$$;

-- Set deal terms (total price and down payment)
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
  v_remaining numeric;
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

  v_remaining := p_total_price - p_down_payment;

  UPDATE deals SET
    total_price = p_total_price,
    down_payment = p_down_payment,
    total_paid = p_down_payment,
    remaining_balance = v_remaining,
    status = 'terms_sent'
  WHERE id = p_deal_id AND status = 'pending_terms';
END;
$$;

-- Record a payment
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
  v_new_total_paid numeric;
  v_new_remaining numeric;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be greater than 0';
  END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF v_deal.status NOT IN ('active', 'seller_confirmed') THEN
    RAISE EXCEPTION 'Deal is not active';
  END IF;

  v_new_total_paid := v_deal.total_paid + p_amount;
  v_new_remaining := v_deal.total_price - v_new_total_paid;

  IF v_new_remaining < 0 THEN
    RAISE EXCEPTION 'Payment exceeds remaining balance';
  END IF;

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

  -- Notify all staff
  INSERT INTO notifications (user_id, type, title, message, data)
  SELECT
    p.id,
    'payment_recorded',
    'Payment Recorded',
    'Payment of ' || p_amount || ' recorded. Total paid: ' || v_new_total_paid || ', Remaining: ' || v_new_remaining,
    jsonb_build_object('deal_id', p_deal_id)
  FROM profiles p;

  RETURN jsonb_build_object(
    'total_paid', v_new_total_paid,
    'remaining_balance', v_new_remaining,
    'is_done', v_new_remaining = 0
  );
END;
$$;

-- Propose an order modification
CREATE OR REPLACE FUNCTION propose_modification(
  p_deal_id uuid,
  p_new_items jsonb,
  p_new_total_price numeric
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_mod_id uuid;
  v_deal record;
BEGIN
  IF get_user_role() NOT IN ('admin', 'seller') THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT * INTO v_deal FROM deals WHERE id = p_deal_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found';
  END IF;

  IF v_deal.status NOT IN ('active', 'seller_confirmed') THEN
    RAISE EXCEPTION 'Deal is not active';
  END IF;

  INSERT INTO deal_modifications (deal_id, proposed_by, new_items, new_total_price)
  VALUES (p_deal_id, auth.uid(), p_new_items, p_new_total_price)
  RETURNING id INTO v_mod_id;

  RETURN v_mod_id;
END;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- PROFILES: users can see/edit own profile; admins can see/edit all
DROP POLICY IF EXISTS "profiles_select_own_or_admin" ON profiles;
CREATE POLICY "profiles_select_own_or_admin"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "profiles_update_own_or_admin" ON profiles;
CREATE POLICY "profiles_update_own_or_admin"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR is_admin())
  WITH CHECK (id = auth.uid() OR is_admin());

-- Column-level: prevent non-admins from changing role via direct update
REVOKE UPDATE ON profiles FROM authenticated;
GRANT UPDATE (display_name, phone, avatar_url) ON profiles TO authenticated;

-- CATEGORIES: public read, admin write
DROP POLICY IF EXISTS "categories_select_public" ON categories;
CREATE POLICY "categories_select_public"
  ON categories FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_insert_admin" ON categories;
CREATE POLICY "categories_insert_admin"
  ON categories FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "categories_update_admin" ON categories;
CREATE POLICY "categories_update_admin"
  ON categories FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "categories_delete_admin" ON categories;
CREATE POLICY "categories_delete_admin"
  ON categories FOR DELETE TO authenticated USING (is_admin());

-- CATEGORY OPTION GROUPS: public read, admin write
DROP POLICY IF EXISTS "option_groups_select_public" ON category_option_groups;
CREATE POLICY "option_groups_select_public"
  ON category_option_groups FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "option_groups_insert_admin" ON category_option_groups;
CREATE POLICY "option_groups_insert_admin"
  ON category_option_groups FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "option_groups_update_admin" ON category_option_groups;
CREATE POLICY "option_groups_update_admin"
  ON category_option_groups FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "option_groups_delete_admin" ON category_option_groups;
CREATE POLICY "option_groups_delete_admin"
  ON category_option_groups FOR DELETE TO authenticated USING (is_admin());

-- CATEGORY OPTIONS: public read, admin write
DROP POLICY IF EXISTS "options_select_public" ON category_options;
CREATE POLICY "options_select_public"
  ON category_options FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "options_insert_admin" ON category_options;
CREATE POLICY "options_insert_admin"
  ON category_options FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "options_update_admin" ON category_options;
CREATE POLICY "options_update_admin"
  ON category_options FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "options_delete_admin" ON category_options;
CREATE POLICY "options_delete_admin"
  ON category_options FOR DELETE TO authenticated USING (is_admin());

-- ORDERS: authenticated staff can read all; updates by staff
DROP POLICY IF EXISTS "orders_select_staff" ON orders;
CREATE POLICY "orders_select_staff"
  ON orders FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "orders_update_staff" ON orders;
CREATE POLICY "orders_update_staff"
  ON orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ORDER ITEMS: authenticated staff can read all
DROP POLICY IF EXISTS "order_items_select_staff" ON order_items;
CREATE POLICY "order_items_select_staff"
  ON order_items FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "order_items_insert_staff" ON order_items;
CREATE POLICY "order_items_insert_staff"
  ON order_items FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_update_staff" ON order_items;
CREATE POLICY "order_items_update_staff"
  ON order_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "order_items_delete_staff" ON order_items;
CREATE POLICY "order_items_delete_staff"
  ON order_items FOR DELETE TO authenticated USING (true);

-- DEALS: authenticated staff can read all
DROP POLICY IF EXISTS "deals_select_staff" ON deals;
CREATE POLICY "deals_select_staff"
  ON deals FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "deals_update_staff" ON deals;
CREATE POLICY "deals_update_staff"
  ON deals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- PAYMENTS: authenticated staff can read all
DROP POLICY IF EXISTS "payments_select_staff" ON payments;
CREATE POLICY "payments_select_staff"
  ON payments FOR SELECT TO authenticated USING (true);

-- DEAL MODIFICATIONS: authenticated staff can read all
DROP POLICY IF EXISTS "deal_mods_select_staff" ON deal_modifications;
CREATE POLICY "deal_mods_select_staff"
  ON deal_modifications FOR SELECT TO authenticated USING (true);

-- NOTIFICATIONS: users see their own; admins see all
DROP POLICY IF EXISTS "notifications_select_own_or_admin" ON notifications;
CREATE POLICY "notifications_select_own_or_admin"
  ON notifications FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- SITE CONTENT: public read, admin write
DROP POLICY IF EXISTS "site_content_select_public" ON site_content;
CREATE POLICY "site_content_select_public"
  ON site_content FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "site_content_insert_admin" ON site_content;
CREATE POLICY "site_content_insert_admin"
  ON site_content FOR INSERT TO authenticated WITH CHECK (is_admin());

DROP POLICY IF EXISTS "site_content_update_admin" ON site_content;
CREATE POLICY "site_content_update_admin"
  ON site_content FOR UPDATE TO authenticated USING (is_admin()) WITH CHECK (is_admin());

DROP POLICY IF EXISTS "site_content_delete_admin" ON site_content;
CREATE POLICY "site_content_delete_admin"
  ON site_content FOR DELETE TO authenticated USING (is_admin());

-- ============================================================
-- FUNCTION GRANTS
-- ============================================================
GRANT EXECUTE ON FUNCTION get_user_role TO authenticated;
GRANT EXECUTE ON FUNCTION is_admin TO authenticated;
GRANT EXECUTE ON FUNCTION create_staff_account TO authenticated;
GRANT EXECUTE ON FUNCTION update_staff_account TO authenticated;
GRANT EXECUTE ON FUNCTION delete_staff_account TO authenticated;
GRANT EXECUTE ON FUNCTION place_order TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_order_by_access_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_deal_by_buyer_token TO anon, authenticated;
GRANT EXECUTE ON FUNCTION buyer_accept_deal TO anon, authenticated;
GRANT EXECUTE ON FUNCTION buyer_reject_deal TO anon, authenticated;
GRANT EXECUTE ON FUNCTION seller_confirm_deal TO anon, authenticated;
GRANT EXECUTE ON FUNCTION buyer_accept_modification TO anon, authenticated;
GRANT EXECUTE ON FUNCTION buyer_reject_modification TO anon, authenticated;
GRANT EXECUTE ON FUNCTION pick_up_order TO authenticated;
GRANT EXECUTE ON FUNCTION accept_order TO authenticated;
GRANT EXECUTE ON FUNCTION reject_order TO authenticated;
GRANT EXECUTE ON FUNCTION set_deal_terms TO authenticated;
GRANT EXECUTE ON FUNCTION record_payment TO authenticated;
GRANT EXECUTE ON FUNCTION propose_modification TO authenticated;

-- ============================================================
-- STORAGE BUCKET
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-receipts', 'payment-receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for payment receipts
DROP POLICY IF EXISTS "receipts_select_staff" ON storage.objects;
CREATE POLICY "receipts_select_staff"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "receipts_insert_staff" ON storage.objects;
CREATE POLICY "receipts_insert_staff"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "receipts_update_staff" ON storage.objects;
CREATE POLICY "receipts_update_staff"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-receipts');

DROP POLICY IF EXISTS "receipts_delete_admin" ON storage.objects;
CREATE POLICY "receipts_delete_admin"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'payment-receipts' AND is_admin());
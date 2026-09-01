export type View =
  | 'home' | 'products' | 'product' | 'cart' | 'about' | 'status'
  | 'order-confirmation' | 'deal-view' | 'seller-confirm'
  | 'login' | 'dashboard' | 'profile' | 'controller' | 'management'
  | 'edit-site';

export type Role = 'admin' | 'seller' | null;

export interface Category {
  id: string;
  name: string;
  description: string;
  image_url: string;
  display_order: number;
}

export interface OptionGroup {
  id: string;
  category_id: string;
  name: string;
  display_order: number;
  options: OptionChoice[];
}

export interface OptionChoice {
  id: string;
  group_id: string;
  label: string;
  display_order: number;
}

export interface CartItem {
  id: string;
  category_id: string;
  category_name: string;
  quantity: number;
  unit: string;
  option_selections: Record<string, string>;
  image_url: string;
}

export interface OrderRow {
  id: string;
  buyer_name: string;
  buyer_email: string;
  buyer_phone: string;
  delivery_address: string;
  status: string;
  picked_up_by: string | null;
  access_token: string;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  category_name: string;
  quantity: number;
  unit: string;
  option_selections: Record<string, string>;
}

export interface DealRow {
  id: string;
  order_id: string;
  seller_id: string | null;
  status: string;
  total_price: number;
  down_payment: number;
  total_paid: number;
  remaining_balance: number;
  buyer_token: string;
  seller_token: string;
  seller_confirmed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRow {
  id: string;
  deal_id: string;
  amount: number;
  photo_url: string;
  recorded_by: string | null;
  note: string;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  email: string;
  role: string;
  display_name: string;
  phone: string;
  avatar_url: string;
}

export interface SiteContent {
  [key: string]: { value: string; image_url: string };
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
}

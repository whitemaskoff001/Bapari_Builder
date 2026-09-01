import { supabase } from './supabase';
import type {
  Category, OptionGroup, OrderRow, OrderItemRow, DealRow,
  PaymentRow, ProfileRow, SiteContent, NotificationRow,
} from '@/types';

// ─── Image Upload ──────────────────────────────────────────────

export async function uploadSiteImage(file: Blob, folder: string): Promise<string> {
  const ext = file.type.split('/')[1] || 'jpg';
  const filename = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage
    .from('site-images')
    .upload(filename, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from('site-images').getPublicUrl(filename);
  return data.publicUrl;
}

// ─── Categories ───────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('display_order');
  if (error) throw error;
  return data ?? [];
}

export async function fetchCategoryOptionGroups(categoryId: string): Promise<OptionGroup[]> {
  const { data: groups, error: gErr } = await supabase
    .from('category_option_groups')
    .select('*')
    .eq('category_id', categoryId)
    .order('display_order');
  if (gErr) throw gErr;
  if (!groups?.length) return [];

  const groupIds = groups.map((g) => g.id);
  const { data: options, error: oErr } = await supabase
    .from('category_options')
    .select('*')
    .in('group_id', groupIds)
    .order('display_order');
  if (oErr) throw oErr;

  return groups.map((g) => ({
    ...g,
    options: (options ?? []).filter((o) => o.group_id === g.id),
  }));
}

// ─── Orders ───────────────────────────────────────────────────

export async function placeOrder(
  name: string, email: string, phone: string, address: string,
  items: Array<{ category_name: string; quantity: number; unit: string; option_selections: Record<string, string> }>,
): Promise<{ order_id: string; access_token: string; reference_number: string }> {
  const { data, error } = await supabase.rpc('place_order', {
    p_buyer_name: name,
    p_buyer_email: email,
    p_buyer_phone: phone,
    p_delivery_address: address,
    p_items: items,
  });
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('No order returned');
  return data[0];
}

export async function getOrderByToken(token: string) {
  const { data, error } = await supabase.rpc('get_order_by_access_token', {
    p_access_token: token,
  });
  if (error) throw error;
  return data;
}

export async function getOrderByReference(reference: string) {
  const { data, error } = await supabase.rpc('get_order_by_reference', {
    p_reference_number: reference,
  });
  if (error) throw error;
  return data;
}

// ─── Deals (buyer-facing, token-based) ────────────────────────

export async function getDealByBuyerToken(token: string) {
  const { data, error } = await supabase.rpc('get_deal_by_buyer_token', {
    p_buyer_token: token,
  });
  if (error) throw error;
  return data;
}

export async function buyerAcceptDeal(buyerToken: string) {
  const { data, error } = await supabase.rpc('buyer_accept_deal', {
    p_buyer_token: buyerToken,
  });
  if (error) throw error;
  return data;
}

export async function buyerRejectDeal(buyerToken: string) {
  const { data, error } = await supabase.rpc('buyer_reject_deal', {
    p_buyer_token: buyerToken,
  });
  if (error) throw error;
  return data;
}

export async function sellerConfirmDeal(sellerToken: string) {
  const { data, error } = await supabase.rpc('seller_confirm_deal', {
    p_seller_token: sellerToken,
  });
  if (error) throw error;
  return data;
}

export async function buyerAcceptModification(buyerToken: string) {
  const { data, error } = await supabase.rpc('buyer_accept_modification', {
    p_buyer_token: buyerToken,
  });
  if (error) throw error;
  return data;
}

export async function buyerRejectModification(buyerToken: string) {
  const { data, error } = await supabase.rpc('buyer_reject_modification', {
    p_buyer_token: buyerToken,
  });
  if (error) throw error;
  return data;
}

// ─── Staff operations ─────────────────────────────────────────

export async function fetchOrders(): Promise<OrderRow[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchOrderItems(orderId: string): Promise<OrderItemRow[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchDeals(): Promise<DealRow[]> {
  const { data, error } = await supabase
    .from('deals')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchPayments(dealId: string): Promise<PaymentRow[]> {
  const { data, error } = await supabase
    .from('payments')
    .select('*')
    .eq('deal_id', dealId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function pickUpOrder(orderId: string) {
  const { error } = await supabase.rpc('pick_up_order', { p_order_id: orderId });
  if (error) throw error;
}

export async function acceptOrder(orderId: string): Promise<string> {
  const { data, error } = await supabase.rpc('accept_order', { p_order_id: orderId });
  if (error) throw error;
  return data;
}

export async function rejectOrder(orderId: string) {
  const { error } = await supabase.rpc('reject_order', { p_order_id: orderId });
  if (error) throw error;
}

export async function setDealTerms(dealId: string, totalPrice: number, downPayment: number) {
  const { error } = await supabase.rpc('set_deal_terms', {
    p_deal_id: dealId,
    p_total_price: totalPrice,
    p_down_payment: downPayment,
  });
  if (error) throw error;
}

export async function recordPayment(dealId: string, amount: number, photoUrl: string, note: string) {
  const { data, error } = await supabase.rpc('record_payment', {
    p_deal_id: dealId,
    p_amount: amount,
    p_photo_url: photoUrl,
    p_note: note,
  });
  if (error) throw error;
  return data;
}

export async function proposeModification(dealId: string, newItems: unknown[], newTotalPrice: number) {
  const { data, error } = await supabase.rpc('propose_modification', {
    p_deal_id: dealId,
    p_new_items: newItems,
    p_new_total_price: newTotalPrice,
  });
  if (error) throw error;
  return data;
}

// ─── Profiles / Controller ────────────────────────────────────

export async function fetchProfiles(): Promise<ProfileRow[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchMyProfile(): Promise<ProfileRow | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function createStaffAccount(email: string, password: string, role: string, displayName: string, phone: string) {
  const { data, error } = await supabase.rpc('create_staff_account', {
    p_email: email,
    p_password: password,
    p_role: role,
    p_display_name: displayName,
    p_phone: phone,
  });
  if (error) throw error;
  return data;
}

export async function updateStaffAccount(
  userId: string,
  email?: string, role?: string, displayName?: string, phone?: string, password?: string,
) {
  const { error } = await supabase.rpc('update_staff_account', {
    p_user_id: userId,
    p_email: email ?? null,
    p_role: role ?? null,
    p_display_name: displayName ?? null,
    p_phone: phone ?? null,
    p_password: password ?? null,
  });
  if (error) throw error;
}

export async function deleteStaffAccount(userId: string) {
  const { error } = await supabase.rpc('delete_staff_account', {
    p_user_id: userId,
  });
  if (error) throw error;
}

export async function updateMyProfile(displayName: string, phone: string) {
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, phone })
    .eq('id', (await supabase.auth.getUser()).data.user?.id);
  if (error) throw error;
}

// ─── Notifications ────────────────────────────────────────────

export async function fetchNotifications(): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function markNotificationRead(id: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', id);
  if (error) throw error;
}

// ─── Site Content ─────────────────────────────────────────────

export async function fetchSiteContent(): Promise<SiteContent> {
  const { data, error } = await supabase.from('site_content').select('*');
  if (error) throw error;
  const result: SiteContent = {};
  for (const row of data ?? []) {
    result[row.key] = { value: row.value ?? '', image_url: row.image_url ?? '' };
  }
  return result;
}

export async function updateSiteContent(key: string, value: string, imageUrl?: string) {
  const { error } = await supabase
    .from('site_content')
    .upsert({ key, value, image_url: imageUrl ?? null });
  if (error) throw error;
}

// ─── Category CRUD (admin) ────────────────────────────────────

export async function createCategory(name: string, description: string, imageUrl: string) {
  const { data, error } = await supabase
    .from('categories')
    .insert({ name, description, image_url: imageUrl })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateCategory(id: string, name: string, description: string, imageUrl: string) {
  const { error } = await supabase
    .from('categories')
    .update({ name, description, image_url: imageUrl })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase
    .from('categories')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function createOptionGroup(categoryId: string, name: string) {
  const { data, error } = await supabase
    .from('category_option_groups')
    .insert({ category_id: categoryId, name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOptionGroup(id: string, name: string) {
  const { error } = await supabase
    .from('category_option_groups')
    .update({ name })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteOptionGroup(id: string) {
  const { error } = await supabase
    .from('category_option_groups')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function createOption(groupId: string, label: string) {
  const { data, error } = await supabase
    .from('category_options')
    .insert({ group_id: groupId, label })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateOption(id: string, label: string) {
  const { error } = await supabase
    .from('category_options')
    .update({ label })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteOption(id: string) {
  const { error } = await supabase
    .from('category_options')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ─── Email notification helper ────────────────────────────────

export async function sendNotificationEmail(
  toEmail: string, subject: string, body: string,
  actionUrl?: string, actionLabel?: string,
) {
  try {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-notification-email`;
    await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ to_email: toEmail, subject, body, action_url: actionUrl, action_label: actionLabel }),
    });
  } catch {
    // Best-effort: email failures shouldn't block the flow
  }
}

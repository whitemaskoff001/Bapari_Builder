import { isSupabaseConfigured, supabase } from './supabase';
import type {
  Category, OptionGroup, OrderRow, OrderItemRow, DealRow,
  PaymentRow, ProfileRow, SiteContent, NotificationRow,
} from '@/types';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'brick', name: 'Brick', description: 'Reliable masonry essentials for durable walls and structures.', image_url: 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=900', display_order: 1 },
  { id: 'cement', name: 'Cement', description: 'High-strength cement for foundations, finishing, and structural work.', image_url: 'https://images.pexels.com/photos/162500/pexels-photo-162500.jpeg?auto=compress&cs=tinysrgb&w=900', display_order: 2 },
  { id: 'sand', name: 'Sand', description: 'Clean, consistent sand for mixing, plastering, and finishing.', image_url: 'https://images.pexels.com/photos/220182/pexels-photo-220182.jpeg?auto=compress&cs=tinysrgb&w=900', display_order: 3 },
  { id: 'steel', name: 'Steel', description: 'Structural steel and reinforcement for strength and stability.', image_url: 'https://images.pexels.com/photos/162553/pexels-photo-162553.jpeg?auto=compress&cs=tinysrgb&w=900', display_order: 4 },
  { id: 'tile', name: 'Tiles', description: 'Flooring and wall tile solutions for durable finishes.', image_url: 'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg?auto=compress&cs=tinysrgb&w=900', display_order: 5 },
  { id: 'paint', name: 'Paint & Finish', description: 'Protective and decorative finishing products for every surface.', image_url: 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=900', display_order: 6 },
];

const DEFAULT_SITE_CONTENT: SiteContent = {
  announcement: { value: 'Building trust, one project at a time', image_url: '' },
  contact_phone: { value: '+880 1711 123 456', image_url: '' },
  company_name: { value: 'BAPARI', image_url: '' },
  company_subname: { value: 'BUILDERS', image_url: '' },
  hero_eyebrow: { value: 'Materials that move your vision forward', image_url: '' },
  hero_title: { value: 'Build it right.', image_url: '' },
  hero_title_em: { value: 'Build it to last.', image_url: '' },
  hero_subtitle: { value: 'Reliable construction materials, honest guidance, and a team that understands what your project demands.', image_url: '' },
  hero_stat1_value: { value: '15+', image_url: '' },
  hero_stat1_label: { value: 'Years of trust', image_url: '' },
  hero_stat2_value: { value: '4.9', image_url: '' },
  hero_stat2_label: { value: 'Customer rating', image_url: '' },
  hero_stat3_value: { value: '24h', image_url: '' },
  hero_stat3_label: { value: 'Quick response', image_url: '' },
  intro_eyebrow: { value: 'The Bapari standard', image_url: '' },
  intro_title: { value: 'Materials you can', image_url: '' },
  intro_title_em: { value: 'build a future on.', image_url: '' },
  intro_body: { value: 'From the first foundation to the final finish, your materials shape everything. We source with care, stand behind what we sell, and make it simple to get exactly what your project needs.', image_url: '' },
  intro_cta: { value: 'Meet the team', image_url: '' },
  featured_eyebrow: { value: 'What we supply', image_url: '' },
  featured_title: { value: 'Start with the essentials.', image_url: '' },
  featured_cta: { value: 'View all materials', image_url: '' },
  process_eyebrow: { value: 'Simple by design', image_url: '' },
  process_title_1: { value: 'From your idea', image_url: '' },
  process_title_2: { value: 'to', image_url: '' },
  process_title_em: { value: 'your doorstep.', image_url: '' },
  process_step1_title: { value: 'Choose your materials', image_url: '' },
  process_step1_desc: { value: 'Browse our curated range of construction essentials.', image_url: '' },
  process_step2_title: { value: 'Tell us what you need', image_url: '' },
  process_step2_desc: { value: 'Share quantity, delivery details, and your preferences.', image_url: '' },
  process_step3_title: { value: 'We work out the details', image_url: '' },
  process_step3_desc: { value: 'Our team calls to confirm availability and the best price.', image_url: '' },
  detail_badge: { value: 'Available for delivery', image_url: '' },
  detail_subtitle: { value: 'for your next build.', image_url: '' },
  detail_add_button: { value: 'Add to materials list', image_url: '' },
  detail_note_prefix: { value: 'Not sure what you need?', image_url: '' },
  detail_note_phone: { value: 'Call +880 1711 123 456', image_url: '' },
};

const DEFAULT_OPTION_GROUPS: Record<string, OptionGroup[]> = {
  brick: [
    { id: 'brick-unit', category_id: 'brick', name: 'Unit', display_order: 1, options: [{ id: 'brick-unit-pc', group_id: 'brick-unit', label: 'Piece', display_order: 1 }, { id: 'brick-unit-pallet', group_id: 'brick-unit', label: 'Pallet', display_order: 2 }] },
    { id: 'brick-quality', category_id: 'brick', name: 'Quality', display_order: 2, options: [{ id: 'brick-quality-standard', group_id: 'brick-quality', label: 'Standard', display_order: 1 }, { id: 'brick-quality-premium', group_id: 'brick-quality', label: 'Premium', display_order: 2 }] },
  ],
  cement: [
    { id: 'cement-unit', category_id: 'cement', name: 'Unit', display_order: 1, options: [{ id: 'cement-unit-bag', group_id: 'cement-unit', label: 'Bag', display_order: 1 }, { id: 'cement-unit-ton', group_id: 'cement-unit', label: 'Ton', display_order: 2 }] },
    { id: 'cement-strength', category_id: 'cement', name: 'Strength', display_order: 2, options: [{ id: 'cement-strength-42', group_id: 'cement-strength', label: '42.5', display_order: 1 }, { id: 'cement-strength-52', group_id: 'cement-strength', label: '52.5', display_order: 2 }] },
  ],
  sand: [
    { id: 'sand-unit', category_id: 'sand', name: 'Unit', display_order: 1, options: [{ id: 'sand-unit-truck', group_id: 'sand-unit', label: 'Truck', display_order: 1 }, { id: 'sand-unit-cft', group_id: 'sand-unit', label: 'CFT', display_order: 2 }] },
    { id: 'sand-type', category_id: 'sand', name: 'Type', display_order: 2, options: [{ id: 'sand-type-river', group_id: 'sand-type', label: 'River', display_order: 1 }, { id: 'sand-type-fine', group_id: 'sand-type', label: 'Fine', display_order: 2 }] },
  ],
  steel: [
    { id: 'steel-unit', category_id: 'steel', name: 'Unit', display_order: 1, options: [{ id: 'steel-unit-ton', group_id: 'steel-unit', label: 'Ton', display_order: 1 }, { id: 'steel-unit-bar', group_id: 'steel-unit', label: 'Bar', display_order: 2 }] },
    { id: 'steel-grade', category_id: 'steel', name: 'Grade', display_order: 2, options: [{ id: 'steel-grade-40', group_id: 'steel-grade', label: 'Grade 40', display_order: 1 }, { id: 'steel-grade-60', group_id: 'steel-grade', label: 'Grade 60', display_order: 2 }] },
  ],
  tile: [
    { id: 'tile-unit', category_id: 'tile', name: 'Unit', display_order: 1, options: [{ id: 'tile-unit-box', group_id: 'tile-unit', label: 'Box', display_order: 1 }, { id: 'tile-unit-sqft', group_id: 'tile-unit', label: 'Sqft', display_order: 2 }] },
    { id: 'tile-finish', category_id: 'tile', name: 'Finish', display_order: 2, options: [{ id: 'tile-finish-matt', group_id: 'tile-finish', label: 'Matte', display_order: 1 }, { id: 'tile-finish-gloss', group_id: 'tile-finish', label: 'Gloss', display_order: 2 }] },
  ],
  paint: [
    { id: 'paint-unit', category_id: 'paint', name: 'Unit', display_order: 1, options: [{ id: 'paint-unit-litre', group_id: 'paint-unit', label: 'Litre', display_order: 1 }, { id: 'paint-unit-tin', group_id: 'paint-unit', label: 'Tin', display_order: 2 }] },
    { id: 'paint-finish', category_id: 'paint', name: 'Finish', display_order: 2, options: [{ id: 'paint-finish-matte', group_id: 'paint-finish', label: 'Matte', display_order: 1 }, { id: 'paint-finish-gloss', group_id: 'paint-finish', label: 'Gloss', display_order: 2 }] },
  ],
};

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
  if (!isSupabaseConfigured) return DEFAULT_CATEGORIES;

  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .order('display_order');
  if (error) throw error;
  return data?.length ? data : DEFAULT_CATEGORIES;
}

export async function fetchCategoryOptionGroups(categoryId: string): Promise<OptionGroup[]> {
  if (!isSupabaseConfigured) return DEFAULT_OPTION_GROUPS[categoryId] ?? [];

  const { data: groups, error: gErr } = await supabase
    .from('category_option_groups')
    .select('*')
    .eq('category_id', categoryId)
    .order('display_order');
  if (gErr) throw gErr;
  if (!groups?.length) return DEFAULT_OPTION_GROUPS[categoryId] ?? [];

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
  if (!isSupabaseConfigured) return null;
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
  if (!isSupabaseConfigured) return { ...DEFAULT_SITE_CONTENT };

  const { data, error } = await supabase.from('site_content').select('*');
  if (error) throw error;
  const result: SiteContent = { ...DEFAULT_SITE_CONTENT };
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

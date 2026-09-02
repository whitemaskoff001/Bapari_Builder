import { useCallback, useEffect, useState } from 'react';
import {
  ArrowRight, Building2, Check, ChevronDown, CircleUserRound, ClipboardList, Copy,
  HardHat, Menu, Minus, Package, Phone, Plus,
  Search, ShoppingBag, SlidersHorizontal, UserRound, X, ShieldCheck,
  Bell, Edit3, Eye, EyeOff, Trash2, LogOut, LayoutDashboard, Users,
  TrendingUp, Clock, Pencil, Save, MapPin, Calendar,
} from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import * as api from '@/lib/api';
import type { View, Category, CartItem, SiteContent, NotificationRow, OptionGroup, OptionChoice } from '@/types';
import { ImageUploader } from '@/components/ImageUploader';

const photos = {
  hero: 'https://images.pexels.com/photos/33194812/pexels-photo-33194812.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  fallback: 'https://images.pexels.com/photos/2333694/pexels-photo-2333694.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
};

function AppInner() {
  const { role, loading, signOut, profile, refreshProfile } = useAuth();
  const [view, setView] = useState<View>('home');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [siteContent, setSiteContent] = useState<SiteContent>({});
  const [lastOrderToken, setLastOrderToken] = useState('');
  const [lastOrderReference, setLastOrderReference] = useState('');
  const [dealToken, setDealToken] = useState('');
  const [sellerToken, setSellerToken] = useState('');
  const [modToken, setModToken] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('bapari-cart');
    if (saved) try { setCart(JSON.parse(saved)); } catch { /* ignore */ }
  }, []);

  useEffect(() => { localStorage.setItem('bapari-cart', JSON.stringify(cart)); }, [cart]);

  useEffect(() => {
    api.fetchSiteContent().then(setSiteContent).catch(() => {});
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  // Handle hash-based routing for hidden login and buyer token pages
  useEffect(() => {
    const handleHash = () => {
      const hash = window.location.hash.slice(1);
      if (hash === 'iamseller/login') setView('login');
      else if (hash.startsWith('deal/')) { setDealToken(hash.slice(5)); setView('deal-view'); }
      else if (hash.startsWith('confirm/')) { setSellerToken(hash.slice(8)); setView('seller-confirm'); }
      else if (hash.startsWith('mod/')) { setModToken(hash.slice(4)); setView('deal-view'); }
    };
    handleHash();
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  const openView = useCallback((next: View) => {
    setView(next);
    setMobileMenu(false);
    if (next !== 'login') window.location.hash = '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const openProduct = useCallback((catId: string) => {
    setSelectedCategoryId(catId);
    openView('product');
  }, [openView]);

  const addToCart = useCallback((item: CartItem) => {
    setCart((c) => [...c, item]);
    setToast(`${item.category_name} added to your materials list`);
    setCartOpen(true);
  }, []);

  const removeFromCart = useCallback((index: number) => {
    setCart((c) => c.filter((_, i) => i !== index));
  }, []);

  const navigateHome = useCallback(() => openView('home'), [openView]);

  const sc = (key: string, fallback: string) => siteContent[key]?.value ?? fallback;

  if (loading) {
    return <div className="app-shell"><div className="loading-screen"><Building2 size={32} /><p>Loading Bapari Builders...</p></div></div>;
  }

  return (
    <div className="app-shell">
      <Header
        cartCount={cart.length}
        role={role}
        onNavigate={openView}
        onCart={() => setCartOpen(true)}
        onLogin={() => { window.location.hash = 'iamseller/login'; setView('login'); }}
        mobileMenu={mobileMenu}
        setMobileMenu={setMobileMenu}
        announcement={sc('announcement', 'Building trust, one project at a time')}
        content={siteContent}
        editMode={editMode && role === 'admin'}
        onContentUpdate={() => api.fetchSiteContent().then(setSiteContent)}
      />
      <main>
        {view === 'home' && <Home onBrowse={() => openView('products')} onAbout={() => openView('about')} onProduct={openProduct} content={siteContent} editMode={editMode && role === 'admin'} onContentUpdate={() => api.fetchSiteContent().then(setSiteContent)} />}
        {view === 'products' && <Products onProduct={openProduct} editMode={editMode && role === 'admin'} onContentUpdate={() => api.fetchSiteContent().then(setSiteContent)} content={siteContent} />}
        {view === 'product' && selectedCategoryId && <ProductDetail categoryId={selectedCategoryId} onBack={() => openView('products')} onAdd={addToCart} editMode={editMode && role === 'admin'} content={siteContent} onContentUpdate={() => api.fetchSiteContent().then(setSiteContent)} />}
        {view === 'cart' && <CartPage cart={cart} onRemove={removeFromCart} onBrowse={() => openView('products')} onSubmitted={(token, reference) => { setLastOrderToken(token); setLastOrderReference(reference); openView('order-confirmation'); }} />}
        {view === 'order-confirmation' && <OrderConfirmation token={lastOrderToken} reference={lastOrderReference} onHome={navigateHome} />}
        {view === 'about' && <About onContact={() => openView('products')} content={siteContent} editMode={editMode && role === 'admin'} onContentUpdate={() => api.fetchSiteContent().then(setSiteContent)} />}
        {view === 'status' && <StatusPage />}
        {view === 'deal-view' && <DealView dealToken={dealToken} modToken={modToken} />}
        {view === 'seller-confirm' && <SellerConfirm sellerToken={sellerToken} />}
        {view === 'login' && <Login onBack={navigateHome} onSuccess={() => openView('dashboard')} content={siteContent} editMode={editMode && role === 'admin'} onContentUpdate={() => api.fetchSiteContent().then(setSiteContent)} />}
        {view === 'dashboard' && role && <Dashboard role={role} onNavigate={openView} onLogout={signOut} profile={profile} editMode={editMode} setEditMode={setEditMode} />}
        {view === 'profile' && role && <ProfilePage onBack={() => openView('dashboard')} onUpdated={refreshProfile} />}
        {view === 'controller' && role === 'admin' && <ControllerPage onBack={() => openView('dashboard')} />}
        {view === 'management' && role && <ManagementPage role={role} onBack={() => openView('dashboard')} />}
        {view === 'edit-site' && role === 'admin' && <EditSitePage onBack={() => openView('dashboard')} onUpdated={() => api.fetchSiteContent().then(setSiteContent)} />}
      </main>
      <Footer onNavigate={openView} content={siteContent} editMode={editMode && role === 'admin'} onContentUpdate={() => api.fetchSiteContent().then(setSiteContent)} />
      <CartDrawer open={cartOpen} cart={cart} onClose={() => setCartOpen(false)} onRemove={removeFromCart} onCheckout={() => { setCartOpen(false); openView('cart'); }} />
      {role === 'admin' && view !== 'login' && (
        <button className={`edit-mode-toggle ${editMode ? 'active' : ''}`} onClick={() => setEditMode(!editMode)}>
          {editMode ? <><EyeOff size={16} /> Exit edit mode</> : <><Edit3 size={16} /> Edit mode</>}
        </button>
      )}
      {toast && <div className="toast"><Check size={17} />{toast}</div>}
    </div>
  );
}

function App() {
  return <AuthProvider><AppInner /></AuthProvider>;
}
export default App;

// â”€â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Header({ cartCount, role, onNavigate, onCart, onLogin, mobileMenu, setMobileMenu, announcement, content, editMode, onContentUpdate }: {
  cartCount: number; role: string | null; onNavigate: (v: View) => void; onCart: () => void; onLogin: () => void;
  mobileMenu: boolean; setMobileMenu: (v: boolean) => void; announcement: string;
  content: SiteContent; editMode: boolean; onContentUpdate: () => void;
}) {
  const sc = (key: string, fallback: string) => content[key]?.value ?? fallback;
  const phone = sc('contact_phone', '+880 1711 123 456');
  const brandName = sc('company_name', 'BAPARI');
  const brandSub = sc('company_subname', 'BUILDERS');
  return (
    <header className="site-header">
      <div className="announcement">
        <span><span className="announcement-dot" /> {announcement}</span>
        <span className="announcement-contact">Call us: {editMode ? <EditableText value={phone} contentKey="contact_phone" editMode={editMode} onUpdate={onContentUpdate} /> : phone}</span>
      </div>
      <div className="nav-wrap">
        <button className="brand" onClick={() => onNavigate('home')}>
          <span className="brand-mark"><Building2 size={21} strokeWidth={2.5} /></span>
          <span><strong>{editMode ? <EditableText value={brandName} contentKey="company_name" editMode={editMode} onUpdate={onContentUpdate} /> : brandName}</strong><small>{editMode ? <EditableText value={brandSub} contentKey="company_subname" editMode={editMode} onUpdate={onContentUpdate} /> : brandSub}</small></span>
        </button>
        <nav className={mobileMenu ? 'main-nav mobile-open' : 'main-nav'}>
          <button onClick={() => onNavigate('home')}>Home</button>
          <button onClick={() => onNavigate('products')}>Materials</button>
          <button onClick={() => onNavigate('about')}>Our story</button>
          <button onClick={() => onNavigate('status')}>Track order</button>
        </nav>
        <div className="nav-actions">
          <button className="icon-button cart-button" onClick={onCart}><ShoppingBag size={19} /><span>{cartCount}</span></button>
          {role ? (
            <button className="account-link" onClick={() => onNavigate('dashboard')}><CircleUserRound size={18} />Dashboard</button>
          ) : (
            <button className="account-link" onClick={onLogin}><UserRound size={17} />Staff login</button>
          )}
          <button className="menu-button" onClick={() => setMobileMenu(!mobileMenu)}><Menu size={22} /></button>
        </div>
      </div>
    </header>
  );
}

// â”€â”€â”€ Home â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Home({ onBrowse, onAbout, onProduct, content, editMode, onContentUpdate }: {
  onBrowse: () => void; onAbout: () => void; onProduct: (id: string) => void;
  content: SiteContent; editMode: boolean; onContentUpdate: () => void;
}) {
  const [cats, setCats] = useState<Category[]>([]);
  useEffect(() => { api.fetchCategories().then(setCats).catch(() => {}); }, []);

  const sc = (key: string, fallback: string) => content[key]?.value ?? fallback;
  const heroImg = content['hero_image']?.image_url || photos.hero;

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow light"><span className="eyebrow-line" /> <EditableText value={sc('hero_eyebrow', 'Materials that move your vision forward')} contentKey="hero_eyebrow" editMode={editMode} onUpdate={onContentUpdate} /></div>
          <h1>
            <EditableText value={sc('hero_title', 'Build it right.')} contentKey="hero_title" editMode={editMode} onUpdate={onContentUpdate} /><br />
            <em><EditableText value={sc('hero_title_em', 'Build it to last.')} contentKey="hero_title_em" editMode={editMode} onUpdate={onContentUpdate} /></em>
          </h1>
          <p><EditableText value={sc('hero_subtitle', 'Reliable construction materials, honest guidance, and a team that understands what your project demands.')} contentKey="hero_subtitle" editMode={editMode} onUpdate={onContentUpdate} multiline /></p>
          <div className="hero-actions">
            <button className="button button-light" onClick={onBrowse}>Explore materials <ArrowRight size={17} /></button>
            <button className="text-button light-text" onClick={onAbout}>Why Bapari Builders <ArrowRight size={15} /></button>
          </div>
          <div className="hero-proof">
            <span><strong><EditableText value={sc('hero_stat1_value', '15+')} contentKey="hero_stat1_value" editMode={editMode} onUpdate={onContentUpdate} /></strong><small><EditableText value={sc('hero_stat1_label', 'Years of trust')} contentKey="hero_stat1_label" editMode={editMode} onUpdate={onContentUpdate} /></small></span>
            <span><strong><EditableText value={sc('hero_stat2_value', '4.9')} contentKey="hero_stat2_value" editMode={editMode} onUpdate={onContentUpdate} /></strong><small><EditableText value={sc('hero_stat2_label', 'Customer rating')} contentKey="hero_stat2_label" editMode={editMode} onUpdate={onContentUpdate} /></small></span>
            <span><strong><EditableText value={sc('hero_stat3_value', '24h')} contentKey="hero_stat3_value" editMode={editMode} onUpdate={onContentUpdate} /></strong><small><EditableText value={sc('hero_stat3_label', 'Quick response')} contentKey="hero_stat3_label" editMode={editMode} onUpdate={onContentUpdate} /></small></span>
          </div>
        </div>
        <div className="hero-image">
          <img src={heroImg} alt="Construction site" />
          {editMode && <div className="hero-edit-trigger"><ImageUploader aspectRatio={940 / 650} currentUrl={heroImg === photos.hero ? '' : heroImg} folder="hero" onUploaded={(url) => { api.updateSiteContent('hero_image', '', url).then(onContentUpdate); }} label="Change hero photo" /></div>}
          <div className="image-caption"><HardHat size={16} /><span><EditableText value={sc('hero_caption_1', 'Quality work')} contentKey="hero_caption_1" editMode={editMode} onUpdate={onContentUpdate} /><br /><strong><EditableText value={sc('hero_caption_2', 'starts here')} contentKey="hero_caption_2" editMode={editMode} onUpdate={onContentUpdate} /></strong></span></div>
        </div>
      </section>
      <section className="intro section">
        <div className="intro-heading">
          <div className="eyebrow"><span className="eyebrow-line" /> <EditableText value={sc('intro_eyebrow', 'The Bapari standard')} contentKey="intro_eyebrow" editMode={editMode} onUpdate={onContentUpdate} /></div>
          <h2><EditableText value={sc('intro_title', 'Materials you can')} contentKey="intro_title" editMode={editMode} onUpdate={onContentUpdate} /><br /><em><EditableText value={sc('intro_title_em', 'build a future on.')} contentKey="intro_title_em" editMode={editMode} onUpdate={onContentUpdate} /></em></h2>
        </div>
        <div className="intro-copy">
          <p><EditableText value={sc('intro_body', 'From the first foundation to the final finish, your materials shape everything. We source with care, stand behind what we sell, and make it simple to get exactly what your project needs.')} contentKey="intro_body" editMode={editMode} onUpdate={onContentUpdate} multiline /></p>
          <button className="text-button" onClick={onAbout}><EditableText value={sc('intro_cta', 'Meet the team')} contentKey="intro_cta" editMode={editMode} onUpdate={onContentUpdate} /> <ArrowRight size={15} /></button>
        </div>
      </section>
      <section className="featured section">
        <div className="section-heading">
          <div>
            <div className="eyebrow"><span className="eyebrow-line" /> <EditableText value={sc('featured_eyebrow', 'What we supply')} contentKey="featured_eyebrow" editMode={editMode} onUpdate={onContentUpdate} /></div>
            <h2><EditableText value={sc('featured_title', 'Start with the essentials.')} contentKey="featured_title" editMode={editMode} onUpdate={onContentUpdate} /></h2>
          </div>
          <button className="text-button" onClick={onBrowse}><EditableText value={sc('featured_cta', 'View all materials')} contentKey="featured_cta" editMode={editMode} onUpdate={onContentUpdate} /> <ArrowRight size={15} /></button>
        </div>
        <div className="category-grid">
          {cats.map((c) => <ProductCard key={c.id} category={c} onClick={() => onProduct(c.id)} />)}
        </div>
      </section>
      <section className="process-section section">
        <div className="process-photo"><img src={content['process_image']?.image_url || photos.hero} alt="Construction workers" />{editMode && <div className="hero-edit-trigger"><ImageUploader aspectRatio={4 / 3} currentUrl={content['process_image']?.image_url || ''} folder="process" onUploaded={(url) => { api.updateSiteContent('process_image', '', url).then(onContentUpdate); }} label="Change photo" /></div>}<div className="process-label"><EditableText value={sc('process_label_1', 'A better way')} contentKey="process_label_1" editMode={editMode} onUpdate={onContentUpdate} /><br /><strong><EditableText value={sc('process_label_2', 'to build')} contentKey="process_label_2" editMode={editMode} onUpdate={onContentUpdate} /></strong></div></div>
        <div className="process-content">
          <div className="eyebrow"><span className="eyebrow-line" /> <EditableText value={sc('process_eyebrow', 'Simple by design')} contentKey="process_eyebrow" editMode={editMode} onUpdate={onContentUpdate} /></div>
          <h2><EditableText value={sc('process_title_1', 'From your idea')} contentKey="process_title_1" editMode={editMode} onUpdate={onContentUpdate} /><br /><EditableText value={sc('process_title_2', 'to')} contentKey="process_title_2" editMode={editMode} onUpdate={onContentUpdate} /> <em><EditableText value={sc('process_title_em', 'your doorstep.')} contentKey="process_title_em" editMode={editMode} onUpdate={onContentUpdate} /></em></h2>
          <div className="step-list">
            {[
              { n: '01', titleKey: 'process_step1_title', titleFallback: 'Choose your materials', descKey: 'process_step1_desc', descFallback: 'Browse our curated range of construction essentials.' },
              { n: '02', titleKey: 'process_step2_title', titleFallback: 'Tell us what you need', descKey: 'process_step2_desc', descFallback: 'Share quantity, delivery details, and your preferences.' },
              { n: '03', titleKey: 'process_step3_title', titleFallback: 'We work out the details', descKey: 'process_step3_desc', descFallback: 'Our team calls to confirm availability and the best price.' },
            ].map((step) => (
              <div className="step" key={step.n}><span className="step-number">{step.n}</span><div><h3><EditableText value={sc(step.titleKey, step.titleFallback)} contentKey={step.titleKey} editMode={editMode} onUpdate={onContentUpdate} /></h3><p><EditableText value={sc(step.descKey, step.descFallback)} contentKey={step.descKey} editMode={editMode} onUpdate={onContentUpdate} multiline /></p></div></div>
            ))}
          </div>
          <button className="button button-dark" onClick={onBrowse}><EditableText value={sc('process_cta', 'Find your materials')} contentKey="process_cta" editMode={editMode} onUpdate={onContentUpdate} /> <ArrowRight size={17} /></button>
        </div>
      </section>
      <section className="cta-band">
        <div className="eyebrow light"><span className="eyebrow-line" /> <EditableText value={sc('cta_eyebrow', 'Have a project in mind?')} contentKey="cta_eyebrow" editMode={editMode} onUpdate={onContentUpdate} /></div>
        <h2><EditableText value={sc('cta_title', 'Let\'s make it')} contentKey="cta_title" editMode={editMode} onUpdate={onContentUpdate} /><br /><em><EditableText value={sc('cta_title_em', 'solid.')} contentKey="cta_title_em" editMode={editMode} onUpdate={onContentUpdate} /></em></h2>
        <button className="button button-light" onClick={onBrowse}><EditableText value={sc('cta_button', 'Start an order')} contentKey="cta_button" editMode={editMode} onUpdate={onContentUpdate} /> <ArrowRight size={17} /></button>
      </section>
    </>
  );
}

// â”€â”€â”€ EditableText (admin edit mode) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EditableText({ value, contentKey, editMode, onUpdate, multiline }: {
  value: string; contentKey: string; editMode: boolean; onUpdate: () => void; multiline?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  if (!editMode) return <>{value}</>;

  if (editing) {
    const save = async () => {
      await api.updateSiteContent(contentKey, draft);
      setEditing(false);
      onUpdate();
    };
    return (
      <span className="inline-edit active">
        {multiline ? <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={2} /> : <input value={draft} onChange={(e) => setDraft(e.target.value)} />}
        <button onClick={save}><Save size={13} /></button>
        <button onClick={() => { setDraft(value); setEditing(false); }}><X size={13} /></button>
      </span>
    );
  }

  return (
    <span className="inline-edit" onClick={() => { setDraft(value); setEditing(true); }}>
      {value}
      <Pencil size={11} className="edit-pencil" />
    </span>
  );
}

// â”€â”€â”€ ProductCard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ProductCard({ category, onClick }: { category: Category; onClick: () => void }) {
  return (
    <button className="product-card" onClick={onClick}>
      <div className="product-image">
        <img src={category.image_url || photos.fallback} alt={category.name} />
        <span className="card-arrow"><ArrowRight size={18} /></span>
      </div>
      <div className="product-card-body">
        <div><span className="card-eyebrow">{category.description}</span><h3>{category.name}</h3></div>
      </div>
    </button>
  );
}

// â”€â”€â”€ Products â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Products({ onProduct, editMode, onContentUpdate, content }: {
  onProduct: (id: string) => void; editMode: boolean; onContentUpdate: () => void; content: SiteContent;
}) {
  const [cats, setCats] = useState<Category[]>([]);
  const [query, setQuery] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newImg, setNewImg] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', description: '', image_url: '' });

  const sc = (key: string, fallback: string) => content[key]?.value ?? fallback;

  const load = () => api.fetchCategories().then(setCats).catch(() => {});
  useEffect(() => { load(); }, []);

  const filtered = cats.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  const handleAdd = async () => {
    if (!newName.trim()) return;
    await api.createCategory(newName, newDesc, newImg);
    setNewName(''); setNewDesc(''); setNewImg(''); setShowAdd(false);
    load(); onContentUpdate();
  };

  const startEdit = (c: Category) => {
    setEditingId(c.id);
    setEditForm({ name: c.name, description: c.description, image_url: c.image_url });
  };

  const handleEdit = async () => {
    if (!editingId) return;
    await api.updateCategory(editingId, editForm.name, editForm.description, editForm.image_url);
    setEditingId(null); load(); onContentUpdate();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this material category?')) return;
    await api.deleteCategory(id);
    load(); onContentUpdate();
  };

  return (
    <section className="page-section">
      <div className="page-intro">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> <EditableText value={sc('products_eyebrow', 'Our materials')} contentKey="products_eyebrow" editMode={editMode} onUpdate={onContentUpdate} /></div>
          <h1><EditableText value={sc('products_title', 'Build from a')} contentKey="products_title" editMode={editMode} onUpdate={onContentUpdate} /><br /><em><EditableText value={sc('products_title_em', 'strong foundation.')} contentKey="products_title_em" editMode={editMode} onUpdate={onContentUpdate} /></em></h1>
        </div>
        <p><EditableText value={sc('products_intro', 'Every material is selected for consistency, value, and the confidence it gives you on site.')} contentKey="products_intro" editMode={editMode} onUpdate={onContentUpdate} multiline /></p>
      </div>
      {editMode && (
        <div className="admin-bar">
          <button className="button button-dark" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> Add material</button>
        </div>
      )}
      {showAdd && (
        <div className="inline-form">
          <input placeholder="Material name" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input placeholder="Short description" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          <div className="uploader-inline">
            <ImageUploader aspectRatio={4 / 3} currentUrl={newImg} folder="categories" onUploaded={setNewImg} label="Upload picture" />
          </div>
          <button className="button button-dark" onClick={handleAdd}>Create</button>
        </div>
      )}
      <div className="catalog-toolbar">
        <div className="search-field"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search materials" /></div>
        <button className="filter-button"><SlidersHorizontal size={16} /> All categories <ChevronDown size={15} /></button>
      </div>
      <div className="catalog-grid">
        {filtered.map((c) => (
          <div key={c.id} className="product-card-wrapper">
            <ProductCard category={c} onClick={() => onProduct(c.id)} />
            {editMode && (
              <div className="card-edit-buttons">
                <button onClick={() => startEdit(c)}><Pencil size={13} /></button>
                <button onClick={() => handleDelete(c.id)}><Trash2 size={13} /></button>
              </div>
            )}
            {editingId === c.id && (
              <div className="inline-form card-edit-form">
                <input placeholder="Name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
                <input placeholder="Description" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
                <div className="uploader-inline">
                  <ImageUploader aspectRatio={4 / 3} currentUrl={editForm.image_url} folder="categories" onUploaded={(url) => setEditForm({ ...editForm, image_url: url })} label="Upload picture" />
                </div>
                <div className="form-buttons-row">
                  <button className="button button-dark" onClick={handleEdit}><Save size={14} /> Save</button>
                  <button className="button button-outline" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="catalog-note"><ShieldCheck size={20} /><span><strong><EditableText value={sc('catalog_note_title', 'Need help choosing?')} contentKey="catalog_note_title" editMode={editMode} onUpdate={onContentUpdate} /></strong> <EditableText value={sc('catalog_note_body', 'Tell us about your project and our materials team will guide you to the right fit.')} contentKey="catalog_note_body" editMode={editMode} onUpdate={onContentUpdate} /></span></div>
    </section>
  );
}

// â”€â”€â”€ ProductDetail â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ProductDetail({ categoryId, onBack, onAdd, editMode, content, onContentUpdate }: {
  categoryId: string; onBack: () => void; onAdd: (item: CartItem) => void; editMode: boolean;
  content: SiteContent; onContentUpdate: () => void;
}) {
  const [category, setCategory] = useState<Category | null>(null);
  const [groups, setGroups] = useState<OptionGroup[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupDraft, setEditingGroupDraft] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [newOptions, setNewOptions] = useState<Record<string, string>>({});
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editingOptionDraft, setEditingOptionDraft] = useState('');

  const loadData = () => {
    setLoading(true);
    api.fetchCategories().then((cats) => {
      const c = cats.find((x) => x.id === categoryId);
      setCategory(c ?? null);
      if (c) {
        api.fetchCategoryOptionGroups(c.id).then((gs) => {
          setGroups(gs);
          const init: Record<string, string> = {};
          gs.forEach((g) => { if (g.options.length) init[g.name] = g.options[0].label; });
          setSelections(init);
          setLoading(false);
        });
      } else { setLoading(false); }
    });
  };

  useEffect(() => { loadData(); }, [categoryId]);

  const sc = (key: string, fallback: string) => content[key]?.value ?? fallback;

  if (loading) return <section className="detail-section"><p className="loading-text">Loading...</p></section>;
  if (!category) return <section className="detail-section"><p className="loading-text">Material not found.</p></section>;

  const unitGroup = groups.find((g) => g.name === 'Quantity Unit');
  const otherGroups = groups.filter((g) => g.name !== 'Quantity Unit');
  const unit = selections['Quantity Unit'] ?? unitGroup?.options[0]?.label ?? '';

  const handleAdd = () => {
    onAdd({
      id: crypto.randomUUID(),
      category_id: category.id,
      category_name: category.name,
      quantity,
      unit,
      option_selections: selections,
      image_url: category.image_url,
    });
  };

  const reloadGroups = () => {
    api.fetchCategoryOptionGroups(category.id).then((gs) => {
      setGroups(gs);
      const init: Record<string, string> = {};
      gs.forEach((g) => { if (g.options.length) init[g.name] = g.options[0].label; });
      setSelections(init);
    });
  };

  const handleAddGroup = async () => {
    if (!newGroupName.trim()) return;
    await api.createOptionGroup(category.id, newGroupName);
    setNewGroupName('');
    setShowAddGroup(false);
    reloadGroups();
  };

  const handleRenameGroup = async (groupId: string) => {
    if (!editingGroupDraft.trim()) return;
    await api.updateOptionGroup(groupId, editingGroupDraft);
    setEditingGroupId(null);
    setEditingGroupDraft('');
    reloadGroups();
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm('Delete this option group and all its choices?')) return;
    await api.deleteOptionGroup(groupId);
    reloadGroups();
  };

  const handleAddOption = async (groupId: string) => {
    const label = newOptions[groupId]?.trim();
    if (!label) return;
    await api.createOption(groupId, label);
    setNewOptions((prev) => ({ ...prev, [groupId]: '' }));
    reloadGroups();
  };

  const handleRenameOption = async (optionId: string) => {
    if (!editingOptionDraft.trim()) return;
    await api.updateOption(optionId, editingOptionDraft);
    setEditingOptionId(null);
    setEditingOptionDraft('');
    reloadGroups();
  };

  const handleDeleteOption = async (optionId: string) => {
    if (!confirm('Delete this option choice?')) return;
    await api.deleteOption(optionId);
    reloadGroups();
  };

  const renderEditableSelect = (g: OptionGroup) => {
    const isNew = editingGroupId === g.id;
    return (
      <div key={g.id} className="editable-field-group">
        {editMode && (
          <div className="field-label-row">
            {isNew ? (
              <>
                <input className="group-name-input" value={editingGroupDraft} onChange={(e) => setEditingGroupDraft(e.target.value)} placeholder="Group name" />
                <button className="mini-btn" onClick={() => handleRenameGroup(g.id)}><Save size={13} /></button>
                <button className="mini-btn" onClick={() => setEditingGroupId(null)}><X size={13} /></button>
              </>
            ) : (
              <>
                <label className="field-label">{g.name}</label>
                <button className="mini-btn" onClick={() => { setEditingGroupId(g.id); setEditingGroupDraft(g.name); }}><Pencil size={12} /></button>
                <button className="mini-btn danger" onClick={() => handleDeleteGroup(g.id)}><Trash2 size={12} /></button>
              </>
            )}
          </div>
        )}
        {!editMode && <label className="field-label">{g.name}</label>}
        <select className="full-select" value={selections[g.name] ?? ''} onChange={(e) => setSelections({ ...selections, [g.name]: e.target.value })}>
          {g.options.map((o: OptionChoice) => <option key={o.id} value={o.label}>{o.label}</option>)}
        </select>
        {editMode && (
          <div className="option-choices-editor">
            {g.options.map((o: OptionChoice) => (
              <div className="choice-row" key={o.id}>
                {editingOptionId === o.id ? (
                  <>
                    <input className="choice-input" value={editingOptionDraft} onChange={(e) => setEditingOptionDraft(e.target.value)} />
                    <button className="mini-btn" onClick={() => handleRenameOption(o.id)}><Save size={12} /></button>
                    <button className="mini-btn" onClick={() => setEditingOptionId(null)}><X size={12} /></button>
                  </>
                ) : (
                  <>
                    <span className="choice-label">{o.label}</span>
                    <button className="mini-btn" onClick={() => { setEditingOptionId(o.id); setEditingOptionDraft(o.label); }}><Pencil size={11} /></button>
                    <button className="mini-btn danger" onClick={() => handleDeleteOption(o.id)}><Trash2 size={11} /></button>
                  </>
                )}
              </div>
            ))}
            <div className="choice-row add-choice-row">
              <input className="choice-input" placeholder="Add new choice" value={newOptions[g.id] ?? ''} onChange={(e) => setNewOptions((prev) => ({ ...prev, [g.id]: e.target.value }))} />
              <button className="mini-btn" onClick={() => handleAddOption(g.id)}><Plus size={13} /></button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="detail-section">
      <button className="back-link" onClick={onBack}>â† All materials</button>
      <div className="detail-grid">
        <div className="detail-image">
          <img src={category.image_url || photos.fallback} alt={category.name} />
          <div className="detail-badge"><Check size={15} /> <EditableText value={sc('detail_badge', 'Available for delivery')} contentKey="detail_badge" editMode={editMode} onUpdate={onContentUpdate} /></div>
        </div>
        <div className="detail-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> {category.description}</div>
          <h1>{category.name}<br /><em><EditableText value={sc('detail_subtitle', 'for your next build.')} contentKey="detail_subtitle" editMode={editMode} onUpdate={onContentUpdate} /></em></h1>
          <div className="form-divider" />
          <div className="quantity-row">
            <div className="quantity-cell">
              <label className="field-label">Quantity</label>
              <div className="quantity-control">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))}><Minus size={15} /></button>
                <strong>{quantity}</strong>
                <button onClick={() => setQuantity(quantity + 1)}><Plus size={15} /></button>
              </div>
            </div>
            {unitGroup && <div className="quantity-cell">{renderEditableSelect(unitGroup)}</div>}
          </div>
          {otherGroups.map((g) => renderEditableSelect(g))}
          {editMode && (
            <div className="add-group-area">
              {showAddGroup ? (
                <div className="inline-form compact-form">
                  <input placeholder="New group name (e.g. Company, Quality)" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} />
                  <button className="button button-dark" onClick={handleAddGroup}>Add group</button>
                  <button className="button button-outline" onClick={() => setShowAddGroup(false)}>Cancel</button>
                </div>
              ) : (
                <button className="text-button" onClick={() => setShowAddGroup(true)}><Plus size={14} /> Add option group</button>
              )}
            </div>
          )}
          <button className="button button-dark full-button" onClick={handleAdd}><EditableText value={sc('detail_add_button', 'Add to materials list')} contentKey="detail_add_button" editMode={editMode} onUpdate={onContentUpdate} /> <ShoppingBag size={17} /></button>
          <p className="detail-note"><Phone size={15} /> <EditableText value={sc('detail_note_prefix', 'Not sure what you need?')} contentKey="detail_note_prefix" editMode={editMode} onUpdate={onContentUpdate} /> <strong><EditableText value={sc('detail_note_phone', 'Call +880 1711 123 456')} contentKey="detail_note_phone" editMode={editMode} onUpdate={onContentUpdate} /></strong></p>
        </div>
      </div>
    </section>
  );
}

// â”€â”€â”€ CartDrawer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CartDrawer({ open, cart, onClose, onRemove, onCheckout }: {
  open: boolean; cart: CartItem[]; onClose: () => void; onRemove: (i: number) => void; onCheckout: () => void;
}) {
  if (!open) return null;
  return (
    <div className="drawer-overlay" onClick={onClose}>
      <aside className="cart-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="drawer-head">
          <div><span className="card-eyebrow">Your selection</span><h2>Materials list <span>{cart.length}</span></h2></div>
          <button className="close-button" onClick={onClose}><X size={19} /></button>
        </div>
        {cart.length === 0 ? (
          <div className="empty-cart"><ShoppingBag size={30} /><p>Your materials list is empty.</p><button className="text-button" onClick={onClose}>Browse materials <ArrowRight size={15} /></button></div>
        ) : (
          <>
            <div className="drawer-items">
              {cart.map((item, i) => (
                <div className="drawer-item" key={item.id}>
                  <img src={item.image_url || photos.fallback} alt="" />
                  <div>
                    <strong>{item.category_name}</strong>
                    <span>{item.quantity} {item.unit} Â· {Object.values(item.option_selections).filter((v) => v !== item.unit).join(', ')}</span>
                  </div>
                  <button onClick={() => onRemove(i)}><X size={15} /></button>
                </div>
              ))}
            </div>
            <div className="drawer-footer">
              <p>We'll confirm pricing and availability with you by phone.</p>
              <button className="button button-dark full-button" onClick={onCheckout}>Continue to details <ArrowRight size={17} /></button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

// â”€â”€â”€ CartPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function CartPage({ cart, onRemove, onBrowse, onSubmitted }: {
  cart: CartItem[]; onRemove: (i: number) => void; onBrowse: () => void; onSubmitted: (token: string, reference: string) => void;
}) {
  const [form, setForm] = useState({ name: '', phone: '', email: '', address: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const update = (k: string, v: string) => setForm((c) => ({ ...c, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cart.length) return;
    setSubmitting(true);
    setError('');
    try {
      const items = cart.map((item) => ({
        category_name: item.category_name,
        quantity: item.quantity,
        unit: item.unit,
        option_selections: item.option_selections,
      }));
      const result = await api.placeOrder(form.name, form.email, form.phone, form.address, items);
      localStorage.removeItem('bapari-cart');

      // Send confirmation email with reference number and order details
      const itemListText = items.map((i) => `â€¢ ${i.quantity} ${i.unit} ${i.category_name}`).join('\n');
      const emailBody = `Hi ${form.name},\n\nThank you for your order with Bapari Builders. We've received your request and our team will call you at ${form.phone} to confirm availability and pricing.\n\nYour order reference: ${result.reference_number}\n\nMaterials requested:\n${itemListText}\n\nDelivery address: ${form.address}\n\nYou can track your order anytime by entering this reference on our Track Order page.\n\nBapari Builders â€” Building trust, one project at a time.`;
      api.sendNotificationEmail(form.email, `Order Confirmation â€” ${result.reference_number}`, emailBody).catch(() => {});

      onSubmitted(result.access_token, result.reference_number);
    } catch (err) {
      setError('Something went wrong. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <section className="page-section checkout-section">
      <div className="page-intro compact">
        <div><div className="eyebrow"><span className="eyebrow-line" /> Almost there</div><h1>Tell us where to<br /><em>bring it.</em></h1></div>
        <p>There is no payment today. Our team will call you to discuss availability, pricing, and delivery.</p>
      </div>
      <div className="checkout-grid">
        <div className="order-summary">
          <div className="summary-head"><h2>Your materials</h2><span>{cart.length} items</span></div>
          {cart.length ? cart.map((item, i) => (
            <div className="summary-item" key={item.id}>
              <img src={item.image_url || photos.fallback} alt="" />
              <div><strong>{item.category_name}</strong><span>{item.quantity} {item.unit} Â· {Object.values(item.option_selections).filter((v) => v !== item.unit).join(', ')}</span></div>
              <button onClick={() => onRemove(i)}><X size={15} /></button>
            </div>
          )) : <div className="empty-summary">No materials added yet. <button className="text-button" onClick={onBrowse}>Browse the catalog</button></div>}
        </div>
        <form className="contact-form" onSubmit={submit}>
          <h2>Delivery details</h2>
          <label>Full name<input required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="Your name" /></label>
          <div className="two-fields">
            <label>Phone number<input required value={form.phone} onChange={(e) => update('phone', e.target.value)} placeholder="+880 1XXX XXX XXX" /></label>
            <label>Email address<input required type="email" value={form.email} onChange={(e) => update('email', e.target.value)} placeholder="you@example.com" /></label>
          </div>
          <label>Delivery address<textarea required value={form.address} onChange={(e) => update('address', e.target.value)} placeholder="Where should we deliver?" rows={3} /></label>
          {error && <div className="form-error">{error}</div>}
          <button className="button button-dark full-button" type="submit" disabled={submitting || !cart.length}>
            {submitting ? 'Sending...' : 'Send request'} <ArrowRight size={17} />
          </button>
          <span className="form-footnote"><ShieldCheck size={14} /> Your details are only used to coordinate this order.</span>
        </form>
      </div>
    </section>
  );
}

// â”€â”€â”€ OrderConfirmation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function OrderConfirmation({ token, reference, onHome }: { token: string; reference: string; onHome: () => void }) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    api.getOrderByToken(token).then((data) => { setOrder(data); setLoading(false); }).catch(() => setLoading(false));
  }, [token]);

  const copyRef = () => {
    navigator.clipboard?.writeText(reference).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }).catch(() => {});
  };

  return (
    <section className="page-section">
      <div className="status-card">
        <div className="status-icon"><ClipboardList size={25} /></div>
        <div className="eyebrow"><span className="eyebrow-line" /> Order placed</div>
        <h1>Waiting for<br /><em>confirmation.</em></h1>
        {loading ? <p>Loading your order details...</p> : order ? (
          <>
            <p>Our team has received your request and will call you at <strong>{order.buyer_phone}</strong> to confirm availability and pricing.</p>
            <div className="order-token-box">
              <span className="card-eyebrow">Your order reference</span>
              <strong className="reference-display">{reference || order.reference_number || token}</strong>
              <button className="copy-ref-button" onClick={copyRef}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy reference</>}
              </button>
              <small>Save this to check your order status anytime. We've also emailed it to you.</small>
            </div>
            <div className="order-status-timeline">
              <div className={`timeline-item ${order.status === 'pending' ? 'active' : 'done'}`}>
                <span className="status-dot" /> <div><strong>Request received</strong><small>We're reviewing your materials</small></div>
              </div>
              <div className={`timeline-item ${['accepted', 'deal_created', 'completed'].includes(order.status) ? 'done' : ''} ${order.status === 'picked_up' ? 'active' : ''}`}>
                <span className="status-dot" /> <div><strong>Team review</strong><small>Our team is calling you</small></div>
              </div>
              <div className={`timeline-item ${['deal_created', 'completed'].includes(order.status) ? 'done' : ''}`}>
                <span className="status-dot" /> <div><strong>Deal in progress</strong><small>Terms agreed, delivery arranged</small></div>
              </div>
              <div className={`timeline-item ${order.status === 'completed' ? 'done' : ''}`}>
                <span className="status-dot" /> <div><strong>Completed</strong><small>All payments settled</small></div>
              </div>
            </div>
            <div className="order-items-list">
              <span className="card-eyebrow">Materials requested</span>
              {(order.items ?? []).map((item: any, i: number) => (
                <div className="order-item-row" key={i}>
                  <Package size={16} />
                  <span>{item.quantity} {item.unit} Â· {item.category_name}</span>
                </div>
              ))}
            </div>
            {order.deals?.length > 0 && (
              <div className="deal-link-box">
                <p>Your team has sent you deal terms to review.</p>
                <button className="button button-dark full-button" onClick={() => { window.location.hash = `deal/${order.deals[0].buyer_token}`; }}>
                  View deal terms <ArrowRight size={16} />
                </button>
              </div>
            )}
            <button className="text-button" onClick={onHome}>Back to home</button>
          </>
        ) : <p>Order not found. Please check your reference number.</p>}
      </div>
    </section>
  );
}

// â”€â”€â”€ StatusPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function StatusPage() {
  const [token, setToken] = useState('');
  const [order, setOrder] = useState<any>(null);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);

  const statusLabels: Record<string, string> = {
    pending: 'Waiting for confirmation',
    picked_up: 'Picked up by our team',
    accepted: 'Accepted â€” negotiating terms',
    rejected: 'Order rejected',
    deal_created: 'Deal in progress',
    completed: 'Order completed',
  };

  const search = async () => {
    if (!token.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const query = token.trim();
      // Try short reference number first (starts with BAP), then fall back to long token
      const isReference = query.toUpperCase().startsWith('BAP');
      const data = isReference
        ? await api.getOrderByReference(query)
        : await api.getOrderByToken(query);
      setOrder(data);
    } catch { setOrder(null); }
    setLoading(false);
  };

  return (
    <section className="status-section page-section">
      <div className="status-card">
        <div className="status-icon"><ClipboardList size={25} /></div>
        <div className="eyebrow"><span className="eyebrow-line" /> Order journey</div>
        <h1>Keep an eye on<br /><em>your order.</em></h1>
        <p>Enter the order reference we gave you after your request.</p>
        <label className="field-label">Order reference<input value={token} onChange={(e) => setToken(e.target.value)} placeholder="e.g. BAP010926ST001" onKeyDown={(e) => { if (e.key === 'Enter') search(); }} /></label>
        <button className="button button-dark full-button" onClick={search} disabled={loading}>
          {loading ? 'Searching...' : 'Check status'} <ArrowRight size={17} />
        </button>
        {searched && !loading && order && (
          <div className="status-result">
            <div className="status-result-head"><span className="status-dot" /><strong>Order found</strong><span>{order.reference_number}</span></div>
            <div className="order-detail-grid">
              <div className="order-detail-cell"><span className="card-eyebrow">Status</span><strong className="status-label-big">{statusLabels[order.status] || order.status}</strong></div>
              <div className="order-detail-cell"><span className="card-eyebrow">Placed on</span><span>{order.created_at ? new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : 'â€”'}</span></div>
              <div className="order-detail-cell"><span className="card-eyebrow">Contact</span><span>{order.buyer_name} Â· {order.buyer_phone}</span></div>
              <div className="order-detail-cell"><span className="card-eyebrow">Delivery address</span><span>{order.delivery_address}</span></div>
            </div>
            <div className="order-status-timeline">
              <div className={`timeline-item ${order.status === 'pending' ? 'active' : 'done'}`}>
                <span className="status-dot" /> <div><strong>Request received</strong><small>We're reviewing your materials</small></div>
              </div>
              <div className={`timeline-item ${['accepted', 'deal_created', 'completed'].includes(order.status) ? 'done' : ''} ${order.status === 'picked_up' ? 'active' : ''}`}>
                <span className="status-dot" /> <div><strong>Team review</strong><small>Our team is calling you</small></div>
              </div>
              <div className={`timeline-item ${['deal_created', 'completed'].includes(order.status) ? 'done' : ''}`}>
                <span className="status-dot" /> <div><strong>Deal in progress</strong><small>Terms agreed, delivery arranged</small></div>
              </div>
              <div className={`timeline-item ${order.status === 'completed' ? 'done' : ''}`}>
                <span className="status-dot" /> <div><strong>Completed</strong><small>All payments settled</small></div>
              </div>
            </div>
            <div className="order-items-list">
              <span className="card-eyebrow">Materials requested</span>
              {(order.items ?? []).map((item: any, i: number) => (
                <div className="order-item-row" key={i}><Package size={16} /><span>{item.quantity} {item.unit} Â· {item.category_name}</span></div>
              ))}
            </div>
            {order.deals?.length > 0 && (
              <button className="button button-dark full-button" onClick={() => { window.location.hash = `deal/${order.deals[0].buyer_token}`; window.location.reload(); }}>
                View deal terms <ArrowRight size={16} />
              </button>
            )}
          </div>
        )}
        {searched && !loading && !order && <div className="status-result"><p>No order found with that reference. Please check and try again.</p></div>}
      </div>
    </section>
  );
}

// â”€â”€â”€ DealView (buyer sees terms, can accept/reject) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function DealView({ dealToken, modToken }: { dealToken: string; modToken: string }) {
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [result, setResult] = useState<'accepted' | 'rejected' | null>(null);

  const token = dealToken || modToken;

  const load = () => {
    if (!token) { setLoading(false); return; }
    api.getDealByBuyerToken(token).then((data) => { setDeal(data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, [token]);

  const accept = async () => {
    setActing(true);
    try {
      if (modToken) await api.buyerAcceptModification(token);
      else await api.buyerAcceptDeal(token);
      setResult('accepted');
    } catch { setResult('rejected'); }
    setActing(false);
  };

  const reject = async () => {
    setActing(true);
    try {
      if (modToken) await api.buyerRejectModification(token);
      else await api.buyerRejectDeal(token);
      setResult('rejected');
    } catch { /* ignore */ }
    setActing(false);
  };

  if (loading) return <section className="page-section"><div className="status-card"><p>Loading deal details...</p></div></section>;
  if (!deal) return <section className="page-section"><div className="status-card"><div className="eyebrow">Deal not found</div><h1>Invalid or<br /><em>expired link.</em></h1><p>This deal link may have already been processed or is no longer valid.</p></div></section>;

  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);
  const isModification = !!modToken && deal.pending_modifications?.length > 0;
  const mod = isModification ? deal.pending_modifications[0] : null;

  return (
    <section className="page-section">
      <div className="status-card deal-card">
        <div className="status-icon"><ShieldCheck size={25} /></div>
        <div className="eyebrow"><span className="eyebrow-line" /> {isModification ? 'Modified terms' : 'Deal terms'}</div>
        <h1>Review your<br /><em>{isModification ? 'updated ' : ''}offer.</em></h1>

        {result === 'accepted' ? (
          <div className="deal-result accepted">
            <Check size={30} /><h2>Terms accepted!</h2>
            <p>{isModification ? 'The updated terms have been accepted. Our team will be in touch.' : 'Thank you! Our team will confirm the order from their end shortly. You\'ll receive a notification by email.'}</p>
          </div>
        ) : result === 'rejected' ? (
          <div className="deal-result rejected">
            <X size={30} /><h2>Terms rejected</h2>
            <p>Our team will contact you to discuss alternatives.</p>
          </div>
        ) : (
          <>
            <div className="deal-terms-box">
              <div className="deal-term-row"><span>Total price</span><strong>à§³{fmt(isModification ? mod.new_total_price : deal.total_price)}</strong></div>
              <div className="deal-term-row"><span>Down payment</span><strong>à§³{fmt(deal.down_payment)}</strong></div>
              <div className="deal-term-row highlight"><span>Remaining after down payment</span><strong>à§³{fmt(isModification ? mod.new_total_price - deal.total_paid : deal.remaining_balance)}</strong></div>
              {deal.total_paid > 0 && <div className="deal-term-row"><span>Paid so far</span><strong>à§³{fmt(deal.total_paid)}</strong></div>}
            </div>

            <div className="order-items-list">
              <span className="card-eyebrow">Materials</span>
              {(isModification ? mod.new_items : deal.items ?? []).map((item: any, i: number) => (
                <div className="order-item-row" key={i}><Package size={16} /><span>{item.quantity} {item.unit} Â· {item.category_name}</span></div>
              ))}
            </div>

            {deal.payments?.length > 0 && (
              <div className="order-items-list">
                <span className="card-eyebrow">Payment history</span>
                {deal.payments.map((p: any) => (
                  <div className="order-item-row" key={p.id}><TrendingUp size={16} /><span>à§³{fmt(p.amount)} â€” {new Date(p.created_at).toLocaleDateString()}</span></div>
                ))}
              </div>
            )}

            {deal.status === 'terms_sent' && !isModification && (
              <div className="deal-actions">
                <button className="button button-dark" onClick={accept} disabled={acting}>{acting ? 'Processing...' : 'Accept terms'}</button>
                <button className="button button-outline" onClick={reject} disabled={acting}>Reject</button>
              </div>
            )}
            {isModification && (
              <div className="deal-actions">
                <button className="button button-dark" onClick={accept} disabled={acting}>{acting ? 'Processing...' : 'Accept changes'}</button>
                <button className="button button-outline" onClick={reject} disabled={acting}>Reject changes</button>
              </div>
            )}
            {deal.status === 'buyer_accepted' && <p className="deal-info-msg">You've accepted these terms. Waiting for our team to confirm.</p>}
            {deal.status === 'active' && <p className="deal-info-msg">This deal is active. Materials will be delivered as agreed.</p>}
            {deal.status === 'done' && <p className="deal-info-msg">This deal is complete. All payments have been settled.</p>}
          </>
        )}
      </div>
    </section>
  );
}

// â”€â”€â”€ SellerConfirm â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SellerConfirm({ sellerToken }: { sellerToken: string }) {
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');

  const confirm = async () => {
    setLoading(true);
    try {
      await api.sellerConfirmDeal(sellerToken);
      setConfirmed(true);
    } catch (err) {
      setError('Could not confirm this deal. It may have already been processed.');
    }
    setLoading(false);
  };

  if (confirmed) return (
    <section className="page-section">
      <div className="status-card">
        <div className="status-icon"><Check size={25} /></div>
        <h1>Deal<br /><em>confirmed.</em></h1>
        <p>The agreement is now active. Both parties have been notified. You can track this deal from your dashboard.</p>
      </div>
    </section>
  );

  return (
    <section className="page-section">
      <div className="status-card">
        <div className="status-icon"><ShieldCheck size={25} /></div>
        <div className="eyebrow"><span className="eyebrow-line" /> Seller confirmation</div>
        <h1>Confirm this<br /><em>agreement.</em></h1>
        <p>The buyer has accepted your deal terms. Please confirm to activate this agreement.</p>
        {error && <div className="form-error">{error}</div>}
        <button className="button button-dark full-button" onClick={confirm} disabled={loading}>
          {loading ? 'Confirming...' : 'Confirm deal'} <ArrowRight size={17} />
        </button>
      </div>
    </section>
  );
}

// â”€â”€â”€ About â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function About({ onContact, content, editMode, onContentUpdate }: {
  onContact: () => void; content: SiteContent; editMode: boolean; onContentUpdate: () => void;
}) {
  const sc = (key: string, fallback: string) => content[key]?.value ?? fallback;
  return (
    <section className="about-page">
      <div className="about-hero">
        <div>
          <div className="eyebrow light"><span className="eyebrow-line" /> <EditableText value={sc('about_eyebrow', 'Our story')} contentKey="about_eyebrow" editMode={editMode} onUpdate={onContentUpdate} /></div>
          <h1>
            <EditableText value={sc('about_title', 'Good buildings')} contentKey="about_title" editMode={editMode} onUpdate={onContentUpdate} /><br />
            <em><EditableText value={sc('about_title_em', 'start with trust.')} contentKey="about_title_em" editMode={editMode} onUpdate={onContentUpdate} /></em>
          </h1>
        </div>
        <img src={content['about_image']?.image_url || photos.hero} alt="Bapari Builders" />
        {editMode && <div className="hero-edit-trigger"><ImageUploader aspectRatio={4 / 3} currentUrl={content['about_image']?.image_url || ''} folder="about" onUploaded={(url) => { api.updateSiteContent('about_image', '', url).then(onContentUpdate); }} label="Change photo" /></div>}
      </div>
      <div className="about-body section">
        <div className="about-statement"><span>"</span><h2><EditableText value={sc('about_quote', 'We believe getting quality materials should feel as solid as the buildings they help create.')} contentKey="about_quote" editMode={editMode} onUpdate={onContentUpdate} multiline /></h2></div>
        <div className="about-text">
          <p><EditableText value={sc('about_p1', 'Bapari Builders began with a simple idea...')} contentKey="about_p1" editMode={editMode} onUpdate={onContentUpdate} multiline /></p>
          <p><EditableText value={sc('about_p2', 'Today, we work with homeowners...')} contentKey="about_p2" editMode={editMode} onUpdate={onContentUpdate} multiline /></p>
          <button className="button button-dark" onClick={onContact}><EditableText value={sc('about_cta', 'Work with us')} contentKey="about_cta" editMode={editMode} onUpdate={onContentUpdate} /> <ArrowRight size={17} /></button>
        </div>
      </div>
      <div className="values section">
        <div className="eyebrow"><span className="eyebrow-line" /> <EditableText value={sc('values_eyebrow', 'What guides us')} contentKey="values_eyebrow" editMode={editMode} onUpdate={onContentUpdate} /></div>
        <div className="value-grid">
          <div><span>01</span><h3><EditableText value={sc('value1_title', 'Be dependable')} contentKey="value1_title" editMode={editMode} onUpdate={onContentUpdate} /></h3><p><EditableText value={sc('value1_desc', 'Do what we say, and make it right when plans change.')} contentKey="value1_desc" editMode={editMode} onUpdate={onContentUpdate} multiline /></p></div>
          <div><span>02</span><h3><EditableText value={sc('value2_title', 'Stay practical')} contentKey="value2_title" editMode={editMode} onUpdate={onContentUpdate} /></h3><p><EditableText value={sc('value2_desc', 'Clear advice, fair options, and solutions that work on site.')} contentKey="value2_desc" editMode={editMode} onUpdate={onContentUpdate} multiline /></p></div>
          <div><span>03</span><h3><EditableText value={sc('value3_title', 'Build relationships')} contentKey="value3_title" editMode={editMode} onUpdate={onContentUpdate} /></h3><p><EditableText value={sc('value3_desc', 'Every order is the start of a long-term partnership.')} contentKey="value3_desc" editMode={editMode} onUpdate={onContentUpdate} multiline /></p></div>
        </div>
      </div>
    </section>
  );
}

// â”€â”€â”€ Login â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Login({ onBack, onSuccess, content, editMode, onContentUpdate }: { onBack: () => void; onSuccess: () => void; content: SiteContent; editMode: boolean; onContentUpdate: () => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const sc = (key: string, fallback: string) => content[key]?.value ?? fallback;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signIn(email, password);
      onSuccess();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'We couldn’t sign you in with those details.';
      setError(message);
    }
    setLoading(false);
  };

  return (
    <section className="login-section">
      <div className="login-art">
        <div className="login-quote">
          <span>"</span><h2><EditableText value={sc('login_quote', 'Strong work begins with the right people behind it.')} contentKey="login_quote" editMode={editMode} onUpdate={onContentUpdate} multiline /></h2><p><EditableText value={sc('login_quote_sub', 'Bapari Builders staff portal')} contentKey="login_quote_sub" editMode={editMode} onUpdate={onContentUpdate} /></p>
        </div>
      </div>
      <div className="login-panel">
        <button className="back-link" onClick={onBack}>Back to website</button>
        <div className="login-content">
          <div className="brand-mark large"><Building2 size={25} /></div>
          <div className="eyebrow"><span className="eyebrow-line" /> <EditableText value={sc('login_eyebrow', 'Team access')} contentKey="login_eyebrow" editMode={editMode} onUpdate={onContentUpdate} /></div>
          <h1><EditableText value={sc('login_title', 'Welcome')} contentKey="login_title" editMode={editMode} onUpdate={onContentUpdate} /><br /><em><EditableText value={sc('login_title_em', 'back.')} contentKey="login_title_em" editMode={editMode} onUpdate={onContentUpdate} /></em></h1>
          <p><EditableText value={sc('login_subtitle', 'Sign in to manage materials, orders, and customer relationships.')} contentKey="login_subtitle" editMode={editMode} onUpdate={onContentUpdate} multiline /></p>
          <form onSubmit={submit}>
            <label>Email address<input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@baparibuilders.com" /></label>
            <label>Password<input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" /></label>
            {error && <div className="form-error">{error}</div>}
            <button className="button button-dark full-button" type="submit" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign in'} <ArrowRight size={17} />
            </button>
          </form>
          <small className="login-note"><EditableText value={sc('login_note', 'This area is for authorized Bapari Builders team members.')} contentKey="login_note" editMode={editMode} onUpdate={onContentUpdate} /></small>
        </div>
      </div>
    </section>
  );
}

// â”€â”€â”€ Dashboard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Dashboard({ role, onNavigate, onLogout, profile, editMode, setEditMode }: {
  role: string; onNavigate: (v: View) => void; onLogout: () => Promise<void>;
  profile: any; editMode: boolean; setEditMode: (v: boolean) => void;
}) {
  const [notifs, setNotifs] = useState<NotificationRow[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const [orders, setOrders] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);

  const loadData = () => {
    api.fetchOrders().then(setOrders).catch(() => {});
    api.fetchDeals().then(setDeals).catch(() => {});
    api.fetchNotifications().then(setNotifs).catch(() => {});
  };

  useEffect(() => { loadData(); const interval = setInterval(loadData, 10000); return () => clearInterval(interval); }, []);

  const pendingOrders = orders.filter((o) => o.status === 'pending');
  const ongoingDeals = deals.filter((d) => ['active', 'seller_confirmed', 'terms_sent', 'buyer_accepted', 'pending_terms'].includes(d.status));
  const doneDeals = deals.filter((d) => d.status === 'done');
  const unreadCount = notifs.filter((n) => !n.is_read).length;

  const totalCollected = deals.reduce((sum, d) => sum + (d.total_paid || 0), 0);

  const markAllRead = async () => {
    for (const n of notifs.filter((n) => !n.is_read)) {
      await api.markNotificationRead(n.id);
    }
    loadData();
  };

  return (
    <section className="dashboard-page">
      <div className="dashboard-head">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> {role === 'admin' ? 'Admin workspace' : 'Seller workspace'}</div>
          <h1>Hello, <em>{profile?.display_name || role}</em></h1>
        </div>
        <div className="dashboard-head-actions">
          <button className="icon-button notif-button" onClick={() => { setShowNotifs(!showNotifs); if (!showNotifs) markAllRead(); }}>
            <Bell size={19} />{unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <button className="button button-outline" onClick={onLogout}><LogOut size={15} /> Sign out</button>
        </div>
      </div>

      {showNotifs && (
        <div className="notifications-panel">
          <div className="notif-panel-head"><h2>Notifications</h2><button className="text-button" onClick={() => setShowNotifs(false)}>Close</button></div>
          {notifs.length === 0 ? <p className="empty-text">No notifications yet.</p> : notifs.slice(0, 20).map((n) => (
            <div className="notif-row" key={n.id}>
              <span className={`notif-dot ${n.is_read ? 'read' : ''}`} />
              <div><strong>{n.title}</strong><small>{n.message}</small><span className="notif-time">{new Date(n.created_at).toLocaleString()}</span></div>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-tabs">
        <button className="active">Overview</button>
        <button onClick={() => onNavigate('management')}>Management {pendingOrders.length > 0 && <span>{pendingOrders.length}</span>}</button>
        {role === 'admin' && <button onClick={() => onNavigate('controller')}>Controller</button>}
        <button onClick={() => onNavigate('profile')}>Profile</button>
        {role === 'admin' && <button onClick={() => onNavigate('edit-site')}>Edit site</button>}
      </div>

      <div className="metrics">
        <div><span>Open requests</span><strong>{String(pendingOrders.length).padStart(2, '0')}</strong><small>Needs attention</small></div>
        <div><span>Ongoing deals</span><strong>{String(ongoingDeals.length).padStart(2, '0')}</strong><small>Active negotiations</small></div>
        <div><span>Total collected</span><strong>à§³{new Intl.NumberFormat('en-US').format(totalCollected)}</strong><small>All deals</small></div>
        <div><span>Completed</span><strong>{String(doneDeals.length).padStart(2, '0')}</strong><small>Finished deals</small></div>
      </div>

      <div className="dashboard-grid">
        <div className="panel">
          <div className="panel-head">
            <div><span className="card-eyebrow">Needs attention</span><h2>Latest requests</h2></div>
            <button className="text-button" onClick={() => onNavigate('management')}>See all <ArrowRight size={14} /></button>
          </div>
          {pendingOrders.length === 0 ? (
            <div className="empty-management"><ClipboardList size={29} /><h3>No pending requests</h3><p>New orders will appear here.</p></div>
          ) : pendingOrders.slice(0, 5).map((o) => (
            <div className="request-row" key={o.id}>
              <span className="request-icon"><Package size={17} /></span>
              <div><strong>{o.buyer_name} Â· {o.buyer_phone}</strong><span>{new Date(o.created_at).toLocaleString()}</span></div>
              <button className="small-action" onClick={() => onNavigate('management')}>Review</button>
            </div>
          ))}
        </div>
        <div className="panel dark-panel">
          <ShieldCheck size={19} />
          <span className="card-eyebrow">A note for today</span>
          <h2>Great service is the foundation of every repeat customer.</h2>
          <p>Keep conversations clear, follow through quickly, and let the quality of the materials speak for itself.</p>
        </div>
      </div>

      {ongoingDeals.length > 0 && (
        <div className="panel" style={{ marginTop: '14px' }}>
          <div className="panel-head"><div><span className="card-eyebrow">Active deals</span><h2>Ongoing</h2></div></div>
          {ongoingDeals.slice(0, 5).map((d) => (
            <div className="request-row" key={d.id}>
              <span className="request-icon"><TrendingUp size={17} /></span>
              <div><strong>Deal Â· à§³{new Intl.NumberFormat('en-US').format(d.total_price)}</strong><span>Status: {d.status.replace(/_/g, ' ')} Â· Paid: à§³{new Intl.NumberFormat('en-US').format(d.total_paid)}</span></div>
              <button className="small-action" onClick={() => onNavigate('management')}>Manage</button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// â”€â”€â”€ ProfilePage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ProfilePage({ onBack, onUpdated }: { onBack: () => void; onUpdated: () => void }) {
  const { profile } = useAuth();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [saved, setSaved] = useState(false);

  const save = async () => {
    await api.updateMyProfile(name, phone);
    await onUpdated();
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  return (
    <section className="dashboard-page">
      <button className="back-link" onClick={onBack}>â† Back to dashboard</button>
      <div className="dashboard-head">
        <div><div className="eyebrow"><span className="eyebrow-line" /> Your profile</div><h1>Profile<br /><em>settings.</em></h1></div>
      </div>
      <div className="panel" style={{ maxWidth: 500 }}>
        <div className="contact-form" style={{ background: 'transparent', padding: 0 }}>
          <label>Display name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" /></label>
          <label>Phone<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+880 1XXX XXX XXX" /></label>
          <label>Email (read only)<input value={profile?.email ?? ''} disabled /></label>
          <button className="button button-dark" onClick={save}><Save size={15} /> Save changes</button>
          {saved && <span className="form-footnote"><Check size={14} /> Profile updated successfully.</span>}
        </div>
      </div>
    </section>
  );
}

// â”€â”€â”€ ControllerPage (admin manages sellers) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ControllerPage({ onBack }: { onBack: () => void }) {
  const [profiles, setProfiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', role: 'seller', display_name: '', phone: '' });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ email: '', role: '', display_name: '', phone: '', password: '' });
  const [error, setError] = useState('');

  const load = () => {
    api.fetchProfiles().then((p) => { setProfiles(p); setLoading(false); }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    setError('');
    if (!form.email.trim() || !form.password.trim()) { setError('Email and password are required.'); return; }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    try {
      await api.createStaffAccount(form.email, form.password, form.role, form.display_name, form.phone);
      setForm({ email: '', password: '', role: 'seller', display_name: '', phone: '' });
      setShowAdd(false);
      load();
    } catch (err: any) {
      setError(err.message || 'Could not create account.');
    }
  };

  const startEdit = (p: any) => {
    setEditingId(p.id);
    setEditForm({ email: p.email, role: p.role, display_name: p.display_name, phone: p.phone, password: '' });
  };

  const handleEdit = async () => {
    if (!editingId) return;
    try {
      await api.updateStaffAccount(
        editingId,
        editForm.email || undefined,
        editForm.role || undefined,
        editForm.display_name || undefined,
        editForm.phone || undefined,
        editForm.password || undefined,
      );
      setEditingId(null);
      load();
    } catch (err: any) {
      setError(err.message || 'Could not update account.');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this team member? This cannot be undone.')) return;
    try {
      await api.deleteStaffAccount(id);
      load();
    } catch (err: any) {
      setError(err.message || 'Could not delete account.');
    }
  };

  return (
    <section className="dashboard-page">
      <button className="back-link" onClick={onBack}>â† Back to dashboard</button>
      <div className="dashboard-head">
        <div><div className="eyebrow"><span className="eyebrow-line" /> Team controller</div><h1>Manage<br /><em>team members.</em></h1></div>
        <button className="button button-dark" onClick={() => setShowAdd(!showAdd)}><Plus size={15} /> Add team member</button>
      </div>
      {error && <div className="form-error">{error}</div>}
      {showAdd && (
        <div className="panel" style={{ marginBottom: 14 }}>
          <div className="contact-form" style={{ background: 'transparent', padding: 0 }}>
            <div className="two-fields">
              <label>Email<input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="newperson@baparibuilders.com" /></label>
              <label>Password<input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" /></label>
            </div>
            <div className="two-fields">
              <label>Display name<input value={form.display_name} onChange={(e) => setForm({ ...form, display_name: e.target.value })} placeholder="Their name" /></label>
              <label>Phone<input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+880 1XXX XXX XXX" /></label>
            </div>
            <label>Role
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                <option value="seller">Seller</option>
                <option value="admin">Admin</option>
              </select>
            </label>
            <div className="form-buttons-row">
              <button className="button button-dark" onClick={handleAdd}>Create account</button>
              <button className="button button-outline" onClick={() => setShowAdd(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      <div className="panel">
        {loading ? <p className="loading-text">Loading team...</p> : profiles.length === 0 ? <p className="empty-text">No team members yet.</p> : (
          <div className="controller-list">
            {profiles.map((p) => (
              <div key={p.id}>
                <div className="team-member">
                  <span className="avatar" style={{ background: p.role === 'admin' ? '#c2d1c1' : '#e0c7a7', color: p.role === 'admin' ? '#36503c' : '#725b3e' }}>
                    {(p.display_name || p.email).slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <strong>{p.display_name || 'Unnamed'}</strong>
                    <span>{p.role === 'admin' ? 'Administrator' : 'Seller'} Â· {p.email} {p.phone ? `Â· ${p.phone}` : ''}</span>
                  </div>
                  <button className="small-action" onClick={() => startEdit(p)}><Pencil size={13} /></button>
                  <button className="small-action danger" onClick={() => handleDelete(p.id)}><Trash2 size={13} /></button>
                </div>
                {editingId === p.id && (
                  <div className="inline-form" style={{ marginLeft: 48, marginBottom: 14 }}>
                    <input placeholder="Email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} />
                    <input placeholder="Display name" value={editForm.display_name} onChange={(e) => setEditForm({ ...editForm, display_name: e.target.value })} />
                    <input placeholder="Phone" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} />
                    <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}>
                      <option value="seller">Seller</option>
                      <option value="admin">Admin</option>
                    </select>
                    <input type="password" placeholder="New password (optional)" value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} />
                    <div className="form-buttons-row">
                      <button className="button button-dark" onClick={handleEdit}><Save size={14} /> Save</button>
                      <button className="button button-outline" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// â”€â”€â”€ ManagementPage (pending/ongoing/done) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function ManagementPage({ role, onBack }: { role: string; onBack: () => void }) {
  const [tab, setTab] = useState<'pending' | 'ongoing' | 'done'>('pending');
  const [orders, setOrders] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [orderItems, setOrderItems] = useState<Record<string, any[]>>({});
  const [dealPayments, setDealPayments] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [actionError, setActionError] = useState('');
  const [showDealTerms, setShowDealTerms] = useState<string | null>(null);
  const [termsForm, setTermsForm] = useState({ total_price: '', down_payment: '' });
  const [showPayment, setShowPayment] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({ amount: '', photo_url: '', note: '' });
  const [showModify, setShowModify] = useState<string | null>(null);
  const [modifyForm, setModifyForm] = useState({ total_price: '', items: '' });
  const [actionMsg, setActionMsg] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const ords = await api.fetchOrders();
      setOrders(ords);
      const dls = await api.fetchDeals();
      setDeals(dls);
      for (const o of ords) {
        if (!orderItems[o.id]) {
          const items = await api.fetchOrderItems(o.id);
          setOrderItems((prev) => ({ ...prev, [o.id]: items }));
        }
      }
      for (const d of dls) {
        if (!dealPayments[d.id]) {
          const pmts = await api.fetchPayments(d.id);
          setDealPayments((prev) => ({ ...prev, [d.id]: pmts }));
        }
      }
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const pendingOrders = orders.filter((o) => o.status === 'pending' || o.status === 'picked_up');
  const activeDeals = deals.filter((d) => ['pending_terms', 'terms_sent', 'buyer_accepted', 'seller_confirmed', 'active'].includes(d.status));
  const doneDeals = deals.filter((d) => d.status === 'done' || d.status === 'buyer_rejected');

  const handlePickUp = async (id: string) => {
    try { await api.pickUpOrder(id); setActionMsg('Order picked up.'); load(); } catch (e: any) { setActionError(e.message); }
  };

  const handleAccept = async (id: string) => {
    try { await api.acceptOrder(id); setActionMsg('Order accepted. Set deal terms now.'); load(); } catch (e: any) { setActionError(e.message); }
  };

  const handleReject = async (id: string) => {
    if (!confirm('Reject this order?')) return;
    try { await api.rejectOrder(id); setActionMsg('Order rejected.'); load(); } catch (e: any) { setActionError(e.message); }
  };

  const handleSetTerms = async () => {
    if (!showDealTerms) return;
    try {
      await api.setDealTerms(showDealTerms, parseFloat(termsForm.total_price), parseFloat(termsForm.down_payment));
      setShowDealTerms(null); setTermsForm({ total_price: '', down_payment: '' });
      setActionMsg('Deal terms sent to buyer.');
      load();
    } catch (e: any) { setActionError(e.message); }
  };

  const handleRecordPayment = async () => {
    if (!showPayment) return;
    try {
      await api.recordPayment(showPayment, parseFloat(paymentForm.amount), paymentForm.photo_url, paymentForm.note);
      setShowPayment(null); setPaymentForm({ amount: '', photo_url: '', note: '' });
      setActionMsg('Payment recorded. Notifications sent.');
      load();
    } catch (e: any) { setActionError(e.message); }
  };

  const handleProposeMod = async () => {
    if (!showModify) return;
    try {
      let items: any[] = [];
      try { items = JSON.parse(modifyForm.items); } catch { setActionError('Items must be valid JSON.'); return; }
      await api.proposeModification(showModify, items, parseFloat(modifyForm.total_price));
      setShowModify(null); setModifyForm({ total_price: '', items: '' });
      setActionMsg('Modification proposed. Buyer will be notified by email.');
      load();
    } catch (e: any) { setActionError(e.message); }
  };

  const fmt = (n: number) => new Intl.NumberFormat('en-US').format(n);

  const renderOrderItems = (orderId: string) => {
    const items = orderItems[orderId] ?? [];
    if (!items.length) return <span className="muted-small">No items</span>;
    return items.map((item, i) => (
      <div className="order-item-row" key={i}><Package size={14} /><span>{item.quantity} {item.unit} Â· {item.category_name}</span></div>
    ));
  };

  const renderDealItems = (orderId: string) => {
    const items = orderItems[orderId] ?? [];
    if (!items.length) return <span className="muted-small">No items</span>;
    return items.map((item, i) => (
      <div className="order-item-row" key={i}><Package size={14} /><span>{item.quantity} {item.unit} Â· {item.category_name}</span></div>
    ));
  };

  return (
    <section className="dashboard-page">
      <button className="back-link" onClick={onBack}>â† Back to dashboard</button>
      <div className="dashboard-head">
        <div><div className="eyebrow"><span className="eyebrow-line" /> Management</div><h1>Orders &<br /><em>deals.</em></h1></div>
      </div>
      {actionMsg && <div className="action-success"><Check size={15} /> {actionMsg}</div>}
      {actionError && <div className="form-error">{actionError}</div>}
      <div className="dashboard-tabs">
        <button className={tab === 'pending' ? 'active' : ''} onClick={() => setTab('pending')}>Pending {pendingOrders.length > 0 && <span>{pendingOrders.length}</span>}</button>
        <button className={tab === 'ongoing' ? 'active' : ''} onClick={() => setTab('ongoing')}>Ongoing {activeDeals.length > 0 && <span>{activeDeals.length}</span>}</button>
        <button className={tab === 'done' ? 'active' : ''} onClick={() => setTab('done')}>Finished</button>
      </div>

      {loading ? <p className="loading-text">Loading...</p> : (
        <>
          {tab === 'pending' && (
            <div className="mgmt-list">
              {pendingOrders.length === 0 ? <div className="empty-management"><ClipboardList size={29} /><h3>No pending orders</h3><p>New orders will appear here for pickup.</p></div> :
                pendingOrders.map((o) => (
                  <div className="mgmt-card" key={o.id}>
                    <div className="mgmt-card-head">
                      <div><strong>{o.buyer_name}</strong><span>{o.buyer_phone} Â· {o.buyer_email}</span></div>
                      <span className={`status-badge ${o.status}`}>{o.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="mgmt-card-body">
                      <div className="mgmt-items">{renderOrderItems(o.id)}</div>
                      <p className="mgmt-address"><Package size={13} /> {o.delivery_address}</p>
                      <small className="muted-small">{new Date(o.created_at).toLocaleString()}</small>
                    </div>
                    <div className="mgmt-card-actions">
                      {o.status === 'pending' && <button className="button button-dark" onClick={() => handlePickUp(o.id)}><Package size={14} /> Pick up</button>}
                      <button className="button button-dark" onClick={() => handleAccept(o.id)}><Check size={14} /> Accept</button>
                      <button className="button button-outline" onClick={() => handleReject(o.id)}><X size={14} /> Reject</button>
                    </div>
                  </div>
                ))
              }
            </div>
          )}

          {tab === 'ongoing' && (
            <div className="mgmt-list">
              {activeDeals.length === 0 ? <div className="empty-management"><TrendingUp size={29} /><h3>No ongoing deals</h3><p>Accepted orders will show their deals here.</p></div> :
                activeDeals.map((d) => {
                  const order = orders.find((o) => o.id === d.order_id);
                  const pmts = dealPayments[d.id] ?? [];
                  return (
                    <div className="mgmt-card" key={d.id}>
                      <div className="mgmt-card-head">
                        <div><strong>{order?.buyer_name ?? 'Unknown'}</strong><span>{order?.buyer_phone}</span></div>
                        <span className={`status-badge ${d.status}`}>{d.status.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="mgmt-card-body">
                        <div className="deal-terms-mini">
                          <span>Total: <strong>à§³{fmt(d.total_price)}</strong></span>
                          <span>Paid: <strong>à§³{fmt(d.total_paid)}</strong></span>
                          <span>Remaining: <strong>à§³{fmt(d.remaining_balance)}</strong></span>
                        </div>
                        <div className="mgmt-items">{renderDealItems(d.order_id)}</div>
                        {pmts.length > 0 && (
                          <div className="payment-history-mini">
                            <span className="card-eyebrow">Payments</span>
                            {pmts.map((p) => <div className="order-item-row" key={p.id}><TrendingUp size={13} /><span>à§³{fmt(p.amount)} â€” {new Date(p.created_at).toLocaleDateString()}</span></div>)}
                          </div>
                        )}
                      </div>
                      <div className="mgmt-card-actions">
                        {d.status === 'pending_terms' && <button className="button button-dark" onClick={() => { setShowDealTerms(d.id); setTermsForm({ total_price: '', down_payment: '' }); }}>Set deal terms</button>}
                        {d.status === 'terms_sent' && <span className="muted-small">Waiting for buyer to respond...</span>}
                        {d.status === 'buyer_accepted' && <span className="muted-small">Buyer accepted â€” check email to confirm</span>}
                        {d.status === 'active' && <>
                          <button className="button button-dark" onClick={() => { setShowPayment(d.id); setPaymentForm({ amount: '', photo_url: '', note: '' }); }}><TrendingUp size={14} /> Record payment</button>
                          <button className="button button-outline" onClick={() => { setShowModify(d.id); setModifyForm({ total_price: String(d.total_price), items: JSON.stringify(orderItems[d.order_id] ?? [], null, 2) }); }}>Modify order</button>
                        </>}
                      </div>
                      {showDealTerms === d.id && (
                        <div className="inline-form">
                          <input type="number" placeholder="Total price (à§³)" value={termsForm.total_price} onChange={(e) => setTermsForm({ ...termsForm, total_price: e.target.value })} />
                          <input type="number" placeholder="Down payment (à§³)" value={termsForm.down_payment} onChange={(e) => setTermsForm({ ...termsForm, down_payment: e.target.value })} />
                          <div className="form-buttons-row">
                            <button className="button button-dark" onClick={handleSetTerms}>Send to buyer</button>
                            <button className="button button-outline" onClick={() => setShowDealTerms(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                      {showPayment === d.id && (
                        <div className="inline-form">
                          <input type="number" placeholder="Amount paid (à§³)" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} />
                          <div className="uploader-inline"><ImageUploader aspectRatio={4 / 3} currentUrl={paymentForm.photo_url} folder="receipts" onUploaded={(url) => setPaymentForm({ ...paymentForm, photo_url: url })} label="Upload receipt photo" /></div>
                          <input placeholder="Note (optional)" value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} />
                          <div className="form-buttons-row">
                            <button className="button button-dark" onClick={handleRecordPayment}>Record payment</button>
                            <button className="button button-outline" onClick={() => setShowPayment(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                      {showModify === d.id && (
                        <div className="inline-form">
                          <input type="number" placeholder="New total price (à§³)" value={modifyForm.total_price} onChange={(e) => setModifyForm({ ...modifyForm, total_price: e.target.value })} />
                          <textarea placeholder="Items JSON" value={modifyForm.items} onChange={(e) => setModifyForm({ ...modifyForm, items: e.target.value })} rows={5} />
                          <div className="form-buttons-row">
                            <button className="button button-dark" onClick={handleProposeMod}>Propose to buyer</button>
                            <button className="button button-outline" onClick={() => setShowModify(null)}>Cancel</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              }
            </div>
          )}

          {tab === 'done' && (
            <div className="mgmt-list">
              {doneDeals.length === 0 ? <div className="empty-management"><Check size={29} /><h3>No completed deals</h3><p>Finished deals will appear here.</p></div> :
                doneDeals.map((d) => {
                  const order = orders.find((o) => o.id === d.order_id);
                  return (
                    <div className="mgmt-card" key={d.id}>
                      <div className="mgmt-card-head">
                        <div><strong>{order?.buyer_name ?? 'Unknown'}</strong><span>{order?.buyer_phone}</span></div>
                        <span className={`status-badge ${d.status}`}>{d.status.replace(/_/g, ' ')}</span>
                      </div>
                      <div className="mgmt-card-body">
                        <div className="deal-terms-mini">
                          <span>Total: <strong>à§³{fmt(d.total_price)}</strong></span>
                          <span>Paid: <strong>à§³{fmt(d.total_paid)}</strong></span>
                        </div>
                        <div className="mgmt-items">{renderDealItems(d.order_id)}</div>
                      </div>
                    </div>
                  );
                })
              }
            </div>
          )}
        </>
      )}
    </section>
  );
}

// â”€â”€â”€ EditSitePage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function EditSitePage({ onBack, onUpdated }: { onBack: () => void; onUpdated: () => void }) {
  const [content, setContent] = useState<SiteContent>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  useEffect(() => { api.fetchSiteContent().then(setContent).catch(() => {}); }, []);

  const save = async (key: string) => {
    await api.updateSiteContent(key, draft, content[key]?.image_url);
    setEditing(null);
    api.fetchSiteContent().then(setContent);
    onUpdated();
  };

  const fields = [
    { key: 'company_name', label: 'Company name (header brand)' },
    { key: 'company_subname', label: 'Company subname (header brand small)' },
    { key: 'announcement', label: 'Announcement bar text' },
    { key: 'contact_phone', label: 'Contact phone (header, footer, detail page)' },
    { key: 'contact_email', label: 'Contact email (footer)' },
    // Home â€” Hero
    { key: 'hero_eyebrow', label: 'Home â€” Hero eyebrow' },
    { key: 'hero_title', label: 'Hero title (line 1)' },
    { key: 'hero_title_em', label: 'Hero title (line 2, emphasized)' },
    { key: 'hero_subtitle', label: 'Hero subtitle' },
    { key: 'hero_stat1_value', label: 'Hero stat 1 value' },
    { key: 'hero_stat1_label', label: 'Hero stat 1 label' },
    { key: 'hero_stat2_value', label: 'Hero stat 2 value' },
    { key: 'hero_stat2_label', label: 'Hero stat 2 label' },
    { key: 'hero_stat3_value', label: 'Hero stat 3 value' },
    { key: 'hero_stat3_label', label: 'Hero stat 3 label' },
    { key: 'hero_caption_1', label: 'Hero image caption (line 1)' },
    { key: 'hero_caption_2', label: 'Hero image caption (line 2, bold)' },
    // Home â€” Intro section
    { key: 'intro_eyebrow', label: 'Home â€” Intro eyebrow' },
    { key: 'intro_title', label: 'Home â€” Intro title (line 1)' },
    { key: 'intro_title_em', label: 'Home â€” Intro title (line 2, emphasized)' },
    { key: 'intro_body', label: 'Home â€” Intro paragraph' },
    { key: 'intro_cta', label: 'Home â€” Intro button text' },
    // Home â€” Featured section
    { key: 'featured_eyebrow', label: 'Home â€” Featured eyebrow' },
    { key: 'featured_title', label: 'Home â€” Featured heading' },
    { key: 'featured_cta', label: 'Home â€” Featured button text' },
    // Home â€” Process section
    { key: 'process_label_1', label: 'Home â€” Process photo label (line 1)' },
    { key: 'process_label_2', label: 'Home â€” Process photo label (line 2, bold)' },
    { key: 'process_eyebrow', label: 'Home â€” Process eyebrow' },
    { key: 'process_title_1', label: 'Home â€” Process title (line 1)' },
    { key: 'process_title_2', label: 'Home â€” Process title (line 2)' },
    { key: 'process_title_em', label: 'Home â€” Process title (emphasized)' },
    { key: 'process_step1_title', label: 'Home â€” Process step 1 title' },
    { key: 'process_step1_desc', label: 'Home â€” Process step 1 description' },
    { key: 'process_step2_title', label: 'Home â€” Process step 2 title' },
    { key: 'process_step2_desc', label: 'Home â€” Process step 2 description' },
    { key: 'process_step3_title', label: 'Home â€” Process step 3 title' },
    { key: 'process_step3_desc', label: 'Home â€” Process step 3 description' },
    { key: 'process_cta', label: 'Home â€” Process button text' },
    // Home â€” CTA band
    { key: 'cta_eyebrow', label: 'Home â€” CTA band eyebrow' },
    { key: 'cta_title', label: 'Home â€” CTA band title (line 1)' },
    { key: 'cta_title_em', label: 'Home â€” CTA band title (line 2, emphasized)' },
    { key: 'cta_button', label: 'Home â€” CTA band button text' },
    // Products page
    { key: 'products_eyebrow', label: 'Materials page â€” eyebrow' },
    { key: 'products_title', label: 'Materials page â€” title (line 1)' },
    { key: 'products_title_em', label: 'Materials page â€” title (emphasized)' },
    { key: 'products_intro', label: 'Materials page â€” intro paragraph' },
    { key: 'catalog_note_title', label: 'Materials page â€” catalog note title' },
    { key: 'catalog_note_body', label: 'Materials page â€” catalog note body' },
    // Product detail page
    { key: 'detail_badge', label: 'Product detail â€” badge text' },
    { key: 'detail_subtitle', label: 'Product detail â€” subtitle (below name)' },
    { key: 'detail_add_button', label: 'Product detail â€” add button text' },
    { key: 'detail_note_prefix', label: 'Product detail â€” note prefix' },
    { key: 'detail_note_phone', label: 'Product detail â€” note phone text' },
    // About page
    { key: 'about_eyebrow', label: 'About â€” eyebrow' },
    { key: 'about_title', label: 'About title (line 1)' },
    { key: 'about_title_em', label: 'About title (line 2, emphasized)' },
    { key: 'about_quote', label: 'About â€” quote text' },
    { key: 'about_p1', label: 'About paragraph 1' },
    { key: 'about_p2', label: 'About paragraph 2' },
    { key: 'about_cta', label: 'About â€” button text' },
    { key: 'values_eyebrow', label: 'About â€” values eyebrow' },
    { key: 'value1_title', label: 'About â€” value 1 title' },
    { key: 'value1_desc', label: 'About â€” value 1 description' },
    { key: 'value2_title', label: 'About â€” value 2 title' },
    { key: 'value2_desc', label: 'About â€” value 2 description' },
    { key: 'value3_title', label: 'About â€” value 3 title' },
    { key: 'value3_desc', label: 'About â€” value 3 description' },
    // Footer
    { key: 'footer_tagline', label: 'Footer â€” tagline' },
    { key: 'footer_explore_label', label: 'Footer â€” explore label' },
    { key: 'footer_contact_label', label: 'Footer â€” contact label' },
    { key: 'footer_location', label: 'Footer â€” location' },
    { key: 'footer_copyright', label: 'Footer â€” copyright text' },
    { key: 'footer_tagline_bottom', label: 'Footer â€” bottom tagline' },
    // Login page
    { key: 'login_quote', label: 'Login â€” quote text' },
    { key: 'login_quote_sub', label: 'Login â€” quote subtitle' },
    { key: 'login_eyebrow', label: 'Login â€” eyebrow' },
    { key: 'login_title', label: 'Login â€” title (line 1)' },
    { key: 'login_title_em', label: 'Login â€” title (emphasized)' },
    { key: 'login_subtitle', label: 'Login â€” subtitle' },
    { key: 'login_note', label: 'Login â€” bottom note' },
  ];

  return (
    <section className="dashboard-page">
      <button className="back-link" onClick={onBack}>â† Back to dashboard</button>
      <div className="dashboard-head">
        <div><div className="eyebrow"><span className="eyebrow-line" /> Edit site content</div><h1>Edit<br /><em>everything.</em></h1></div>
      </div>
      <div className="panel">
        <p style={{ marginBottom: 20, color: '#7a837b', fontSize: 12 }}>Click any field to edit the text shown on your website. Changes go live immediately.</p>
        {fields.map((f) => (
          <div className="edit-field-row" key={f.key}>
            <label>{f.label}</label>
            {editing === f.key ? (
              <div className="inline-edit-row">
                <input value={draft} onChange={(e) => setDraft(e.target.value)} />
                <button className="button button-dark" onClick={() => save(f.key)}><Save size={14} /> Save</button>
                <button className="button button-outline" onClick={() => setEditing(null)}>Cancel</button>
              </div>
            ) : (
              <div className="edit-value-row" onClick={() => { setEditing(f.key); setDraft(content[f.key]?.value ?? ''); }}>
                <span>{content[f.key]?.value || '(empty)'}</span>
                <Pencil size={13} />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="panel" style={{ marginTop: 14 }}>
        <div className="panel-head"><div><span className="card-eyebrow">Material categories</span><h2>Manage materials</h2></div></div>
        <p style={{ color: '#7a837b', fontSize: 12, marginBottom: 14 }}>Go to the Materials page with edit mode enabled to add, edit, or delete material categories and their options.</p>
        <button className="button button-dark" onClick={onBack}>Back to dashboard</button>
      </div>
    </section>
  );
}

// â”€â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function Footer({ onNavigate, content, editMode, onContentUpdate }: { onNavigate: (v: View) => void; content: SiteContent; editMode: boolean; onContentUpdate: () => void }) {
  const sc = (key: string, fallback: string) => content[key]?.value ?? fallback;
  const phone = sc('contact_phone', '+880 1711 123 456');
  const email = sc('contact_email', 'hello@baparibuilders.com');
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <button className="brand footer-brand" onClick={() => onNavigate('home')}>
            <span className="brand-mark"><Building2 size={21} /></span>
            <span><strong>{editMode ? <EditableText value={sc('company_name', 'BAPARI')} contentKey="company_name" editMode={editMode} onUpdate={onContentUpdate} /> : sc('company_name', 'BAPARI')}</strong><small>{editMode ? <EditableText value={sc('company_subname', 'BUILDERS')} contentKey="company_subname" editMode={editMode} onUpdate={onContentUpdate} /> : sc('company_subname', 'BUILDERS')}</small></span>
          </button>
          <p><EditableText value={sc('footer_tagline', 'Building trust, one project at a time.')} contentKey="footer_tagline" editMode={editMode} onUpdate={onContentUpdate} multiline /></p>
        </div>
        <div className="footer-links">
          <div>
            <span><EditableText value={sc('footer_explore_label', 'Explore')} contentKey="footer_explore_label" editMode={editMode} onUpdate={onContentUpdate} /></span>
            <button onClick={() => onNavigate('products')}>{sc('nav_materials', 'Materials')}</button>
            <button onClick={() => onNavigate('about')}>{sc('nav_about', 'Our story')}</button>
            <button onClick={() => onNavigate('status')}>{sc('nav_track', 'Track an order')}</button>
          </div>
          <div>
            <span><EditableText value={sc('footer_contact_label', 'Talk to us')} contentKey="footer_contact_label" editMode={editMode} onUpdate={onContentUpdate} /></span>
            <a href={`tel:${phone}`}>{phone}</a>
            <a href={`mailto:${email}`}>{email}</a>
            <span><EditableText value={sc('footer_location', 'Dhaka, Bangladesh')} contentKey="footer_location" editMode={editMode} onUpdate={onContentUpdate} /></span>
          </div>
        </div>
      </div>
      <div className="footer-bottom">
        <span><EditableText value={sc('footer_copyright', 'Â© 2024 Bapari Builders. Built for better beginnings.')} contentKey="footer_copyright" editMode={editMode} onUpdate={onContentUpdate} /></span>
        <span><EditableText value={sc('footer_tagline_bottom', 'Quality materials. Clear conversations.')} contentKey="footer_tagline_bottom" editMode={editMode} onUpdate={onContentUpdate} /></span>
      </div>
    </footer>
  );
}




-- Default staff account profiles for local/demo access.
-- IMPORTANT: Auth users must be created through Supabase Auth (or via a server-side
-- service-role admin call). Direct inserts into auth.users are not safe and can leave
-- the auth tables in an inconsistent state that breaks sign-in with the public anon key.
-- This migration only upserts profile metadata for staff accounts that already exist.

DO $$
BEGIN
  -- Admin profile (legacy auth account if already present)
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@baparibuilders.com') THEN
    INSERT INTO public.profiles (id, email, role, display_name, phone, avatar_url, created_at)
    VALUES (
      (SELECT id FROM auth.users WHERE email = 'admin@baparibuilders.com'),
      'admin@baparibuilders.com',
      'admin',
      'Bapari Admin',
      '+880 1700 000000',
      '',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      phone = EXCLUDED.phone,
      avatar_url = EXCLUDED.avatar_url;
  END IF;

  -- Primary admin profile
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'bugreaper101@gmail.com') THEN
    INSERT INTO public.profiles (id, email, role, display_name, phone, avatar_url, created_at)
    VALUES (
      (SELECT id FROM auth.users WHERE email = 'bugreaper101@gmail.com'),
      'bugreaper101@gmail.com',
      'admin',
      'Admin',
      '',
      '',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      phone = EXCLUDED.phone,
      avatar_url = EXCLUDED.avatar_url;
  END IF;

  -- Seller profile
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'seller@baparibuilders.com') THEN
    INSERT INTO public.profiles (id, email, role, display_name, phone, avatar_url, created_at)
    VALUES (
      (SELECT id FROM auth.users WHERE email = 'seller@baparibuilders.com'),
      'seller@baparibuilders.com',
      'seller',
      'Bapari Seller',
      '+880 1800 000000',
      '',
      now()
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      role = EXCLUDED.role,
      display_name = EXCLUDED.display_name,
      phone = EXCLUDED.phone,
      avatar_url = EXCLUDED.avatar_url;
  END IF;
END $$;

-- Default staff accounts for local/demo access.
-- Replace these credentials before production use.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@baparibuilders.com'
  ) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_user_meta_data,
      is_super_admin
    ) VALUES (
      '11111111-1111-4111-8111-111111111111'::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      'admin@baparibuilders.com',
      crypt('Admin@12345', gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('display_name', 'Bapari Admin', 'phone', '+880 1700 000000'),
      false
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'seller@baparibuilders.com'
  ) THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_user_meta_data,
      is_super_admin
    ) VALUES (
      '22222222-2222-4222-8222-222222222222'::uuid,
      '00000000-0000-0000-0000-000000000000'::uuid,
      'authenticated',
      'authenticated',
      'seller@baparibuilders.com',
      crypt('Seller@12345', gen_salt('bf')),
      now(),
      now(),
      now(),
      jsonb_build_object('display_name', 'Bapari Seller', 'phone', '+880 1800 000000'),
      false
    );
  END IF;
END $$;

INSERT INTO public.profiles (id, email, role, display_name, phone, avatar_url, created_at)
VALUES
  ('11111111-1111-4111-8111-111111111111'::uuid, 'admin@baparibuilders.com', 'admin', 'Bapari Admin', '+880 1700 000000', '', now()),
  ('22222222-2222-4222-8222-222222222222'::uuid, 'seller@baparibuilders.com', 'seller', 'Bapari Seller', '+880 1800 000000', '', now())
ON CONFLICT (id) DO UPDATE SET
  email = EXCLUDED.email,
  role = EXCLUDED.role,
  display_name = EXCLUDED.display_name,
  phone = EXCLUDED.phone,
  avatar_url = EXCLUDED.avatar_url;

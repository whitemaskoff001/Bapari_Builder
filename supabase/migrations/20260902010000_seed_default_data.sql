INSERT INTO categories (id, name, description, image_url, display_order)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'Brick', 'Reliable masonry essentials for durable walls and structures.', 'https://images.pexels.com/photos/1239291/pexels-photo-1239291.jpeg?auto=compress&cs=tinysrgb&w=900', 1),
  ('22222222-2222-2222-2222-222222222222', 'Cement', 'High-strength cement for foundations, finishing, and structural work.', 'https://images.pexels.com/photos/162500/pexels-photo-162500.jpeg?auto=compress&cs=tinysrgb&w=900', 2),
  ('33333333-3333-3333-3333-333333333333', 'Sand', 'Clean, consistent sand for mixing, plastering, and finishing.', 'https://images.pexels.com/photos/220182/pexels-photo-220182.jpeg?auto=compress&cs=tinysrgb&w=900', 3),
  ('44444444-4444-4444-4444-444444444444', 'Steel', 'Structural steel and reinforcement for strength and stability.', 'https://images.pexels.com/photos/162553/pexels-photo-162553.jpeg?auto=compress&cs=tinysrgb&w=900', 4),
  ('55555555-5555-5555-5555-555555555555', 'Tiles', 'Flooring and wall tile solutions for durable finishes.', 'https://images.pexels.com/photos/271743/pexels-photo-271743.jpeg?auto=compress&cs=tinysrgb&w=900', 5),
  ('66666666-6666-6666-6666-666666666666', 'Paint & Finish', 'Protective and decorative finishing products for every surface.', 'https://images.pexels.com/photos/3184436/pexels-photo-3184436.jpeg?auto=compress&cs=tinysrgb&w=900', 6)
ON CONFLICT (id) DO NOTHING;

INSERT INTO category_option_groups (id, category_id, name, display_order)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Unit', 1),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '11111111-1111-1111-1111-111111111111', 'Quality', 2),
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'Unit', 1),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', 'Strength', 2),
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', 'Unit', 1),
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '33333333-3333-3333-3333-333333333333', 'Type', 2),
  ('12121212-1212-1212-1212-121212121212', '44444444-4444-4444-4444-444444444444', 'Unit', 1),
  ('13131313-1313-1313-1313-131313131313', '44444444-4444-4444-4444-444444444444', 'Grade', 2),
  ('14141414-1414-1414-1414-141414141414', '55555555-5555-5555-5555-555555555555', 'Unit', 1),
  ('15151515-1515-1515-1515-151515151515', '55555555-5555-5555-5555-555555555555', 'Finish', 2),
  ('16161616-1616-1616-1616-161616161616', '66666666-6666-6666-6666-666666666666', 'Unit', 1),
  ('17171717-1717-1717-1717-171717171717', '66666666-6666-6666-6666-666666666666', 'Finish', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO category_options (id, group_id, label, display_order)
VALUES
  ('1a1a1a1a-1a1a-1a1a-1a1a-1a1a1a1a1a1a', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Piece', 1),
  ('1b1b1b1b-1b1b-1b1b-1b1b-1b1b1b1b1b1b', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Pallet', 2),
  ('1c1c1c1c-1c1c-1c1c-1c1c-1c1c1c1c1c1c', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Standard', 1),
  ('1d1d1d1d-1d1d-1d1d-1d1d-1d1d1d1d1d1d', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Premium', 2),
  ('1e1e1e1e-1e1e-1e1e-1e1e-1e1e1e1e1e1e', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Bag', 1),
  ('1f1f1f1f-1f1f-1f1f-1f1f-1f1f1f1f1f1f', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Ton', 2),
  ('2a2a2a2a-2a2a-2a2a-2a2a-2a2a2a2a2a2a', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '42.5', 1),
  ('2b2b2b2b-2b2b-2b2b-2b2b-2b2b2b2b2b2b', 'dddddddd-dddd-dddd-dddd-dddddddddddd', '52.5', 2),
  ('2c2c2c2c-2c2c-2c2c-2c2c-2c2c2c2c2c2c', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Truck', 1),
  ('2d2d2d2d-2d2d-2d2d-2d2d-2d2d2d2d2d2d', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'CFT', 2),
  ('2e2e2e2e-2e2e-2e2e-2e2e-2e2e2e2e2e2e', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'River', 1),
  ('2f2f2f2f-2f2f-2f2f-2f2f-2f2f2f2f2f2f', 'ffffffff-ffff-ffff-ffff-ffffffffffff', 'Fine', 2),
  ('3a3a3a3a-3a3a-3a3a-3a3a-3a3a3a3a3a3a', '12121212-1212-1212-1212-121212121212', 'Ton', 1),
  ('3b3b3b3b-3b3b-3b3b-3b3b-3b3b3b3b3b3b', '12121212-1212-1212-1212-121212121212', 'Bar', 2),
  ('3c3c3c3c-3c3c-3c3c-3c3c-3c3c3c3c3c3c', '13131313-1313-1313-1313-131313131313', 'Grade 40', 1),
  ('3d3d3d3d-3d3d-3d3d-3d3d-3d3d3d3d3d3d', '13131313-1313-1313-1313-131313131313', 'Grade 60', 2),
  ('3e3e3e3e-3e3e-3e3e-3e3e-3e3e3e3e3e3e', '14141414-1414-1414-1414-141414141414', 'Box', 1),
  ('3f3f3f3f-3f3f-3f3f-3f3f-3f3f3f3f3f3f', '14141414-1414-1414-1414-141414141414', 'Sqft', 2),
  ('4a4a4a4a-4a4a-4a4a-4a4a-4a4a4a4a4a4a', '15151515-1515-1515-1515-151515151515', 'Matte', 1),
  ('4b4b4b4b-4b4b-4b4b-4b4b-4b4b4b4b4b4b', '15151515-1515-1515-1515-151515151515', 'Gloss', 2),
  ('4c4c4c4c-4c4c-4c4c-4c4c-4c4c4c4c4c4c', '16161616-1616-1616-1616-161616161616', 'Litre', 1),
  ('4d4d4d4d-4d4d-4d4d-4d4d-4d4d4d4d4d4d', '16161616-1616-1616-1616-161616161616', 'Tin', 2),
  ('4e4e4e4e-4e4e-4e4e-4e4e-4e4e4e4e4e4e', '17171717-1717-1717-1717-171717171717', 'Matte', 1),
  ('4f4f4f4f-4f4f-4f4f-4f4f-4f4f4f4f4f4f', '17171717-1717-1717-1717-171717171717', 'Gloss', 2)
ON CONFLICT (id) DO NOTHING;

INSERT INTO site_content (key, value, image_url)
VALUES
  ('announcement', 'Building trust, one project at a time', ''),
  ('contact_phone', '+880 1711 123 456', ''),
  ('company_name', 'BAPARI', ''),
  ('company_subname', 'BUILDERS', ''),
  ('hero_eyebrow', 'Materials that move your vision forward', ''),
  ('hero_title', 'Build it right.', ''),
  ('hero_title_em', 'Build it to last.', ''),
  ('hero_subtitle', 'Reliable construction materials, honest guidance, and a team that understands what your project demands.', ''),
  ('hero_stat1_value', '15+', ''),
  ('hero_stat1_label', 'Years of trust', ''),
  ('hero_stat2_value', '4.9', ''),
  ('hero_stat2_label', 'Customer rating', ''),
  ('hero_stat3_value', '24h', ''),
  ('hero_stat3_label', 'Quick response', ''),
  ('intro_eyebrow', 'The Bapari standard', ''),
  ('intro_title', 'Materials you can', ''),
  ('intro_title_em', 'build a future on.', ''),
  ('intro_body', 'From the first foundation to the final finish, your materials shape everything. We source with care, stand behind what we sell, and make it simple to get exactly what your project needs.', ''),
  ('intro_cta', 'Meet the team', ''),
  ('featured_eyebrow', 'What we supply', ''),
  ('featured_title', 'Start with the essentials.', ''),
  ('featured_cta', 'View all materials', ''),
  ('process_eyebrow', 'Simple by design', ''),
  ('process_title_1', 'From your idea', ''),
  ('process_title_2', 'to', ''),
  ('process_title_em', 'your doorstep.', ''),
  ('process_step1_title', 'Choose your materials', ''),
  ('process_step1_desc', 'Browse our curated range of construction essentials.', ''),
  ('process_step2_title', 'Tell us what you need', ''),
  ('process_step2_desc', 'Share quantity, delivery details, and your preferences.', ''),
  ('process_step3_title', 'We work out the details', ''),
  ('process_step3_desc', 'Our team calls to confirm availability and the best price.', ''),
  ('detail_badge', 'Available for delivery', ''),
  ('detail_subtitle', 'for your next build.', ''),
  ('detail_add_button', 'Add to materials list', ''),
  ('detail_note_prefix', 'Not sure what you need?', ''),
  ('detail_note_phone', 'Call +880 1711 123 456', '')
ON CONFLICT (key) DO UPDATE
SET value = EXCLUDED.value,
    image_url = EXCLUDED.image_url,
    updated_at = now();

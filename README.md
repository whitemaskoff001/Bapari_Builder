# Bapari Builders

A full-stack storefront and materials management app for Bapari Builders, built with Vite, React, TypeScript, and Supabase.

## Local development

1. Copy `.env.example` to `.env`.
2. Add your Supabase values:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the app:
   ```bash
   npm run dev
   ```

## Production deployment

This project includes a GitHub Pages workflow in `.github/workflows/deploy.yml`.

Set the following repository secrets in GitHub:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Then push to `main` and GitHub Actions will deploy the site.

## Database setup

Apply the SQL migrations in `supabase/migrations` to create the database schema in Supabase.

Recommended workflow:
```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
```

## Notes

The frontend is intentionally resilient when the backend is not configured yet, so the storefront still renders with sensible defaults while the live Supabase project is connected.

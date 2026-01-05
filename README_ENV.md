# Environment Variables Setup

Create a `.env.local` file in the root directory with the following variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here

# Database Configuration (from Supabase)
DATABASE_URL=postgresql://user:password@host:port/database
```

## How to get these values:

1. **Supabase URL and Anon Key:**
   - Go to your Supabase project dashboard
   - Navigate to Settings > API
   - Copy the "Project URL" → `NEXT_PUBLIC_SUPABASE_URL`
   - Copy the "anon public" key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Database URL:**
   - In Supabase dashboard, go to Settings > Database
   - Copy the "Connection string" → `DATABASE_URL`
   - Make sure to replace `[YOUR-PASSWORD]` with your actual database password

## Important Notes:

- `.env.local` is already in `.gitignore` and won't be committed to git
- Restart your development server after creating/updating `.env.local`
- The `NEXT_PUBLIC_` prefix is required for client-side environment variables in Next.js

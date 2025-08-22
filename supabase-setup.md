# Supabase Migration Guide

## Step 1: Create Supabase Project
1. Go to https://supabase.com
2. Create new project (free tier)
3. Choose region closest to users
4. Note your project URL and anon key

## Step 2: Database Migration
1. Export current schema from Neon:
   ```sql
   -- Run this in your current Neon database
   pg_dump --schema-only --no-owner --no-privileges DATABASE_URL
   ```
2. Import to Supabase using SQL Editor
3. Export data from Neon and import to Supabase

## Step 3: Update Environment Variables
Replace these variables:
```env
# Old Neon variables
DATABASE_URL=...

# New Supabase variables  
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

## Step 4: File Storage Migration
1. Enable Storage in Supabase dashboard
2. Create buckets: `receipts`, `reports`  
3. Set up Row Level Security policies
4. Update file upload code to use Supabase Storage API

## Step 5: Authentication (Optional)
Consider migrating to Supabase Auth for:
- Built-in user management
- Social login providers
- Row Level Security integration
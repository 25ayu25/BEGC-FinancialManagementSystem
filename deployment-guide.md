# Deployment Guide: Supabase + Netlify

## 🎯 Architecture Overview
- **Frontend**: React app deployed to Netlify CDN
- **Backend**: Express.js API deployed as Netlify Functions  
- **Database**: Supabase PostgreSQL (free tier)
- **File Storage**: Supabase Storage (instead of Google Cloud)

## 📋 Deployment Checklist

### 1. Supabase Setup
1. Create account at https://supabase.com
2. Create new project (free tier: 500MB database, 1GB bandwidth)
3. Copy your project credentials:
   ```
   Project URL: https://[project-id].supabase.co
   Anon Key: eyJ...
   Service Role Key: eyJ...
   ```

### 2. Database Migration
1. **Export current schema**:
   ```bash
   # From your current Neon database
   pg_dump --schema-only DATABASE_URL > schema.sql
   ```

2. **Import to Supabase**:
   - Go to Supabase Dashboard → SQL Editor
   - Copy/paste schema.sql and run
   - Or use Supabase CLI: `supabase db push`

3. **Export/Import data**:
   ```bash
   # Export data
   pg_dump --data-only DATABASE_URL > data.sql
   # Import to Supabase via SQL Editor
   ```

### 3. Environment Variables Update

**Local Development (.env)**:
```env
# Replace Neon with Supabase
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=development
```

**Netlify Environment Variables**:
```env
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[PROJECT-ID].supabase.co:5432/postgres
SUPABASE_URL=https://[PROJECT-ID].supabase.co
SUPABASE_ANON_KEY=your-anon-key
NODE_ENV=production
```

### 4. File Storage Migration (Optional)
If using file uploads, migrate from Google Cloud to Supabase Storage:

1. **Enable Storage in Supabase**
2. **Create storage buckets**: `receipts`, `reports`
3. **Set up Row Level Security policies**
4. **Update client code** to use Supabase Storage SDK

### 5. Netlify Deployment

**Option A: Git Deploy (Recommended)**
1. Push code to GitHub/GitLab
2. Connect repository to Netlify
3. Build settings:
   ```
   Build command: npm run build
   Publish directory: dist
   ```

**Option B: CLI Deploy**
```bash
npm install -g netlify-cli
netlify build
netlify deploy --prod
```

### 6. Domain & SSL
- **Custom Domain**: Configure in Netlify Dashboard
- **SSL**: Automatic with Netlify (Let's Encrypt)

## 🚀 Build Process
The build creates:
```
dist/
├── index.html (frontend)
├── assets/ (CSS, JS, images)
└── netlify/
    └── functions/
        └── api.js (backend)
```

## 💰 Cost Breakdown (Free Tiers)
- **Netlify**: 100GB bandwidth, 300 build minutes/month
- **Supabase**: 500MB database, 1GB bandwidth, 2GB file storage
- **Total**: $0/month for small to medium usage

## 🔧 Testing Deployment
1. **Local build test**:
   ```bash
   npm run build
   npm run start
   ```

2. **Function test**:
   ```bash
   netlify dev
   ```

3. **Database connection test**:
   ```bash
   # Test API endpoints
   curl https://your-app.netlify.app/api/auth/user
   ```

## 🐛 Common Issues & Solutions

**Issue**: "Function timeout"
**Solution**: Optimize database queries, add connection pooling

**Issue**: "Database connection failed"
**Solution**: Check DATABASE_URL format, verify IP allowlist

**Issue**: "CORS errors"
**Solution**: Configure proper CORS headers in Express app

**Issue**: "Cold start delays"
**Solution**: Implement function warming or consider upgrading to paid plan

## 📊 Performance Optimization
- Enable Netlify Edge CDN
- Use Supabase connection pooling
- Implement proper database indexing
- Add client-side caching with React Query
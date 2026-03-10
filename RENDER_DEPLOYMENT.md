# Deploy to Render

## Prerequisites
- A Render account (https://render.com)
- Your Supabase credentials

## Deployment Steps

### 1. Create a Web Service on Render

1. Go to https://dashboard.render.com
2. Click "New +" → "Web Service"
3. Upload this project as a zip or connect via Git

### 2. Configure Build & Start Commands

**Root Directory:** `nodejs_space`

**Build Command:**
```bash
yarn install && yarn build
```

**Start Command:**
```bash
node dist/main.js
```

### 3. Environment Variables

Add these in Render dashboard under "Environment":

```
SUPABASE_URL=https://obhmgszztpugcvgbuofd.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
ABACUSAI_API_KEY=your_abacus_api_key_here
NODE_ENV=production
PORT=3000
```

**Where to find credentials:**
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase Dashboard → Settings → API → service_role key
- `ABACUSAI_API_KEY`: Get from https://abacus.ai (for PDF generation)

### 4. Configure Render Settings

- **Region**: Choose closest to your location
- **Instance Type**: Starter (free) or paid tier
- **Health Check Path**: `/`
- **Auto-Deploy**: Enable for automatic deployments

### 5. Update Supabase Webhook

Once deployed, you'll get a URL like: `https://your-app-name.onrender.com`

Update Supabase webhook:
1. Go to Supabase Dashboard → Database → Webhooks
2. Set URL: `https://your-app-name.onrender.com/webhook/supabase`
3. Method: `POST`
4. Header: `Content-Type: application/json`
5. Schema: `public`
6. Table: `jobs`
7. Events: Enable `INSERT` and `UPDATE`

### 6. Test Your Deployment

**Check health:**
```bash
curl https://your-app-name.onrender.com/
```

**View API docs:**
```
https://your-app-name.onrender.com/api-docs
```

**Test webhook:**
```bash
curl https://your-app-name.onrender.com/webhook/supabase
```

## How It Works

### INSERT Event (New Job)
→ Generates **Quote** PDF

### UPDATE Event (Status → "Approved")
→ Generates **Tool Talk** + **SWMS** PDFs

### UPDATE Event (Status → "Complete")
→ Generates **Invoice** PDF

## Storage Structure

**Templates** (in Supabase `Files` bucket):
- `templates/quote.html`
- `templates/invoice.html`
- `templates/swms.html`
- `templates/toolbox.html`

**Generated PDFs** (saved to `Files` bucket):
- `generated PDF/quote/2026/{filename}.pdf`
- `generated PDF/invoice/2026/{filename}.pdf`
- `generated PDF/swms/2026/{filename}.pdf`
- `generated PDF/tool_talk/2026/{filename}.pdf`

## Troubleshooting

**Service won't start?**
- Check Render logs for errors
- Verify all environment variables are set
- Ensure build completed successfully

**Webhook not firing?**
- Test the endpoint with curl
- Check Supabase webhook delivery logs
- Verify webhook URL is correct

**PDF generation fails?**
- Verify Supabase credentials
- Check that templates exist in correct bucket/path
- Review Render logs for specific errors
- Ensure ABACUSAI_API_KEY is valid

**Cold starts (free tier)?**
- Free tier spins down after 15 min of inactivity
- First request takes 30-60 seconds to wake up
- Consider paid tier for production (no cold starts)

## Support

- Render Docs: https://render.com/docs
- Supabase Docs: https://supabase.com/docs
- Check logs in Render dashboard for detailed errors

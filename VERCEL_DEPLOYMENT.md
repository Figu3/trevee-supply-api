# Vercel Deployment Guide

This guide will help you deploy the TREVEE Supply API to Vercel in under 5 minutes.

## Why Vercel?

- ✅ **Free tier available** - Perfect for APIs
- ✅ **Automatic HTTPS** - Required by CoinGecko
- ✅ **Global CDN** - Fast response times worldwide
- ✅ **Edge caching** - Automatic caching (60s fresh, 300s stale)
- ✅ **Zero configuration** - Just push and deploy
- ✅ **Auto-scaling** - Handles traffic spikes
- ✅ **GitHub integration** - Auto-deploy on push

## Method 1: Deploy with Vercel Dashboard (Easiest)

### Step 1: Connect GitHub

1. Go to [vercel.com](https://vercel.com)
2. Click "Sign Up" or "Login"
3. Sign in with your GitHub account
4. Authorize Vercel to access your repositories

### Step 2: Import Project

1. Click "Add New" → "Project"
2. Find and select `trevee-supply-api` repository
3. Click "Import"

### Step 3: Configure Project

Leave all settings as default:
- **Framework Preset**: Other
- **Root Directory**: `./`
- **Build Command**: (leave empty)
- **Output Directory**: (leave empty)
- **Install Command**: `npm install`

### Step 4: Add Environment Variables (Optional but Recommended)

Click "Environment Variables" and add:

- **Variable name**: `ALCHEMY_API_KEY`
  - **Value**: Your Alchemy API key
  - **Environments**: Production, Preview, Development

Get a free Alchemy API key at: https://www.alchemy.com/

### Step 5: Deploy

1. Click "Deploy"
2. Wait 30-60 seconds for deployment to complete
3. Click "Visit" to see your live API

### Your API URL

Your API will be available at:

```
https://your-project-name.vercel.app/api/circulating-supply
```

For example:
```
https://trevee-supply-api.vercel.app/api/circulating-supply
```

## Method 2: Deploy with Vercel CLI

### Step 1: Install Vercel CLI

```bash
npm install -g vercel
```

### Step 2: Login

```bash
vercel login
```

Follow the prompts to login with your GitHub account.

### Step 3: Deploy

```bash
cd /path/to/trevee-supply-api

# Deploy to preview
vercel

# Deploy to production
vercel --prod
```

### Step 4: Add Environment Variables

```bash
# Add Alchemy API key
vercel env add ALCHEMY_API_KEY production

# Enter your API key when prompted
# Paste: your_alchemy_api_key_here
```

### Step 5: Redeploy

```bash
vercel --prod
```

## Testing Your Deployment

### Test Circulating Supply (CoinGecko Endpoint)

```bash
curl https://your-project.vercel.app/api/circulating-supply
```

**Expected output**: Plain number like `1000000000` (no JSON, no quotes)

### Test Content-Type Header

```bash
curl -I https://your-project.vercel.app/api/circulating-supply
```

**Expected**: `content-type: text/plain`

### Test Detailed Endpoint

```bash
curl https://your-project.vercel.app/api/circulating-supply/detailed
```

**Expected**: JSON with per-chain breakdown

### Test Health

```bash
curl https://your-project.vercel.app/health
```

## Monitoring

### View Logs

1. Go to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Click on your project
3. Go to "Logs" tab
4. Real-time logs appear here

### View Analytics

1. Go to your project dashboard
2. Click "Analytics" tab
3. See request counts, response times, errors

### View Function Metrics

1. Go to "Functions" tab
2. See invocation counts per function
3. See average execution time
4. See error rates

## Automatic Deployments

Every time you push to GitHub, Vercel automatically:
1. Detects the push
2. Runs `npm install`
3. Deploys the new version
4. Makes it live instantly

**Preview deployments**: Every pull request gets its own preview URL

**Production deployments**: Pushes to `main` branch deploy to production

## Custom Domain (Optional)

### Add a Custom Domain

1. Go to your project settings
2. Click "Domains"
3. Click "Add"
4. Enter your domain (e.g., `api.yourdomain.com`)
5. Follow DNS configuration instructions

Vercel automatically provides:
- ✅ Free SSL certificate
- ✅ Automatic renewals
- ✅ Global CDN

Your CoinGecko URL would be:
```
https://api.yourdomain.com/api/circulating-supply
```

## Environment Variables

### Add More Variables

You can add custom RPC endpoints:

```bash
# Ethereum RPC
vercel env add ETHEREUM_RPC_URL production
# Enter: https://eth-mainnet.g.alchemy.com/v2/your_key

# Sonic RPC
vercel env add SONIC_RPC_URL production
# Enter: https://rpc.soniclabs.com

# Plasma RPC
vercel env add PLASMA_RPC_URL production
# Enter: https://rpc.plasma.to
```

After adding variables, redeploy:
```bash
vercel --prod
```

## Caching

Vercel automatically caches responses:

- **Fresh cache**: 60 seconds (instant response)
- **Stale cache**: 300 seconds (serve stale while refreshing)
- **Cache headers**: Automatically added by Vercel Edge

This is configured in each API function:
```javascript
res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
```

## Limits on Free Tier

Vercel Free tier includes:
- ✅ 100GB bandwidth per month
- ✅ 100 hours serverless function execution
- ✅ Unlimited deployments
- ✅ Unlimited team members
- ✅ Automatic HTTPS

This is **more than enough** for a CoinGecko supply API.

## Troubleshooting

### Deployment Failed

**Check build logs**:
1. Go to your project dashboard
2. Click on failed deployment
3. View build logs
4. Look for error messages

**Common issues**:
- Missing dependencies in `package.json`
- Syntax errors in code
- Environment variables not set

### API Returns Error

**Check function logs**:
1. Go to project → Logs
2. Filter by function name
3. Look for error stack traces

**Common issues**:
- RPC endpoint timeouts
- Missing environment variables
- Invalid token address

### Wrong Response Format

**Verify Content-Type**:
```bash
curl -I https://your-project.vercel.app/api/circulating-supply
```

Should show: `content-type: text/plain`

If it shows JSON, there's a configuration issue.

## Submit to CoinGecko

Once deployed on Vercel:

1. **Test your endpoint**:
   ```bash
   curl https://your-project.vercel.app/api/circulating-supply
   ```

2. **Verify it returns plain text** (not JSON)

3. **Check response time** (should be < 5 seconds)

4. **Submit to CoinGecko** with your URL:
   ```
   https://your-project.vercel.app/api/circulating-supply
   ```

5. **CoinGecko will verify**:
   - ✅ HTTPS enabled (Vercel provides this)
   - ✅ Plain text response (configured)
   - ✅ Fast response time (Vercel CDN)
   - ✅ High uptime (Vercel SLA)

## Next Steps

After successful deployment:

1. ✅ **Monitor your API** - Check Vercel analytics daily
2. ✅ **Set up alerts** - Use Vercel notifications for errors
3. ✅ **Test periodically** - Run automated tests weekly
4. ✅ **Keep updated** - Pull latest changes from GitHub

## Support

- **Vercel Docs**: https://vercel.com/docs
- **Vercel Support**: https://vercel.com/support
- **Project GitHub**: https://github.com/Figu3/trevee-supply-api

---

**Ready to deploy?** Just push to GitHub and let Vercel handle the rest! 🚀

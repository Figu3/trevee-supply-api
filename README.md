# TREVEE Multi-Chain Supply API

![Node.js](https://img.shields.io/badge/Node.js-18+-green) ![License](https://img.shields.io/badge/license-MIT-blue) ![CoinGecko](https://img.shields.io/badge/CoinGecko-Compatible-orange)

Production-ready API for tracking TREVEE token's circulating supply across Ethereum, Sonic, and Plasma blockchains. Built specifically to meet CoinGecko's strict API requirements.

## Features

- ✅ **CoinGecko Compatible** - Returns plain text numbers as required by CoinGecko
- 🚀 **Multi-Chain Support** - Tracks TREVEE across Ethereum, Sonic, and Plasma
- ⚡ **High Performance** - 60-second caching with stale-while-revalidate strategy
- 🔄 **Reliable** - Retry logic with exponential backoff and fallback RPC endpoints
- 📊 **Detailed Analytics** - Comprehensive breakdown endpoint for debugging
- 🐳 **Docker Ready** - Easy deployment with Docker and Docker Compose
- 🏥 **Health Monitoring** - Built-in health check endpoint

## Quick Start

### Installation

```bash
# Clone or download the project
cd trevee-supply-api

# Install dependencies
npm install

# Run the enhanced version (recommended)
npm start

# Or run the basic version
npm run start:basic
```

The API will be available at `http://localhost:3000`

### Testing

```bash
# Run automated tests
npm test
```

## API Endpoints

### For CoinGecko

#### `GET /api/circulating-supply`

Returns the total circulating supply across all chains as plain text.

**Response Format**: `text/plain`

**Example**:
```bash
curl http://localhost:3000/api/circulating-supply
# Output: 1000000000
```

#### `GET /api/total-supply`

Returns the total supply across all chains as plain text.

**Response Format**: `text/plain`

**Example**:
```bash
curl http://localhost:3000/api/total-supply
# Output: 1000000000
```

### For Debugging

#### `GET /api/circulating-supply/detailed`

Returns detailed breakdown by chain in JSON format.

**Response Format**: `application/json`

**Example**:
```bash
curl http://localhost:3000/api/circulating-supply/detailed
```

**Response**:
```json
{
  "timestamp": "2025-01-15T12:00:00.000Z",
  "fetchDuration": 2543,
  "tokenAddress": "0xe90FE2DE4A415aD48B6DcEc08bA6ae98231948Ac",
  "chains": {
    "ethereum": {
      "totalSupply": "500000000",
      "excludedBalance": "50000000",
      "circulatingSupply": "450000000"
    },
    "sonic": {
      "totalSupply": "300000000",
      "excludedBalance": "30000000",
      "circulatingSupply": "270000000"
    },
    "plasma": {
      "totalSupply": "200000000",
      "excludedBalance": "20000000",
      "circulatingSupply": "180000000"
    }
  },
  "totals": {
    "totalSupply": "1000000000",
    "excludedBalance": "100000000",
    "circulatingSupply": "900000000",
    "decimals": 18
  },
  "excludedAddresses": [...]
}
```

#### `GET /health`

Health check endpoint for monitoring.

**Response Format**: `application/json`

**Example Response**:
```json
{
  "status": "healthy",
  "uptime": 3600,
  "timestamp": "2025-01-15T12:00:00.000Z",
  "version": "1.0.0 (enhanced)",
  "cache": {
    "circulating": {
      "hasValue": true,
      "age": "45s",
      "status": "HIT"
    }
  }
}
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
cp .env.example .env
```

Edit `.env`:

```bash
# Server port (default: 3000)
PORT=3000

# Ethereum RPC (recommended: use Alchemy for better reliability)
ALCHEMY_API_KEY=your_alchemy_api_key_here

# Or use custom RPC URLs
# ETHEREUM_RPC_URL=https://eth-mainnet.g.alchemy.com/v2/your_key
# SONIC_RPC_URL=https://rpc.soniclabs.com
# PLASMA_RPC_URL=https://rpc.plasma.to
```

### Excluded Addresses

The following addresses are excluded from circulating supply:

**Burn Addresses:**
- `0x0000000000000000000000000000000000000000` (Zero address)
- `0x000000000000000000000000000000000000dEaD` (Dead address)

**DAO Treasuries:**
- `0x1Ae6DCBc88d6f81A7BCFcCC7198397D776F3592E` (Ethereum DAO)
- `0xE2a7De3C3190AFd79C49C8E8f2Fa30Ca78B97DFd` (Sonic DAO)
- `0x7481b40c3453D0b5D9b8f82427c77C2eCAd397d1` (Plasma DAO)

**Migration Contract:**
- `0x7481b40c3453D0b5D9b8f82427c77C2eCAd397d1` (Migration contract)

To add more excluded addresses, edit the `EXCLUDED_ADDRESSES` array in the API files.

## Deployment

### Option 1: Node.js (VPS, Cloud Server)

```bash
# Install dependencies
npm install

# Start with PM2 for auto-restart
npm install -g pm2
pm2 start trevee-supply-api-enhanced.js --name trevee-api
pm2 save
pm2 startup
```

### Option 2: Docker

```bash
# Build the Docker image
docker build -t trevee-supply-api .

# Run the container
docker run -d \
  --name trevee-api \
  -p 3000:3000 \
  --restart unless-stopped \
  trevee-supply-api
```

### Option 3: Docker Compose (Recommended)

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Option 4: Cloud Platforms

#### Heroku
```bash
# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set ALCHEMY_API_KEY=your_key

# Deploy
git push heroku main
```

#### Railway
1. Connect your GitHub repository
2. Add environment variables in dashboard
3. Deploy automatically

#### Render
1. Connect repository
2. Select Node.js environment
3. Set start command: `npm start`
4. Add environment variables

## HTTPS Setup (Required for Production)

CoinGecko requires HTTPS. Options:

### Nginx Reverse Proxy

```nginx
server {
    listen 443 ssl;
    server_name api.yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Cloudflare

1. Add your domain to Cloudflare
2. Enable SSL/TLS (Full or Strict mode)
3. Point DNS A record to your server IP
4. Cloudflare automatically provides HTTPS

### Let's Encrypt (Certbot)

```bash
# Install certbot
sudo apt-get install certbot

# Get certificate
sudo certbot certonly --standalone -d api.yourdomain.com
```

## CoinGecko Submission

### Pre-Submission Checklist

Before submitting to CoinGecko, ensure:

- ✅ `/api/circulating-supply` returns plain text number (not JSON)
- ✅ Content-Type is `text/plain`
- ✅ No quotes around the number
- ✅ Response time < 5 seconds
- ✅ API is publicly accessible (no authentication)
- ✅ HTTPS is enabled
- ✅ Server has 99%+ uptime

### How to Submit

1. **Deploy your API** with HTTPS

2. **Test the endpoint** from multiple locations:
   ```bash
   curl https://api.yourdomain.com/api/circulating-supply
   ```

3. **Go to CoinGecko** (for coin teams):
   - Visit: https://www.coingecko.com/
   - Contact CoinGecko team through their official channels
   - Provide your API URL: `https://api.yourdomain.com/api/circulating-supply`

4. **Provide the following information**:
   - Circulating Supply URL: `https://api.yourdomain.com/api/circulating-supply`
   - Total Supply URL: `https://api.yourdomain.com/api/total-supply` (optional)
   - Response format: Plain text number

### Testing Your Endpoint

Run the test suite:

```bash
npm test
```

This will verify:
- Correct response format (plain text)
- Content-Type headers
- Response time
- Value validity
- CoinGecko compliance

## Performance

### Caching Strategy

The enhanced version uses a sophisticated caching strategy:

- **Fresh Cache**: 0-60 seconds - Instant response from cache
- **Stale Cache**: 60-300 seconds - Serve stale data while refreshing in background
- **Cache Miss**: > 300 seconds - Fetch fresh data

This ensures:
- ⚡ Sub-50ms response time (with cache)
- 🔄 Always-available data (stale-while-revalidate)
- 💰 Reduced RPC costs

### Response Times

- **First request** (cold start): 2-5 seconds
- **Cached requests**: 20-50ms
- **Stale requests**: 20-50ms (background refresh)

### RPC Endpoint Fallbacks

The enhanced version includes fallback RPC endpoints:

**Ethereum**: Alchemy → LlamaRPC → Ankr → PublicNode

**Sonic**: Custom → Official RPC

**Plasma**: Custom → Official → dRPC

## Monitoring

### Health Checks

Check API health:

```bash
curl http://localhost:3000/health
```

### Cache Status

The enhanced version adds `X-Cache` headers to responses:
- `HIT` - Served from fresh cache
- `STALE` - Served from stale cache (refreshing in background)
- `MISS` - Fetched fresh data
- `ERROR-FALLBACK` - Error occurred, serving old cache

### Uptime Monitoring

Use services like:
- **UptimeRobot** (free): https://uptimerobot.com
- **Pingdom**: https://www.pingdom.com
- **StatusCake**: https://www.statuscake.com

Set up alerts for:
- API downtime
- Response time > 5 seconds
- HTTP errors

## Troubleshooting

### API Returns "0"

**Cause**: RPC endpoints are failing or unreachable

**Solution**:
1. Check your internet connection
2. Verify RPC endpoints are accessible
3. Add ALCHEMY_API_KEY to `.env` for better reliability
4. Check logs for specific error messages

### Slow Response Times

**Cause**: Cold cache or slow RPC endpoints

**Solution**:
1. Use the enhanced version (caching)
2. Add custom RPC endpoints in `.env`
3. Use Alchemy or Infura for Ethereum
4. Warm up cache with initial request

### CoinGecko Rejection

**Cause**: API doesn't meet requirements

**Solution**:
1. Run `npm test` to verify compliance
2. Ensure response is plain text (not JSON)
3. Check Content-Type is `text/plain`
4. Verify HTTPS is working
5. Test from external location (not localhost)

### Docker Build Fails

**Cause**: Missing dependencies or wrong Node version

**Solution**:
```bash
# Clean build
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

## Architecture

### Basic Version (`trevee-supply-api.js`)

- Simple implementation
- No caching
- Direct RPC queries
- ~200 lines of code
- Good for understanding the logic

### Enhanced Version (`trevee-supply-api-enhanced.js`)

- Production-ready
- 60-second caching with stale-while-revalidate
- Retry logic with exponential backoff
- Fallback RPC endpoints
- X-Cache headers
- ~400 lines of code
- **Recommended for production**

## Security

- ✅ Non-root Docker user
- ✅ No sensitive data in responses
- ✅ No authentication required (public API)
- ✅ Rate limiting recommended (via reverse proxy)
- ✅ HTTPS required for production

## FAQ

**Q: Why plain text instead of JSON?**
A: CoinGecko specifically requires plain text numbers. JSON responses will be rejected.

**Q: How often should I refresh the cache?**
A: 60 seconds is optimal. Longer = fewer RPC calls but staler data. Shorter = more accurate but more expensive.

**Q: Can I add more chains?**
A: Yes! Edit the RPC_ENDPOINTS and query logic in the API files.

**Q: What if one chain is down?**
A: The API continues with other chains. Failed chains return 0 for that portion.

**Q: Do I need my own RPC endpoints?**
A: Not required, but recommended for production for better reliability and performance.

## Support

For issues or questions:
1. Check this README
2. Run `npm test` to diagnose issues
3. Check server logs for error messages
4. Verify RPC endpoints are accessible

## License

MIT License - feel free to use for any purpose.

---

**Built for TREVEE token** - Multi-chain circulating supply tracking made simple.

/**
 * TREVEE Multi-Chain Supply API - Enhanced Production Version
 *
 * Production-ready implementation with:
 * - 60-second caching for performance
 * - Retry logic with exponential backoff
 * - Fallback RPC endpoints
 * - Comprehensive error handling
 * - Response time monitoring
 * - X-Cache headers (HIT/MISS/STALE)
 *
 * CoinGecko-compatible endpoints:
 * - GET /api/circulating-supply (returns plain text number)
 * - GET /api/total-supply (returns plain text number)
 * - GET /api/circulating-supply/detailed (returns JSON breakdown)
 */

const express = require('express');
const { ethers } = require('ethers');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================================
// CONFIGURATION
// ============================================================================

// TREVEE Token Configuration
const TOKEN_ADDRESS = '0xe90FE2DE4A415aD48B6DcEc08bA6ae98231948Ac';

// RPC Endpoints with fallbacks
const RPC_ENDPOINTS = {
  ethereum: [
    process.env.ETHEREUM_RPC_URL ||
      (process.env.ALCHEMY_API_KEY
        ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
        : null),
    'https://eth.llamarpc.com',
    'https://rpc.ankr.com/eth',
    'https://ethereum.publicnode.com'
  ].filter(Boolean),

  sonic: [
    process.env.SONIC_RPC_URL,
    'https://rpc.soniclabs.com'
  ].filter(Boolean),

  plasma: [
    process.env.PLASMA_RPC_URL,
    'https://rpc.plasma.to',
    'https://plasma.drpc.org'
  ].filter(Boolean)
};

// Excluded addresses (DAO treasuries, migration contract, burn addresses)
const EXCLUDED_ADDRESSES = [
  // Burn addresses
  '0x0000000000000000000000000000000000000000', // Zero address
  '0x000000000000000000000000000000000000dEaD', // Dead address

  // DAO Treasuries
  '0x1Ae6DCBc88d6f81A7BCFcCC7198397D776F3592E', // Ethereum DAO
  '0xE2a7De3C3190AFd79C49C8E8f2Fa30Ca78B97DFd', // Sonic DAO
  '0x7481b40c3453D0b5D9b8f82427c77C2eCAd397d1', // Plasma DAO

  // Migration Contract
  '0x7481b40c3453D0b5D9b8f82427c77C2eCAd397d1'  // Migration contract (Plasma)
];

// Standard ERC20 ABI
const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
];

// Cache configuration
const CACHE_TTL = 60000; // 60 seconds
const STALE_WHILE_REVALIDATE = 300000; // 5 minutes (serve stale data while fetching new)

let cache = {
  circulating: { value: null, timestamp: 0, error: null },
  total: { value: null, timestamp: 0, error: null },
  detailed: { value: null, timestamp: 0, error: null }
};

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second base delay

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Sleep for a specified duration
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;

      const delay = RETRY_DELAY * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${retries} after ${delay}ms...`);
      await sleep(delay);
    }
  }
}

/**
 * Try multiple RPC endpoints until one succeeds
 */
async function tryRPCEndpoints(rpcUrls, fn) {
  let lastError;

  for (const rpcUrl of rpcUrls) {
    try {
      return await fn(rpcUrl);
    } catch (error) {
      console.warn(`RPC endpoint ${rpcUrl} failed:`, error.message);
      lastError = error;
    }
  }

  throw lastError || new Error('All RPC endpoints failed');
}

/**
 * Check if cache is fresh
 */
function isCacheFresh(cacheKey) {
  const cached = cache[cacheKey];
  if (!cached || !cached.value) return false;

  const age = Date.now() - cached.timestamp;
  return age < CACHE_TTL;
}

/**
 * Check if cache is stale but usable
 */
function isCacheStale(cacheKey) {
  const cached = cache[cacheKey];
  if (!cached || !cached.value) return false;

  const age = Date.now() - cached.timestamp;
  return age >= CACHE_TTL && age < STALE_WHILE_REVALIDATE;
}

/**
 * Get cache status
 */
function getCacheStatus(cacheKey) {
  if (isCacheFresh(cacheKey)) return 'HIT';
  if (isCacheStale(cacheKey)) return 'STALE';
  return 'MISS';
}

/**
 * Update cache
 */
function updateCache(cacheKey, value) {
  cache[cacheKey] = {
    value,
    timestamp: Date.now(),
    error: null
  };
}

/**
 * Get cached value or null
 */
function getCachedValue(cacheKey) {
  const cached = cache[cacheKey];
  if (!cached || !cached.value) return null;
  return cached.value;
}

// ============================================================================
// BLOCKCHAIN QUERY FUNCTIONS
// ============================================================================

/**
 * Get total supply for a chain
 */
async function getTotalSupply(rpcUrl, tokenAddress) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const totalSupply = await contract.totalSupply();
  return totalSupply;
}

/**
 * Get total balance of excluded addresses on a chain
 */
async function getExcludedBalance(rpcUrl, tokenAddress, excludedAddresses) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

  // Query all excluded addresses in parallel
  const balancePromises = excludedAddresses.map(addr =>
    contract.balanceOf(addr)
  );

  const balances = await Promise.all(balancePromises);

  // Sum all excluded balances
  const totalExcluded = balances.reduce((sum, balance) => sum + balance, 0n);
  return totalExcluded;
}

/**
 * Get decimals for the token
 */
async function getDecimals(rpcUrl, tokenAddress) {
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
  const decimals = await contract.decimals();
  return decimals;
}

/**
 * Get circulating supply for a specific chain with retries and fallbacks
 */
async function getCirculatingSupplyForChain(chainName, rpcUrls) {
  console.log(`Fetching data for ${chainName}...`);

  return await retryWithBackoff(async () => {
    return await tryRPCEndpoints(rpcUrls, async (rpcUrl) => {
      const totalSupply = await getTotalSupply(rpcUrl, TOKEN_ADDRESS);
      const excludedBalance = await getExcludedBalance(rpcUrl, TOKEN_ADDRESS, EXCLUDED_ADDRESSES);
      const circulatingSupply = totalSupply - excludedBalance;

      return {
        chain: chainName,
        totalSupply,
        excludedBalance,
        circulatingSupply
      };
    });
  });
}

/**
 * Get circulating supply across all chains
 */
async function getAllChainsCirculatingSupply() {
  const startTime = Date.now();
  console.log('Fetching circulating supply from all chains...');

  // Query all chains in parallel
  const [ethereum, sonic, plasma] = await Promise.all([
    getCirculatingSupplyForChain('Ethereum', RPC_ENDPOINTS.ethereum),
    getCirculatingSupplyForChain('Sonic', RPC_ENDPOINTS.sonic),
    getCirculatingSupplyForChain('Plasma', RPC_ENDPOINTS.plasma)
  ]);

  // Get decimals (should be same on all chains, use Ethereum)
  const decimals = await retryWithBackoff(async () => {
    return await tryRPCEndpoints(RPC_ENDPOINTS.ethereum, async (rpcUrl) => {
      return await getDecimals(rpcUrl, TOKEN_ADDRESS);
    });
  });

  // Calculate totals
  const totalCirculating = ethereum.circulatingSupply + sonic.circulatingSupply + plasma.circulatingSupply;
  const totalSupply = ethereum.totalSupply + sonic.totalSupply + plasma.totalSupply;
  const totalExcluded = ethereum.excludedBalance + sonic.excludedBalance + plasma.excludedBalance;

  const duration = Date.now() - startTime;
  console.log(`Data fetched in ${duration}ms`);

  return {
    chains: { ethereum, sonic, plasma },
    totals: {
      circulatingSupply: totalCirculating,
      totalSupply: totalSupply,
      excludedBalance: totalExcluded,
      decimals: Number(decimals)
    },
    metadata: {
      fetchDuration: duration,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Format bigint to human-readable number (without decimals)
 */
function formatSupply(supplyBigInt, decimals) {
  return ethers.formatUnits(supplyBigInt, decimals);
}

// ============================================================================
// API ENDPOINTS
// ============================================================================

/**
 * GET /api/circulating-supply
 * CoinGecko endpoint - Returns PLAIN TEXT number only
 * With caching and stale-while-revalidate
 */
app.get('/api/circulating-supply', async (req, res) => {
  const cacheStatus = getCacheStatus('circulating');

  // If cache is fresh, return immediately
  if (cacheStatus === 'HIT') {
    const cached = getCachedValue('circulating');
    res.set('Content-Type', 'text/plain');
    res.set('X-Cache', 'HIT');
    res.set('X-Cache-Age', `${Math.floor((Date.now() - cache.circulating.timestamp) / 1000)}s`);
    return res.send(cached);
  }

  // If cache is stale, serve stale data and refresh in background
  if (cacheStatus === 'STALE') {
    const cached = getCachedValue('circulating');
    res.set('Content-Type', 'text/plain');
    res.set('X-Cache', 'STALE');
    res.set('X-Cache-Age', `${Math.floor((Date.now() - cache.circulating.timestamp) / 1000)}s`);

    // Refresh cache in background (fire and forget)
    getAllChainsCirculatingSupply()
      .then(data => {
        const circulatingSupply = formatSupply(
          data.totals.circulatingSupply,
          data.totals.decimals
        );
        updateCache('circulating', circulatingSupply);
        updateCache('total', formatSupply(data.totals.totalSupply, data.totals.decimals));
        updateCache('detailed', data);
        console.log('Background cache refresh completed');
      })
      .catch(error => {
        console.error('Background cache refresh failed:', error);
      });

    return res.send(cached);
  }

  // Cache miss - fetch fresh data
  try {
    const data = await getAllChainsCirculatingSupply();
    const circulatingSupply = formatSupply(
      data.totals.circulatingSupply,
      data.totals.decimals
    );

    // Update all caches
    updateCache('circulating', circulatingSupply);
    updateCache('total', formatSupply(data.totals.totalSupply, data.totals.decimals));
    updateCache('detailed', data);

    res.set('Content-Type', 'text/plain');
    res.set('X-Cache', 'MISS');
    res.send(circulatingSupply);
  } catch (error) {
    console.error('Error fetching circulating supply:', error);

    // Try to serve stale cache if available
    const cachedValue = getCachedValue('circulating');
    if (cachedValue) {
      res.set('Content-Type', 'text/plain');
      res.set('X-Cache', 'ERROR-FALLBACK');
      return res.send(cachedValue);
    }

    // No cache available, return 0
    res.status(500).set('Content-Type', 'text/plain').send('0');
  }
});

/**
 * GET /api/total-supply
 * CoinGecko endpoint - Returns PLAIN TEXT number only
 */
app.get('/api/total-supply', async (req, res) => {
  const cacheStatus = getCacheStatus('total');

  if (cacheStatus === 'HIT') {
    const cached = getCachedValue('total');
    res.set('Content-Type', 'text/plain');
    res.set('X-Cache', 'HIT');
    return res.send(cached);
  }

  if (cacheStatus === 'STALE') {
    const cached = getCachedValue('total');
    res.set('Content-Type', 'text/plain');
    res.set('X-Cache', 'STALE');

    // Refresh in background
    getAllChainsCirculatingSupply()
      .then(data => {
        updateCache('circulating', formatSupply(data.totals.circulatingSupply, data.totals.decimals));
        updateCache('total', formatSupply(data.totals.totalSupply, data.totals.decimals));
        updateCache('detailed', data);
      })
      .catch(error => console.error('Background refresh failed:', error));

    return res.send(cached);
  }

  try {
    const data = await getAllChainsCirculatingSupply();
    const totalSupply = formatSupply(data.totals.totalSupply, data.totals.decimals);

    updateCache('circulating', formatSupply(data.totals.circulatingSupply, data.totals.decimals));
    updateCache('total', totalSupply);
    updateCache('detailed', data);

    res.set('Content-Type', 'text/plain');
    res.set('X-Cache', 'MISS');
    res.send(totalSupply);
  } catch (error) {
    console.error('Error fetching total supply:', error);

    const cachedValue = getCachedValue('total');
    if (cachedValue) {
      res.set('Content-Type', 'text/plain');
      res.set('X-Cache', 'ERROR-FALLBACK');
      return res.send(cachedValue);
    }

    res.status(500).set('Content-Type', 'text/plain').send('0');
  }
});

/**
 * GET /api/circulating-supply/detailed
 * Debugging endpoint - Returns JSON with per-chain breakdown
 */
app.get('/api/circulating-supply/detailed', async (req, res) => {
  const cacheStatus = getCacheStatus('detailed');

  if (cacheStatus === 'HIT' || cacheStatus === 'STALE') {
    const cached = getCachedValue('detailed');
    if (cached) {
      const response = formatDetailedResponse(cached);
      res.set('X-Cache', cacheStatus);
      return res.json(response);
    }
  }

  try {
    const data = await getAllChainsCirculatingSupply();
    updateCache('detailed', data);

    const response = formatDetailedResponse(data);
    res.set('X-Cache', 'MISS');
    res.json(response);
  } catch (error) {
    console.error('Error fetching detailed supply:', error);
    res.status(500).json({ error: error.message });
  }
});

function formatDetailedResponse(data) {
  return {
    timestamp: data.metadata?.timestamp || new Date().toISOString(),
    fetchDuration: data.metadata?.fetchDuration,
    tokenAddress: TOKEN_ADDRESS,
    chains: {
      ethereum: {
        totalSupply: formatSupply(data.chains.ethereum.totalSupply, data.totals.decimals),
        excludedBalance: formatSupply(data.chains.ethereum.excludedBalance, data.totals.decimals),
        circulatingSupply: formatSupply(data.chains.ethereum.circulatingSupply, data.totals.decimals)
      },
      sonic: {
        totalSupply: formatSupply(data.chains.sonic.totalSupply, data.totals.decimals),
        excludedBalance: formatSupply(data.chains.sonic.excludedBalance, data.totals.decimals),
        circulatingSupply: formatSupply(data.chains.sonic.circulatingSupply, data.totals.decimals)
      },
      plasma: {
        totalSupply: formatSupply(data.chains.plasma.totalSupply, data.totals.decimals),
        excludedBalance: formatSupply(data.chains.plasma.excludedBalance, data.totals.decimals),
        circulatingSupply: formatSupply(data.chains.plasma.circulatingSupply, data.totals.decimals)
      }
    },
    totals: {
      totalSupply: formatSupply(data.totals.totalSupply, data.totals.decimals),
      excludedBalance: formatSupply(data.totals.excludedBalance, data.totals.decimals),
      circulatingSupply: formatSupply(data.totals.circulatingSupply, data.totals.decimals),
      decimals: data.totals.decimals
    },
    excludedAddresses: EXCLUDED_ADDRESSES,
    cache: {
      circulatingAge: cache.circulating.timestamp ? `${Math.floor((Date.now() - cache.circulating.timestamp) / 1000)}s` : 'none',
      totalAge: cache.total.timestamp ? `${Math.floor((Date.now() - cache.total.timestamp) / 1000)}s` : 'none',
      detailedAge: cache.detailed.timestamp ? `${Math.floor((Date.now() - cache.detailed.timestamp) / 1000)}s` : 'none'
    }
  };
}

/**
 * POST /api/cache/clear
 * Clear all caches (useful for testing)
 */
app.post('/api/cache/clear', (req, res) => {
  cache = {
    circulating: { value: null, timestamp: 0, error: null },
    total: { value: null, timestamp: 0, error: null },
    detailed: { value: null, timestamp: 0, error: null }
  };

  res.json({
    success: true,
    message: 'Cache cleared',
    timestamp: new Date().toISOString()
  });
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    version: '1.0.0 (enhanced)',
    cache: {
      circulating: {
        hasValue: !!cache.circulating.value,
        age: cache.circulating.timestamp ? `${Math.floor((Date.now() - cache.circulating.timestamp) / 1000)}s` : 'none',
        status: getCacheStatus('circulating')
      },
      total: {
        hasValue: !!cache.total.value,
        age: cache.total.timestamp ? `${Math.floor((Date.now() - cache.total.timestamp) / 1000)}s` : 'none',
        status: getCacheStatus('total')
      }
    }
  });
});

/**
 * GET /
 * Root endpoint with API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'TREVEE Multi-Chain Supply API',
    version: '1.0.0 (enhanced)',
    features: [
      '60-second caching',
      'Retry logic with exponential backoff',
      'Fallback RPC endpoints',
      'Stale-while-revalidate strategy',
      'X-Cache headers'
    ],
    endpoints: {
      circulatingSupply: '/api/circulating-supply',
      totalSupply: '/api/total-supply',
      detailed: '/api/circulating-supply/detailed',
      health: '/health',
      cacheClear: 'POST /api/cache/clear'
    },
    documentation: 'See README.md for full documentation'
  });
});

// ============================================================================
// SERVER START & GRACEFUL SHUTDOWN
// ============================================================================

const server = app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('TREVEE Multi-Chain Supply API (Enhanced Version)');
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  - Circulating Supply: http://localhost:${PORT}/api/circulating-supply`);
  console.log(`  - Total Supply:       http://localhost:${PORT}/api/total-supply`);
  console.log(`  - Detailed:           http://localhost:${PORT}/api/circulating-supply/detailed`);
  console.log(`  - Health:             http://localhost:${PORT}/health`);
  console.log(`\nFeatures:`);
  console.log(`  - Cache TTL: ${CACHE_TTL / 1000}s`);
  console.log(`  - Stale TTL: ${STALE_WHILE_REVALIDATE / 1000}s`);
  console.log(`  - Max Retries: ${MAX_RETRIES}`);
  console.log(`  - Fallback RPCs: Yes`);
  console.log(`\nToken: ${TOKEN_ADDRESS}`);
  console.log(`Chains: Ethereum, Sonic, Plasma`);
  console.log(`Excluded Addresses: ${EXCLUDED_ADDRESSES.length}`);
  console.log('='.repeat(60));
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

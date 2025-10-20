/**
 * TREVEE Multi-Chain Supply API - Basic Version
 *
 * This is a simple implementation for tracking TREVEE token's circulating supply
 * across Ethereum, Sonic, and Plasma blockchains.
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

// TREVEE Token Configuration
const TOKEN_ADDRESS = '0xe90FE2DE4A415aD48B6DcEc08bA6ae98231948Ac';

// RPC Endpoints for each chain
const RPC_ENDPOINTS = {
  ethereum: process.env.ETHEREUM_RPC_URL ||
    (process.env.ALCHEMY_API_KEY
      ? `https://eth-mainnet.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`
      : 'https://eth.llamarpc.com'),
  sonic: process.env.SONIC_RPC_URL || 'https://rpc.soniclabs.com',
  plasma: process.env.PLASMA_RPC_URL || 'https://rpc.plasma.to'
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
 * Get circulating supply for a specific chain
 */
async function getCirculatingSupplyForChain(chainName, rpcUrl) {
  console.log(`Fetching data for ${chainName}...`);

  const totalSupply = await getTotalSupply(rpcUrl, TOKEN_ADDRESS);
  const excludedBalance = await getExcludedBalance(rpcUrl, TOKEN_ADDRESS, EXCLUDED_ADDRESSES);
  const circulatingSupply = totalSupply - excludedBalance;

  return {
    chain: chainName,
    totalSupply,
    excludedBalance,
    circulatingSupply
  };
}

/**
 * Get circulating supply across all chains
 */
async function getAllChainsCirculatingSupply() {
  console.log('Fetching circulating supply from all chains...');

  // Query all chains in parallel
  const [ethereum, sonic, plasma] = await Promise.all([
    getCirculatingSupplyForChain('Ethereum', RPC_ENDPOINTS.ethereum),
    getCirculatingSupplyForChain('Sonic', RPC_ENDPOINTS.sonic),
    getCirculatingSupplyForChain('Plasma', RPC_ENDPOINTS.plasma)
  ]);

  // Get decimals (should be same on all chains)
  const decimals = await getDecimals(RPC_ENDPOINTS.ethereum, TOKEN_ADDRESS);

  // Calculate totals
  const totalCirculating = ethereum.circulatingSupply + sonic.circulatingSupply + plasma.circulatingSupply;
  const totalSupply = ethereum.totalSupply + sonic.totalSupply + plasma.totalSupply;
  const totalExcluded = ethereum.excludedBalance + sonic.excludedBalance + plasma.excludedBalance;

  return {
    chains: { ethereum, sonic, plasma },
    totals: {
      circulatingSupply: totalCirculating,
      totalSupply: totalSupply,
      excludedBalance: totalExcluded,
      decimals: Number(decimals)
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
 */
app.get('/api/circulating-supply', async (req, res) => {
  try {
    const data = await getAllChainsCirculatingSupply();
    const circulatingSupply = formatSupply(
      data.totals.circulatingSupply,
      data.totals.decimals
    );

    // CRITICAL: Must return plain text, not JSON
    res.set('Content-Type', 'text/plain');
    res.send(circulatingSupply);
  } catch (error) {
    console.error('Error fetching circulating supply:', error);
    res.status(500).set('Content-Type', 'text/plain').send('0');
  }
});

/**
 * GET /api/total-supply
 * CoinGecko endpoint - Returns PLAIN TEXT number only
 */
app.get('/api/total-supply', async (req, res) => {
  try {
    const data = await getAllChainsCirculatingSupply();
    const totalSupply = formatSupply(
      data.totals.totalSupply,
      data.totals.decimals
    );

    // CRITICAL: Must return plain text, not JSON
    res.set('Content-Type', 'text/plain');
    res.send(totalSupply);
  } catch (error) {
    console.error('Error fetching total supply:', error);
    res.status(500).set('Content-Type', 'text/plain').send('0');
  }
});

/**
 * GET /api/circulating-supply/detailed
 * Debugging endpoint - Returns JSON with per-chain breakdown
 */
app.get('/api/circulating-supply/detailed', async (req, res) => {
  try {
    const data = await getAllChainsCirculatingSupply();

    // Format response with human-readable numbers
    const response = {
      timestamp: new Date().toISOString(),
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
      excludedAddresses: EXCLUDED_ADDRESSES
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching detailed supply:', error);
    res.status(500).json({ error: error.message });
  }
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
    version: '1.0.0 (basic)'
  });
});

/**
 * GET /
 * Root endpoint with API information
 */
app.get('/', (req, res) => {
  res.json({
    name: 'TREVEE Multi-Chain Supply API',
    version: '1.0.0 (basic)',
    endpoints: {
      circulatingSupply: '/api/circulating-supply',
      totalSupply: '/api/total-supply',
      detailed: '/api/circulating-supply/detailed',
      health: '/health'
    },
    documentation: 'See README.md for full documentation'
  });
});

// ============================================================================
// SERVER START
// ============================================================================

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('TREVEE Multi-Chain Supply API (Basic Version)');
  console.log('='.repeat(60));
  console.log(`Server running on port ${PORT}`);
  console.log(`\nEndpoints:`);
  console.log(`  - Circulating Supply: http://localhost:${PORT}/api/circulating-supply`);
  console.log(`  - Total Supply:       http://localhost:${PORT}/api/total-supply`);
  console.log(`  - Detailed:           http://localhost:${PORT}/api/circulating-supply/detailed`);
  console.log(`  - Health:             http://localhost:${PORT}/health`);
  console.log(`\nToken: ${TOKEN_ADDRESS}`);
  console.log(`Chains: Ethereum, Sonic, Plasma`);
  console.log(`Excluded Addresses: ${EXCLUDED_ADDRESSES.length}`);
  console.log('='.repeat(60));
});

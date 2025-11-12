/**
 * Shared blockchain utilities for Vercel serverless functions
 */

const { ethers } = require('ethers');

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
    'https://rpc.ankr.com/eth'
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

// Excluded addresses
const EXCLUDED_ADDRESSES = [
  '0x0000000000000000000000000000000000000000', // Zero address
  '0x000000000000000000000000000000000000dEaD', // Dead address
  '0x1Ae6DCBc88d6f81A7BCFcCC7198397D776F3592E', // Ethereum DAO
  '0xE2a7De3C3190AFd79C49C8E8f2Fa30Ca78B97DFd', // Sonic DAO
  '0x7481b40c3453D0b5D9b8f82427c77C2eCAd397d1', // Plasma DAO
  '0x99fe40e501151e92f10ac13ea1c06083ee170363', // Migration contract (Sonic)
];

// Standard ERC20 ABI
const ERC20_ABI = [
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function decimals() view returns (uint8)'
];

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 500;

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry with exponential backoff
 */
async function retryWithBackoff(fn, retries = MAX_RETRIES) {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      await sleep(RETRY_DELAY * Math.pow(2, i));
    }
  }
}

/**
 * Try multiple RPC endpoints
 */
async function tryRPCEndpoints(rpcUrls, fn) {
  let lastError;
  for (const rpcUrl of rpcUrls) {
    try {
      return await fn(rpcUrl);
    } catch (error) {
      console.warn(`RPC ${rpcUrl} failed:`, error.message);
      lastError = error;
    }
  }
  throw lastError || new Error('All RPC endpoints failed');
}

/**
 * Get circulating supply for a chain
 */
async function getCirculatingSupplyForChain(chainName, rpcUrls) {
  return await retryWithBackoff(async () => {
    return await tryRPCEndpoints(rpcUrls, async (rpcUrl) => {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);

      // Get total supply
      const totalSupply = await contract.totalSupply();

      // Get excluded balances in parallel
      const balancePromises = EXCLUDED_ADDRESSES.map(addr => contract.balanceOf(addr));
      const balances = await Promise.all(balancePromises);

      // Sum excluded balances
      const excludedBalance = balances.reduce((sum, bal) => sum + bal, 0n);
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
 * Get all chains data
 */
async function getAllChainsCirculatingSupply() {
  const startTime = Date.now();

  // Query all chains in parallel
  const [ethereum, sonic, plasma] = await Promise.all([
    getCirculatingSupplyForChain('Ethereum', RPC_ENDPOINTS.ethereum),
    getCirculatingSupplyForChain('Sonic', RPC_ENDPOINTS.sonic),
    getCirculatingSupplyForChain('Plasma', RPC_ENDPOINTS.plasma)
  ]);

  // Get decimals from Ethereum
  const decimals = await retryWithBackoff(async () => {
    return await tryRPCEndpoints(RPC_ENDPOINTS.ethereum, async (rpcUrl) => {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(TOKEN_ADDRESS, ERC20_ABI, provider);
      return await contract.decimals();
    });
  });

  // Calculate totals
  const totalCirculating = ethereum.circulatingSupply + sonic.circulatingSupply + plasma.circulatingSupply;
  // Use Sonic as canonical source for total supply (50M TREVEE)
  const totalSupply = sonic.totalSupply;
  const totalExcluded = ethereum.excludedBalance + sonic.excludedBalance + plasma.excludedBalance;

  return {
    chains: { ethereum, sonic, plasma },
    totals: {
      circulatingSupply: totalCirculating,
      totalSupply: totalSupply,
      excludedBalance: totalExcluded,
      decimals: Number(decimals)
    },
    metadata: {
      fetchDuration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Format supply to human-readable number
 */
function formatSupply(supplyBigInt, decimals) {
  return ethers.formatUnits(supplyBigInt, decimals);
}

module.exports = {
  TOKEN_ADDRESS,
  EXCLUDED_ADDRESSES,
  getAllChainsCirculatingSupply,
  formatSupply
};

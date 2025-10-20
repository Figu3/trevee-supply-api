/**
 * Vercel Serverless Function: Detailed Supply Data
 * Returns JSON with per-chain breakdown
 */

const { getAllChainsCirculatingSupply, formatSupply, TOKEN_ADDRESS, EXCLUDED_ADDRESSES } = require('./_lib/blockchain');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const data = await getAllChainsCirculatingSupply();

    const response = {
      timestamp: data.metadata.timestamp,
      fetchDuration: data.metadata.fetchDuration,
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

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).json(response);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: error.message });
  }
};

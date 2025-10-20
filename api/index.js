/**
 * Vercel Serverless Function: Root / Index
 */

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  res.status(200).json({
    name: 'TREVEE Multi-Chain Supply API',
    version: '1.0.0 (vercel)',
    platform: 'Vercel Serverless',
    endpoints: {
      circulatingSupply: '/api/circulating-supply',
      totalSupply: '/api/total-supply',
      detailed: '/api/circulating-supply/detailed',
      health: '/health'
    },
    documentation: 'https://github.com/Figu3/trevee-supply-api'
  });
};

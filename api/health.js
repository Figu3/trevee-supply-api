/**
 * Vercel Serverless Function: Health Check
 */

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  res.status(200).json({
    status: 'healthy',
    platform: 'vercel',
    timestamp: new Date().toISOString(),
    version: '1.0.0 (vercel)'
  });
};

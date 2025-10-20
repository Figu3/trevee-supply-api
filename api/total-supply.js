/**
 * Vercel Serverless Function: Total Supply
 * Returns plain text number for CoinGecko
 */

const { getAllChainsCirculatingSupply, formatSupply } = require('./_lib/blockchain');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  if (req.method !== 'GET') {
    return res.status(405).send('Method Not Allowed');
  }

  try {
    const data = await getAllChainsCirculatingSupply();
    const totalSupply = formatSupply(
      data.totals.totalSupply,
      data.totals.decimals
    );

    res.setHeader('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.status(200).send(totalSupply);
  } catch (error) {
    console.error('Error:', error);
    res.setHeader('Content-Type', 'text/plain');
    res.status(500).send('0');
  }
};

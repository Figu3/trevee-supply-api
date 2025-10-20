/**
 * TREVEE Supply API Test Script
 *
 * Automated testing for CoinGecko compliance and API functionality
 *
 * Run with: node test-api.js
 * Or: npm test
 */

const http = require('http');

const API_BASE = process.env.API_URL || 'http://localhost:3000';
const TIMEOUT = 10000; // 10 seconds

// ANSI color codes for prettier output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

// Test results
const results = {
  passed: 0,
  failed: 0,
  warnings: 0
};

/**
 * Make HTTP GET request
 */
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Request timeout'));
    }, TIMEOUT);

    http.get(url, (res) => {
      clearTimeout(timeout);
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data
        });
      });
    }).on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

/**
 * Print test result
 */
function printResult(testName, passed, message = '') {
  if (passed) {
    console.log(`  ${colors.green}✓${colors.reset} ${testName}`);
    results.passed++;
  } else {
    console.log(`  ${colors.red}✗${colors.reset} ${testName}`);
    if (message) console.log(`    ${colors.red}${message}${colors.reset}`);
    results.failed++;
  }
}

/**
 * Print warning
 */
function printWarning(message) {
  console.log(`  ${colors.yellow}⚠${colors.reset} ${message}`);
  results.warnings++;
}

/**
 * Print section header
 */
function printSection(title) {
  console.log(`\n${colors.cyan}━━━ ${title} ━━━${colors.reset}`);
}

/**
 * Test circulating supply endpoint
 */
async function testCirculatingSupply() {
  printSection('Testing /api/circulating-supply');

  try {
    const startTime = Date.now();
    const res = await httpGet(`${API_BASE}/api/circulating-supply`);
    const duration = Date.now() - startTime;

    // Test 1: Status code
    printResult(
      'Returns 200 OK',
      res.statusCode === 200,
      `Got status ${res.statusCode}`
    );

    // Test 2: Content-Type header
    const contentType = res.headers['content-type'];
    printResult(
      'Content-Type is text/plain',
      contentType && contentType.includes('text/plain'),
      `Got Content-Type: ${contentType}`
    );

    // Test 3: Response is plain number
    const body = res.body.trim();
    const isNumber = /^\d+(\.\d+)?$/.test(body);
    printResult(
      'Response is plain number (no JSON, no quotes)',
      isNumber,
      `Got: "${body.substring(0, 50)}${body.length > 50 ? '...' : ''}"`
    );

    // Test 4: Value is valid
    const value = parseFloat(body);
    printResult(
      'Value is valid number (not NaN, not negative)',
      !isNaN(value) && value >= 0,
      `Value: ${value}`
    );

    // Test 5: Response time
    const isFast = duration < 5000;
    printResult(
      `Response time < 5s (${duration}ms)`,
      isFast,
      `Took ${duration}ms`
    );

    if (duration > 1000 && duration < 5000) {
      printWarning(`Response time is ${duration}ms (cache may not be warmed up)`);
    }

    // Test 6: X-Cache header (enhanced version only)
    if (res.headers['x-cache']) {
      console.log(`  ${colors.blue}ℹ${colors.reset} X-Cache: ${res.headers['x-cache']}`);
    }

    console.log(`  ${colors.blue}ℹ${colors.reset} Circulating Supply: ${body}`);

  } catch (error) {
    printResult('Endpoint is accessible', false, error.message);
  }
}

/**
 * Test total supply endpoint
 */
async function testTotalSupply() {
  printSection('Testing /api/total-supply');

  try {
    const res = await httpGet(`${API_BASE}/api/total-supply`);

    printResult('Returns 200 OK', res.statusCode === 200);

    const contentType = res.headers['content-type'];
    printResult(
      'Content-Type is text/plain',
      contentType && contentType.includes('text/plain')
    );

    const body = res.body.trim();
    const isNumber = /^\d+(\.\d+)?$/.test(body);
    printResult(
      'Response is plain number',
      isNumber,
      `Got: "${body.substring(0, 50)}"`
    );

    const value = parseFloat(body);
    printResult(
      'Value is valid number',
      !isNaN(value) && value >= 0
    );

    console.log(`  ${colors.blue}ℹ${colors.reset} Total Supply: ${body}`);

  } catch (error) {
    printResult('Endpoint is accessible', false, error.message);
  }
}

/**
 * Test detailed endpoint
 */
async function testDetailed() {
  printSection('Testing /api/circulating-supply/detailed');

  try {
    const res = await httpGet(`${API_BASE}/api/circulating-supply/detailed`);

    printResult('Returns 200 OK', res.statusCode === 200);

    const contentType = res.headers['content-type'];
    printResult(
      'Content-Type is application/json',
      contentType && contentType.includes('application/json')
    );

    let data;
    try {
      data = JSON.parse(res.body);
      printResult('Response is valid JSON', true);
    } catch (e) {
      printResult('Response is valid JSON', false, 'Failed to parse JSON');
      return;
    }

    // Check structure
    printResult(
      'Has chains breakdown',
      data.chains && data.chains.ethereum && data.chains.sonic && data.chains.plasma
    );

    printResult(
      'Has totals',
      data.totals && data.totals.circulatingSupply && data.totals.totalSupply
    );

    printResult(
      'Has excluded addresses',
      Array.isArray(data.excludedAddresses) && data.excludedAddresses.length > 0
    );

    console.log(`  ${colors.blue}ℹ${colors.reset} Chains:`);
    console.log(`    - Ethereum: ${data.chains?.ethereum?.circulatingSupply || 'N/A'}`);
    console.log(`    - Sonic: ${data.chains?.sonic?.circulatingSupply || 'N/A'}`);
    console.log(`    - Plasma: ${data.chains?.plasma?.circulatingSupply || 'N/A'}`);
    console.log(`  ${colors.blue}ℹ${colors.reset} Total Circulating: ${data.totals?.circulatingSupply || 'N/A'}`);
    console.log(`  ${colors.blue}ℹ${colors.reset} Excluded Addresses: ${data.excludedAddresses?.length || 0}`);

  } catch (error) {
    printResult('Endpoint is accessible', false, error.message);
  }
}

/**
 * Test health endpoint
 */
async function testHealth() {
  printSection('Testing /health');

  try {
    const res = await httpGet(`${API_BASE}/health`);

    printResult('Returns 200 OK', res.statusCode === 200);

    let data;
    try {
      data = JSON.parse(res.body);
      printResult('Response is valid JSON', true);
    } catch (e) {
      printResult('Response is valid JSON', false);
      return;
    }

    printResult('Has status field', data.status === 'healthy');
    printResult('Has uptime field', typeof data.uptime === 'number');

    console.log(`  ${colors.blue}ℹ${colors.reset} Status: ${data.status}`);
    console.log(`  ${colors.blue}ℹ${colors.reset} Uptime: ${Math.floor(data.uptime)}s`);
    console.log(`  ${colors.blue}ℹ${colors.reset} Version: ${data.version || 'N/A'}`);

  } catch (error) {
    printResult('Endpoint is accessible', false, error.message);
  }
}

/**
 * Test cache behavior (enhanced version only)
 */
async function testCache() {
  printSection('Testing Cache Behavior (Enhanced Version)');

  try {
    // First request (should be MISS or STALE)
    const res1 = await httpGet(`${API_BASE}/api/circulating-supply`);
    const cache1 = res1.headers['x-cache'];

    if (!cache1) {
      printWarning('X-Cache header not present (basic version or not implemented)');
      return;
    }

    console.log(`  ${colors.blue}ℹ${colors.reset} First request: X-Cache = ${cache1}`);

    // Second request (should be HIT)
    await new Promise(resolve => setTimeout(resolve, 100)); // Wait a bit
    const res2 = await httpGet(`${API_BASE}/api/circulating-supply`);
    const cache2 = res2.headers['x-cache'];

    console.log(`  ${colors.blue}ℹ${colors.reset} Second request: X-Cache = ${cache2}`);

    printResult(
      'Cache is working (second request shows HIT)',
      cache2 === 'HIT',
      `Expected HIT, got ${cache2}`
    );

    // Verify responses are identical
    printResult(
      'Cached response matches original',
      res1.body.trim() === res2.body.trim()
    );

  } catch (error) {
    printWarning(`Cache test failed: ${error.message}`);
  }
}

/**
 * CoinGecko compliance checklist
 */
function printCoinGeckoChecklist() {
  printSection('CoinGecko Compliance Checklist');

  console.log(`  ${colors.cyan}Required for CoinGecko submission:${colors.reset}`);
  console.log(`  [ ] /api/circulating-supply returns plain text number`);
  console.log(`  [ ] Content-Type is text/plain`);
  console.log(`  [ ] No JSON formatting (no quotes, no objects)`);
  console.log(`  [ ] Response time < 5 seconds`);
  console.log(`  [ ] API is publicly accessible (no auth)`);
  console.log(`  [ ] HTTPS enabled (production only)`);
  console.log(`  [ ] 99%+ uptime (production monitoring)`);
  console.log(`\n  ${colors.cyan}Optional but recommended:${colors.reset}`);
  console.log(`  [ ] Caching for performance`);
  console.log(`  [ ] Error handling and fallbacks`);
  console.log(`  [ ] Health check endpoint`);
}

/**
 * Print summary
 */
function printSummary() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${colors.cyan}Test Summary${colors.reset}`);
  console.log(`${'='.repeat(60)}`);
  console.log(`  ${colors.green}Passed:${colors.reset}   ${results.passed}`);
  console.log(`  ${colors.red}Failed:${colors.reset}   ${results.failed}`);
  console.log(`  ${colors.yellow}Warnings:${colors.reset} ${results.warnings}`);
  console.log(`${'='.repeat(60)}`);

  if (results.failed === 0) {
    console.log(`\n${colors.green}✓ All tests passed! API is ready for CoinGecko.${colors.reset}`);
    console.log(`\nNext steps:`);
    console.log(`  1. Deploy to production with HTTPS`);
    console.log(`  2. Set up monitoring for 99%+ uptime`);
    console.log(`  3. Submit to CoinGecko with your API URL`);
  } else {
    console.log(`\n${colors.red}✗ Some tests failed. Please fix issues before submitting to CoinGecko.${colors.reset}`);
  }

  console.log();
}

/**
 * Main test runner
 */
async function runTests() {
  console.log(`${colors.cyan}${'='.repeat(60)}`);
  console.log(`TREVEE Supply API - Test Suite`);
  console.log(`${'='.repeat(60)}${colors.reset}`);
  console.log(`Testing: ${API_BASE}\n`);

  // Wait for server to be ready
  console.log('Waiting for server to be ready...\n');
  let serverReady = false;
  for (let i = 0; i < 5; i++) {
    try {
      await httpGet(`${API_BASE}/health`);
      serverReady = true;
      break;
    } catch (e) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  if (!serverReady) {
    console.log(`${colors.red}ERROR: Server is not responding at ${API_BASE}${colors.reset}`);
    console.log(`\nMake sure the API server is running:`);
    console.log(`  npm start`);
    console.log(`  or`);
    console.log(`  node trevee-supply-api-enhanced.js`);
    process.exit(1);
  }

  // Run tests
  await testCirculatingSupply();
  await testTotalSupply();
  await testDetailed();
  await testHealth();
  await testCache();

  // Print checklist and summary
  printCoinGeckoChecklist();
  printSummary();

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run tests
runTests().catch(error => {
  console.error(`${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});

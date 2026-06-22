// ============================================================
//  paypalService.js — PayPal REST API (Orders v2)
// ============================================================
const https = require('https');

const BASE = process.env.PAYPAL_MODE === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const creds = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
  ).toString('base64');

  return new Promise((resolve, reject) => {
    const body = 'grant_type=client_credentials';
    const options = {
      hostname: BASE.replace('https://', ''),
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(data).access_token); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function createOrder(amount, currency = 'USD') {
  const token = await getAccessToken();
  const body = JSON.stringify({
    intent: 'CAPTURE',
    purchase_units: [{
      amount: { currency_code: currency, value: parseFloat(amount).toFixed(2) },
    }],
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE.replace('https://', ''),
      path: '/v2/checkout/orders',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function captureOrder(orderId) {
  const token = await getAccessToken();
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE.replace('https://', ''),
      path: `/v2/checkout/orders/${orderId}/capture`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': 0,
      },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

/**
 * Look up a CAPTURE (payment) by its capture ID directly from PayPal's
 * API. This is used by /api/public/register as the source of truth for
 * "did this transaction really happen, for how much, and was it
 * COMPLETED" — instead of trusting a transactionId string the client
 * claims is real. A request that names a capture ID that PayPal doesn't
 * know about, or that wasn't actually COMPLETED, or that was for a
 * different amount than the program costs, will fail this check.
 */
async function getCaptureDetails(captureId) {
  const token = await getAccessToken();
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE.replace('https://', ''),
      path: `/v2/payments/captures/${captureId}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

module.exports = { createOrder, captureOrder, getCaptureDetails };

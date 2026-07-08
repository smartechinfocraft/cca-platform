// ============================================================
//  stripeService.js — Stripe Payment Intents via HTTPS
// ============================================================
const https = require('https');
const querystring = require('querystring');

const STRIPE_API_HOST = 'api.stripe.com';

function requireStripeSecret() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw Object.assign(new Error('STRIPE_SECRET_KEY is not set on the server.'), { status: 500 });
  }
  return process.env.STRIPE_SECRET_KEY;
}

function stripeRequest(method, path, body) {
  const secret = requireStripeSecret();
  const encoded = body ? querystring.stringify(body) : '';

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: STRIPE_API_HOST,
      path,
      method,
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(encoded),
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data || '{}');
          if (res.statusCode >= 400) {
            const message = parsed.error?.message || `Stripe API error (${res.statusCode})`;
            return reject(Object.assign(new Error(message), { status: res.statusCode, detail: parsed }));
          }
          resolve(parsed);
        } catch (err) {
          reject(err);
        }
      });
    });
    req.on('error', reject);
    if (encoded) req.write(encoded);
    req.end();
  });
}

function toMinorUnits(amount) {
  return Math.round(Number(amount) * 100);
}

async function createPaymentIntent(amount, currency = 'USD', metadata = {}) {
  const cents = toMinorUnits(amount);
  if (!Number.isInteger(cents) || cents <= 0) {
    throw Object.assign(new Error('Stripe payment amount must be greater than $0.'), { status: 400 });
  }

  const body = {
    amount: cents,
    currency: currency.toLowerCase(),
    description: 'California Cricket Academy registration',
    'payment_method_types[]': 'card',
  };

  Object.entries(metadata).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      body[`metadata[${key}]`] = String(value);
    }
  });

  return stripeRequest('POST', '/v1/payment_intents', body);
}

async function getPaymentIntent(paymentIntentId) {
  if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
    throw Object.assign(new Error('Invalid Stripe PaymentIntent ID.'), { status: 400 });
  }
  return stripeRequest('GET', `/v1/payment_intents/${encodeURIComponent(paymentIntentId)}`);
}

module.exports = { createPaymentIntent, getPaymentIntent, toMinorUnits };

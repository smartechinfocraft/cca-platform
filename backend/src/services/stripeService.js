// ============================================================
//  stripeService.js — Stripe Payment Intents via HTTPS
// ============================================================
const https = require('https');
const crypto = require('crypto');
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

// ── Refunds ────────────────────────────────────────────────
// Only ever called from an admin-gated route. `amount` (if given) must be
// in the SAME currency's major units (e.g. dollars) — converted here to
// minor units, matching how PaymentIntents are created above.
async function refundPaymentIntent(paymentIntentId, amount) {
  if (!paymentIntentId || !paymentIntentId.startsWith('pi_')) {
    throw Object.assign(new Error('Invalid Stripe PaymentIntent ID.'), { status: 400 });
  }
  const body = { payment_intent: paymentIntentId };
  if (amount !== undefined && amount !== null) {
    const cents = toMinorUnits(amount);
    if (!Number.isInteger(cents) || cents <= 0) {
      throw Object.assign(new Error('Refund amount must be greater than $0.'), { status: 400 });
    }
    body.amount = cents;
  }
  return stripeRequest('POST', '/v1/refunds', body);
}

// ── Webhook signature verification ──────────────────────────
// Re-implements Stripe's documented "Stripe-Signature" verification
// scheme (HMAC-SHA256 over "{timestamp}.{rawBody}") without depending on
// the stripe npm package, since this project talks to the Stripe REST
// API directly over https. Rejects:
//   - missing/malformed header
//   - signature mismatch (tampered or fake payload)
//   - timestamps older than the configured tolerance (replay protection)
// `rawBody` MUST be the exact, unparsed request body Buffer/string Stripe
// sent — never the JSON.parse()'d object — or the HMAC will never match.
function verifyStripeWebhookSignature(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!secret) {
    throw Object.assign(new Error('STRIPE_WEBHOOK_SECRET is not set on the server.'), { status: 500 });
  }
  if (!signatureHeader || typeof signatureHeader !== 'string') {
    throw Object.assign(new Error('Missing Stripe-Signature header.'), { status: 400 });
  }

  const parts = signatureHeader.split(',').reduce((acc, part) => {
    const [k, v] = part.split('=');
    if (k && v) acc[k.trim()] = v.trim();
    return acc;
  }, {});

  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) {
    throw Object.assign(new Error('Malformed Stripe-Signature header.'), { status: 400 });
  }

  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');

  const expectedBuf = Buffer.from(expected, 'utf8');
  const receivedBuf = Buffer.from(v1, 'utf8');
  const signatureValid =
    expectedBuf.length === receivedBuf.length && crypto.timingSafeEqual(expectedBuf, receivedBuf);

  if (!signatureValid) {
    throw Object.assign(new Error('Stripe webhook signature verification failed.'), { status: 400 });
  }

  // Replay protection: reject events whose timestamp is outside tolerance,
  // even if the signature itself is valid (e.g. a captured/replayed request).
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > toleranceSeconds) {
    throw Object.assign(new Error('Stripe webhook timestamp outside tolerance (possible replay).'), { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Stripe webhook payload is not valid JSON.'), { status: 400 });
  }
  return event;
}

module.exports = {
  createPaymentIntent,
  getPaymentIntent,
  refundPaymentIntent,
  verifyStripeWebhookSignature,
  toMinorUnits,
};

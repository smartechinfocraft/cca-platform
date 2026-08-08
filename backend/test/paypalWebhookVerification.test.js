const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const https = require('https');

test('PayPal webhook verification sends the provider verification request', async () => {
  const originalRequest = https.request;
  const originalWebhookId = process.env.PAYPAL_WEBHOOK_ID;
  process.env.PAYPAL_WEBHOOK_ID = 'WH-test';
  const calls = [];
  https.request = (options, callback) => {
    calls.push(options);
    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {
      const response = new EventEmitter();
      response.statusCode = 200;
      callback(response);
      process.nextTick(() => {
        response.emit('data', calls.length === 1
          ? JSON.stringify({ access_token: 'token' })
          : JSON.stringify({ verification_status: 'SUCCESS' }));
        response.emit('end');
      });
    };
    return request;
  };

  try {
    delete require.cache[require.resolve('../src/services/paypalService')];
    const { verifyWebhookSignature } = require('../src/services/paypalService');
    const verified = await verifyWebhookSignature({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://example.test/cert',
      'paypal-transmission-id': 'transmission-1',
      'paypal-transmission-sig': 'signature',
      'paypal-transmission-time': '2026-08-08T00:00:00Z',
    }, { id: 'WH-event', event_type: 'PAYMENT.CAPTURE.COMPLETED' });

    assert.equal(verified, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].path, '/v1/notifications/verify-webhook-signature');
    assert.equal(calls[1].headers.Authorization, 'Bearer token');
    assert.equal(calls[1].headers['PayPal-Request-Id'], undefined);
  } finally {
    https.request = originalRequest;
    if (originalWebhookId === undefined) delete process.env.PAYPAL_WEBHOOK_ID;
    else process.env.PAYPAL_WEBHOOK_ID = originalWebhookId;
    delete require.cache[require.resolve('../src/services/paypalService')];
  }
});

test('PayPal webhook verification rejects a non-2xx provider response', async () => {
  const originalRequest = https.request;
  const originalWebhookId = process.env.PAYPAL_WEBHOOK_ID;
  process.env.PAYPAL_WEBHOOK_ID = 'WH-test';
  let call = 0;
  https.request = (_options, callback) => {
    call += 1;
    const request = new EventEmitter();
    request.write = () => {};
    request.end = () => {
      const response = new EventEmitter();
      response.statusCode = call === 1 ? 200 : 500;
      callback(response);
      process.nextTick(() => {
        response.emit('data', call === 1 ? JSON.stringify({ access_token: 'token' }) : JSON.stringify({ verification_status: 'SUCCESS' }));
        response.emit('end');
      });
    };
    return request;
  };
  try {
    delete require.cache[require.resolve('../src/services/paypalService')];
    const { verifyWebhookSignature } = require('../src/services/paypalService');
    assert.equal(await verifyWebhookSignature({
      'paypal-auth-algo': 'SHA256withRSA',
      'paypal-cert-url': 'https://example.test/cert',
      'paypal-transmission-id': 'transmission-2',
      'paypal-transmission-sig': 'signature',
      'paypal-transmission-time': '2026-08-08T00:00:00Z',
    }, { id: 'event' }), false);
  } finally {
    https.request = originalRequest;
    if (originalWebhookId === undefined) delete process.env.PAYPAL_WEBHOOK_ID;
    else process.env.PAYPAL_WEBHOOK_ID = originalWebhookId;
    delete require.cache[require.resolve('../src/services/paypalService')];
  }
});

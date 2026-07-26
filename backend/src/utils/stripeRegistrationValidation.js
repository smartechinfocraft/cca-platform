const { toMinorUnits } = require('../services/stripeService');

function validateStripeIntent(reg, intent) {
  const receivedCents = Number(intent.amount_received || intent.amount || 0);
  const expectedCents = toMinorUnits(reg.totalAmount);
  const currencyMatches = !intent.currency || intent.currency.toUpperCase() === 'USD';
  const metadataMatches = String(intent.metadata?.registrationId || '') === String(reg._id);
  return {
    valid:
      intent.status === 'succeeded'
      && Math.abs(receivedCents - expectedCents) <= 1
      && currencyMatches
      && metadataMatches,
    receivedCents,
    expectedCents,
    currencyMatches,
    metadataMatches,
  };
}

module.exports = { validateStripeIntent };

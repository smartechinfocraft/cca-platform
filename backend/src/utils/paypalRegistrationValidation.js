function validatePayPalCapture(reg, capture) {
  const amount = Number(capture?.amount?.value || 0);
  const currency = capture?.amount?.currency_code;
  const registrationId = capture?.custom_id;
  return {
    valid:
      capture?.status === 'COMPLETED'
      && Math.abs(amount - Number(reg.totalAmount)) <= 0.01
      && (!currency || currency === 'USD')
      && (!registrationId || String(registrationId) === String(reg._id)),
    amount,
    currency,
  };
}

module.exports = { validatePayPalCapture };

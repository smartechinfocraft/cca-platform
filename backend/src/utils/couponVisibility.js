function buildPublicCouponFilter(now = new Date()) {
  return {
    isActive: true,
    // Backward compatible: existing documents without this new field remain
    // public. Only an explicit false hides the code from discovery.
    isPubliclyVisible: { $ne: false },
    $or: [
      { expiresAt: null },
      { expiresAt: { $gt: now } },
    ],
  };
}

module.exports = { buildPublicCouponFilter };

// ============================================================
//  controllers/reportController.js
//  Revenue reports, custom report builder, export
// ============================================================
const mongoose = require('mongoose');

const getReg = () => mongoose.model('Registration');

// ─── GET /api/reports/revenue ─────────────────────────────────────────────────
// Overall revenue summary with graphs data
exports.getRevenueSummary = async (req, res) => {
  try {
    const { from, to, groupBy = 'month' } = req.query;

    const matchStage = { status: { $in: ['CONFIRMED', 'PAID'] } };
    if (from || to) {
      matchStage.createdAt = {};
      if (from) matchStage.createdAt.$gte = new Date(from);
      if (to)   matchStage.createdAt.$lte = new Date(to);
    }

    // Group by month or week
    const groupId = groupBy === 'week'
      ? { year: { $isoWeekYear: '$createdAt' }, week: { $isoWeek: '$createdAt' } }
      : { year: { $year: '$createdAt' }, month: { $month: '$createdAt' } };

    const revenueByPeriod = await getReg().aggregate([
      { $match: matchStage },
      { $group: { _id: groupId, revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.week': 1 } },
    ]);

    // Revenue by program
    const revenueByProgram = await getReg().aggregate([
      { $match: matchStage },
      { $group: { _id: '$programId', revenue: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $lookup: { from: 'programs', localField: '_id', foreignField: '_id', as: 'program' } },
      { $unwind: { path: '$program', preserveNullAndEmptyArrays: true } },
      { $project: { revenue: 1, count: 1, programTitle: '$program.title' } },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    // Payment method breakdown
    const paymentBreakdown = await getReg().aggregate([
      { $match: matchStage },
      { $group: { _id: '$paymentMethod', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
    ]);

    // Totals
    const totals = await getReg().aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: null,
          totalRevenue:      { $sum: '$totalAmount' },
          totalRegistrations:{ $sum: 1 },
          avgOrderValue:     { $avg: '$totalAmount' },
          totalDiscount:     { $sum: '$discountAmount' },
        },
      },
    ]);

    res.json({
      success: true,
      data: {
        totals:           totals[0] || {},
        revenueByPeriod,
        revenueByProgram,
        paymentBreakdown,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── POST /api/reports/custom ─────────────────────────────────────────────────
// Build a custom report with any combination of filters
// Body: { filters: { category, program, batch, location, level, status, from, to }, groupBy }
exports.buildCustomReport = async (req, res) => {
  try {
    const { filters = {}, groupBy = 'program' } = req.body;

    // Build match query from filters
    const match = {};

    if (filters.status)
      match.status = Array.isArray(filters.status) ? { $in: filters.status } : filters.status;
    else
      match.status = { $in: ['CONFIRMED', 'PAID'] };

    if (filters.from || filters.to) {
      match.createdAt = {};
      if (filters.from) match.createdAt.$gte = new Date(filters.from);
      if (filters.to)   match.createdAt.$lte = new Date(filters.to);
    }

    if (filters.program)  match.programId  = new mongoose.Types.ObjectId(filters.program);
    if (filters.batch)    match.batchId    = new mongoose.Types.ObjectId(filters.batch);
    if (filters.location) match.locationId = new mongoose.Types.ObjectId(filters.location);
    if (filters.level)    match.levelId    = new mongoose.Types.ObjectId(filters.level);

    // Category (a.k.a "Season", e.g. "Fall 2026") lives on the Program, not
    // directly on the Registration, so resolve it to a set of Program IDs
    // first and intersect with any Program filter already selected.
    if (filters.category) {
      const Program = mongoose.model('Program');
      const categoryProgramIds = await Program.find({ category: filters.category }).distinct('_id');

      if (match.programId) {
        // A specific Program was also selected — only keep it if it
        // actually belongs to the selected category, otherwise the
        // report should come back empty rather than ignoring the filter.
        const matches = categoryProgramIds.some((id) => id.equals(match.programId));
        match.programId = matches ? match.programId : new mongoose.Types.ObjectId('000000000000000000000000');
      } else {
        match.programId = { $in: categoryProgramIds };
      }
    }

    const data = await getReg().aggregate([
      { $match: match },
      {
        $lookup: {
          from: 'programs', localField: 'programId', foreignField: '_id', as: 'program',
        },
      },
      { $unwind: { path: '$program', preserveNullAndEmptyArrays: true } },
      {
        $group: {
          _id:       '$programId',
          name:      { $first: '$program.title' },
          revenue:   { $sum: '$totalAmount' },
          count:     { $sum: 1 },
          avgValue:  { $avg: '$totalAmount' },
          discount:  { $sum: '$discountAmount' },
        },
      },
      { $sort: { revenue: -1 } },
    ]);

    // Summary totals
    const totals = data.reduce(
      (acc, row) => ({
        revenue: acc.revenue + row.revenue,
        count:   acc.count   + row.count,
        discount:acc.discount + row.discount,
      }),
      { revenue: 0, count: 0, discount: 0 }
    );

    res.json({
      success: true,
      data: {
        rows: data,
        totals,
        generatedAt: new Date().toISOString(),
        filters,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

// ─── GET /api/reports/export ──────────────────────────────────────────────────
// Export registrations as CSV
exports.exportCSV = async (req, res) => {
  try {
    const match = {};
    if (req.query.status)  match.status    = req.query.status;
    if (req.query.program) match.programId = new mongoose.Types.ObjectId(req.query.program);

    // Category (a.k.a "Season", e.g. "Fall 2026") lives on the Program, not
    // directly on the Registration — resolve it to Program IDs first.
    if (req.query.category) {
      const Program = mongoose.model('Program');
      const categoryProgramIds = await Program.find({ category: req.query.category }).distinct('_id');

      if (match.programId) {
        const matches = categoryProgramIds.some((id) => id.equals(match.programId));
        match.programId = matches ? match.programId : new mongoose.Types.ObjectId('000000000000000000000000');
      } else {
        match.programId = { $in: categoryProgramIds };
      }
    }

    // Registration links to batches via the `batches` array (refs Batch),
    // not a single batchId. Location lives on the Batch, not the Registration.
    let batchIds = null; // null = no restriction
    if (req.query.batch) {
      batchIds = [new mongoose.Types.ObjectId(req.query.batch)];
    }
    if (req.query.location) {
      const Batch = mongoose.model('Batch');
      const locationBatchIds = await Batch.find({ location: req.query.location }).distinct('_id');
      batchIds = batchIds
        ? batchIds.filter((id) => locationBatchIds.some((lid) => lid.equals(id)))
        : locationBatchIds;
    }
    if (batchIds) match.batches = { $in: batchIds };

    // NOTE: "Level" isn't a relation that exists on Registration, Batch, or Program
    // in the current schema (Program only stores skillLevels as free-text strings),
    // so a levelId filter can't be matched here yet.

    const registrations = await getReg().find(match)
      .populate('programId', 'title sku')
      .populate({
        path: 'batches',
        select: 'title location',
        populate: { path: 'location', select: 'title' },
      })
      .lean();

    // Build CSV manually (no extra library needed)
    const headers = [
      'Registration #', 'Status', 'Program', 'Batch', 'Location',
      'Total Amount', 'Discount', 'Payment Method', 'Payment Status', 'Created At',
      'Waiver Accepted', 'Waiver Typed Signature', 'Waiver Drawn Signature Captured',
      'Waiver Accepted At', 'Waiver Agreement Version',
    ];

    const rows = registrations.map((r) => {
      const batchTitles   = (r.batches || []).map((b) => b.title).filter(Boolean).join(' / ');
      const locationTitles = (r.batches || [])
        .map((b) => b.location?.title)
        .filter(Boolean)
        .filter((v, i, arr) => arr.indexOf(v) === i) // de-dupe if multiple batches share a location
        .join(' / ');

      return [
        r.registrationNumber,
        r.status,
        r.programId?.title || '',
        batchTitles,
        locationTitles,
        r.totalAmount,
        r.discountAmount,
        r.paymentMethod,
        r.paymentStatus,
        new Date(r.createdAt).toLocaleDateString(),
        r.waiverAccepted ? 'Yes' : 'No',
        r.waiverSignature || '',
        r.waiverDrawnSignature ? 'Yes' : 'No',
        r.waiverAcceptedAt ? new Date(r.waiverAcceptedAt).toLocaleString() : '',
        r.waiverAgreementVersion || '',
      ];
    });

    const csv = [
      headers.join(','),
      ...rows.map((r) => r.map((v) => `"${v ?? ''}"`).join(',')),
    ].join('\n');

    const filename = `CCA_Report_${new Date().toISOString().split('T')[0]}.csv`;

    // Set headers so browser downloads the file
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

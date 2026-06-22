// ============================================================
//  controllers/dashboardController.js
//  Returns all stats needed for the admin dashboard:
//   - Summary cards (registrations, revenue, students, programs)
//   - Monthly revenue chart data (bar chart)
//   - Registration status breakdown (pie chart)
//   - Recent registrations table
//   - Batch fill-rate chart
// ============================================================
const mongoose    = require('mongoose');
const { Registration } = require('../models/index');
const Program     = require('../models/Program');
require('../models/index'); // ensure all models are registered

// ─── GET /api/dashboard/stats ─────────────────────────────────────────────────
exports.getStats = async (req, res) => {
  try {
    const Registration = mongoose.model('Registration');
    const Batch        = mongoose.model('Batch');
    const Coach        = mongoose.model('Coach');

    // ── Summary cards ────────────────────────────────────────
    // Total confirmed+paid registrations
    const totalRegistrations = await Registration.countDocuments({
      status: { $in: ['CONFIRMED', 'PAID'] },
    });

    // Revenue: sum totalAmount of PAID/CONFIRMED registrations
    const revenueAgg = await Registration.aggregate([
      { $match: { status: { $in: ['CONFIRMED', 'PAID'] } } },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } },
    ]);
    const totalRevenue = revenueAgg[0]?.total || 0;

    const totalPrograms = await Program.countDocuments({ isActive: true });
    const totalCoaches  = await Coach.countDocuments({ status: 'ACTIVE' });

    // Pending registrations (need admin attention)
    const pendingCount = await Registration.countDocuments({ status: 'PENDING' });

    // ── Monthly revenue chart (last 6 months) ────────────────
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlyRevenue = await Registration.aggregate([
      {
        $match: {
          status: { $in: ['CONFIRMED', 'PAID'] },
          createdAt: { $gte: sixMonthsAgo },
        },
      },
      {
        // Group by year+month
        $group: {
          _id: {
            year:  { $year:  '$createdAt' },
            month: { $month: '$createdAt' },
          },
          revenue:       { $sum: '$totalAmount' },
          registrations: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    // Format for chart.js / recharts
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const chartRevenue = monthlyRevenue.map((m) => ({
      month:         `${monthNames[m._id.month - 1]} ${m._id.year}`,
      revenue:       m.revenue,
      registrations: m.registrations,
    }));

    // ── Registration status breakdown (pie chart) ─────────────
    const statusBreakdown = await Registration.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);

    // ── Batch capacity chart ──────────────────────────────────
    const batchCapacity = await Batch.aggregate([
      { $match: { isActive: true } },
      { $lookup: { from: 'programs', localField: 'program', foreignField: '_id', as: 'program' } },
      { $unwind: '$program' },
      {
        $project: {
          name:            { $ifNull: ['$title', '$dayOfWeek'] },
          maxCapacity:     1,
          currentCapacity: 1,
          fillRate: {
            $cond: [
              { $gt: ['$maxCapacity', 0] },
              { $multiply: [{ $divide: ['$currentCapacity', '$maxCapacity'] }, 100] },
              0,
            ],
          },
        },
      },
      { $limit: 8 }, // top 8 batches for readability
    ]);

    // ── Recent registrations ──────────────────────────────────
    const recentRegistrations = await Registration.find()
      .populate('programId', 'title')
      .sort({ createdAt: -1 })
      .limit(8)
      .lean();

    res.json({
      success: true,
      data: {
        cards: {
          totalRegistrations,
          totalRevenue,
          totalPrograms,
          totalCoaches,
          pendingCount,
        },
        charts: {
          monthlyRevenue: chartRevenue,
          statusBreakdown: statusBreakdown.map((s) => ({ name: s._id, value: s.count })),
          batchCapacity,
        },
        recentRegistrations,
      },
    });
  } catch (err) {
    console.error('Dashboard error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
};

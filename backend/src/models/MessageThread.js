// ============================================================
//  models/Message.js — Parent <-> Admin/Coach messaging, scoped
//  to a specific batch (per the brief: "particular batch oriented").
//
//  One MessageThread per (parent, batch) pair. Each thread holds an
//  array of individual messages so the whole conversation stays
//  together — a parent asking about pickup time for their child's
//  Tuesday batch shouldn't get mixed in with a different question
//  about a different batch.
//
//  Both admins AND the batch's assigned coach can see and reply to
//  a thread, since either one might be the right person to answer
//  (per the brief: "same for coach").
// ============================================================
const mongoose = require('mongoose');

const messageEntrySchema = new mongoose.Schema(
  {
    // Who sent this individual message within the thread
    senderRole: { type: String, enum: ['PARENT', 'ADMIN', 'COACH'], required: true },
    senderId:   { type: mongoose.Schema.Types.ObjectId, required: true }, // Parent/User/Coach _id depending on role
    senderName: { type: String, required: true }, // denormalized for display without extra populate calls
    body:       { type: String, required: true, trim: true, maxlength: 2000 },
    readByParent: { type: Boolean, default: false },
    readByStaff:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

const messageThreadSchema = new mongoose.Schema(
  {
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Parent', required: true, index: true },
    batchId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Batch', required: true, index: true },
    // Denormalized so admin/coach inboxes can render a useful list
    // without populating on every request.
    subject:      { type: String, required: true, trim: true, maxlength: 150 },
    studentName:  { type: String }, // which child this is about, if relevant
    status:       { type: String, enum: ['OPEN', 'RESOLVED'], default: 'OPEN' },
    messages:     [messageEntrySchema],
    lastMessageAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

messageThreadSchema.index({ batchId: 1, status: 1 });
messageThreadSchema.index({ parentId: 1, lastMessageAt: -1 });

if (!mongoose.modelNames().includes('MessageThread')) {
  mongoose.model('MessageThread', messageThreadSchema);
}

module.exports = mongoose.model('MessageThread');

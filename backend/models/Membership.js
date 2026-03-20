const mongoose = require('mongoose');

const membershipSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true
    },
    role: {
        type: String,
        enum: ['leader', 'member'],
        default: 'member'
    }
}, { timestamps: true });

// Compound index to ensure one membership per user per group
membershipSchema.index({ userId: 1, groupId: 1 }, { unique: true });

module.exports = mongoose.model('Membership', membershipSchema);

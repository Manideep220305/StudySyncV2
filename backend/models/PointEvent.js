const mongoose = require('mongoose');

const pointEventSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        default: null
    },
    points: {
        type: Number,
        required: true
    },
    reason: {
        type: String,
        enum: ['quiz_win', 'pomodoro', 'task_resolved'],
        required: true
    }
}, { timestamps: true });

// Indexes for fast leaderboard and profile queries
pointEventSchema.index({ userId: 1, groupId: 1 });
pointEventSchema.index({ groupId: 1, createdAt: -1 });
pointEventSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('PointEvent', pointEventSchema);

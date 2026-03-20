const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    groupId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Group',
        required: true,
        index: true
    },
    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    text: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1000
    },
    type: {
        type: String,
        enum: ['text', 'system', 'quiz'],
        default: 'text'
    }
}, { timestamps: true });

// Compound index for fetching group message history (fast pagination)
messageSchema.index({ groupId: 1, createdAt: -1 });

module.exports = mongoose.model('Message', messageSchema);


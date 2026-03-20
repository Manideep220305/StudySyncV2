const mongoose = require('mongoose');

const groupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Please provide a group name'],
        trim: true,
        maxlength: 50
    },
    description: {
        type: String,
        maxlength: 200
    },
    tags: [{
        type: String,
        trim: true
    }],
joinCode: {
        type: String,
        required: true
    },
    // Backward compatibility for legacy data/indexes that used inviteCode.
    inviteCode: {
        type: String,
        required: true
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    uploadedFiles: [{
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 255
        },
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        uploadedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

// Indexes
groupSchema.index({ tags: 1 });
groupSchema.index({ joinCode: 1 }, { unique: true });

const crypto = require('crypto');

// Static method to generate unique 6-digit join code
groupSchema.statics.generateJoinCode = function() {
    return crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 6);
};

module.exports = mongoose.model('Group', groupSchema);

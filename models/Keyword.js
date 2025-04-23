const mongoose = require('mongoose');

const RankingHistorySchema = new mongoose.Schema({
    position: {
        type: String,
        required: true
    },
    checkedAt: {
        type: Date,
        default: Date.now
    }
});

const KeywordSchema = new mongoose.Schema({
    keyword: {
        type: String,
        required: true,
        trim: true
    },
    domain: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Domain',
        required: true
    },
    currentRank: {
        type: String,
        default: 'Not checked'
    },
    lastChecked: {
        type: Date
    },
    group: {
        type: String,
        default: 'Default',
        trim: true
    },
    rankingHistory: [RankingHistorySchema],
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Keyword', KeywordSchema); 
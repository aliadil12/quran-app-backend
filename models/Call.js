const mongoose = require('mongoose');

const participantSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  joinTime: {
    type: Date,
    default: Date.now
  },
  leaveTime: {
    type: Date
  }
});

const callSchema = new mongoose.Schema({
  teacherId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  roomId: {
    type: String,
    required: true,
    unique: true
  },
  type: {
    type: String,
    enum: ['صوتي', 'فيديو'],
    required: true
  },
  callType: {
    type: String,
    enum: ['عام', 'اختبار'],
    required: true
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  status: {
    type: String,
    enum: ['جارية', 'منتهي'],
    default: 'جارية'
  },
  participants: [participantSchema],
  studyCircleId: {
    type: String,
    required: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Call', callSchema);
const mongoose = require('mongoose');

const studyCircleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'اسم الحلقة مطلوب'],
    trim: true
  },
  type: {
    type: String,
    required: [true, 'نوع الحلقة مطلوب'],
    enum: ['تجويد', 'حفظ', 'اتقان', 'تفسير']
  },
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'معلم الحلقة مطلوب']
  },
  level: {
    type: String,
    required: [true, 'مستوى الحلقة مطلوب'],
    enum: ['مبتدئ', 'متوسط', 'متقدم']
  },
  description: {
    type: String,
    maxlength: [500, 'الوصف يجب أن لا يتجاوز 500 حرف']
  },
  maxMembers: {
    type: Number,
    default: 30
  },
  isActive: {
    type: Boolean,
    default: true
  },
  members: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  ratings: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  averageRating: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// حساب متوسط التقييم قبل الحفظ
studyCircleSchema.pre('save', function(next) {
  if (this.ratings.length > 0) {
    const sum = this.ratings.reduce((total, rating) => total + rating.rating, 0);
    this.averageRating = Number((sum / this.ratings.length).toFixed(1));
  }
  next();
});

module.exports = mongoose.model('StudyCircle', studyCircleSchema);

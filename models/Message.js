const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true
  },
  studyCircleId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'StudyCircle',
    default: null
  },
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  },
  // إضافة حقل للتمييز بين محادثات الحلقات والمحادثات الخاصة
  messageType: {
    type: String,
    enum: ['private', 'circle'],
    required: true
  },
  deletedFor: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  // إضافة حقل للرد على الرسائل
  replyTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Message',
    default: null
  },
  // إضافة حقل للوسائط المتعددة - للاستخدام المستقبلي
  attachments: [{
    url: String,
    type: String,
    name: String
  }],
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// إنشاء فهارس للبحث السريع
messageSchema.index({ sender: 1, receiver: 1 });
messageSchema.index({ studyCircleId: 1 });
messageSchema.index({ isRead: 1 });
messageSchema.index({ messageType: 1 });
messageSchema.index({ replyTo: 1 });

// دالة للتحقق من صحة الرسالة قبل الحفظ
messageSchema.pre('save', function(next) {
  // للمحادثات الخاصة، يجب تحديد المستقبل
  if (this.messageType === 'private' && !this.receiver) {
    return next(new Error('يجب تحديد المستقبل للمحادثات الخاصة'));
  }
  
  // لمحادثات الحلقة، يجب تحديد معرف الحلقة
  if (this.messageType === 'circle' && !this.studyCircleId) {
    return next(new Error('يجب تحديد معرف الحلقة لمحادثات الحلقة'));
  }
  
  next();
});

module.exports = mongoose.model('Message', messageSchema);

// models/User.js

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const ValidationRules = require('../utils/validation');

// تعريف سكيما التقييمات
const ratingSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, 'معرف المستخدم مطلوب'],
    ref: 'User'
  },
  rating: {
    type: Number,
    required: [true, 'التقييم مطلوب'],
    min: [1, 'أقل تقييم هو 1'],
    max: [5, 'أعلى تقييم هو 5']
  },
  comment: {
    type: String,
    maxlength: [500, 'التعليق يجب أن لا يتجاوز 500 حرف']
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// تعريف سكيما المستخدم
const userSchema = new mongoose.Schema({
  // معلومات الحساب الأساسية
  name: {
    type: String,
    required: [true, 'الاسم مطلوب'],
    trim: true,
    match: [ValidationRules.ARABIC_NAME_PATTERN, 'الاسم يجب أن يكون باللغة العربية']
  },
  email: {
    type: String,
    required: [true, 'البريد الإلكتروني مطلوب'],
    unique: true,
    trim: true,
    lowercase: true,
    match: [ValidationRules.EMAIL_PATTERN, 'البريد الإلكتروني غير صحيح']
  },
  password: {
    type: String,
    required: [true, 'كلمة المرور مطلوبة'],
    minlength: [ValidationRules.PASSWORD_MIN_LENGTH, `كلمة المرور يجب أن تكون ${ValidationRules.PASSWORD_MIN_LENGTH} أحرف على الأقل`],
    select: false
  },
  role: {
    type: String,
    enum: {
      values: ValidationRules.ROLES,
      message: 'نوع الحساب غير صحيح'
    },
    required: [true, 'نوع الحساب مطلوب']
  },
  isActive: {
    type: Boolean,
    default: true
  },
  
  // الصورة الشخصية
  profileImage: {
    type: String,
    default: ''
  },

  // نظام التقييمات
  ratings: [ratingSchema],
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalRatings: {
    type: Number,
    default: 0,
    min: 0
  },

  // حقول خاصة بالطالب
  parentPhone: {
    type: String,
    required: function() { return this.role === 'student' },
    validate: {
      validator: function(v) {
        if (this.role === 'student') {
          return ValidationRules.PHONE_PATTERN.test(v);
        }
        return true;
      },
      message: 'رقم هاتف ولي الأمر غير صحيح'
    }
  },
  studyHours: {
    type: String,
    required: function() { return this.role === 'student' }
  },
  studyTime: {
    type: String,
    required: function() { return this.role === 'student' }
  },
  level: {
    type: String,
    required: function() { return this.role === 'student' }
  },
  targetDuration: {
    type: String,
    required: function() { return this.role === 'student' }
  },
  memorizedParts: {
    type: Number,
    default: 0,
    min: [0, 'عدد الأجزاء يجب أن لا يقل عن 0'],
    max: [30, 'عدد الأجزاء يجب أن لا يتجاوز 30'],
    required: function() { return this.role === 'student' }
  },
  progressPercentage: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },

  // حقول خاصة بالأستاذ
  specialization: {
    type: String,
    required: function() { return this.role === 'teacher' }
  },
  quranParts: {
    type: String,
    required: function() { return this.role === 'teacher' }
  },
  teachingTime: {
    type: String,
    required: function() { return this.role === 'teacher' }
  },
  readingLevel: {
    type: String,
    required: function() { return this.role === 'teacher' }
  },
  teachingExperience: {
    type: String,
    required: function() { return this.role === 'teacher' }
  },
  education: {
    type: String,
    required: function() { return this.role === 'teacher' }
  },
  bio: {
    type: String,
    required: function() { return this.role === 'teacher' },
    minlength: [ValidationRules.BIO_MIN_LENGTH, 'النبذة التعريفية يجب أن تكون 50 حرف على الأقل'],
    maxlength: [ValidationRules.BIO_MAX_LENGTH, 'النبذة التعريفية يجب أن لا تتجاوز 500 حرف']
  },

  // حقول مشتركة
  phone: {
    type: String,
    required: function() { return this.role === 'teacher' || this.role === 'student' },
    validate: {
      validator: function(v) {
        if (this.role === 'teacher' || this.role === 'student') {
          return ValidationRules.PHONE_PATTERN.test(v);
        }
        return true;
      },
      message: 'رقم الهاتف غير صحيح'
    }
  },
  birthDate: {
    type: Date,
    required: function() { return this.role === 'teacher' || this.role === 'student' },
    validate: {
      validator: function(date) {
        if (this.role === 'teacher' || this.role === 'student') {
          const age = new Date().getFullYear() - date.getFullYear();
          const range = this.role === 'teacher' ? ValidationRules.TEACHER_AGE_RANGE : ValidationRules.STUDENT_AGE_RANGE;
          return age >= range.min && age <= range.max;
        }
        return true;
      },
      message: props => {
        const range = props.this.role === 'teacher' ? ValidationRules.TEACHER_AGE_RANGE : ValidationRules.STUDENT_AGE_RANGE;
        return `العمر يجب أن يكون بين ${range.min} و ${range.max} سنة`;
      }
    }
  },
  gender: {
    type: String,
    enum: {
      values: ['ذكر', 'أنثى'],
      message: 'الجنس يجب أن يكون ذكر أو أنثى'
    },
    required: function() { return this.role === 'teacher' || this.role === 'student' }
  },
  province: {
    type: String,
    required: function() { return this.role === 'teacher' || this.role === 'student' }
  }
}, {
  timestamps: true
});

// معالجة ما قبل الحفظ
userSchema.pre('save', async function(next) {
  try {
    // تشفير كلمة المرور إذا تم تعديلها
    if (this.isModified('password')) {
      const salt = await bcrypt.genSalt(10);
      this.password = await bcrypt.hash(this.password, salt);
    }

    // حساب نسبة التقدم للطلاب
    if (this.role === 'student' && this.isModified('memorizedParts')) {
      this.progressPercentage = Math.min(100, Math.max(0, (this.memorizedParts / 30) * 100));
    }

    next();
  } catch (error) {
    next(error);
  }
});

// مقارنة كلمة المرور
userSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.password);
  } catch (error) {
    throw new Error('خطأ في مقارنة كلمة المرور');
  }
};

// إضافة أو تحديث تقييم
userSchema.methods.addRating = async function(userId, rating, comment = '') {
  try {
    // البحث عن التقييم السابق
    const existingRatingIndex = this.ratings.findIndex(r => 
      r.userId.toString() === userId.toString()
    );

    if (existingRatingIndex > -1) {
      // تحديث التقييم الموجود
      this.ratings[existingRatingIndex].rating = rating;
      this.ratings[existingRatingIndex].comment = comment;
      this.ratings[existingRatingIndex].createdAt = Date.now();
    } else {
      // إضافة تقييم جديد
      this.ratings.push({
        userId: userId,
        rating: rating,
        comment: comment,
        createdAt: Date.now()
      });
    }

    // إعادة حساب المتوسط والعدد الكلي
    if (this.ratings.length > 0) {
      const totalRating = this.ratings.reduce((sum, r) => sum + r.rating, 0);
      this.averageRating = Number((totalRating / this.ratings.length).toFixed(1));
      this.totalRatings = this.ratings.length;
    } else {
      this.averageRating = 0;
      this.totalRatings = 0;
    }

    // حفظ التغييرات
    const savedUser = await this.save();
    
    if (!savedUser) {
      throw new Error('فشل في حفظ التقييم');
    }

    return this;
  } catch (error) {
    console.error('Error in addRating:', error);
    throw error;
  }
};

// حذف تقييم
userSchema.methods.removeRating = async function(userId) {
  try {
    this.ratings = this.ratings.filter(r => r.userId.toString() !== userId.toString());
    
    // إعادة حساب المتوسط والعدد الكلي
    if (this.ratings.length > 0) {
      const totalRating = this.ratings.reduce((sum, r) => sum + r.rating, 0);
      this.averageRating = Number((totalRating / this.ratings.length).toFixed(1));
    } else {
      this.averageRating = 0;
    }
    this.totalRatings = this.ratings.length;

    return await this.save();
  } catch (error) {
    throw new Error('فشل في حذف التقييم');
  }
};

// إضافة مؤشرات للبحث لتحسين الأداء
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ email: 1 });

module.exports = mongoose.model('User', userSchema);

// controllers/ratingController.js

const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');

// إضافة تقييم جديد
const addRating = async (req, res, next) => {
  try {
    const { teacherId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user._id;

    console.log('Rating data:', { teacherId, rating, comment, userId });

    // التحقق من البيانات
    if (!rating || rating < 1 || rating > 5) {
      return next(new AppError('التقييم يجب أن يكون بين 1 و 5', 400));
    }

    // البحث عن الأستاذ
    const teacher = await User.findOne({ 
      _id: teacherId, 
      role: 'teacher',
      isActive: true 
    });

    if (!teacher) {
      return next(new AppError('لم يتم العثور على الأستاذ', 404));
    }

    // التحقق من أن المقيم ليس نفسه الأستاذ
    if (teacher._id.toString() === userId.toString()) {
      return next(new AppError('لا يمكنك تقييم نفسك', 400));
    }

    // إضافة/تحديث التقييم
    await teacher.addRating(userId, rating, comment || '');

    // إرجاع النتيجة
    res.status(200).json({
      status: 'success',
      data: {
        averageRating: teacher.averageRating,
        totalRatings: teacher.totalRatings
      }
    });

  } catch (error) {
    console.error('Error in addRating:', error);
    next(new AppError('حدث خطأ في إضافة التقييم', 500));
  }
};

// جلب تقييمات الأستاذ
const getTeacherRatings = async (req, res, next) => {
  try {
    const { teacherId } = req.params;

    const teacher = await User.findOne({ 
      _id: teacherId, 
      role: 'teacher',
      isActive: true 
    })
    .select('ratings averageRating totalRatings')
    .populate('ratings.userId', 'name');

    if (!teacher) {
      return next(new AppError('لم يتم العثور على الأستاذ', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        ratings: teacher.ratings,
        averageRating: teacher.averageRating,
        totalRatings: teacher.totalRatings
      }
    });

  } catch (error) {
    console.error('Error in getTeacherRatings:', error);
    next(new AppError('حدث خطأ في جلب التقييمات', 500));
  }
};

module.exports = {
  addRating,
  getTeacherRatings
};

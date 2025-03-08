// controllers/studentProgressController.js

const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');

const updateStudentProgress = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { memorizedParts } = req.body;

    // التحقق من صحة عدد الأجزاء
    if (memorizedParts < 0 || memorizedParts > 30) {
      return next(new AppError('عدد الأجزاء يجب أن يكون بين 0 و 30', 400));
    }

    // البحث عن الطالب وتحديث تقدمه
    const student = await User.findOne({ 
      _id: studentId, 
      role: 'student',
      isActive: true 
    });

    if (!student) {
      return next(new AppError('لم يتم العثور على الطالب', 404));
    }

    // تحديث عدد الأجزاء
    student.memorizedParts = memorizedParts;
    // سيتم حساب نسبة التقدم تلقائياً قبل الحفظ من خلال middleware

    await student.save();

    res.status(200).json({
      status: 'success',
      data: {
        memorizedParts: student.memorizedParts,
        progressPercentage: student.progressPercentage
      }
    });

  } catch (error) {
    next(new AppError('حدث خطأ في تحديث تقدم الطالب', 500));
  }
};

const getStudentProgress = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const student = await User.findOne({ 
      _id: studentId, 
      role: 'student',
      isActive: true 
    }).select('memorizedParts progressPercentage');

    if (!student) {
      return next(new AppError('لم يتم العثور على الطالب', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        memorizedParts: student.memorizedParts,
        progressPercentage: student.progressPercentage
      }
    });

  } catch (error) {
    next(new AppError('حدث خطأ في جلب تقدم الطالب', 500));
  }
};

module.exports = {
  updateStudentProgress,
  getStudentProgress
};

// controllers/communityController.js

const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');

const getTeachers = async (req, res, next) => {
  try {
    const teachers = await User.find({ role: 'teacher', isActive: true })
      .select('name specialization province averageRating totalRatings');

    res.status(200).json({
      status: 'success',
      data: teachers.map(teacher => ({
        id: teacher._id,
        name: teacher.name,
        specialization: teacher.specialization,
        location: teacher.province,
        rating: teacher.averageRating,
        totalRatings: teacher.totalRatings,
        imageUrl: teacher.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name)}&background=1B5E20&color=fff`,
      }))
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب قائمة الأساتذة', 500));
  }
};

const getStudents = async (req, res, next) => {
  try {
    const students = await User.find({ role: 'student', isActive: true })
      .select('name level province memorizedParts progressPercentage');

    res.status(200).json({
      status: 'success',
      data: students.map(student => ({
        id: student._id,
        name: student.name,
        level: student.level,
        location: student.province,
        memorizedParts: student.memorizedParts,
        progress: student.progressPercentage,
        imageUrl: student.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=1B5E20&color=fff`,
      }))
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب قائمة الطلاب', 500));
  }
};

module.exports = {
  getTeachers,
  getStudents
};

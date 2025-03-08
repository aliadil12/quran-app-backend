const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');

const getTeacherDetails = async (req, res, next) => {
  try {
    const { teacherId } = req.params;

    const teacher = await User.findOne({ 
      _id: teacherId, 
      role: 'teacher',
      isActive: true 
    }).select('-password');

    if (!teacher) {
      return next(new AppError('لم يتم العثور على الأستاذ', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        id: teacher._id,
        name: teacher.name,
        specialization: teacher.specialization,
        imageUrl: teacher.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name)}&background=1B5E20&color=fff`,
        rating: teacher.averageRating,
        totalRatings: teacher.totalRatings,
        location: teacher.province,
        phone: teacher.phone,
        email: teacher.email,
        birthDate: teacher.birthDate,
        quranParts: teacher.quranParts,
        teachingTime: teacher.teachingTime,
        readingLevel: teacher.readingLevel,
        teachingExperience: teacher.teachingExperience,
        education: teacher.education,
        bio: teacher.bio,
        gender: teacher.gender
      }
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب بيانات الأستاذ', 500));
  }
};

const getStudentDetails = async (req, res, next) => {
  try {
    const { studentId } = req.params;

    const student = await User.findOne({ 
      _id: studentId, 
      role: 'student',
      isActive: true 
    }).select('-password');

    if (!student) {
      return next(new AppError('لم يتم العثور على الطالب', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        id: student._id,
        name: student.name,
        level: student.level,
        imageUrl: student.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(student.name)}&background=1B5E20&color=fff`,
        memorizedParts: student.memorizedParts,
        progress: student.progressPercentage,
        location: student.province,
        phone: student.phone,
        email: student.email,
        birthDate: student.birthDate,
        gender: student.gender,
        studyHours: student.studyHours,
        studyTime: student.studyTime,
        parentPhone: student.parentPhone
      }
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب بيانات الطالب', 500));
  }
};

module.exports = {
  getTeacherDetails,
  getStudentDetails
};

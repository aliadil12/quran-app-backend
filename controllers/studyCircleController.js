const StudyCircle = require('../models/StudyCircle');
const User = require('../models/User');
const Message = require('../models/Message'); 
const { AppError } = require('../utils/errorHandler');

// جلب جميع الحلقات
const getAllCircles = async (req, res, next) => {
  try {
    const circles = await StudyCircle.find({ isActive: true })
      .populate('teacher', 'name')
      .select('name type teacher level members averageRating');

    res.status(200).json({
      status: 'success',
      data: circles.map(circle => ({
        id: circle._id,
        name: circle.name,
        type: circle.type,
        teacher: circle.teacher.name,
        teacherId: circle.teacher._id,
        level: circle.level,
        students: circle.members.length,
        rating: circle.averageRating || 0
      }))
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب الحلقات', 500));
  }
};

// جلب الحلقات المنضم إليها
const getUserCircles = async (req, res, next) => {
  try {
    const userId = req.user._id;
    
    let circles = [];
    if (req.user.role === 'teacher') {
      circles = await StudyCircle.find({ teacher: userId, isActive: true })
        .select('name type level members averageRating');
    } else {
      circles = await StudyCircle.find({ members: userId, isActive: true })
        .populate('teacher', 'name')
        .select('name type teacher level members averageRating');
    }

    res.status(200).json({
      status: 'success',
      data: circles.map(circle => ({
        id: circle._id,
        name: circle.name,
        type: circle.type,
        teacher: req.user.role === 'teacher' ? req.user.name : circle.teacher.name,
        teacherId: req.user.role === 'teacher' ? req.user._id : circle.teacher._id,
        level: circle.level,
        students: circle.members.length,
        rating: circle.averageRating || 0
      }))
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب الحلقات المنضم إليها', 500));
  }
};

// إنشاء حلقة جديدة
const createCircle = async (req, res, next) => {
  try {
    // التحقق من أن المستخدم معلم
    if (req.user.role !== 'teacher') {
      return next(new AppError('غير مسموح لك بإنشاء حلقة، يجب أن تكون معلماً', 403));
    }

    const { name, type, level, description, maxMembers } = req.body;

    // إنشاء الحلقة
    const circle = await StudyCircle.create({
      name,
      type,
      teacher: req.user._id,
      level,
      description,
      maxMembers,
      members: []
    });

    res.status(201).json({
      status: 'success',
      data: {
        id: circle._id,
        name: circle.name,
        type: circle.type,
        teacher: req.user.name,
        teacherId: req.user._id,
        level: circle.level,
        students: 0,
        rating: 0
      }
    });
  } catch (error) {
    next(new AppError('حدث خطأ في إنشاء الحلقة', 500));
  }
};

// جلب تفاصيل الحلقة
const getCircleDetails = async (req, res, next) => {
  try {
    const { circleId } = req.params;

    const circle = await StudyCircle.findById(circleId)
      .populate('teacher', 'name')
      .populate('members', 'name level memorizedParts progressPercentage')
      .select('-__v');

    if (!circle) {
      return next(new AppError('لم يتم العثور على الحلقة', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        id: circle._id,
        name: circle.name,
        type: circle.type,
        teacher: circle.teacher.name,
        teacherId: circle.teacher._id,
        level: circle.level,
        description: circle.description || '',
        maxMembers: circle.maxMembers,
        students: circle.members.length,
        rating: circle.averageRating || 0,
        members: circle.members.map(member => ({
          id: member._id,
          name: member.name,
          level: member.level || 'مبتدئ',
          memorizedParts: member.memorizedParts || 0,
          progress: member.progressPercentage || 0,
          isActive: true
        }))
      }
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب تفاصيل الحلقة', 500));
  }
};

// الانضمام للحلقة
const joinCircle = async (req, res, next) => {
  try {
    const { circleId } = req.params;
    const userId = req.user._id;

    // التحقق من أن المستخدم طالب
    if (req.user.role !== 'student') {
      return next(new AppError('غير مسموح لك بالانضمام للحلقة، يجب أن تكون طالباً', 403));
    }

    // البحث عن الحلقة
    const circle = await StudyCircle.findById(circleId);
    
    if (!circle) {
      return next(new AppError('لم يتم العثور على الحلقة', 404));
    }

    // التحقق من أن الحلقة غير ممتلئة
    if (circle.members.length >= circle.maxMembers) {
      return next(new AppError('الحلقة ممتلئة، لا يمكن الانضمام', 400));
    }

    // التحقق من أن المستخدم ليس منضماً بالفعل
    if (circle.members.includes(userId)) {
      return next(new AppError('أنت بالفعل منضم لهذه الحلقة', 400));
    }

    // إضافة المستخدم للحلقة
    circle.members.push(userId);
    await circle.save();

    res.status(200).json({
      status: 'success',
      message: 'تم الانضمام للحلقة بنجاح'
    });
  } catch (error) {
    next(new AppError('حدث خطأ في الانضمام للحلقة', 500));
  }
};

// مغادرة الحلقة
const leaveCircle = async (req, res, next) => {
  try {
    const { circleId } = req.params;
    const userId = req.user._id;

    // البحث عن الحلقة
    const circle = await StudyCircle.findById(circleId);
    
    if (!circle) {
      return next(new AppError('لم يتم العثور على الحلقة', 404));
    }

    // التحقق من أن المستخدم منضم للحلقة
    if (!circle.members.includes(userId)) {
      return next(new AppError('أنت لست منضماً لهذه الحلقة', 400));
    }

    // إزالة المستخدم من الحلقة
    circle.members = circle.members.filter(id => id.toString() !== userId.toString());
    await circle.save();

    res.status(200).json({
      status: 'success',
      message: 'تم مغادرة الحلقة بنجاح'
    });
  } catch (error) {
    next(new AppError('حدث خطأ في مغادرة الحلقة', 500));
  }
};

const deleteCircle = async (req, res, next) => {
  try {
    const { circleId } = req.params;
    const userId = req.user._id;

    // التحقق من وجود الحلقة
    const circle = await StudyCircle.findById(circleId);
    
    if (!circle) {
      return next(new AppError('لم يتم العثور على الحلقة', 404));
    }

    // التحقق من أن المستخدم هو مالك الحلقة (المعلم)
    if (circle.teacher.toString() !== userId.toString()) {
      return next(new AppError('غير مسموح لك بحذف هذه الحلقة', 403));
    }

    // حذف جميع رسائل الحلقة أولاً
    await Message.deleteMany({ studyCircleId: circleId, messageType: 'circle' });

    // حذف الحلقة
    await StudyCircle.findByIdAndDelete(circleId);

    res.status(200).json({
      status: 'success',
      message: 'تم حذف الحلقة ورسائلها بنجاح'
    });
  } catch (error) {
    console.error("Error al eliminar el círculo:", error);
    next(new AppError('حدث خطأ في حذف الحلقة', 500));
  }
};


module.exports = {
  getAllCircles,
  getUserCircles,
  createCircle,
  getCircleDetails,
  joinCircle,
  leaveCircle,
  deleteCircle
};

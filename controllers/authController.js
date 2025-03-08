const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');
const ValidationRules = require('../utils/validation');

const signToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '30d'
  });
};

const createSendToken = (user, statusCode, res) => {
  const token = signToken(user._id);

  // Remove sensitive data
  const userResponse = {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    ...(user.role === 'student' ? {
      level: user.level,
      studyTime: user.studyTime,
      parentPhone: user.parentPhone,
      memorizedParts: user.memorizedParts,
      progressPercentage: user.progressPercentage
    } : user.role === 'teacher' ? {
      specialization: user.specialization,
      teachingTime: user.teachingTime,
      education: user.education,
      quranParts: user.quranParts
    } : {})
  };

  res.status(statusCode).json({
    status: 'success',
    data: {
      user: userResponse,
      token
    }
  });
};

const registerUser = async (req, res, next) => {
  try {
    const { email, password, role, ...userData } = req.body;

    // التحقق من صحة البيانات
    const validationErrors = ValidationRules.validateRegistration(req.body);
    if (validationErrors.length > 0) {
      return next(new AppError(validationErrors[0], 400));
    }

    // التحقق من وجود المستخدم
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(
        new AppError(
          existingUser.role === role 
            ? 'البريد الإلكتروني مسجل مسبقاً'
            : 'البريد الإلكتروني مسجل بنوع حساب آخر',
          400
        )
      );
    }

    // إنشاء المستخدم
    const user = await User.create({
      email,
      password,
      role,
      ...userData
    });

    createSendToken(user, 201, res);

  } catch (error) {
    next(new AppError('حدث خطأ في إنشاء الحساب', 500));
  }
};

const loginUser = async (req, res, next) => {
  try {
    const { email, password, role } = req.body;

    // التحقق من وجود البيانات المطلوبة
    if (!email || !password || !role) {
      return next(new AppError('الرجاء إدخال جميع البيانات المطلوبة', 400));
    }

    // البحث عن المستخدم مع تضمين كلمة المرور
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return next(new AppError('البريد الإلكتروني غير مسجل في النظام', 401));
    }

    // التحقق من نوع الحساب
    if (user.role !== role) {
      return next(new AppError('هذا الحساب مسجل بنوع مختلف', 401));
    }

    // التحقق من حالة الحساب
    if (!user.isActive) {
      return next(new AppError('الحساب معطل، الرجاء التواصل مع الإدارة', 401));
    }

    // التحقق من كلمة المرور
    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect) {
      return next(new AppError('كلمة المرور غير صحيحة', 401));
    }

    createSendToken(user, 200, res);

  } catch (error) {
    next(new AppError('حدث خطأ في تسجيل الدخول', 500));
  }
};

const protect = async (req, res, next) => {
  try {
    // التحقق من وجود التوكن
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('غير مصرح بالوصول، الرجاء تسجيل الدخول', 401));
    }

    // التحقق من صحة التوكن
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // التحقق من وجود المستخدم
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('هذا المستخدم غير موجود', 401));
    }

    // التحقق من حالة الحساب
    if (!user.isActive) {
      return next(new AppError('الحساب معطل، الرجاء التواصل مع الإدارة', 401));
    }

    req.user = user;
    next();
  } catch (error) {
    next(new AppError('غير مصرح بالوصول', 401));
  }
};

const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({
      status: 'success',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          ...(user.role === 'student' ? {
            level: user.level,
            studyTime: user.studyTime,
            parentPhone: user.parentPhone
          } : user.role === 'teacher' ? {
            specialization: user.specialization,
            teachingTime: user.teachingTime,
            education: user.education
          } : {})
        }
      }
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب بيانات المستخدم', 500));
  }
};

module.exports = {
  registerUser,
  loginUser,
  protect,
  getMe
};

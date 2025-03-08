const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  try {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');

      if (!req.user) {
        return res.status(401).json({
          status: 'error',
          message: 'المستخدم غير موجود'
        });
      }

      next();
    } else {
      res.status(401).json({
        status: 'error',
        message: 'غير مصرح بالوصول، الرجاء تسجيل الدخول'
      });
    }
  } catch (error) {
    res.status(401).json({
      status: 'error',
      message: 'غير مصرح بالوصول'
    });
  }
};

module.exports = { protect };

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const {
  getAllCircles,
  getUserCircles,
  createCircle,
  getCircleDetails,
  joinCircle,
  leaveCircle,
  deleteCircle 
} = require('../controllers/studyCircleController');

// جلب جميع الحلقات
router.get('/', protect, getAllCircles);

// جلب حلقات المستخدم
router.get('/my-circles', protect, getUserCircles);

// إنشاء حلقة جديدة
router.post('/', protect, createCircle);

// جلب تفاصيل الحلقة
router.get('/:circleId', protect, getCircleDetails);

// الانضمام للحلقة
router.post('/:circleId/join', protect, joinCircle);

// مغادرة الحلقة
router.delete('/:circleId/leave', protect, leaveCircle);

// حذف الحلقة
router.delete('/:circleId', protect, deleteCircle);


module.exports = router;

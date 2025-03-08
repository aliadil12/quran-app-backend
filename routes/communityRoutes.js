// routes/communityRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { getTeachers, getStudents } = require('../controllers/communityController');
const { addRating, getTeacherRatings } = require('../controllers/ratingController');

// مسارات المجتمع الأساسية
router.get('/teachers', protect, getTeachers);
router.get('/students', protect, getStudents);

// مسارات التقييم
router.post('/teachers/:teacherId/ratings', protect, addRating);
router.get('/teachers/:teacherId/ratings', protect, getTeacherRatings);

module.exports = router;

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getTeacherDetails,
  getStudentDetails
} = require('../controllers/userDetailsController');

router.get('/teachers/:teacherId', protect, getTeacherDetails);
router.get('/students/:studentId', protect, getStudentDetails);

module.exports = router;

// routes/studentProgressRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  updateStudentProgress,
  getStudentProgress 
} = require('../controllers/studentProgressController');

router.route('/students/:studentId/progress')
  .get(protect, getStudentProgress)
  .put(protect, updateStudentProgress);

module.exports = router;

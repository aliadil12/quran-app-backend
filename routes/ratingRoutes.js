// routes/ratingRoutes.js

const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { addRating, getTeacherRatings } = require('../controllers/ratingController');

router.post('/teachers/:teacherId/ratings', protect, addRating);
router.get('/teachers/:teacherId/ratings', getTeacherRatings);

module.exports = router;

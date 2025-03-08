const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  createCall,
  endCall,
  joinCall,
  leaveCall,
  getActiveCalls,
  getCallHistory
} = require('../controllers/callController');

router.post('/create', protect, createCall);
router.put('/:callId/end', protect, endCall);
router.post('/:callId/join', protect, joinCall);
router.put('/:callId/leave', protect, leaveCall);
router.get('/active', protect, getActiveCalls);
router.get('/history', protect, getCallHistory);

module.exports = router;
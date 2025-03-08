const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');
const { 
  getPrivateChatHistory, 
  getCircleChatHistory, 
  getChatList,
  deletePrivateChat,
  deletePrivateChatForAll
} = require('../controllers/chatController');

// Rutas
router.get('/', protect, getChatList);
router.get('/private/:userId', protect, getPrivateChatHistory);
router.get('/circle/:circleId', protect, getCircleChatHistory);
router.delete('/private/:userId', protect, deletePrivateChat);
router.delete('/private/:userId/all', protect, deletePrivateChatForAll);

module.exports = router;

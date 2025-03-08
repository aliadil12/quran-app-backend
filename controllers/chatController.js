const Message = require('../models/Message');
const User = require('../models/User');
const StudyCircle = require('../models/StudyCircle');
const mongoose = require('mongoose');
const { AppError } = require('../utils/errorHandler');

// جلب تاريخ الدردشة الخاصة مع مستخدم معين
const getPrivateChatHistory = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    
    // استخراج معاملات التصفح المحسنة
    const limit = parseInt(req.query.limit) || 30;
    const before = req.query.before;
    
    // التحقق من وجود المستخدم الآخر
    const otherUser = await User.findById(userId);
    if (!otherUser) {
      return next(new AppError('المستخدم غير موجود', 404));
    }
    
    // إنشاء الشرط الأساسي للبحث
    let query = {
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ],
      messageType: 'private',
      deletedFor: { $ne: currentUserId }
    };
    
    // إضافة شرط الرسائل قبل توقيت معين للتحميل التدريجي
    if (before) {
      if (mongoose.Types.ObjectId.isValid(before)) {
        // إذا كان معرّف صالح لرسالة
        const referenceMsg = await Message.findById(before);
        if (referenceMsg) {
          query.createdAt = { $lt: referenceMsg.createdAt };
        }
      } else if (!isNaN(before)) {
        // إذا كان طابع زمني
        query.createdAt = { $lt: new Date(parseInt(before)) };
      }
    }
    
    // حساب إجمالي عدد الرسائل (اختياري لتحسين الأداء)
    const totalCount = await Message.countDocuments(query);
    
    // جلب الرسائل مع ترتيب تنازلي حسب التاريخ
    const messages = await Message.find(query)
      .sort({ createdAt: -1 }) // ترتيب تنازلي
      .limit(limit + 1) // جلب عنصر إضافي لمعرفة ما إذا كان هناك المزيد
      .populate('sender', 'name role profileImage')
      .populate({
        path: 'replyTo',
        select: 'content sender',
        populate: { path: 'sender', select: 'name' }
      });
    
    // تحديد ما إذا كان هناك المزيد من الرسائل
    const hasMore = messages.length > limit;
    
    // إزالة العنصر الإضافي
    if (hasMore) {
      messages.pop();
    }
    
    // تنسيق الرسائل للواجهة
    const formattedMessages = messages.map(message => {
      const isCurrentUserSender = message.sender._id.toString() === currentUserId.toString();
      const messageDate = message.createdAt;
      
      const formattedMessage = {
        id: message._id.toString(),
        text: message.content,
        sender: message.sender.name,
        senderId: message.sender._id.toString(),
        senderImage: message.sender.profileImage || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(message.sender.name)}&background=1B5E20&color=fff`,
        isMe: isCurrentUserSender,
        isTeacher: message.sender.role === 'teacher',
        timestamp: messageDate.getTime(), // إضافة الطابع الزمني بالمللي ثانية
        time: messageDate.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }), // تنسيق على غرار تلجرام
        status: isCurrentUserSender 
          ? (message.isRead ? 'read' : 'delivered') 
          : null
      };
      
      // إضافة معلومات الرد إذا كانت الرسالة ردًا على رسالة أخرى
      if (message.replyTo) {
        formattedMessage.replyTo = {
          id: message.replyTo._id.toString(),
          text: message.replyTo.content,
          sender: message.replyTo.sender.name
        };
      }
      
      return formattedMessage;
    });
    
    // تحديث الرسائل غير المقروءة
    await Message.updateMany(
      { 
        sender: userId, 
        receiver: currentUserId,
        isRead: false 
      },
      { isRead: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: formattedMessages,
      hasMore,
      oldest: hasMore && messages.length > 0 ? messages[messages.length - 1]._id.toString() : null,
      totalCount
    });
  } catch (error) {
    console.error('خطأ في جلب تاريخ الدردشة الخاصة:', error);
    next(new AppError('حدث خطأ في جلب تاريخ الدردشة', 500));
  }
};

// جلب تاريخ دردشة الحلقة
const getCircleChatHistory = async (req, res, next) => {
  try {
    const { circleId } = req.params;
    const currentUserId = req.user._id;
    
    // استخراج معاملات التصفح المحسنة
    const limit = parseInt(req.query.limit) || 30;
    const before = req.query.before;
    
    // التحقق من وجود الحلقة وأن المستخدم عضو فيها
    const circle = await StudyCircle.findById(circleId);
    if (!circle) {
      return next(new AppError('الحلقة غير موجودة', 404));
    }
    
    // التحقق من أن المستخدم عضو أو معلم في الحلقة
    const isMember = circle.members.some(id => id.toString() === currentUserId.toString());
    const isTeacher = circle.teacher.toString() === currentUserId.toString();
    
    if (!isMember && !isTeacher) {
      return next(new AppError('أنت لست عضواً في هذه الحلقة', 403));
    }
    
    // إنشاء الشرط الأساسي للبحث
    let query = { 
      studyCircleId: circleId,
      messageType: 'circle',
      deletedFor: { $ne: currentUserId }
    };
    
    // إضافة شرط الرسائل قبل توقيت معين للتحميل التدريجي
    if (before) {
      if (mongoose.Types.ObjectId.isValid(before)) {
        // إذا كان معرّف صالح لرسالة
        const referenceMsg = await Message.findById(before);
        if (referenceMsg) {
          query.createdAt = { $lt: referenceMsg.createdAt };
        }
      } else if (!isNaN(before)) {
        // إذا كان طابع زمني
        query.createdAt = { $lt: new Date(parseInt(before)) };
      }
    }
    
    // حساب إجمالي عدد الرسائل (اختياري لتحسين الأداء)
    const totalCount = await Message.countDocuments(query);
    
    // جلب الرسائل مع ترتيب تنازلي حسب التاريخ
    const messages = await Message.find(query)
      .sort({ createdAt: -1 }) // ترتيب تنازلي
      .limit(limit + 1) // جلب عنصر إضافي لمعرفة ما إذا كان هناك المزيد
      .populate('sender', 'name role profileImage')
      .populate({
        path: 'replyTo',
        select: 'content sender',
        populate: { path: 'sender', select: 'name' }
      });
    
    // تحديد ما إذا كان هناك المزيد من الرسائل
    const hasMore = messages.length > limit;
    
    // إزالة العنصر الإضافي
    if (hasMore) {
      messages.pop();
    }
    
    // تنسيق الرسائل
    const formattedMessages = messages.map(message => {
      const isCurrentUserSender = message.sender._id.toString() === currentUserId.toString();
      const messageDate = message.createdAt;
      
      const formattedMessage = {
        id: message._id.toString(),
        text: message.content,
        sender: message.sender.name,
        senderId: message.sender._id.toString(),
        senderImage: message.sender.profileImage || 
                    `https://ui-avatars.com/api/?name=${encodeURIComponent(message.sender.name)}&background=1B5E20&color=fff`,
        isMe: isCurrentUserSender,
        isTeacher: message.sender.role === 'teacher',
        timestamp: messageDate.getTime(), // إضافة الطابع الزمني بالمللي ثانية
        time: messageDate.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }), // تنسيق على غرار تلجرام
        status: isCurrentUserSender 
          ? (message.isRead ? 'read' : 'delivered') 
          : null
      };
      
      // إضافة معلومات الرد إذا كانت الرسالة ردًا على رسالة أخرى
      if (message.replyTo) {
        formattedMessage.replyTo = {
          id: message.replyTo._id.toString(),
          text: message.replyTo.content,
          sender: message.replyTo.sender.name
        };
      }
      
      return formattedMessage;
    });
    
    // تحديث حالة الرسائل غير المقروءة
    await Message.updateMany(
      { 
        studyCircleId: circleId,
        sender: { $ne: currentUserId },
        isRead: false 
      },
      { isRead: true }
    );
    
    res.status(200).json({
      status: 'success',
      data: formattedMessages,
      hasMore,
      oldest: hasMore && messages.length > 0 ? messages[messages.length - 1]._id.toString() : null,
      totalCount
    });
  } catch (error) {
    console.error('خطأ في جلب رسائل الحلقة:', error);
    next(new AppError('حدث خطأ في جلب رسائل الحلقة', 500));
  }
};

// جلب قائمة الدردشات للمستخدم
const getChatList = async (req, res, next) => {
  try {
    const currentUserId = req.user._id;
    
    // الدردشات الخاصة - إيجاد آخر رسالة من كل محادثة
    const privateChats = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(currentUserId.toString()) },
            { receiver: new mongoose.Types.ObjectId(currentUserId.toString()) }
          ],
          messageType: 'private' // تأكيد أن الرسائل خاصة
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $eq: ["$sender", new mongoose.Types.ObjectId(currentUserId.toString())] },
              "$receiver",
              "$sender"
            ]
          },
          lastMessage: { $first: "$$ROOT" },
          unreadCount: {
            $sum: {
              $cond: [
                { 
                  $and: [
                    { $eq: ["$receiver", new mongoose.Types.ObjectId(currentUserId.toString())] },
                    { $eq: ["$isRead", false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "userInfo"
        }
      },
      {
        $unwind: "$userInfo"
      }
    ]);
    
    // جلب الحلقات للمستخدم
    const userCircles = await StudyCircle.find({
      $or: [
        { members: currentUserId },
        { teacher: currentUserId }
      ]
    }).populate('teacher', 'name');
    
    // جلب آخر رسالة وعدد الرسائل غير المقروءة لكل حلقة
    const circleChats = await Promise.all(
      userCircles.map(async circle => {
        // جلب آخر رسالة لكل حلقة
        const latestMessage = await Message.findOne({ 
          studyCircleId: circle._id,
          messageType: 'circle' // تأكيد أن الرسائل تنتمي للحلقة
        })
        .sort({ createdAt: -1 })
        .populate('sender', 'name');
          
        // عدد الرسائل غير المقروءة
        const unreadCount = await Message.countDocuments({
          studyCircleId: circle._id,
          messageType: 'circle',
          sender: { $ne: currentUserId },
          isRead: false
        });
        
        return {
          _id: circle._id,
          name: circle.name,
          type: 'circle',
          isTeacher: circle.teacher._id.toString() === currentUserId.toString(),
          teacherName: circle.teacher.name,
          latestMessage,
          unreadCount
        };
      })
    );
    
    // تنسيق النتائج
    const privateChatsFormatted = privateChats.map(chat => ({
      id: chat._id.toString(),
      name: chat.userInfo.name,
      type: 'private',
      lastMessage: chat.lastMessage.content,
      time: new Date(chat.lastMessage.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }),
      unreadCount: chat.unreadCount,
      avatarUrl: chat.userInfo.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.userInfo.name)}&background=1B5E20&color=fff`,
      isOnline: false, // سيتم تحديثه من خلال WebSocket
      isPinned: false,
      isMuted: false,
      isTeacher: chat.userInfo.role === 'teacher',
      lastMessageStatus: chat.lastMessage.sender.toString() === currentUserId.toString() 
        ? (chat.lastMessage.isRead ? 'read' : 'delivered') 
        : null
    }));
    
    const circleChatsFormatted = circleChats.map(chat => ({
      id: chat._id.toString(),
      name: chat.name,
      type: 'circle',
      lastMessage: chat.latestMessage ? chat.latestMessage.content : 'لا توجد رسائل بعد',
      time: chat.latestMessage ? new Date(chat.latestMessage.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }) : '',
      unreadCount: chat.unreadCount,
      avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(chat.name)}&background=1B5E20&color=fff`,
      isOnline: true, // الحلقات دائمًا "متصلة"
      isPinned: false,
      isMuted: false,
      isTeacher: chat.isTeacher,
      teacherName: chat.teacherName
    }));
    
    res.status(200).json({
      status: 'success',
      data: {
        privateChats: privateChatsFormatted,
        circleChats: circleChatsFormatted
      }
    });
  } catch (error) {
    console.error('خطأ في جلب قائمة الدردشات:', error);
    next(new AppError('حدث خطأ في جلب قائمة الدردشات', 500));
  }
};


const deletePrivateChat = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    
    // تحديث حالة الرسائل بدلاً من حذفها فعلياً
    await Message.updateMany(
      { 
        $or: [
          { sender: currentUserId, receiver: userId },
          { sender: userId, receiver: currentUserId }
        ],
        messageType: 'private',
        deletedFor: { $ne: currentUserId }
      },
      { $addToSet: { deletedFor: currentUserId } }
    );
    
    res.status(200).json({
      status: 'success',
      message: 'تم حذف المحادثة بنجاح'
    });
  } catch (error) {
    console.error('خطأ في حذف المحادثة:', error);
    next(new AppError('حدث خطأ في حذف المحادثة', 500));
  }
};

// حذف المحادثة الخاصة للجميع
const deletePrivateChatForAll = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const currentUserId = req.user._id;
    
    // التأكد من أن المستخدم يحذف محادثته الخاصة فقط
    const messages = await Message.find({ 
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ],
      messageType: 'private'
    });
    
    if (messages.length === 0) {
      return next(new AppError('لا توجد محادثة لحذفها', 404));
    }
    
    // حذف الرسائل فعلياً من قاعدة البيانات
    await Message.deleteMany({ 
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId }
      ],
      messageType: 'private'
    });
    
    res.status(200).json({
      status: 'success',
      message: 'تم حذف المحادثة للجميع بنجاح'
    });
  } catch (error) {
    console.error('خطأ في حذف المحادثة للجميع:', error);
    next(new AppError('حدث خطأ في حذف المحادثة للجميع', 500));
  }
};


module.exports = {
  getPrivateChatHistory,
  getCircleChatHistory,
  getChatList,
  deletePrivateChat,
  deletePrivateChatForAll
};

const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const StudyCircle = require('../models/StudyCircle');
const config = require('../config/config');

function setupWebSocketServer(server) {
  const io = socketIO(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  
  // تتبع المستخدمين المتصلين بمعلومات إضافية
  const connectedUsers = new Map(); // userId => {socketId, user: {_id, name, role, profileImage}}
  
  // تتبع مجموعات الدردشة - circleId => Set of userIds
  const circleMembers = new Map();
  
  // وسيط التحقق من المصادقة
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('خطأ في المصادقة: التوكن غير موجود'));
      }
      
      const decoded = jwt.verify(token, config.jwtSecret);
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return next(new Error('المستخدم غير موجود'));
      }
      
      // حفظ معلومات المستخدم في الجلسة
      socket.user = {
        _id: user._id,
        name: user.name,
        role: user.role,
        profileImage: user.profileImage || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=1B5E20&color=fff`
      };
      
      next();
    } catch (error) {
      console.error('خطأ في مصادقة WebSocket:', error);
      next(new Error('خطأ في المصادقة: ' + error.message));
    }
  });
  
  io.on('connection', async (socket) => {
    console.log(`مستخدم متصل: ${socket.user.name} (${socket.user._id})`);
    
    // تسجيل المستخدم في قائمة المتصلين مع معلوماته
    connectedUsers.set(socket.user._id.toString(), {
      socketId: socket.id,
      user: socket.user,
      lastActive: new Date()
    });
    
    // الانضمام إلى غرفة شخصية للرسائل الخاصة
    socket.join(socket.user._id.toString());
    
    // إرسال حالة الاتصال للمستخدمين الآخرين
    io.emit('userStatus', { 
      userId: socket.user._id.toString(), 
      status: 'online',
      user: {
        name: socket.user.name,
        role: socket.user.role,
        profileImage: socket.user.profileImage
      }
    });
    
    // إرسال قائمة المستخدمين المتصلين
    socket.emit('usersOnline', Array.from(connectedUsers.keys()));
    
    // الانضمام التلقائي إلى حلقات المستخدم عند الاتصال
    try {
      let userCircles = [];
      
      if (socket.user.role === 'teacher') {
        // جلب الحلقات التي يدرسها المعلم
        userCircles = await StudyCircle.find({ 
          teacher: socket.user._id, 
          isActive: true 
        });
      } else {
        // جلب الحلقات التي ينتمي إليها الطالب
        userCircles = await StudyCircle.find({ 
          members: socket.user._id, 
          isActive: true 
        });
      }
      
      // الانضمام إلى غرف الحلقات
      for (const circle of userCircles) {
        socket.join(`circle_${circle._id}`);
        console.log(`${socket.user.name} انضم تلقائيًا إلى غرفة الحلقة: ${circle._id}`);
        
        // تحديث قائمة الأعضاء في الحلقة
        if (!circleMembers.has(circle._id.toString())) {
          circleMembers.set(circle._id.toString(), new Set());
        }
        circleMembers.get(circle._id.toString()).add(socket.user._id.toString());
      }
    } catch (error) {
      console.error('خطأ في الانضمام التلقائي للحلقات:', error);
    }
    
    // الانضمام يدويًا إلى غرف الحلقات
    socket.on('joinCircle', async (circleId) => {
      try {
        // التحقق من عضوية المستخدم في الحلقة
        const circle = await StudyCircle.findById(circleId);
        if (!circle) {
          socket.emit('messageError', { error: 'الحلقة غير موجودة' });
          return;
        }
        
        const isTeacher = circle.teacher.toString() === socket.user._id.toString();
        const isMember = circle.members.some(m => m.toString() === socket.user._id.toString());
        
        if (!isTeacher && !isMember) {
          socket.emit('messageError', { error: 'غير مصرح لك بالانضمام إلى هذه الحلقة' });
          return;
        }
        
        socket.join(`circle_${circleId}`);
        console.log(`${socket.user.name} انضم إلى غرفة الحلقة: ${circleId}`);
        
        // تحديث قائمة الأعضاء في الحلقة
        if (!circleMembers.has(circleId)) {
          circleMembers.set(circleId, new Set());
        }
        circleMembers.get(circleId).add(socket.user._id.toString());
        
        // إخبار المستخدم بالانضمام الناجح
        socket.emit('joinedCircle', { circleId });
        
        // إخبار أعضاء الحلقة الآخرين بانضمام المستخدم
        socket.to(`circle_${circleId}`).emit('userJoinedCircle', {
          circleId,
          user: {
            _id: socket.user._id,
            name: socket.user.name,
            role: socket.user.role,
            profileImage: socket.user.profileImage
          }
        });
      } catch (error) {
        console.error('خطأ في الانضمام للحلقة:', error);
        socket.emit('messageError', { error: 'خطأ في الانضمام للحلقة: ' + error.message });
      }
    });
    
    // الاستماع للرسائل الخاصة
    socket.on('privateMessage', async (data) => {
      try {
        const { receiverId, content } = data;
        
        // التحقق من وجود المستقبل
        const receiver = await User.findById(receiverId);
        if (!receiver) {
          socket.emit('messageError', { error: 'المستقبل غير موجود' });
          return;
        }
        
        // حفظ الرسالة في قاعدة البيانات
        const message = await Message.create({
          sender: socket.user._id,
          content,
          receiver: receiverId,
          messageType: 'private'
        });
        
        // تعبئة معلومات المرسل قبل الإرسال
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name role profileImage')
          .populate('receiver', 'name role profileImage');
        
        // الحصول على الطابع الزمني المنسق
        const messageDate = populatedMessage.createdAt;
        const formattedTime = messageDate.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
        
        // إرسال إلى المستقبل إذا كان متصلاً
        const receiverConnection = connectedUsers.get(receiverId);
        if (receiverConnection) {
          io.to(receiverConnection.socketId).emit('privateMessage', {
            id: populatedMessage._id.toString(),
            text: populatedMessage.content,
            sender: populatedMessage.sender.name,
            senderId: populatedMessage.sender._id.toString(),
            senderImage: populatedMessage.sender.profileImage,
            isMe: false,
            isTeacher: populatedMessage.sender.role === 'teacher',
            timestamp: messageDate.getTime(),
            time: formattedTime,
            status: 'delivered'
          });
        }
        
        // إرسال تأكيد الإرسال للمرسل
        socket.emit('messageSent', {
          id: populatedMessage._id.toString(),
          text: populatedMessage.content,
          sender: populatedMessage.sender.name,
          senderId: populatedMessage.sender._id.toString(),
          senderImage: populatedMessage.sender.profileImage,
          isMe: true,
          isTeacher: populatedMessage.sender.role === 'teacher',
          timestamp: messageDate.getTime(),
          time: formattedTime,
          status: 'sent'
        });
      } catch (error) {
        console.error('خطأ في إرسال رسالة خاصة:', error);
        socket.emit('messageError', { error: 'تعذر إرسال الرسالة: ' + error.message });
      }
    });
    
    // الاستماع لرسائل الحلقات
    socket.on('circleMessage', async (data) => {
      try {
        const { circleId, content } = data;
        
        // التحقق من وجود الحلقة وعضوية المستخدم
        const circle = await StudyCircle.findById(circleId);
        if (!circle) {
          socket.emit('messageError', { error: 'الحلقة غير موجودة' });
          return;
        }
        
        const isTeacher = circle.teacher.toString() === socket.user._id.toString();
        const isMember = circle.members.some(m => m.toString() === socket.user._id.toString());
        
        if (!isTeacher && !isMember) {
          socket.emit('messageError', { error: 'غير مصرح لك بإرسال رسائل إلى هذه الحلقة' });
          return;
        }
        
        // حفظ الرسالة في قاعدة البيانات
        const message = await Message.create({
          sender: socket.user._id,
          content,
          studyCircleId: circleId,
          messageType: 'circle'
        });
        
        // تعبئة معلومات المرسل قبل الإرسال
        const populatedMessage = await Message.findById(message._id)
          .populate('sender', 'name role profileImage');
        
        // الحصول على الطابع الزمني المنسق
        const messageDate = populatedMessage.createdAt;
        const formattedTime = messageDate.toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' });
        
        // تجهيز الرسالة للإرسال
        const formattedMessage = {
          id: populatedMessage._id.toString(),
          text: populatedMessage.content,
          sender: populatedMessage.sender.name,
          senderId: populatedMessage.sender._id.toString(),
          senderImage: populatedMessage.sender.profileImage,
          isTeacher: populatedMessage.sender.role === 'teacher',
          timestamp: messageDate.getTime(),
          time: formattedTime
        };
        
        // إرسال إلى جميع المستخدمين في الحلقة
        socket.to(`circle_${circleId}`).emit('circleMessage', {
          ...formattedMessage,
          isMe: false,
          status: null
        });
        
        // إرسال تأكيد للمرسل
        socket.emit('messageSent', {
          ...formattedMessage,
          isMe: true,
          status: 'sent'
        });
      } catch (error) {
        console.error('خطأ في إرسال رسالة للحلقة:', error);
        socket.emit('messageError', { error: 'تعذر إرسال الرسالة: ' + error.message });
      }
    });
    
    // إضافة وظيفة الرد على الرسائل
    socket.on('replyToMessage', async (data) => {
      try {
        const { messageId, content } = data;
        
        // التحقق من وجود الرسالة الأصلية
        const originalMessage = await Message.findById(messageId);
        if (!originalMessage) {
          socket.emit('messageError', { error: 'الرسالة الأصلية غير موجودة' });
          return;
        }
        
        // تأكد من أن المستخدم يستطيع الرد على هذه الرسالة (عضو في الحلقة أو طرف في المحادثة الخاصة)
        if (originalMessage.messageType === 'circle') {
          // التحقق من عضوية المستخدم في الحلقة
          const circle = await StudyCircle.findById(originalMessage.studyCircleId);
          if (!circle) {
            socket.emit('messageError', { error: 'الحلقة غير موجودة' });
            return;
          }
          
          const isTeacher = circle.teacher.toString() === socket.user._id.toString();
          const isMember = circle.members.some(m => m.toString() === socket.user._id.toString());
          
          if (!isTeacher && !isMember) {
            socket.emit('messageError', { error: 'غير مصرح لك بالرد في هذه الحلقة' });
            return;
          }
          
          // إنشاء رسالة الرد للحلقة
          const replyMessage = await Message.create({
            sender: socket.user._id,
            content,
            studyCircleId: originalMessage.studyCircleId,
            messageType: 'circle',
            replyTo: originalMessage._id
          });
          
          // تعبئة الرسالة
          const populatedReply = await Message.findById(replyMessage._id)
            .populate('sender', 'name role profileImage')
            .populate({
              path: 'replyTo',
              select: 'content sender',
              populate: { path: 'sender', select: 'name' }
            });
          
          // إعداد رسالة الرد
          const formattedReply = {
            id: populatedReply._id.toString(),
            text: populatedReply.content,
            sender: populatedReply.sender.name,
            senderId: populatedReply.sender._id.toString(),
            senderImage: populatedReply.sender.profileImage,
            isTeacher: populatedReply.sender.role === 'teacher',
            time: new Date(populatedReply.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }),
            replyTo: {
              id: populatedReply.replyTo._id.toString(),
              text: populatedReply.replyTo.content,
              sender: populatedReply.replyTo.sender.name
            }
          };
          
          // إرسال إلى جميع المستخدمين في الحلقة
          socket.to(`circle_${originalMessage.studyCircleId}`).emit('circleMessage', {
            ...formattedReply,
            isMe: false,
            status: null
          });
          
          // إرسال تأكيد للمرسل
          socket.emit('messageSent', {
            ...formattedReply,
            isMe: true,
            status: 'sent'
          });
          
        } else if (originalMessage.messageType === 'private') {
          // التحقق من أن المستخدم مشارك في المحادثة الخاصة
          const isParticipant = 
            originalMessage.sender.toString() === socket.user._id.toString() || 
            originalMessage.receiver.toString() === socket.user._id.toString();
          
          if (!isParticipant) {
            socket.emit('messageError', { error: 'غير مصرح لك بالرد على هذه الرسالة' });
            return;
          }
          
          // تحديد المستقبل (الطرف الآخر في المحادثة)
          const receiverId = originalMessage.sender.toString() === socket.user._id.toString() 
            ? originalMessage.receiver.toString() 
            : originalMessage.sender.toString();
          
          // إنشاء رسالة الرد الخاصة
          const replyMessage = await Message.create({
            sender: socket.user._id,
            content,
            receiver: receiverId,
            messageType: 'private',
            replyTo: originalMessage._id
          });
          
          // تعبئة الرسالة
          const populatedReply = await Message.findById(replyMessage._id)
            .populate('sender', 'name role profileImage')
            .populate('receiver', 'name')
            .populate({
              path: 'replyTo',
              select: 'content sender',
              populate: { path: 'sender', select: 'name' }
            });
          
          // إعداد رسالة الرد
          const formattedReply = {
            id: populatedReply._id.toString(),
            text: populatedReply.content,
            sender: populatedReply.sender.name,
            senderId: populatedReply.sender._id.toString(),
            senderImage: populatedReply.sender.profileImage,
            isTeacher: populatedReply.sender.role === 'teacher',
            time: new Date(populatedReply.createdAt).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' }),
            replyTo: {
              id: populatedReply.replyTo._id.toString(),
              text: populatedReply.replyTo.content,
              sender: populatedReply.replyTo.sender.name
            }
          };
          
          // إرسال إلى المستقبل إذا كان متصلاً
          const receiverConnection = connectedUsers.get(receiverId);
          if (receiverConnection) {
            io.to(receiverConnection.socketId).emit('privateMessage', {
              ...formattedReply,
              isMe: false,
              status: 'delivered'
            });
          }
          
          // إرسال تأكيد للمرسل
          socket.emit('messageSent', {
            ...formattedReply,
            isMe: true,
            status: 'sent'
          });
        }
        
      } catch (error) {
        console.error('خطأ في الرد على الرسالة:', error);
        socket.emit('messageError', { error: 'تعذر إرسال الرد: ' + error.message });
      }
    });
    
    // تحديث حالة قراءة الرسائل
    socket.on('markAsRead', async (data) => {
      try {
        const { messageIds } = data;
        if (!Array.isArray(messageIds) || messageIds.length === 0) {
          return;
        }
        
        // تحديث حالة الرسائل
        await Message.updateMany(
          { 
            _id: { $in: messageIds },
            receiver: socket.user._id, // تأكد من أن المستخدم هو المستقبل فعلاً
            isRead: false 
          },
          { isRead: true }
        );
        
        socket.emit('messagesMarkedAsRead', { messageIds });
        
        // إبلاغ المرسلين بقراءة رسائلهم
        const messages = await Message.find({ _id: { $in: messageIds } });
        const senderIds = [...new Set(messages.map(m => m.sender.toString()))];
        
        for (const senderId of senderIds) {
          const senderConnection = connectedUsers.get(senderId);
          if (senderConnection) {
            const readMessageIds = messages
              .filter(m => m.sender.toString() === senderId)
              .map(m => m._id);
              
            io.to(senderConnection.socketId).emit('messagesRead', { 
              messageIds: readMessageIds,
              readBy: socket.user._id
            });
          }
        }
      } catch (error) {
        console.error('خطأ في تحديث حالة قراءة الرسائل:', error);
      }
    });
    
    // مغادرة الحلقات
    socket.on('leaveCircle', async (circleId) => {
      try {
        socket.leave(`circle_${circleId}`);
        console.log(`${socket.user.name} غادر غرفة الحلقة: ${circleId}`);
        
        // تحديث قائمة الأعضاء في الحلقة
        if (circleMembers.has(circleId)) {
          circleMembers.get(circleId).delete(socket.user._id.toString());
        }
        
        // إخبار الأعضاء الآخرين بمغادرة المستخدم
        socket.to(`circle_${circleId}`).emit('userLeftCircle', {
          circleId,
          userId: socket.user._id.toString()
        });
      } catch (error) {
        console.error('خطأ في مغادرة الحلقة:', error);
      }
    });
    
    // الحصول على الأعضاء النشطين في الحلقة
    socket.on('getActiveCircleMembers', (circleId) => {
      try {
        const members = circleMembers.get(circleId) || new Set();
        const activeMembers = Array.from(members).map(userId => {
          const connection = connectedUsers.get(userId);
          return connection ? connection.user : null;
        }).filter(Boolean);
        
        socket.emit('activeCircleMembers', {
          circleId,
          members: activeMembers
        });
      } catch (error) {
        console.error('خطأ في جلب الأعضاء النشطين:', error);
      }
    });
    
    // تتبع حالة الاتصال
    socket.on('disconnect', () => {
      console.log(`مستخدم انقطع اتصاله: ${socket.user.name}`);
      
      // تحديث الوقت الأخير للنشاط قبل الحذف
      const userInfo = connectedUsers.get(socket.user._id.toString());
      if (userInfo) {
        userInfo.lastActive = new Date();
      }
      
      // حذف المستخدم من القائمة بعد تأخير قصير
      // هذا يتيح إمكانية إعادة الاتصال السريع دون فقدان الحالة
      setTimeout(() => {
        // التحقق مما إذا كان المستخدم لم يتصل مرة أخرى
        const currentConnection = connectedUsers.get(socket.user._id.toString());
        if (currentConnection && currentConnection.socketId === socket.id) {
          connectedUsers.delete(socket.user._id.toString());
          
          // تحديث حالة المستخدم في جميع الحلقات التي كان فيها
          for (const [circleId, members] of circleMembers.entries()) {
            if (members.has(socket.user._id.toString())) {
              members.delete(socket.user._id.toString());
              // إخبار الأعضاء الآخرين
              io.to(`circle_${circleId}`).emit('userLeftCircle', {
                circleId,
                userId: socket.user._id.toString()
              });
            }
          }
          
          // إخبار جميع المستخدمين بقطع الاتصال
          io.emit('userStatus', { 
            userId: socket.user._id.toString(), 
            status: 'offline',
            lastSeen: new Date()
          });
          
          // تحديث قائمة المستخدمين المتصلين
          io.emit('usersOnline', Array.from(connectedUsers.keys()));
        }
      }, 5000); // تأخير 5 ثوانٍ قبل اعتبار المستخدم غير متصل
    });
  });
  
  return io;
}

module.exports = setupWebSocketServer;

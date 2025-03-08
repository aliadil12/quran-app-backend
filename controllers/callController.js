const Call = require('../models/Call');
const User = require('../models/User');
const { AppError } = require('../utils/errorHandler');

const createCall = async (req, res, next) => {
  try {
    const { type, callType, studyCircleId } = req.body;
    const roomId = `${studyCircleId}_${Date.now()}`;
    const call = await Call.create({
      teacherId: req.user._id,
      roomId,
      type,
      callType,
      studyCircleId,
      status: 'جارية'
    });
    await Call.findByIdAndUpdate(call._id, {
      $push: { participants: { userId: req.user._id } }
    });
    res.status(201).json({
      status: 'success',
      data: call
    });
  } catch (error) {
    next(new AppError('حدث خطأ في إنشاء المكالمة', 500));
  }
};

const endCall = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const call = await Call.findById(callId);
    if (!call) {
      return next(new AppError('المكالمة غير موجودة', 404));
    }
    call.status = 'منتهي';
    call.endTime = Date.now();
    call.participants.forEach(participant => {
      if (!participant.leaveTime) {
        participant.leaveTime = Date.now();
      }
    });
    await call.save();
    res.status(200).json({
      status: 'success',
      data: call
    });
  } catch (error) {
    next(new AppError('حدث خطأ في إنهاء المكالمة', 500));
  }
};

const joinCall = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const call = await Call.findById(callId);
    if (!call) {
      return next(new AppError('المكالمة غير موجودة', 404));
    }
    if (call.status === 'منتهي') {
      return next(new AppError('المكالمة قد انتهت', 400));
    }
    
    // Verificar si el usuario ya está en la llamada
    const existingParticipant = call.participants.find(
      p => p.userId.toString() === req.user._id.toString() && !p.leaveTime
    );
    
    if (existingParticipant) {
      return res.status(200).json({
        status: 'success',
        data: {
          roomId: call.roomId,
          type: call.type
        }
      });
    }
    
    await Call.findByIdAndUpdate(callId, {
      $push: { participants: { userId: req.user._id } }
    });
    
    res.status(200).json({
      status: 'success',
      data: {
        roomId: call.roomId,
        type: call.type
      }
    });
  } catch (error) {
    next(new AppError('حدث خطأ في الانضمام للمكالمة', 500));
  }
};

const leaveCall = async (req, res, next) => {
  try {
    const { callId } = req.params;
    const call = await Call.findById(callId);
    if (!call) {
      return next(new AppError('المكالمة غير موجودة', 404));
    }
    
    const participantIndex = call.participants.findIndex(
      p => p.userId.toString() === req.user._id.toString() && !p.leaveTime
    );
    
    if (participantIndex === -1) {
      return res.status(200).json({
        status: 'success',
        message: 'أنت لست مشاركًا في هذه المكالمة'
      });
    }
    
    call.participants[participantIndex].leaveTime = Date.now();
    await call.save();
    
    // Si el profesor abandona la llamada, finalizarla
    if (req.user.role === 'teacher' && 
        call.teacherId.toString() === req.user._id.toString() && 
        call.status !== 'منتهي') {
      call.status = 'منتهي';
      call.endTime = Date.now();
      await call.save();
    }
    
    res.status(200).json({
      status: 'success',
      message: 'تم مغادرة المكالمة بنجاح'
    });
  } catch (error) {
    next(new AppError('حدث خطأ في مغادرة المكالمة', 500));
  }
};

const getActiveCalls = async (req, res, next) => {
  try {
    const { studyCircleId } = req.query;
    if (!studyCircleId) {
      return next(new AppError('معرف حلقة الدراسة مطلوب', 400));
    }
    const activeCalls = await Call.find({
      studyCircleId,
      status: 'جارية'
    }).populate('teacherId', 'name');
    res.status(200).json({
      status: 'success',
      data: activeCalls
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب المكالمات النشطة', 500));
  }
};

const getCallHistory = async (req, res, next) => {
  try {
    const { studyCircleId } = req.query;
    if (!studyCircleId) {
      return next(new AppError('معرف حلقة الدراسة مطلوب', 400));
    }
    const callHistory = await Call.find({
      studyCircleId,
      status: 'منتهي'
    })
    .populate('teacherId', 'name')
    .sort({ endTime: -1 });
    res.status(200).json({
      status: 'success',
      data: callHistory
    });
  } catch (error) {
    next(new AppError('حدث خطأ في جلب سجل المكالمات', 500));
  }
};

module.exports = {
  createCall,
  endCall,
  joinCall,
  leaveCall,
  getActiveCalls,
  getCallHistory
};
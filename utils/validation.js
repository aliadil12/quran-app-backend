// utils/validation.js

const ValidationRules = {
  EMAIL_PATTERN: /^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/,
  PHONE_PATTERN: /^07[0-9]{9}$/,
  ARABIC_NAME_PATTERN: /^[\u0600-\u06FF\s]+$/,
  
  PASSWORD_MIN_LENGTH: 6,
  BIO_MIN_LENGTH: 5,
  BIO_MAX_LENGTH: 500,

  STUDENT_AGE_RANGE: { min: 5, max: 60 },
  TEACHER_AGE_RANGE: { min: 12, max: 70 },

  ROLES: ['student', 'teacher', 'user'],

  validateRegistration: (data) => {
    const errors = [];

    // التحقق من البيانات الأساسية المشتركة
    if (!data.email?.match(ValidationRules.EMAIL_PATTERN)) {
      errors.push('البريد الإلكتروني غير صحيح');
    }
    if (!data.password || data.password.length < ValidationRules.PASSWORD_MIN_LENGTH) {
      errors.push(`كلمة المرور يجب أن تكون ${ValidationRules.PASSWORD_MIN_LENGTH} أحرف على الأقل`);
    }
    if (!data.name?.match(ValidationRules.ARABIC_NAME_PATTERN)) {
      errors.push('الاسم يجب أن يكون باللغة العربية');
    }

    // التحقق من البيانات حسب نوع المستخدم
    if (data.role === 'teacher' || data.role === 'student') {
      if (!data.phone?.match(ValidationRules.PHONE_PATTERN)) {
        errors.push('رقم الهاتف غير صحيح');
      }
      
      if (data.birthDate) {
        const age = new Date().getFullYear() - new Date(data.birthDate).getFullYear();
        const range = data.role === 'teacher' ? ValidationRules.TEACHER_AGE_RANGE : ValidationRules.STUDENT_AGE_RANGE;
        if (age < range.min || age > range.max) {
          errors.push(`العمر يجب أن يكون بين ${range.min} و ${range.max} سنة`);
        }
      }

      if (data.role === 'teacher') {
        if (!data.specialization) errors.push('التخصص مطلوب');
        if (!data.quranParts) errors.push('عدد الأجزاء المحفوظة مطلوب');
        if (!data.teachingTime) errors.push('وقت التدريس مطلوب');
        if (data.bio && (data.bio.length < ValidationRules.BIO_MIN_LENGTH || 
            data.bio.length > ValidationRules.BIO_MAX_LENGTH)) {
          errors.push(`النبذة التعريفية يجب أن تكون بين ${ValidationRules.BIO_MIN_LENGTH} و ${ValidationRules.BIO_MAX_LENGTH} حرف`);
        }
      } else if (data.role === 'student') {
        if (!data.parentPhone?.match(ValidationRules.PHONE_PATTERN)) {
          errors.push('رقم هاتف ولي الأمر غير صحيح');
        }
        if (!data.studyHours) errors.push('ساعات الدراسة مطلوبة');
        if (!data.studyTime) errors.push('وقت الدراسة مطلوب');
        if (!data.level) errors.push('المستوى مطلوب');
      }
    }

    return errors;
  }
};

module.exports = ValidationRules;

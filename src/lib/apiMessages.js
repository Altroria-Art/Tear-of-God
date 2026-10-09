// Translate server errors at the UI boundary. Keep server codes, status and data intact.
// Backend diagnostics stay in the backend; people see a short, useful message.
export function apiErrorMessage(error, { code, status, t }) {
  const text = typeof error === 'string' ? error : '';
  const rules = [
    [/Invalid email or password|อีเมลหรือรหัสผ่านไม่ถูกต้อง/i, 'loginInvalid'],
    [/Incorrect current password|รหัสผ่านปัจจุบันไม่ถูกต้อง/i, 'currentPasswordInvalid'],
    [/Email already registered|อีเมลนี้ถูกใช้งานแล้ว/i, 'emailTaken'],
    [/Invalid email|อีเมลไม่ถูกต้อง/i, 'emailInvalid'],
    [/Use 8[–-]256|รหัสผ่านต้องมี 8|password must be 8/i, 'passwordLength'],
    [/Use 1[–-]50|ชื่อต้องมี 1|Invalid name|ชื่อไม่ถูกต้อง/i, 'nameLength'],
    [/Invalid, expired or used code|Invalid or used reset code|Reset code expired|รหัสยืนยัน.*(?:หมดอายุ|ใช้งาน)|ลิงก์ไม่ถูกต้อง/i, 'resetInvalid'],
    [/six-digit code|กรอกอีเมลและรหัสยืนยัน/i, 'resetRequired'],
    [/Google verification failed|Google ID token|ยืนยันบัญชี Google/i, 'googleFailed'],
    [/Please log in again|ข้อมูลบัญชีเปลี่ยนแล้ว|session.*expired/i, 'sessionExpired'],
    [/Unauthorized|Please log in|กรุณาเข้าสู่ระบบ/i, 'loginRequired'],
    [/already reported|ได้รายงาน.*แล้ว/i, 'alreadyReported'],
    [/report.*own|รายงานเนื้อหาของตัวเอง/i, 'reportOwn'],
    [/follow ตัวเอง|follow yourself/i, 'followOwn'],
    [/Cannot duel your own|ดวล.*ตัวเอง/i, 'duelOwn'],
    [/Badge is not unlocked|ป้ายนี้ยังไม่ถูกปลดล็อก/i, 'badgeLocked'],
    [/Invalid badge|ป้ายไม่ถูกต้อง/i, 'badgeInvalid'],
    [/Template cooldown|cooldown is active/i, 'topicCooldown'],
    [/Uploads are disabled in Preview/i, 'previewUploads'],
    [/Google sign-in is disabled in Preview|synthetic test accounts only/i, 'previewAccount'],
    [/No file provided/i, 'fileRequired'],
    [/5MB|ไฟล์ใหญ่เกินไป/i, 'imageSize'],
    [/ชนิดไฟล์ไม่ถูกต้อง|เนื้อหาไฟล์ไม่ตรง|Invalid avatar URL/i, 'imageType'],
    [/ปีเข้าศึกษาไม่ถูกต้อง/i, 'yearInvalid'],
    [/มหาวิทยาลัยไม่ถูกต้อง/i, 'universityInvalid'],
    [/คณะไม่ถูกต้อง/i, 'facultyInvalid'],
    [/สาขาไม่ตรงกับคณะ/i, 'majorInvalid'],
    [/ไม่สามารถจัดการบัญชีแอดมินของตัวเอง/i, 'adminOwn'],
    [/เกิน 24 ชั่วโมง/i, 'reportExpired'],
    [/รายงานไม่พบ/i, 'reportMissing'],
    [/Comment not found|คอมเมนต์.*(?:ไม่มี|ไม่พบ)/i, 'commentMissing'],
    [/Template not found|ไม่พบเทมเพลต|เทมเพลตไม่มี/i, 'topicMissing'],
    [/Duel not found/i, 'duelMissing'],
    [/ไม่พบผู้ใช้/i, 'userMissing'],
    [/โพสต์ไม่มี|^Not found$/i, 'postMissing'],
    [/Tier labels must be unique/i, 'tierNamesUnique'],
    [/Ranking items must be unique/i, 'itemsUnique'],
    [/unknown tier|no valid tiers|no owner to duel/i, 'rankingInvalid'],
    [/Forbidden|ไม่มีสิทธิ์/i, 'forbidden'],
    [/too large/i, 'requestLarge'],
    [/Service temporarily unavailable|เกิดข้อผิดพลาดฐานข้อมูล/i, 'unavailable'],
  ];
  if (code === 'RATE_LIMITED' || status === 429) return t('apiMessages.tooFast');
  if (code === 'BADGE_NOT_UNLOCKED') return t('apiMessages.badgeLocked');
  if (code === 'INVALID_BADGE') return t('apiMessages.badgeInvalid');
  const match = rules.find(([pattern]) => pattern.test(text));
  if (match) return t(`apiMessages.${match[1]}`);
  const fieldLength = text.match(/^(username|title|description|content|bio|reason|email|password) must be (\d+(?:[–-]\d+)?|at most \d+) characters$/i);
  if (fieldLength) return t('apiMessages.fieldLength', { field: t(`apiFields.${fieldLength[1].toLowerCase()}`), range: fieldLength[2].replace('at most ', '0–') });
  if (status === 401) return t('apiMessages.loginRequired');
  if (status === 403) return t('apiMessages.forbidden');
  if (status === 404) return t('common.pageNotFound');
  if (status === 413) return t('apiMessages.requestLarge');
  if (status >= 500 || code === 'INTERNAL_ERROR') return t('apiMessages.unavailable');
  if (status === 400 || /invalid|must be|must contain|is required|Missing |required|ข้อมูลไม่ถูกต้อง/i.test(text)) return t('apiMessages.checkDetails');
  return t('errors.actionFailed');
}

export function localizeApiResult(result, status, t) {
  if (!result || typeof result !== 'object' || !result.error) return result;
  return { ...result, error: apiErrorMessage(result.error, { code: result.code, status, t }) };
}

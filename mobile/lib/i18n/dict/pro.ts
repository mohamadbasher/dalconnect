import type { Dict } from "../index";

// Professional side: dashboard, jobs, earnings, gallery, business profile.
export const pro: Dict = {
  // ---------- pro-mode gate ----------
  proGateTitle: { ar: "منطقة المهنيين", he: "אזור בעלי המקצוע" },
  proGateSubtitle: {
    ar: "انضم كمهني لاستقبال طلبات عمل من عملاء بالقرب منك والربح من مهاراتك",
    he: "הצטרפו כבעלי מקצוע כדי לקבל בקשות עבודה מלקוחות באזורכם ולהרוויח מהכישורים שלכם",
  },
  proGateCta: { ar: "الانضمام كمهني", he: "הצטרפות כבעל מקצוע" },

  // ---------- dashboard ----------
  availableForWork: { ar: "متاح لاستقبال الطلبات", he: "זמין לקבלת בקשות" },
  availabilityOffHint: {
    ar: "لن تصلك طلبات جديدة وأنت غير متاح",
    he: "כל עוד אינכם זמינים לא יגיעו אליכם בקשות חדשות",
  },
  openRequestsTitle: { ar: "طلبات مفتوحة بالقرب منك", he: "בקשות פתוחות באזורך" },
  accept: { ar: "قبول", he: "אישור" },
  reject: { ar: "رفض", he: "דחייה" },
  rejectConfirmTitle: { ar: "رفض الحجز؟", he: "לדחות את ההזמנה?" },
  rejectConfirmMsg: {
    ar: "سيتم إبلاغ العميل برفض الحجز. لا يمكن التراجع عن ذلك.",
    he: "הלקוח יקבל הודעה שההזמנה נדחתה. אי אפשר לבטל את הפעולה.",
  },
  sendOffer: { ar: "إرسال عرض سعر", he: "שליחת הצעת מחיר" },
  offerEtaLabel: { ar: "متى تستطيع الوصول؟", he: "תוך כמה זמן תגיעו?" },
  etaCustom: { ar: "وقت آخر", he: "זמן אחר" },
  etaMinutesPlaceholder: { ar: "بالدقائق", he: "בדקות" },
  offerMessageLabel: { ar: "رسالة للعميل", he: "הודעה ללקוח" },
  offerMessagePlaceholder: {
    ar: "اكتب تفاصيل إضافية عن عرضك…",
    he: "כתבו פרטים נוספים על ההצעה…",
  },
  offerSent: { ar: "تم إرسال عرضك للعميل", he: "ההצעה נשלחה ללקוח" },
  alreadyOffered: { ar: "سبق أن أرسلت عرضاً لهذا الطلب", he: "כבר שלחתם הצעה לבקשה הזו" },
  yourOffer: { ar: "عرضك", he: "ההצעה שלך" },
  noOpenRequests: { ar: "لا توجد طلبات مفتوحة حالياً", he: "אין כרגע בקשות פתוחות" },
  noOpenRequestsHint: {
    ar: "سنعلمك فور وصول طلب جديد في مجالات عملك",
    he: "נעדכן אתכם ברגע שתגיע בקשה חדשה בתחומים שלכם",
  },
  photosCount: { ar: "{count} صور", he: "{count} תמונות" },
  statOpenNow: { ar: "طلبات مفتوحة الآن", he: "בקשות פתוחות כעת" },
  statPendingOffers: { ar: "عروضي المعلّقة", he: "הצעות ממתינות" },
  statActiveJobs: { ar: "أعمال جارية", he: "עבודות פעילות" },
  offerPending: { ar: "بانتظار رد العميل", he: "ממתינה למענה" },
  offerAccepted: { ar: "عرض مقبول", he: "הצעה התקבלה" },
  offerRejected: { ar: "عرض مرفوض", he: "הצעה נדחתה" },
  offerWithdrawn: { ar: "عرض مسحوب", he: "הצעה בוטלה" },

  // ---------- quoting (request-and-quote model) ----------
  quoteUrgent: { ar: "عاجل — اليوم", he: "דחוף — היום" },
  quoteScheduled: { ar: "بموعد محدد", he: "במועד מתוזמן" },
  quotePreferredTime: { ar: "الموعد المفضّل", he: "מועד מועדף" },
  quoteMinLabel: { ar: "من (₪)", he: "מ־ (₪)" },
  quoteMaxLabel: { ar: "إلى (₪)", he: "עד (₪)" },
  quoteMinPlaceholder: { ar: "200", he: "200" },
  quoteMaxPlaceholder: { ar: "350", he: "350" },
  quoteRangeHint: {
    ar: "العميل يرى النطاق فقط — السعر النهائي تتفقان عليه بالهاتف",
    he: "הלקוח רואה רק את הטווח — את המחיר הסופי תסכמו בטלפון",
  },
  quoteRangeRequired: {
    ar: "أدخل أقل سعر وأعلى سعر",
    he: "הזינו מחיר מינימלי ומקסימלי",
  },
  quoteRangeInvalid: {
    ar: "أدخل مبلغين صحيحين أكبر من صفر",
    he: "הזינו שני סכומים תקינים הגדולים מאפס",
  },
  quoteRangeOrder: {
    ar: "أقل سعر يجب ألا يتجاوز أعلى سعر",
    he: "המחיר המינימלי לא יכול להיות גבוה מהמקסימלי",
  },
  quoteAgreedRange: { ar: "نطاق السعر المتفق عليه", he: "טווח המחיר שסוכם" },
  quoteFinalOnPhone: {
    ar: "اتفق مع العميل على السعر النهائي بالهاتف",
    he: "סכמו עם הלקוח את המחיר הסופי בטלפון",
  },

  // ---------- jobs tab ----------
  proSegActive: { ar: "الحالية", he: "פעילות" },
  proSegDone: { ar: "المنجزة", he: "הושלמו" },
  segOther: { ar: "أخرى", he: "אחרות" },
  noJobs: { ar: "لا توجد أعمال هنا", he: "אין כאן עבודות" },
  noJobsHint: {
    ar: "الأعمال التي تقبلها ستظهر في هذه القائمة",
    he: "עבודות שתקבלו יופיעו ברשימה הזו",
  },

  // ---------- job screen ----------
  jobTitle: { ar: "تفاصيل العمل", he: "פרטי העבודה" },
  customerTitle: { ar: "العميل", he: "הלקוח" },
  proDetailsTitle: { ar: "التفاصيل", he: "פרטים" },
  proAddressLabel: { ar: "العنوان", he: "כתובת" },
  proScheduleLabel: { ar: "الموعد", he: "מועד" },
  proAsap: { ar: "في أقرب وقت ممكن", he: "בהקדם האפשרי" },
  agreedPrice: { ar: "السعر المتفق عليه", he: "המחיר שסוכם" },
  proCashNote: { ar: "الدفع نقداً عند إتمام العمل", he: "התשלום במזומן בסיום העבודה" },
  navigate: { ar: "التوجه عبر الخرائط", he: "ניווט" },
  progressTitle: { ar: "مراحل العمل", he: "שלבי העבודה" },
  imOnMyWay: { ar: "أنا في الطريق", he: "אני בדרך" },
  startWorking: { ar: "بدء العمل", he: "התחלת העבודה" },
  finishJob: { ar: "إنهاء العمل", he: "סיום העבודה" },
  proWhatsApp: { ar: "واتساب", he: "וואטסאפ" },
  proChatInApp: { ar: "المراسلة داخل التطبيق", he: "צ׳אט באפליקציה" },
  proContactLocked: {
    ar: "يظهر رقم العميل بعد قبول عرضك",
    he: "מספר הלקוח יופיע לאחר שההצעה תתקבל",
  },
  proContactUnavailable: {
    ar: "تعذّر جلب رقم العميل — اسحب للتحديث",
    he: "לא הצלחנו לטעון את מספר הלקוח — משכו לרענון",
  },
  proFinalPriceTitle: { ar: "السعر النهائي", he: "המחיר הסופי" },
  proFinalPriceLabel: { ar: "المبلغ الذي اتفقتما عليه (₪)", he: "הסכום שסוכם (₪)" },
  proFinalPriceHint: {
    ar: "أدخل المبلغ الذي تقاضيته فعلاً من العميل — عمولة المنصة تُحتسب على أساسه.",
    he: "הזינו את הסכום שגביתם בפועל מהלקוח — עמלת הפלטפורמה מחושבת לפיו.",
  },
  proFinalPriceInvalid: {
    ar: "أدخل مبلغاً صحيحاً أكبر من صفر",
    he: "הזינו סכום תקין הגדול מאפס",
  },
  proFinalPriceConfirm: { ar: "تأكيد وإنهاء العمل", he: "אישור וסיום העבודה" },
  earningsForJob: { ar: "أرباحك من هذا العمل", he: "הרווח שלך מהעבודה" },
  grossAmount: { ar: "المبلغ الإجمالي", he: "סכום כולל" },
  netAmount: { ar: "الصافي لك", he: "נטו עבורך" },
  jobNotFound: { ar: "العمل غير موجود", he: "העבודה לא נמצאה" },
  cancelledByCustomerTitle: { ar: "ألغى العميل هذا الحجز", he: "הלקוח ביטל את ההזמנה" },
  proCancelReasonLabel: { ar: "سبب الإلغاء", he: "סיבת הביטול" },
  statusUpdated: { ar: "تم تحديث حالة العمل", he: "סטטוס העבודה עודכן" },
  jobCompletedToast: { ar: "تم إنهاء العمل — بالتوفيق!", he: "העבודה הושלמה — כל הכבוד!" },
  statusChangedElsewhere: {
    ar: "تغيّرت حالة الحجز — حدّثنا الصفحة",
    he: "סטטוס ההזמנה השתנה — רעננו את הדף",
  },

  // ---------- earnings ----------
  totalNet: { ar: "إجمالي الأرباح", he: 'סה"כ רווחים' },
  thisMonthNet: { ar: "هذا الشهر", he: "החודש" },
  commissionOwed: { ar: "عمولات مستحقة للمنصة: {amount}", he: "עמלות לתשלום לפלטפורמה: {amount}" },
  commissionExplainer: {
    ar: "عمولة المنصة — تُسوّى شهرياً",
    he: "עמלת הפלטפורמה — מתחשבנת אחת לחודש",
  },
  historyTitle: { ar: "سجل الأرباح", he: "היסטוריית רווחים" },
  noEarnings: { ar: "لا أرباح بعد", he: "אין עדיין רווחים" },
  noEarningsHint: {
    ar: "أكمل أول عمل لك لتظهر أرباحك هنا",
    he: "השלימו את העבודה הראשונה והרווחים יופיעו כאן",
  },
  noEarningsThisMonth: {
    ar: "لا أرباح هذا الشهر بعد — أكمل عملاً ليظهر هنا",
    he: "אין עדיין רווחים החודש — השלימו עבודה כדי שתופיע כאן",
  },

  // ---------- become-pro wizard ----------
  becomeProTitle: { ar: "الانضمام كمهني", he: "הצטרפות כבעל מקצוע" },
  stepBusiness: { ar: "معلومات النشاط", he: "פרטי העסק" },
  stepCategories: { ar: "مجالات العمل", he: "תחומי העבודה" },
  stepVerification: { ar: "توثيق الهوية", he: "אימות זהות" },
  businessNameLabel: { ar: "اسم النشاط التجاري", he: "שם העסק" },
  businessNamePlaceholder: { ar: "مثلاً: كهربائي أبو أحمد", he: "לדוגמה: חשמלאי אבו אחמד" },
  businessNameRequired: { ar: "أدخل اسم النشاط", he: "הזינו שם עסק" },
  bioLabel: { ar: "نبذة عنك وعن خدماتك", he: "קצת עליכם ועל השירות" },
  bioPlaceholder: {
    ar: "خبرتك، خدماتك، وما يميزك…",
    he: "הניסיון שלכם, השירותים ומה שמייחד אתכם…",
  },
  cityLabel: { ar: "مدينة العمل", he: "עיר הפעילות" },
  selectCity: { ar: "اختر المدينة", he: "בחרו עיר" },
  proSearchCity: { ar: "ابحث عن مدينة…", he: "חיפוש עיר…" },
  pickCategoriesHint: { ar: "اختر من 1 إلى 5 مجالات", he: "בחרו בין 1 ל‑5 תחומים" },
  maxCategoriesMsg: { ar: "يمكن اختيار 5 مجالات كحد أقصى", he: "אפשר לבחור עד 5 תחומים" },
  minCategoriesMsg: { ar: "اختر مجالاً واحداً على الأقل", he: "בחרו לפחות תחום אחד" },
  idHint: {
    ar: "المهنيون الموثقون يحصلون على أعمال أكثر — صوّر هويتك الشخصية لتوثيق حسابك",
    he: "בעלי מקצוע מאומתים מקבלים יותר עבודות — צלמו את תעודת הזהות לאימות החשבון",
  },
  idPrivacyNote: {
    ar: "تُستخدم الصورة للتوثيق فقط ولا تظهر للعملاء",
    he: "התמונה משמשת לאימות בלבד ולא מוצגת ללקוחות",
  },
  takePhoto: { ar: "التقاط صورة", he: "צילום תמונה" },
  pickFromGallery: { ar: "اختيار من المعرض", he: "בחירה מהגלריה" },
  submitPro: { ar: "إنهاء التسجيل", he: "סיום ההרשמה" },

  // ---------- pro settings ----------
  proSettingsTitle: { ar: "إعدادات المهني", he: "הגדרות בעל מקצוע" },
  businessInfoTitle: { ar: "معلومات النشاط", he: "פרטי העסק" },
  myCategoriesTitle: { ar: "مجالات عملي", he: "תחומי העבודה שלי" },
  workingHoursTitle: { ar: "ساعات العمل", he: "שעות פעילות" },
  fromLabel: { ar: "من", he: "מ־" },
  toLabel: { ar: "إلى", he: "עד" },
  selectHour: { ar: "اختر الساعة", he: "בחרו שעה" },
  closedLabel: { ar: "مغلق", he: "סגור" },
  day0: { ar: "الأحد", he: "ראשון" },
  day1: { ar: "الاثنين", he: "שני" },
  day2: { ar: "الثلاثاء", he: "שלישי" },
  day3: { ar: "الأربعاء", he: "רביעי" },
  day4: { ar: "الخميس", he: "חמישי" },
  day5: { ar: "الجمعة", he: "שישי" },
  day6: { ar: "السبت", he: "שבת" },
  verificationTitle: { ar: "توثيق الحساب", he: "אימות החשבון" },
  verifyNoneHint: {
    ar: "وثّق حسابك بصورة هويتك لكسب ثقة العملاء والحصول على أعمال أكثر",
    he: "אמתו את החשבון עם תעודת זהות כדי לזכות באמון הלקוחות ולקבל יותר עבודות",
  },
  verifyCta: { ar: "رفع صورة الهوية", he: "העלאת תעודת זהות" },
  verifyPendingLabel: { ar: "قيد المراجعة", he: "בבדיקה" },
  verifyRejectedHint: {
    ar: "تم رفض التوثيق — تأكد أن الصورة واضحة وأعد الرفع",
    he: "האימות נדחה — ודאו שהתמונה ברורה והעלו מחדש",
  },
  reupload: { ar: "إعادة الرفع", he: "העלאה מחדש" },
  galleryTitle: { ar: "معرض أعمالي", he: "גלריית העבודות שלי" },
  galleryHint: { ar: "حتى 12 صورة من أعمالك السابقة", he: "עד 12 תמונות מעבודות קודמות" },
  galleryFull: { ar: "وصلت للحد الأقصى (12 صورة)", he: "הגעתם למקסימום (12 תמונות)" },
  deletePhotoTitle: { ar: "حذف الصورة؟", he: "למחוק את התמונה?" },
  deletePhotoMsg: { ar: "سيتم حذف الصورة من معرضك نهائياً", he: "התמונה תימחק מהגלריה לצמיתות" },
  saved: { ar: "تم الحفظ", he: "נשמר" },
  uploadFailed: { ar: "فشل رفع الصورة، حاول مجدداً", he: "העלאת התמונה נכשלה, נסו שוב" },

  // ---------- hours editor ----------
  openLabel: { ar: "مفتوح", he: "פתוח" },
  hoursHint: {
    ar: "اضغط على الساعة لاختيار وقت آخر — العملاء يرون هذه الأوقات في ملفك",
    he: "הקישו על השעה כדי לבחור זמן אחר — הלקוחות רואים את השעות האלה בפרופיל",
  },
  setHoursHint: { ar: "لم تحدد ساعات عمل بعد", he: "עדיין לא הוגדרו שעות פעילות" },

  // ---------- become-pro completion meter ----------
  completionTitle: { ar: "اكتمال ملفك المهني", he: "השלמת הפרופיל המקצועי" },
  completionReady: { ar: "جاهز للنشر ✨", he: "מוכן לפרסום ✨" },
  completionRemaining: { ar: "أكمل {count} خطوات", he: "השלימו עוד {count} שלבים" },
  checkBusinessName: { ar: "اسم النشاط", he: "שם העסק" },
  checkBio: { ar: "نبذة", he: "תיאור" },
  checkCity: { ar: "المدينة", he: "עיר" },
  checkCategory: { ar: "مجال عمل", he: "תחום" },
  checkIdDoc: { ar: "الهوية", he: "תעודת זהות" },
  proCreated: { ar: "أهلاً بك بيننا! ملفك المهني جاهز", he: "ברוכים הבאים! הפרופיל המקצועי שלכם מוכן" },

  // ---------- profile preview ----------
  previewCta: { ar: "معاينة ملفك كما يراه الزبون", he: "תצוגה מקדימה כפי שהלקוח רואה" },
  previewTitle: { ar: "معاينة الملف", he: "תצוגה מקדימה" },
  previewSubtitle: { ar: "هكذا يظهر ملفك للعملاء", he: "כך הפרופיל שלכם נראה ללקוחות" },
  previewMissing: { ar: "ينقصك: {items}", he: "חסר לכם: {items}" },
  previewBackToEdit: { ar: "العودة للتعديل", he: "חזרה לעריכה" },
  missingPhoto: { ar: "صورة شخصية", he: "תמונת פרופיל" },
  missingBio: { ar: "نبذة عنك", he: "תיאור עליכם" },
  missingGallery: { ar: "صور أعمالك", he: "תמונות עבודות" },
  missingVerification: { ar: "توثيق الهوية", he: "אימות זהות" },
  previewAllGood: { ar: "ملفك مكتمل — أحسنت!", he: "הפרופיל מלא — כל הכבוד!" },
  noBioYet: { ar: "لم تكتب نبذة بعد", he: "עוד לא נכתב תיאור" },
  noGalleryYet: { ar: "لا صور أعمال بعد", he: "עדיין אין תמונות עבודות" },
  newPro: { ar: "مهني جديد", he: "בעל מקצוע חדש" },

  // ---------- earnings graph ----------
  last7DaysTitle: { ar: "أرباح آخر 7 أيام", he: "רווחי 7 הימים האחרונים" },
  last7DaysTotal: { ar: "المجموع: {amount}", he: 'סה"כ: {amount}' },
};

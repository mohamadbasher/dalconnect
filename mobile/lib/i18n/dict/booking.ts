import type { Dict } from "../index";

// Booking creation / detail / offers / reviews strings.
export const booking: Dict = {
  // ----- create booking -----
  newBooking: { ar: "طلب خدمة جديد", he: "בקשת שירות חדשה" },
  bookingWith: { ar: "أنت تطلب من", he: "אתם מזמינים אצל" },
  openRequestInfo: {
    ar: "سيصلك عروض أسعار من المهنيين القريبين منك — اختر العرض الأنسب لك",
    he: "בעלי מקצוע באזורכם ישלחו לכם הצעות מחיר — בחרו את ההצעה שמתאימה לכם",
  },
  chooseCategory: { ar: "اختر الفئة", he: "בחרו קטגוריה" },
  categoryRequired: { ar: "الرجاء اختيار الفئة", he: "נא לבחור קטגוריה" },
  bookingTitleLabel: { ar: "عنوان الطلب", he: "כותרת הבקשה" },
  bookingTitlePlaceholder: { ar: "مثال: تركيب مكيف جديد", he: "לדוגמה: התקנת מזגן חדש" },
  descriptionLabel: { ar: "وصف المطلوب", he: "תיאור העבודה" },
  descriptionPlaceholder: {
    ar: "اشرح ما تحتاجه بالتفصيل حتى يفهم المهني العمل…",
    he: "תארו בפירוט מה אתם צריכים כדי שבעל המקצוע יבין את העבודה…",
  },
  descriptionTooShort: { ar: "الوصف قصير جداً — ١٠ أحرف على الأقل", he: "התיאור קצר מדי — לפחות 10 תווים" },
  photosLabel: { ar: "صور (حتى {n})", he: "תמונות (עד {n})" },
  addPhoto: { ar: "إضافة صورة", he: "הוספת תמונה" },
  locationLabel: { ar: "الموقع", he: "מיקום" },
  chooseCity: { ar: "اختر المدينة", he: "בחרו עיר" },
  searchCity: { ar: "ابحث عن مدينة…", he: "חיפוש עיר…" },
  addressLabel: { ar: "العنوان", he: "כתובת" },
  addressPlaceholder: { ar: "الشارع، رقم البيت، علامة مميزة…", he: "רחוב, מספר בית, נקודת ציון…" },
  useMyLocation: { ar: "استخدام موقعي الحالي", he: "שימוש במיקום הנוכחי" },
  locationSet: { ar: "تم تحديد الموقع — اسحب العلامة لضبطه بدقة", he: "המיקום נקבע — גררו את הסימון לדיוק" },
  locationFailed: {
    ar: "تعذر تحديد موقعك — تأكد من تفعيل صلاحية الموقع",
    he: "לא הצלחנו לאתר את המיקום — ודאו שהרשאת המיקום פעילה",
  },
  scheduleLabel: { ar: "الموعد", he: "מועד" },
  asap: { ar: "في أقرب وقت", he: "בהקדם האפשרי" },
  pickTime: { ar: "تحديد موعد", he: "בחירת מועד" },
  pickTimeError: { ar: "اختر اليوم والساعة", he: "בחרו יום ושעה" },
  pastTimeError: { ar: "الوقت المختار قد مضى — اختر وقتاً لاحقاً", he: "השעה שנבחרה כבר עברה — בחרו שעה מאוחרת יותר" },
  chooseDate: { ar: "اختر اليوم", he: "בחרו יום" },
  chooseHour: { ar: "اختر الساعة", he: "בחרו שעה" },
  scheduleSummary: { ar: "موعدك: {date} الساعة {time}", he: "המועד שלכם: {date} בשעה {time}" },
  submitBooking: { ar: "إرسال الطلب", he: "שליחת הבקשה" },
  uploadingPhotos: { ar: "جاري رفع الصور… {n}/{total}", he: "מעלים תמונות… {n}/{total}" },

  // ----- completion meter -----
  meterTitle: { ar: "اكتمال الطلب", he: "שלמות הבקשה" },
  meterReady: { ar: "طلبك واضح وجاهز للإرسال ✨", he: "הבקשה ברורה ומוכנה לשליחה ✨" },
  meterRemaining: {
    ar: "أضف {n} تفاصيل ليصلك عروض أدق",
    he: "הוסיפו עוד {n} פרטים כדי לקבל הצעות מדויקות יותר",
  },
  meterCategory: { ar: "الفئة", he: "קטגוריה" },
  meterDescription: { ar: "الوصف", he: "תיאור" },
  meterPlace: { ar: "الموقع", he: "מיקום" },
  meterPhotos: { ar: "الصور", he: "תמונות" },

  // ----- toasts -----
  bookingSentToast: { ar: "تم إرسال طلبك للمهني", he: "הבקשה נשלחה לבעל המקצוע" },
  requestPostedToast: { ar: "نشرنا طلبك — بانتظار العروض", he: "פרסמנו את הבקשה — ממתינים להצעות" },
  bookingFailedToast: { ar: "تعذر إرسال الطلب — حاول مرة أخرى", he: "שליחת הבקשה נכשלה — נסו שוב" },
  offerAcceptedToast: { ar: "تم قبول عرض {name}", he: "ההצעה של {name} התקבלה" },
  bookingCancelledToast: { ar: "تم إلغاء الطلب", he: "ההזמנה בוטלה" },

  // ----- bookings tab -----
  segActive: { ar: "جارية", he: "פעילות" },
  segDone: { ar: "منتهية", he: "הושלמו" },
  segCancelled: { ar: "ملغاة", he: "בוטלו" },
  emptyBookingsTitle: { ar: "لا توجد طلبات بعد", he: "אין עדיין הזמנות" },
  emptyBookingsSubtitle: { ar: "اطلب خدمة الآن وسيظهر طلبك هنا", he: "הזמינו שירות עכשיו והבקשה תופיע כאן" },
  emptyDoneTitle: { ar: "لا توجد طلبات منتهية", he: "אין הזמנות שהושלמו" },
  emptyCancelledTitle: { ar: "لا توجد طلبات ملغاة", he: "אין הזמנות שבוטלו" },
  newRequestCta: { ar: "اطلب خدمة", he: "הזמנת שירות" },

  // ----- booking detail -----
  bookingDetails: { ar: "تفاصيل الطلب", he: "פרטי ההזמנה" },
  bookingNotFound: { ar: "الطلب غير موجود", he: "ההזמנה לא נמצאה" },
  bookingStatus: { ar: "حالة الطلب", he: "סטטוס ההזמנה" },
  offersTitle: { ar: "العروض ({n})", he: "הצעות ({n})" },
  waitingOffersTitle: { ar: "بانتظار العروض…", he: "ממתינים להצעות…" },
  waitingOffersSubtitle: {
    ar: "أرسلنا طلبك للمهنيين القريبين منك، ستظهر العروض هنا فور وصولها",
    he: "שלחנו את הבקשה לבעלי מקצוע באזורכם, ההצעות יופיעו כאן ברגע שיגיעו",
  },
  notifyProsHint: {
    ar: "أبلغنا المهنيين المناسبين في منطقتك — عادةً يصل أول عرض خلال دقائق",
    he: "עדכנו את בעלי המקצוע המתאימים באזורכם — בדרך כלל ההצעה הראשונה מגיעה תוך דקות",
  },
  acceptOffer: { ar: "قبول العرض", he: "קבלת ההצעה" },
  acceptOfferConfirm: { ar: "قبول عرض {name} بسعر {price}؟", he: "לקבל את ההצעה של {name} במחיר {price}?" },
  viewProfile: { ar: "عرض الملف", he: "צפייה בפרופיל" },
  etaChip: { ar: "يصل خلال {n} د", he: "מגיע תוך {n} דק׳" },
  proSectionTitle: { ar: "المهني", he: "בעל המקצוע" },
  detailsTitle: { ar: "التفاصيل", he: "פרטים" },
  scheduledFor: { ar: "الموعد المفضل", he: "מועד מועדף" },
  openInMaps: { ar: "افتح في الخرائط", he: "פתיחה במפות" },
  locationOnMap: { ar: "موقع محدد على الخريطة", he: "מיקום מסומן במפה" },
  cashNote: { ar: "الدفع نقداً عند إتمام الخدمة", he: "התשלום במזומן בסיום העבודה" },
  cancelBooking: { ar: "إلغاء الطلب", he: "ביטול ההזמנה" },
  cancelConfirm: { ar: "هل أنت متأكد من إلغاء هذا الطلب؟", he: "האם לבטל את ההזמנה?" },
  cancelReasonPlaceholder: { ar: "سبب الإلغاء (اختياري)", he: "סיבת הביטול (אופציונלי)" },
  keepBooking: { ar: "تراجع", he: "חזרה" },
  cancelLockedWorking: {
    ar: "بدأ المهني بتنفيذ العمل، لذلك لم يعد بالإمكان إلغاء الطلب من التطبيق.",
    he: "בעל המקצוע כבר התחיל בעבודה, ולכן לא ניתן לבטל את ההזמנה מהאפליקציה.",
  },
  cancelLockedDone: {
    ar: "انتهى هذا الطلب، ولم يعد بالإمكان إلغاؤه.",
    he: "ההזמנה הזו הסתיימה ולא ניתן לבטל אותה.",
  },
  contactProCta: { ar: "تواصل مع المهني", he: "יצירת קשר עם בעל המקצוע" },
  cancelReasonLabel: { ar: "سبب الإلغاء", he: "סיבת הביטול" },
  cancelledBanner: { ar: "تم إلغاء هذا الطلب", he: "ההזמנה בוטלה" },
  rejectedBanner: { ar: "عذراً، تم رفض هذا الطلب", he: "מצטערים, הבקשה נדחתה" },
  rateService: { ar: "قيّم الخدمة", he: "דירוג השירות" },
  yourRating: { ar: "تقييمك", he: "הדירוג שלכם" },
  reportProblem: { ar: "الإبلاغ عن مشكلة", he: "דיווח על בעיה" },

  // ----- rate modal -----
  rateTitle: { ar: "كيف كانت الخدمة؟", he: "איך היה השירות?" },
  rateSubtitle: { ar: "تقييمك يساعد الآخرين على اختيار المهني المناسب", he: "הדירוג שלכם עוזר לאחרים לבחור נכון" },
  submitRating: { ar: "إرسال التقييم", he: "שליחת הדירוג" },
  alreadyRated: { ar: "تم تقييم هذا الطلب مسبقاً", he: "ההזמנה הזו כבר דורגה" },
};

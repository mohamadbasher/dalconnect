import type { Dict } from "../index";

// Booking creation / detail / offers / reviews strings.
export const booking: Dict = {
  // ----- create booking -----
  newBooking: { ar: "طلب خدمة جديد", he: "בקשת שירות חדשה" },
  newBookingSubtitle: {
    ar: "احكي لنا شو المشكلة ومنوصّل طلبك للمهنيين بمنطقتك",
    he: "ספרו לנו מה הבעיה ונעביר את הבקשה לבעלי המקצוע באזורכם",
  },
  bookingWith: { ar: "أنت تطلب من", he: "אתם מזמינים אצל" },
  openRequestInfo: {
    ar: "سيصلك عروض أسعار من المهنيين القريبين منك — اختر العرض الأنسب لك",
    he: "בעלי מקצוע באזורכם ישלחו לכם הצעות מחיר — בחרו את ההצעה שמתאימה לכם",
  },
  // Sits by the CTA, not at the top: nobody needs the payoff explained before
  // they've described the problem.
  afterSubmitNote: {
    ar: "بعد ما تبعث الطلب، بتبلّش توصلك عروض من مهنيين مناسبين بمنطقتك",
    he: "לאחר שליחת הבקשה תתחילו לקבל הצעות מבעלי מקצוע מתאימים באזורכם",
  },
  chooseCategory: { ar: "اختر الفئة", he: "בחרו קטגוריה" },
  changeCategory: { ar: "تغيير", he: "שינוי" },
  searchCategory: { ar: "ابحث عن خدمة…", he: "חיפוש שירות…" },
  stepProblem: { ar: "شو المشكلة؟", he: "מה הבעיה?" },
  stepProblemHint: {
    ar: "فصّل قد ما بتقدر عشان توصلك عروض أدق",
    he: "פרטו כמה שיותר כדי לקבל הצעות מדויקות יותר",
  },
  stepWhere: { ar: "وين بدك الخدمة؟", he: "איפה השירות?" },
  // What's still missing, shown above a disabled CTA. A greyed-out button with
  // no reason is a dead end.
  submitMissing: { ar: "لسا ناقص: {what}", he: "עוד חסר: {what}" },
  missCategory: { ar: "الخدمة", he: "השירות" },
  missDescription: { ar: "وصف المشكلة", he: "תיאור הבעיה" },
  missWhen: { ar: "وقت الخدمة", he: "מתי" },
  missWhere: { ar: "المدينة", he: "העיר" },
  locationNearestCity: { ar: "حدّدنا مدينتك: {city}", he: "זיהינו את העיר: {city}" },
  useMyLocationSub: {
    ar: "منستعمل موقعك لنلاقي مهنيين قريبين منك",
    he: "נשתמש במיקום שלכם לאיתור בעלי מקצוע באזורכם",
  },
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
  photosOptional: { ar: "صور (اختياري)", he: "תמונות (אופציונלי)" },
  photosHint: {
    ar: "الصورة بتساعد المهني يعطيك سعر أدق",
    he: "תמונה עוזרת לבעל המקצוע לתת הצעת מחיר מדויקת יותר",
  },
  addPhoto: { ar: "إضافة صورة", he: "הוספת תמונה" },
  addPhotos: { ar: "إضافة صور", he: "הוספת תמונות" },
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
  editBooking: { ar: "تعديل الطلب", he: "עריכת הבקשה" },
  editBookingSubtitle: {
    ar: "بتقدر تعدّل التفاصيل ما دام ما اخترت مهني",
    he: "אפשר לעדכן את הפרטים כל עוד לא נבחר בעל מקצוע",
  },
  saveChanges: { ar: "حفظ التعديلات", he: "שמירת השינויים" },
  editLockedNote: {
    ar: "الخدمة والتوقيت ما بينعدّلوا بعد الإرسال — المهنيين قدّموا عروضهم على أساسهم",
    he: "השירות והתזמון אינם ניתנים לשינוי לאחר השליחה — בעלי המקצוע הגישו הצעות על בסיסם",
  },
  bookingUpdatedToast: { ar: "تم تحديث الطلب", he: "הבקשה עודכנה" },
  editLoadFailed: { ar: "تعذّر فتح الطلب للتعديل", he: "לא הצלחנו לפתוח את הבקשה לעריכה" },
  uploadingPhotos: { ar: "جاري رفع الصور… {n}/{total}", he: "מעלים תמונות… {n}/{total}" },

  // ----- toasts -----
  bookingSentToast: { ar: "تم إرسال طلبك للمهني", he: "הבקשה נשלחה לבעל המקצוע" },
  requestPostedToast: { ar: "نشرنا طلبك — بانتظار العروض", he: "פרסמנו את הבקשה — ממתינים להצעות" },
  bookingFailedToast: { ar: "تعذر إرسال الطلب — حاول مرة أخرى", he: "שליחת הבקשה נכשלה — נסו שוב" },
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
  bookingsListHint: {
    ar: "اضغط على أي طلب لمتابعة العروض والتواصل مع المهني",
    he: "הקישו על בקשה כדי לעקוב אחרי ההצעות וליצור קשר עם בעל המקצוע",
  },

  // ----- booking detail -----
  bookingDetails: { ar: "تفاصيل الطلب", he: "פרטי ההזמנה" },
  bookingNotFound: { ar: "الطلب غير موجود", he: "ההזמנה לא נמצאה" },
  /** compact tracker: what happens after the current step */
  stepNext: { ar: "الخطوة التالية: {step}", he: "השלב הבא: {step}" },
  // Milestones for the tracker rail. Short by necessity — five sit side by side
  // across a phone. These name the JOURNEY; STATUS_KEY names the current state.
  trackSent: { ar: "انبعث", he: "נשלחה" },
  trackOffers: { ar: "عروض", he: "הצעות" },
  trackChosen: { ar: "اخترت", he: "נבחר" },
  trackWorking: { ar: "بالتنفيذ", he: "בביצוע" },
  trackDone: { ar: "اكتمل", he: "הושלם" },
  waitingOffersTitle: { ar: "بانتظار العروض…", he: "ממתינים להצעות…" },
  waitingOffersSubtitle: {
    ar: "أرسلنا طلبك للمهنيين القريبين منك، ستظهر العروض هنا فور وصولها",
    he: "שלחנו את הבקשה לבעלי מקצוע באזורכם, ההצעות יופיעו כאן ברגע שיגיעו",
  },
  // No timing promise. We have no data behind "usually within minutes", and it
  // is a promise made on behalf of people who haven't agreed to it.
  notifyProsHint: {
    ar: "أبلغنا المهنيين المناسبين في منطقتك — منخبّرك فور وصول عرض جديد",
    he: "עדכנו את בעלי המקצוע המתאימים באזורכם — נעדכן אתכם ברגע שתתקבל הצעה",
  },
  proSectionTitle: { ar: "المهني", he: "בעל המקצוע" },

  // ----- quotes (request → price-range offers → contact reveal) -----
  quotesTitle: { ar: "عروض الأسعار ({n})", he: "הצעות מחיר ({n})" },
  quotesCompareHint: {
    ar: "قارن بين العروض واختر الأنسب لك — يظهر رقم هاتف المهني فور قبولك عرضه",
    he: "השוו בין ההצעות ובחרו את המתאימה לכם — מספר הטלפון של בעל המקצוע יופיע מיד לאחר הקבלה",
  },
  quotesDeclinedTitle: { ar: "عروض رفضتها ({n})", he: "הצעות שדחיתם ({n})" },
  quotesDeclinedHint: {
    ar: "هذه العروض لم تعد سارية، لكن طلبك ما زال مفتوحاً ويمكن أن تصلك عروض جديدة",
    he: "ההצעות האלה כבר לא בתוקף, אבל הבקשה שלכם עדיין פתוחה ויכולות להגיע הצעות חדשות",
  },
  quotePriceLabel: { ar: "نطاق السعر المتوقع", he: "טווח המחיר המשוער" },
  quoteNoPrice: { ar: "بدون سعر", he: "ללא מחיר" },
  quoteEta: { ar: "يصل خلال {n} دقيقة", he: "מגיע תוך {n} דק׳" },
  quoteJobsDone: { ar: "{n} عمل منجز", he: "{n} עבודות שהושלמו" },
  quoteNoRatingYet: { ar: "جديد", he: "חדש" },
  quoteUnknownPro: { ar: "مهني", he: "בעל מקצוע" },
  quoteAccept: { ar: "قبول العرض", he: "קבלת ההצעה" },
  quoteDecline: { ar: "رفض هذا العرض", he: "דחיית ההצעה" },
  quoteAcceptTitle: { ar: "قبول عرض السعر", he: "קבלת הצעת המחיר" },
  quoteAcceptConfirm: {
    ar: "قبول عرض {name} بنطاق {price}؟ سنغلق باقي العروض ويظهر لك رقم هاتفه للتواصل معه.",
    he: "לקבל את ההצעה של {name} בטווח {price}? נסגור את שאר ההצעות ומספר הטלפון שלו יוצג לכם.",
  },
  quoteAcceptConfirmNoPrice: {
    ar: "قبول عرض {name}؟ سنغلق باقي العروض ويظهر لك رقم هاتفه للتواصل معه.",
    he: "לקבל את ההצעה של {name}? נסגור את שאר ההצעות ומספר הטלפון שלו יוצג לכם.",
  },
  quoteAcceptedToast: { ar: "قبلنا عرض {name} — رقم هاتفه ظاهر الآن", he: "קיבלנו את ההצעה של {name} — מספר הטלפון מוצג עכשיו" },
  quoteDeclinedToast: { ar: "رفضت عرض {name} — طلبك ما زال مفتوحاً", he: "דחיתם את ההצעה של {name} — הבקשה נשארת פתוחה" },

  // ----- contact reveal -----
  quoteContactTitle: { ar: "المهني ومعلومات التواصل", he: "בעל המקצוע ופרטי הקשר" },
  quoteContactHint: {
    ar: "اتصل بالمهني أو راسله على واتساب للاتفاق على التفاصيل النهائية والموعد",
    he: "התקשרו לבעל המקצוע או שלחו לו הודעת ווטסאפ כדי לסכם את הפרטים והמועד",
  },
  quoteContactPending: {
    ar: "ستظهر معلومات التواصل بمجرد قبول أحد عروض الأسعار",
    he: "פרטי הקשר יופיעו ברגע שתקבלו אחת מהצעות המחיר",
  },
  quoteCallNow: { ar: "اتصل الآن", he: "התקשרו עכשיו" },
  quoteWhatsApp: { ar: "مراسلة على واتساب", he: "הודעה בווטסאפ" },
  quoteChatInApp: { ar: "المراسلة داخل التطبيق", he: "התכתבות באפליקציה" },
  quoteWhatsAppPrefill: {
    ar: "مرحباً، أنا صاحب طلب «{title}» عبر تطبيق دال كونكت",
    he: "שלום, אני שלחתי את הבקשה «{title}» באפליקציית דל קונקט",
  },

  // ----- money on the request -----
  quoteAgreedPriceLabel: { ar: "السعر المتفق عليه", he: "המחיר שסוכם" },
  quoteFinalPriceLabel: { ar: "المبلغ النهائي", he: "הסכום הסופי" },
  quoteRangeNote: {
    ar: "يُتفق على السعر النهائي مع المهني ضمن هذا النطاق، والدفع نقداً",
    he: "המחיר הסופי נקבע מול בעל המקצוע בתוך הטווח הזה, והתשלום במזומן",
  },
  quoteServiceFee: { ar: "رسوم نشر الطلب: {amount}", he: "עמלת פרסום הבקשה: {amount}" },
  quoteUrgencyUrgent: { ar: "عاجل — اليوم", he: "דחוף — היום" },
  quoteUrgencyScheduled: { ar: "بموعد محدد", he: "במועד מתוכנן" },
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

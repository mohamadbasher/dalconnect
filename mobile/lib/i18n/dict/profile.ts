import type { Dict } from "../index";

// Profile / settings / notifications-screen strings.
export const profile: Dict = {
  // ----- profile tab -----
  profileRoleCustomer: { ar: "عميل", he: "לקוח" },
  profileRolePro: { ar: "مهني", he: "בעל מקצוע" },
  profileBecomeProTitle: { ar: "هل أنت صاحب مهنة؟", he: "בעלי מקצוע?" },
  profileBecomeProSubtitle: {
    ar: "انضم إلى دال كونكت واحصل على أعمال جديدة كل يوم",
    he: "הצטרפו לדל קונקט וקבלו עבודות חדשות כל יום",
  },
  profileBecomeProCta: { ar: "انضم كمهني", he: "הצטרפות כבעל מקצוע" },
  profileBusinessSettings: { ar: "إعدادات العمل", he: "הגדרות העסק" },
  profileSwitchToPro: { ar: "التبديل إلى وضع المهني", he: "מעבר למצב בעל מקצוע" },
  profileSwitchToCustomer: { ar: "التبديل إلى وضع العميل", he: "מעבר למצב לקוח" },
  profileEditProfile: { ar: "تعديل الملف الشخصي", he: "עריכת פרופיל" },
  profileAppearance: { ar: "المظهر", he: "מראה" },
  profileAboutLegal: { ar: "حول التطبيق والشروط", he: "אודות ותנאים" },
  profileSectionAccount: { ar: "الحساب", he: "חשבון" },
  profileSectionPreferences: { ar: "التفضيلات", he: "העדפות" },
  profileSignOut: { ar: "تسجيل الخروج", he: "התנתקות" },
  profileSignOutConfirm: {
    ar: "هل أنت متأكد أنك تريد تسجيل الخروج؟",
    he: "בטוחים שברצונכם להתנתק?",
  },
  profileVersion: { ar: "الإصدار {version}", he: "גרסה {version}" },

  // ----- delete account (store requirement) -----
  profileDeleteAccount: { ar: "حذف الحساب", he: "מחיקת החשבון" },
  profileDeleteConfirm1: {
    ar: "سيؤدي حذف حسابك إلى إزالة ملفك الشخصي وحجوزاتك ومحادثاتك وجميع بياناتك نهائياً. لا يمكن التراجع عن هذه الخطوة.",
    he: "מחיקת החשבון תסיר לצמיתות את הפרופיל, ההזמנות, השיחות וכל הנתונים שלך. לא ניתן לבטל פעולה זו.",
  },
  profileDeleteContinue: { ar: "متابعة الحذف", he: "המשך למחיקה" },
  profileDeleteConfirm2Title: { ar: "تأكيد أخير", he: "אישור אחרון" },
  profileDeleteConfirm2: {
    ar: "هل أنت متأكد تماماً؟ سيتم حذف حسابك وجميع بياناتك الآن بشكل نهائي.",
    he: "בטוחים לגמרי? החשבון וכל הנתונים יימחקו עכשיו לצמיתות.",
  },
  profileDeleteForever: { ar: "احذف نهائياً", he: "מחיקה לצמיתות" },
  profileDeleteError: {
    ar: "تعذّر حذف الحساب، يرجى المحاولة لاحقاً",
    he: "מחיקת החשבון נכשלה, נסו שוב מאוחר יותר",
  },
  profileAboutText: {
    ar: "دال كونكت يربطك بأفضل أصحاب المهن في منطقتك — كهربائيون، سبّاكون، فنّيو تكييف والمزيد. الدفع نقداً مباشرة بعد إنجاز العمل.\n\nباستخدامك للتطبيق فإنك توافق على شروط الاستخدام وسياسة الخصوصية. النص الكامل سيتوفر هنا قريباً.",
    he: "דל קונקט מחבר אתכם לבעלי המקצוע הטובים באזורכם — חשמלאים, אינסטלטורים, טכנאי מיזוג ועוד. התשלום במזומן ישירות בסיום העבודה.\n\nהשימוש באפליקציה מהווה הסכמה לתנאי השימוש ולמדיניות הפרטיות. הנוסח המלא יופיע כאן בקרוב.",
  },

  // ----- edit profile -----
  editFullName: { ar: "الاسم الكامل", he: "שם מלא" },
  editFullNameRequired: { ar: "الرجاء إدخال الاسم الكامل", he: "יש להזין שם מלא" },
  editPhone: { ar: "رقم الهاتف", he: "מספר טלפון" },
  editPhoneNote: {
    ar: "رقم الهاتف هو اسم الدخول الخاص بك ولا يمكن تغييره",
    he: "מספר הטלפון משמש להתחברות ולא ניתן לשינוי",
  },
  editChooseCity: { ar: "اختر المدينة", he: "בחירת עיר" },
  editSearchCity: { ar: "ابحث عن مدينة…", he: "חיפוש עיר…" },
  editUploadError: { ar: "تعذر رفع الصورة، حاول مجدداً", he: "העלאת התמונה נכשלה, נסו שוב" },

  // ----- notifications -----
  notifMarkAllRead: { ar: "تعليم الكل كمقروء", he: "סימון הכל כנקרא" },
  notifEmptyTitle: { ar: "لا إشعارات بعد", he: "אין התראות עדיין" },
  notifEmptySubtitle: {
    ar: "ستصلك هنا تحديثات الحجوزات والعروض والرسائل",
    he: "כאן יופיעו עדכונים על הזמנות, הצעות והודעות",
  },

  // ----- report -----
  reportTitle: { ar: "الإبلاغ عن مشكلة", he: "דיווח על בעיה" },
  reportReasonLabel: { ar: "ما سبب البلاغ؟", he: "מה סיבת הדיווח?" },
  reportReasonUnprofessional: { ar: "سلوك غير مهني", he: "התנהגות לא מקצועית" },
  reportReasonNoShow: { ar: "لم يحضر في الموعد", he: "לא הגיע/ה בזמן" },
  reportReasonWrongPrice: { ar: "سعر مختلف عن المتفق عليه", he: "מחיר שונה מהמוסכם" },
  reportReasonFraud: { ar: "احتيال أو نصب", he: "הונאה" },
  reportReasonOther: { ar: "سبب آخر", he: "סיבה אחרת" },
  reportDetailsLabel: { ar: "تفاصيل إضافية", he: "פרטים נוספים" },
  reportDetailsPlaceholder: { ar: "اكتب ما حدث…", he: "ספרו לנו מה קרה…" },
  reportDetailsRequired: { ar: "الرجاء كتابة التفاصيل", he: "יש להוסיף פרטים" },
  reportSubmit: { ar: "إرسال البلاغ", he: "שליחת הדיווח" },
  reportSuccessTitle: { ar: "استلمنا بلاغك", he: "הדיווח התקבל" },
  reportSuccessBody: {
    ar: "شكراً لك. سيراجع فريقنا البلاغ ويتخذ الإجراء المناسب في أقرب وقت.",
    he: "תודה. הצוות שלנו יבדוק את הדיווח ויטפל בו בהקדם.",
  },
};

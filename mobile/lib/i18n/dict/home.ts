import type { Dict } from "../index";

// Customer home (service picker) / service search / category / pro-profile strings.
export const home: Dict = {
  // ----- home -----
  // The service grid's own heading — the screen carries exactly one.
  homeSubtitle: { ar: "شو بتحتاج اليوم؟", he: "מה אתם צריכים היום?" },
  homeSearchPlaceholder: { ar: "شو الخدمة اللي بتدوّر عليها؟", he: "איזה שירות אתם מחפשים?" },
  homeServicesSubtitle: {
    ar: "اختر الخدمة وبنوصّل طلبك لكل المهنيين القريبين منك",
    he: "בחרו שירות ונעביר את הבקשה לכל בעלי המקצוע באזורכם",
  },
  homeNoServices: { ar: "لا توجد خدمات متاحة حالياً", he: "אין שירותים זמינים כרגע" },
  homeOffersCount: { ar: "عروض الأسعار: {count}", he: "הצעות מחיר: {count}" },
  homeTrackRequest: { ar: "اضغط لمتابعة طلبك", he: "לחצו למעקב אחרי הבקשה" },

  // ----- service search -----
  searchServicesCount: { ar: "{count} خدمة", he: "{count} שירותים" },
  searchNoServiceTitle: { ar: "ما لقينا خدمة بهذا الاسم", he: "לא מצאנו שירות בשם הזה" },
  searchNoServiceSubtitle: {
    ar: "جرّب كلمة ثانية أو تصفّح كل الخدمات",
    he: "נסו מילה אחרת או עיינו בכל השירותים",
  },
  searchClearQuery: { ar: "امسح البحث", he: "ניקוי החיפוש" },
  searchErrorTitle: { ar: "تعذّر تحميل الخدمات", he: "לא הצלחנו לטעון את השירותים" },
  searchErrorSubtitle: {
    ar: "تأكد من اتصالك بالإنترنت وحاول مرة ثانية",
    he: "בדקו את החיבור לאינטרנט ונסו שוב",
  },
  // kept for the exported PickerSheet's callers (city / category / sort sheets)
  searchAllCities: { ar: "كل المدن", he: "כל הערים" },
  searchAllCategories: { ar: "كل الفئات", he: "כל הקטגוריות" },
  searchCityPlaceholder: { ar: "ابحث عن مدينة…", he: "חיפוש עיר…" },
  searchSort: { ar: "ترتيب", he: "מיון" },
  searchSortRating: { ar: "الأعلى تقييماً", he: "לפי דירוג" },
  searchSortNewest: { ar: "الأحدث", he: "החדשים ביותר" },

  // ----- urgency (create request) -----
  urgencyTitle: { ar: "إيمتى بتحتاج الخدمة؟", he: "מתי אתם צריכים את השירות?" },
  urgencySameDay: { ar: "اليوم", he: "היום" },
  urgencySameDaySub: {
    ar: "بأسرع وقت — بنوصل طلبك فوراً لكل المهنيين المتاحين",
    he: "בהקדם האפשרי — נעביר את הבקשה מיד לכל בעלי המקצוע הזמינים",
  },
  urgencyScheduled: { ar: "بموعد لاحق", he: "במועד מאוחר יותר" },
  urgencyScheduledSub: {
    ar: "بكرة أو بعدها — اختر اليوم والساعة اللي بتناسبك",
    he: "מחר או אחר כך — בחרו יום ושעה שנוחים לכם",
  },
  urgencyCostsMore: { ar: "رسوم أعلى", he: "עלות גבוהה יותר" },
  urgencyRequired: { ar: "اختر إيمتى بتحتاج الخدمة", he: "בחרו מתי אתם צריכים את השירות" },
  meterUrgency: { ar: "التوقيت", he: "תזמון" },
  urgencyFeeNote: {
    ar: "رسوم إنشاء الطلب على المنصة",
    he: "דמי פתיחת בקשה בפלטפורמה",
  },
  urgencyPickTimeOptional: { ar: "اختياري — بتقدر تتركه فاضي", he: "אופציונלי — אפשר להשאיר ריק" },
  urgencyUrgentTag: { ar: "عاجل", he: "דחוף" },
  urgencyScheduledTag: { ar: "بموعد", he: "מתוזמן" },

  // ----- category -----
  catNotFound: { ar: "الفئة غير موجودة", he: "הקטגוריה לא נמצאה" },
  catEmptyTitle: { ar: "لا يوجد مهنيون في هذه الفئة بعد", he: "אין עדיין בעלי מקצוע בקטגוריה הזו" },
  catEmptySubtitle: {
    ar: "أنشئ طلباً مفتوحاً وسيصلك عرض فور توفر مهني مناسب",
    he: "צרו בקשה פתוחה ותקבלו הצעה ברגע שיהיה בעל מקצוע מתאים",
  },
  catOpenRequestCta: { ar: "أنشئ طلباً مفتوحاً في هذه الفئة", he: "צרו בקשה פתוחה בקטגוריה הזו" },

  // ----- professional profile (reachable only from a quote) -----
  proBookNow: { ar: "احجز الآن", he: "הזמינו עכשיו" },
  proAbout: { ar: "نبذة", he: "אודות" },
  proWorkingHours: { ar: "ساعات العمل", he: "שעות פעילות" },
  proClosed: { ar: "مغلق", he: "סגור" },
  proGallery: { ar: "معرض الأعمال", he: "גלריית עבודות" },
  proNoReviews: { ar: "لا توجد تقييمات بعد", he: "אין עדיין ביקורות" },
  proReviewsCount: { ar: "{count} تقييم", he: "{count} ביקורות" },
  proNotFound: { ar: "المهني غير موجود", he: "בעל המקצוע לא נמצא" },
  proOwnProfileHint: {
    ar: "هذا ملفك الشخصي كما يراه العملاء — يمكنك تعديله من إعدادات المهني",
    he: "כך הלקוחות רואים את הפרופיל שלך — ניתן לערוך אותו בהגדרות בעל המקצוע",
  },
  proCustomerFallback: { ar: "عميل", he: "לקוח" },
  proUnavailableBanner: {
    ar: "المهني غير متاح حالياً — يمكنك مع ذلك إرسال طلب وسيرد عليك عند توفره",
    he: "בעל המקצוע לא זמין כרגע — עדיין אפשר לשלוח בקשה והוא יחזור אליכם כשיתפנה",
  },
  proFavorite: { ar: "مفضلة", he: "מועדפים" },
  proOpenNow: { ar: "مفتوح الآن", he: "פתוח עכשיו" },
  proClosedNow: { ar: "مغلق الآن", he: "סגור עכשיו" },
  proWhatsapp: { ar: "واتساب", he: "וואטסאפ" },
  proWhatsappFailed: {
    ar: "ما قدرنا نفتح واتساب على جهازك",
    he: "לא הצלחנו לפתוח את וואטסאפ במכשיר שלכם",
  },
  proCallFailed: { ar: "ما قدرنا نبدأ المكالمة", he: "לא הצלחנו להתחיל את השיחה" },
  proShareTradeFallback: { ar: "مهني", he: "בעל מקצוע" },
  proShareMessage: {
    ar: "{name} — {trade}\nلقيته على {app}، تطبيق يلاقي لك أفضل المهنيين بمنطقتك 👌",
    he: "{name} — {trade}\nמצאתי אותו ב{app}, האפליקציה שמוצאת לכם את בעלי המקצוע הטובים באזור 👌",
  },
  proDay0: { ar: "الأحد", he: "ראשון" },
  proDay1: { ar: "الاثنين", he: "שני" },
  proDay2: { ar: "الثلاثاء", he: "שלישי" },
  proDay3: { ar: "الأربعاء", he: "רביעי" },
  proDay4: { ar: "الخميس", he: "חמישי" },
  proDay5: { ar: "الجمعة", he: "שישי" },
  proDay6: { ar: "السبت", he: "שבת" },
};

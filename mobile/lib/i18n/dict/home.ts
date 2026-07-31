import type { Dict } from "../index";

// Customer home / search / category / pro-profile / favorites strings.
export const home: Dict = {
  // ----- home -----
  homeGreeting: { ar: "أهلاً {name} 👋", he: "אהלן {name} 👋" },
  homeSubtitle: { ar: "شو بتحتاج اليوم؟", he: "מה אתם צריכים היום?" },
  homeSearchPlaceholder: { ar: "ابحث عن خدمة أو مهني…", he: "חפשו שירות או בעל מקצוע…" },
  homeTopRated: { ar: "الأعلى تقييماً", he: "המדורגים ביותר" },
  homeMoreTile: { ar: "المزيد", he: "עוד" },
  homeCtaTitle: { ar: "بحاجة لشي مستعجل؟", he: "צריכים משהו דחוף?" },
  homeCtaSubtitle: {
    ar: "أنشئ طلباً مفتوحاً واستقبل عروض أسعار من المهنيين القريبين منك",
    he: "צרו בקשה פתוחה וקבלו הצעות מחיר מבעלי מקצוע באזורכם",
  },
  homeCtaButton: { ar: "أنشئ طلباً الآن", he: "צרו בקשה עכשיו" },
  homeNoProsYet: { ar: "لا يوجد مهنيون بعد", he: "אין עדיין בעלי מקצוע" },
  homeActiveRequest: { ar: "طلبك الحالي", he: "הבקשה הפעילה שלכם" },
  homeOffersCount: { ar: "عروض الأسعار: {count}", he: "הצעות מחיר: {count}" },

  // ----- favorites -----
  favEmptyTitle: { ar: "لا مفضلات بعد", he: "אין עדיין מועדפים" },
  favEmptySubtitle: {
    ar: "اضغط على القلب في صفحة أي مهني لتجده هنا بسرعة",
    he: "לחצו על הלב בעמוד של בעל מקצוע כדי למצוא אותו כאן במהירות",
  },

  // ----- search & filters -----
  searchAllCities: { ar: "كل المدن", he: "כל הערים" },
  searchAllCategories: { ar: "كل الفئات", he: "כל הקטגוריות" },
  searchCityPlaceholder: { ar: "ابحث عن مدينة…", he: "חיפוש עיר…" },
  searchSort: { ar: "ترتيب", he: "מיון" },
  searchSortRating: { ar: "الأعلى تقييماً", he: "לפי דירוג" },
  searchSortNewest: { ar: "الأحدث", he: "החדשים ביותר" },
  searchEmptySubtitle: {
    ar: "جرّب كلمات أخرى أو غيّر الفلاتر",
    he: "נסו מילים אחרות או שנו את הסינון",
  },
  searchResultsCount: { ar: "{count} مهني", he: "{count} בעלי מקצוע" },
  searchBrowseSubtitle: {
    ar: "تصفّح الفئات أو ابحث عن خدمة أو مهني",
    he: "עיינו בקטגוריות או חפשו שירות או בעל מקצוע",
  },

  // ----- category -----
  catNotFound: { ar: "الفئة غير موجودة", he: "הקטגוריה לא נמצאה" },
  catEmptyTitle: { ar: "لا يوجد مهنيون في هذه الفئة بعد", he: "אין עדיין בעלי מקצוע בקטגוריה הזו" },
  catEmptySubtitle: {
    ar: "أنشئ طلباً مفتوحاً وسيصلك عرض فور توفر مهني مناسب",
    he: "צרו בקשה פתוחה ותקבלו הצעה ברגע שיהיה בעל מקצוע מתאים",
  },
  catOpenRequestCta: { ar: "أنشئ طلباً مفتوحاً في هذه الفئة", he: "צרו בקשה פתוחה בקטגוריה הזו" },

  // ----- professional profile -----
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
  proDay0: { ar: "الأحد", he: "ראשון" },
  proDay1: { ar: "الاثنين", he: "שני" },
  proDay2: { ar: "الثلاثاء", he: "שלישי" },
  proDay3: { ar: "الأربعاء", he: "רביעי" },
  proDay4: { ar: "الخميس", he: "חמישי" },
  proDay5: { ar: "الجمعة", he: "שישי" },
  proDay6: { ar: "السبت", he: "שבת" },
};

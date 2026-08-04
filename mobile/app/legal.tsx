// Terms of Use / Privacy Policy screen.
//
// ⚠️ IMPORTANT: the text below is a good-faith DRAFT to satisfy the App Store /
// Google Play requirement that these documents exist and are reachable in-app.
// It is NOT legal advice and MUST be reviewed (and the {{PLACEHOLDERS}} filled)
// before public launch. Replace the company details in LEGAL_CONTACT below.
import React, { useEffect, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme, radius, spacing } from "../lib/theme";
import { useI18n } from "../lib/i18n";
import { supabase } from "../lib/supabase";
import { ROW, RTL_TEXT } from "../lib/rtl";
import type { LegalPage } from "../lib/types";

// TODO(owner): fill these in before launch.
const LEGAL_CONTACT = {
  company: "DalConnect",
  email: "support@dalconnect.app",
  updated: "2026-07",
};

type Tab = "terms" | "privacy";

const TERMS: Record<"ar" | "he", { h: string; p: string }[]> = {
  ar: [
    {
      h: "١. عن الخدمة",
      p: `${LEGAL_CONTACT.company} هو منصّة وسيطة تربط بين العملاء وأصحاب المهن المستقلين. نحن لا نقدّم الخدمات المهنية بأنفسنا ولسنا طرفاً في الاتفاق الذي يتم بين العميل والمهني.`,
    },
    {
      h: "٢. الحسابات",
      p: "يجب أن تكون بعمر 18 عاماً فما فوق لإنشاء حساب. أنت مسؤول عن دقّة بياناتك وعن الحفاظ على سرّية كلمة المرور الخاصة بك وعن كل نشاط يتم عبر حسابك.",
    },
    {
      h: "٣. الحجوزات والأسعار",
      p: "الأسعار المعروضة يحدّدها المهنيون ولا تحدّدها المنصّة. الدفع يتم نقداً ومباشرةً بين العميل والمهني بعد إنجاز العمل. أي خلاف حول السعر أو جودة العمل هو بين الطرفين، ونحن نساعد في الوساطة قدر الإمكان.",
    },
    {
      h: "٤. العمولة",
      p: "تحتسب المنصّة عمولة على الأعمال المنجزة من المهنيين وفق النسبة المعلنة داخل التطبيق. تُعرض تفاصيل العمولة في صفحة الأرباح الخاصة بالمهني.",
    },
    {
      h: "٥. السلوك المقبول",
      p: "يُمنع استخدام المنصّة لأي غرض غير قانوني، أو نشر محتوى مسيء أو مضلّل، أو انتحال هوية الغير، أو محاولة الالتفاف على المنصّة للتهرّب من العمولة. نحتفظ بالحق في تعليق أو حذف أي حساب يخالف هذه الشروط.",
    },
    {
      h: "٦. التقييمات والبلاغات",
      p: "التقييمات يجب أن تعكس تجربة حقيقية. نحتفظ بالحق في إزالة التقييمات المزيّفة أو المسيئة، ومراجعة البلاغات واتخاذ الإجراء المناسب.",
    },
    {
      h: "٧. حدود المسؤولية",
      p: "نبذل جهدنا للتحقق من المهنيين، لكننا لا نضمن جودة أي عمل. المنصّة غير مسؤولة عن أي ضرر مباشر أو غير مباشر ناتج عن الخدمات المقدَّمة من المهنيين.",
    },
    {
      h: "٨. تعديل الشروط",
      p: `قد نقوم بتحديث هذه الشروط من وقت لآخر. الاستمرار في استخدام التطبيق بعد التحديث يعني الموافقة على النسخة الجديدة. آخر تحديث: ${LEGAL_CONTACT.updated}.`,
    },
  ],
  he: [
    {
      h: "1. אודות השירות",
      p: `${LEGAL_CONTACT.company} היא פלטפורמת תיווך המחברת בין לקוחות לבעלי מקצוע עצמאיים. איננו מספקים את השירותים המקצועיים בעצמנו ואיננו צד להסכם שנכרת בין הלקוח לבעל המקצוע.`,
    },
    {
      h: "2. חשבונות",
      p: "יש להיות בני 18 ומעלה כדי לפתוח חשבון. אתם אחראים לנכונות הפרטים, לשמירת סודיות הסיסמה ולכל פעילות שתתבצע בחשבונכם.",
    },
    {
      h: "3. הזמנות ומחירים",
      p: "המחירים נקבעים על ידי בעלי המקצוע ולא על ידי הפלטפורמה. התשלום מתבצע במזומן ישירות בין הלקוח לבעל המקצוע בסיום העבודה. מחלוקות על מחיר או איכות הן בין הצדדים, ואנו נסייע בגישור ככל שניתן.",
    },
    {
      h: "4. עמלה",
      p: "הפלטפורמה גובה עמלה על עבודות שהושלמו, לפי השיעור המוצג באפליקציה. פירוט העמלה מוצג בעמוד הרווחים של בעל המקצוע.",
    },
    {
      h: "5. שימוש הוגן",
      p: "אין להשתמש בפלטפורמה למטרות בלתי חוקיות, לפרסם תוכן פוגעני או מטעה, להתחזות לאחר, או לעקוף את הפלטפורמה כדי להימנע מתשלום עמלה. אנו רשאים להשעות או למחוק חשבון שמפר תנאים אלה.",
    },
    {
      h: "6. דירוגים ודיווחים",
      p: "דירוגים צריכים לשקף חוויה אמיתית. אנו רשאים להסיר דירוגים מזויפים או פוגעניים, לבחון דיווחים ולנקוט בצעדים מתאימים.",
    },
    {
      h: "7. הגבלת אחריות",
      p: "אנו עושים מאמץ לאמת בעלי מקצוע, אך איננו ערבים לאיכות העבודה. הפלטפורמה אינה אחראית לנזק ישיר או עקיף הנובע מהשירותים שסופקו על ידי בעלי המקצוע.",
    },
    {
      h: "8. שינוי התנאים",
      p: `ייתכן שנעדכן תנאים אלה מעת לעת. המשך השימוש באפליקציה לאחר עדכון מהווה הסכמה לנוסח החדש. עודכן לאחרונה: ${LEGAL_CONTACT.updated}.`,
    },
  ],
};

const PRIVACY: Record<"ar" | "he", { h: string; p: string }[]> = {
  ar: [
    {
      h: "١. المعلومات التي نجمعها",
      p: "الاسم، رقم الهاتف، المدينة، صورة الملف الشخصي (اختيارية)، وتفاصيل طلباتك. للمهنيين: اسم النشاط، الوصف، مجالات العمل، ساعات العمل، صور الأعمال، وصورة إثبات الهوية لأغراض التوثيق فقط.",
    },
    {
      h: "٢. الموقع الجغرافي",
      p: "نستخدم موقعك — فقط عند منحك الإذن — لعرض المهنيين القريبين منك ولمشاركة عنوان العمل مع المهني الذي اخترته. يمكنك رفض الإذن والاستمرار باستخدام التطبيق عبر إدخال العنوان يدوياً.",
    },
    {
      h: "٣. كيف نستخدم بياناتك",
      p: "لتشغيل الخدمة: مطابقة الطلبات مع المهنيين، تمكين المحادثات، إرسال إشعارات حول حجوزاتك، منع الاحتيال، وتحسين التطبيق. لا نبيع بياناتك لأي جهة.",
    },
    {
      h: "٤. مع من نشاركها",
      p: "المهني الذي تتعامل معه يرى اسمك، هاتفك، وعنوان العمل — بالقدر اللازم لإتمام الخدمة. نستخدم مزوّدي خدمات تقنية (استضافة قواعد البيانات وخدمة الإشعارات) لتشغيل التطبيق.",
    },
    {
      h: "٥. صور إثبات الهوية",
      p: "تُخزَّن في مساحة خاصة غير علنية، ولا تظهر للعملاء إطلاقاً، ويطّلع عليها فريق التوثيق فقط لغرض التحقق.",
    },
    {
      h: "٦. حقوقك",
      p: "يمكنك تعديل بياناتك في أي وقت من صفحة الملف الشخصي، ويمكنك حذف حسابك وكل بياناتك نهائياً من إعدادات الحساب داخل التطبيق.",
    },
    {
      h: "٧. تواصل معنا",
      p: `لأي سؤال حول الخصوصية: ${LEGAL_CONTACT.email}`,
    },
  ],
  he: [
    {
      h: "1. מידע שאנו אוספים",
      p: "שם, מספר טלפון, עיר, תמונת פרופיל (אופציונלי) ופרטי ההזמנות שלכם. לבעלי מקצוע: שם העסק, תיאור, תחומי עבודה, שעות פעילות, תמונות עבודות ותעודת זהות לצורכי אימות בלבד.",
    },
    {
      h: "2. מיקום",
      p: "אנו משתמשים במיקום — רק לאחר קבלת הרשאה — כדי להציג בעלי מקצוע באזורכם ולשתף את כתובת העבודה עם בעל המקצוע שבחרתם. אפשר לסרב ולהמשיך להשתמש באפליקציה עם הזנת כתובת ידנית.",
    },
    {
      h: "3. כיצד אנו משתמשים במידע",
      p: "להפעלת השירות: התאמת בקשות לבעלי מקצוע, אפשור צ׳אט, שליחת התראות על ההזמנות, מניעת הונאות ושיפור האפליקציה. איננו מוכרים את המידע שלכם.",
    },
    {
      h: "4. עם מי אנו משתפים",
      p: "בעל המקצוע שאיתו אתם מתקשרים רואה את שמכם, הטלפון וכתובת העבודה — במידה הנדרשת לביצוע השירות. אנו נעזרים בספקי תשתית טכנית (אחסון נתונים ושירות התראות) להפעלת האפליקציה.",
    },
    {
      h: "5. תעודות זהות",
      p: "נשמרות באחסון פרטי שאינו ציבורי, אינן מוצגות ללקוחות כלל, ונצפות רק על ידי צוות האימות לצורך אימות בלבד.",
    },
    {
      h: "6. הזכויות שלכם",
      p: "ניתן לערוך את הפרטים בכל עת מעמוד הפרופיל, וניתן למחוק את החשבון וכל הנתונים לצמיתות מהגדרות החשבון באפליקציה.",
    },
    {
      h: "7. יצירת קשר",
      p: `לשאלות בנושא פרטיות: ${LEGAL_CONTACT.email}`,
    },
  ],
};

export default function LegalScreen() {
  const { colors, shadows } = useTheme();
  const { t, lang } = useI18n();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === "privacy" ? "privacy" : "terms");
  // Admin-editable copy overrides the built-in text when it exists, so terms
  // can be updated without shipping a new build. The bundled text above is the
  // fallback — this screen is never blank, even offline.
  const [remote, setRemote] = useState<Record<string, { title: string; body: string }>>({});

  useEffect(() => {
    let alive = true;
    supabase
      .from("legal_pages")
      .select("key,title_ar,title_he,body_ar,body_he")
      .in("key", ["terms", "privacy"])
      .then(({ data }) => {
        if (!alive || !data) return;
        const map: Record<string, { title: string; body: string }> = {};
        for (const row of data as LegalPage[]) {
          const title = (lang === "he" ? row.title_he : row.title_ar) ?? "";
          const body = (lang === "he" ? row.body_he : row.body_ar) ?? "";
          if (body.trim()) map[row.key] = { title, body };
        }
        setRemote(map);
      });
    return () => {
      alive = false;
    };
  }, [lang]);

  const override = remote[tab];
  const sections = tab === "terms" ? TERMS[lang] : PRIVACY[lang];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* header */}
      <View
        style={{
          ...ROW,
          gap: spacing.md,
          paddingTop: insets.top + spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingBottom: spacing.sm,
        }}
      >
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={{
            width: 40,
            height: 40,
            borderRadius: 20,
            backgroundColor: colors.card,
            alignItems: "center",
            justifyContent: "center",
            ...shadows.card,
          }}
        >
          <Ionicons name="arrow-forward" size={20} color={colors.text} />
        </Pressable>
        <Text style={[RTL_TEXT, { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" }]}>
          {t("legalTitle")}
        </Text>
      </View>

      {/* tabs */}
      <View style={{ ...ROW, gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }}>
        {(["terms", "privacy"] as Tab[]).map((k) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={{
              flex: 1,
              backgroundColor: tab === k ? colors.brand : colors.chip,
              borderRadius: radius.full,
              paddingVertical: 10,
              alignItems: "center",
            }}
          >
            <Text
              style={{
                color: tab === k ? colors.onBrand : colors.text,
                fontSize: 13.5,
                fontWeight: "700",
              }}
            >
              {t(k === "terms" ? "legalTerms" : "legalPrivacy")}
            </Text>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={{
          padding: spacing.lg,
          paddingBottom: insets.bottom + spacing.xxl,
          gap: spacing.lg,
        }}
        showsVerticalScrollIndicator={false}
      >
        {override ? (
          <View style={{ gap: 6 }}>
            {override.title ? (
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>
                {override.title}
              </Text>
            ) : null}
            <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 14, lineHeight: 22 }]}>
              {override.body}
            </Text>
          </View>
        ) : (
          sections.map((s) => (
            <View key={s.h} style={{ gap: 6 }}>
              <Text style={[RTL_TEXT, { color: colors.text, fontSize: 15.5, fontWeight: "800" }]}>{s.h}</Text>
              <Text style={[RTL_TEXT, { color: colors.muted, fontSize: 14, lineHeight: 22 }]}>{s.p}</Text>
            </View>
          ))
        )}

        <Text
          style={[
            RTL_TEXT,
            { color: colors.faint, fontSize: 12, marginTop: spacing.md, lineHeight: 18 },
          ]}
        >
          {t("legalUpdated", { date: LEGAL_CONTACT.updated })} · {LEGAL_CONTACT.email}
        </Text>
      </ScrollView>
    </View>
  );
}

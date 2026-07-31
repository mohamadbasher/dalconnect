import type { Dict } from "../index";

// Chat list + thread strings.
export const chat: Dict = {
  // conversation list
  chatEmptyTitle: { ar: "لا توجد محادثات بعد", he: "אין שיחות עדיין" },
  chatEmptySubtitle: {
    ar: "محادثاتك مع المهنيين ستظهر هنا",
    he: "השיחות שלך עם בעלי המקצוע יופיעו כאן",
  },
  chatStartConversation: { ar: "ابدأ المحادثة", he: "התחילו שיחה" },

  // thread
  chatSayHello: { ar: "قل مرحباً 👋", he: "אמרו שלום 👋" },
  chatSayHelloSubtitle: {
    ar: "هذه بداية محادثتكما — اكسر الجليد برسالة ودّية",
    he: "זו תחילת השיחה שלכם — שברו את הקרח בהודעה חביבה",
  },
  chatInputPlaceholder: { ar: "اكتب رسالة…", he: "כתבו הודעה…" },
  chatTyping: { ar: "يكتب الآن…", he: "מקליד/ה…" },
  chatSharedLocation: { ar: "موقع مُشارك", he: "מיקום משותף" },
  chatSendFailed: { ar: "تعذّر إرسال الرسالة، حاول مجدداً", he: "שליחת ההודעה נכשלה, נסו שוב" },
  chatImageFailed: { ar: "تعذّر إرسال الصورة، حاول مجدداً", he: "שליחת התמונה נכשלה, נסו שוב" },
  chatLocationFailed: {
    ar: "تعذّرت مشاركة الموقع — تأكد من تفعيل خدمة الموقع",
    he: "שיתוף המיקום נכשל — ודאו ששירותי המיקום מופעלים",
  },
  chatNotFound: { ar: "المحادثة غير موجودة", he: "השיחה לא נמצאה" },

  // failed send + retry
  chatTapToRetry: { ar: "لم تُرسل — اضغط لإعادة المحاولة", he: "לא נשלחה — הקישו לניסיון חוזר" },
  chatFailedBody: {
    ar: "لم يتم إرسال هذه الرسالة. هل تريد المحاولة مجدداً؟",
    he: "ההודעה הזו לא נשלחה. לנסות שוב?",
  },
};

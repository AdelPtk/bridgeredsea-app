# מערכת מונים אוטומטית לאירועים

## סקירה כללית

המערכת החדשה מחזיקה **מונים מצטברים** ב-Firestore לכל אירוע, שמתעדכנים **אוטומטית** בכל פעם שיש שינוי במשתתפים.

### מבנה המונים ב-Firestore

```
years/{year}/eventStats/{eventKey}/
  - totalEligibleAdults: int     // סך כל הזכאים לכניסה
  - totalConsumedAdults: int      // סך כל הכניסות שבוצעו
  - participants: int             // מספר משתתפים זכאים
  - updatedAt: string             // זמן עדכון אחרון
```

## איך זה עובד?

### עדכון אוטומטי
המונים מתעדכנים **אוטומטית** בכל פעם ש:
- ✅ נוסף משתתף חדש עם זכאות לאירוע
- ✅ שונתה כמות הזכאים של משתתף קיים
- ✅ בוצעה כניסה לאירוע (redemption)
- ✅ בוטלה כניסה (unredeemed)

### פונקציות שמעדכנות מונים
- `upsertParticipantAndSeedEvents()` - יוצר משתתפים חדשים
- `setParticipantEventQuantity()` - משנה כמות זכאים
- `setEventRedeemed()` - מסמן כניסה/ביטול
- `redeemEventAdults()` - כניסה חלקית של מבוגרים

כל הפונקציות האלה קוראות ל-`incrementEventStats()` מחוץ לטרנזקציה כדי להבטיח עדכון אמין.

## אתחול ראשוני (פעם אחת!)

אם יש לך נתונים קיימים מלפני השדרוג, יש לאתחל את המונים **פעם אחת**.

### שיטה 1: דרך Admin Dashboard (הכי קל! ⭐)

1. ✅ היכנס ל-Admin Dashboard באפליקציה
2. ✅ בחלק העליון תראה **תיבה צהובה** עם כפתור "אתחל מונים כעת"
3. ✅ לחץ על הכפתור וחכה כמה שניות
4. ✅ תקבל הודעה שהאתחול הושלם
5. ✅ **מחק את הקוד של התיבה הצהובה** מ-`AdminDashboard.tsx` (שורות 248-278 בערך)

**לאחר מכן - המונים יתעדכנו אוטומטית ולא תצטרך לרוץ את זה שוב!**

### שיטה 2: דרך Browser Console (למתקדמים)

1. פתח את האפליקציה בדפדפן
2. נווט ל-`/admin`
3. פתח Developer Console (F12)
4. העתק והדבק את הקוד הזה:

\`\`\`javascript
(async () => {
  const { rebuildEventStats } = await import('/src/services/eventStats.ts');
  const { getYearKey } = await import('/src/services/participants.ts');
  const events = ["OPENING","RB1","TERRACE1","SOUPS","COCKTAIL","TERRACE2","RB2","TERRACE3","PRIZES"];
  const year = getYearKey();
  console.log('🔄 Initializing counters for year:', year);
  for (const eventKey of events) {
    try {
      console.log('⏳ Processing', eventKey, '...');
      const stats = await rebuildEventStats(year, eventKey);
      console.log('✅', eventKey + ':', stats.participants, 'participants |', stats.totalEligibleAdults, 'eligible |', stats.totalConsumedAdults, 'consumed');
    } catch (error) {
      console.error('❌ Error processing', eventKey + ':', error);
    }
  }
  console.log('🎉 Counter initialization complete!');
})();
\`\`\`

## שימוש ב-AdminDashboard

### לפני השדרוג
❌ היה צריך ללחוץ "רענון מונים מלא" אחרי כל שינוי  
❌ סריקות איטיות על כל המשתתפים

### אחרי השדרוג
✅ המונים מוצגים **מיד** בלחיצה על אירוע  
✅ **אין צורך** בכפתורי רענון (הוסרו מה-UI)  
✅ המונים **תמיד עדכניים** ללא צורך בפעולה ידנית

### תצוגת מונים
כשלוחצים על אירוע, מוצגים 3 מונים:
1. **מס' זכאים** - כמה משתתפים יש עם זכאות לאירוע
2. **כמות זכאית** - סך כל המבוגרים שזכאים להיכנס
3. **כניסות שבוצעו** - סך כל הכניסות שכבר בוצעו

## יתרונות המערכת החדשה

### ביצועים ⚡
- **קריאה מהירה** - קריאת מסמך בודד במקום סריקת אלפי משתתפים
- **אין עיכובים** - תצוגה מיידית של סטטיסטיקות
- **קניון זול יותר** - פחות קריאות = חיסכון בעלויות Firestore

### אמינות 🛡️
- **תמיד עדכני** - מתעדכן אוטומטית עם כל שינוי
- **אין צורך בסנכרון ידני** - הכל קורה ברקע
- **לא תלוי ב-UI** - עובד גם אם לא נכנסים לדשבורד

### נוחות שימוש 🎯
- **אין כפתורי רענון מיותרים** - פשוט לוחצים על אירוע ורואים את המצב
- **ממשק נקי יותר** - פחות לחצנים, יותר מידע
- **תצוגה ברורה** - 3 מספרים פשוטים שמספרים הכל

## תחזוקה

### אין צורך בפעולות שוטפות! 
המערכת פועלת **לחלוטין אוטומטית** לאחר האתחול הראשוני.

### מה לעשות אם המונים לא מדויקים?
זה לא אמור לקרות, אבל במקרה חירום:

1. הוסף בקוד זמני:
\`\`\`typescript
import { rebuildEventStats } from "@/services/eventStats";
await rebuildEventStats(getYearKey(), "EVENT_KEY");
\`\`\`

2. או הפעל מחדש את סקריפט האתחול.

## שינויים טכניים

### `participants.ts`
- ✅ `incrementEventStats` נקרא **מחוץ** לטרנזקציות
- ✅ ללא `try/catch` שבולע שגיאות
- ✅ מבטיח שכל שינוי מעדכן את המונים

### `AdminDashboard.tsx`
- ✅ הוסרו כפתורי "רענון מונים מלא" ו"רענון לכל האירועים"
- ✅ הוסר קוד `rebuildEventStats` האוטומטי
- ✅ נוספה תצוגה של "כמות זכאית" (eligibleAdults)
- ✅ קריאה ישירה מ-`eventStats` ללא סריקות

### `eventStats.ts`
- ✅ ללא שינוי - הפונקציות כבר היו נכונות
- ✅ `rebuildEventStats` נשאר לשימוש חירום בלבד

## סיכום

🎉 **המערכת החדשה מהירה, אמינה ופשוטה!**

- ✅ מונים אוטומטיים
- ✅ אין צורך בפעולות ידניות
- ✅ ביצועים מעולים
- ✅ חוויית משתמש משופרת

---

**הוכן על ידי GitHub Copilot** • אוקטובר 2025

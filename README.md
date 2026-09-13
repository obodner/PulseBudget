# PulseBudget 💸⏱️

> **מד הצעדים הפיננסי (The Financial Pedometer)**  
> מעקב הוצאות, הכנסות, תקרות חכמות ו-BI בזמן אמת לצעירים.

[![Live Web App](https://img.shields.io/badge/Live-pulsebudget--erez.web.app-00f5d4?style=for-the-badge&logo=firebase)](https://pulsebudget-erez.web.app)
[![Built with TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)](https://firebase.google.com/)

---

## 🌟 חזון המוצר

**PulseBudget** הופכת את ניהול התקציב האישי מחוויה מעיקה ומסורבלת של טבלאות אקסל לחוויה יומיומית קלילה וסוחפת בפרדיגמת **"מד צעדים"**:
- **טבעת פעימה ויזואלית (Activity Ring):** ניטור קצב ההוצאות היומי, השבועי והחודשי.
- **כלל הברזל:** תקרות תקציב מיועדות אך ורק להוצאות.
- **תקרות לפי קטגוריה:** הגדרת יעדים מדויקים לקטגוריות פרטניות (מזון, תחבורה, קניות וכו') תחת תקרת מטריה כללית.
- **פעמון התראות עליון ומונה חריגות:** ניווט מהיר בלחיצה אחת לתקופה החורגת.
- **תובנות בזק (Pulse Nuggets):** כרטיסיית טיפים חכמים במסך הבית בשפה צעירה וסוחפת (ללא ז'רגון בנקאי כבד).
- **מעבדת הדופק (Pulse Lab BI):** מפת חום שבועית, זיהוי בולעני כסף, מודיעין בתי עסק מובילים וסימולטור חיסכון אינטראקטיבי.
- **סאונד רטרו מסונתז:** צלילי 8-bit מקוריים (Super Mario) באמצעות Web Audio API (אפס קבצי שמע חיצוניים).
- **סנכרון ענן ועבודה אופליין:** אימות משתמשים עם Google ודוא"ל, סנכרון בזמן אמת ב-Cloud Firestore, ותמיכה מלאה ב-`localStorage`.

---

## 🛠️ טכנולוגיות

- **Frontend:** Vanilla TypeScript, HTML5 Semantic Elements, Modern CSS (Glassmorphism, Neon Cyber Palette).
- **Charts:** Chart.js + Chart.js Annotation Plugin.
- **Audio:** Web Audio API (סינתוז בזמן אמת ללא הורדת קבצים).
- **Backend & Cloud:** Firebase Authentication, Cloud Firestore, Firebase Hosting.
- **Build Tool:** Vite.

---

## 🚀 הרצה מקומית

```bash
# 1. התקנת תלויות
npm install

# 2. הרצת שרת פיתוח
npm run dev

# 3. בניית גרסת ייצור
npm run build
```

---

## 📄 תיעוד דרישות המערכת

מסמכי האפיון והדרישות המלאים זמינים בתיקיית `docs`:
- 🇮🇱 [מסמך דרישות מערכת בעברית (SYSTEM_REQUIREMENTS_HE.md)](./docs/SYSTEM_REQUIREMENTS_HE.md)
- 🇬🇧 [English System Requirements Document (SYSTEM_REQUIREMENTS.md)](./docs/SYSTEM_REQUIREMENTS.md)
- 🧪 [אפיון מוצר: תובנות חכמות ו-BI לצעירים (BI_INSIGHTS_PRD_HE.md)](./docs/BI_INSIGHTS_PRD_HE.md)

/**
 * Script to remove event eligibility for specific participants
 * This will DELETE the event document from Firestore, making the event not appear for these participants
 */

import { initializeApp } from "firebase/app";
import { getFirestore, doc, deleteDoc, getDoc } from "firebase/firestore";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const YEAR = "2025";

// Participants to remove COCKTAIL (19/11) eligibility
const cocktailParticipants = [
  "38",   // טננבאום אורלי
  "47",   // עמי ראובן וקארין
  "317",  // אלדר דליה וגרוס ירון
  "344",  // מחרז רוזי בריג'יט
  "355",  // בראל מיכאל
  "356",  // בראל מיכאל
  "358",  // טל לביאה
  "359",  // לויטנוס מאיר ולביאה
  "360",  // מונטאנו אאורה ואלכס
  "361",  // ברקוביץ אריה ורבקה
  "362",  // ברקוביץ נועה
  "370",  // קייזר אהובית ושרון
  "374",  // איסק מנחם
  "375",  // סף יעל
  "379",  // מחרז רוזי בריג'יט
];

// Participants to remove OPENING (13/11) eligibility
const openingParticipants = [
  "350",  // אברון אנית ורונן
  "349",  // אברון נעמי ויניב
  "351",  // אברון רועי ורותם
  "354",  // קופמן שרה ואלכס
  "353",  // קופמן שרה ואלכס
];

async function removeEventFromParticipant(
  participantId: string,
  eventKey: string,
  eventName: string
): Promise<boolean> {
  try {
    const eventRef = doc(
      db,
      "years",
      YEAR,
      "participants",
      participantId,
      "events",
      eventKey
    );

    // Check if event exists
    const eventSnap = await getDoc(eventRef);
    if (!eventSnap.exists()) {
      console.log(`  ⚠️  Event ${eventKey} already doesn't exist for participant ${participantId}`);
      return false;
    }

    // Delete the event document
    await deleteDoc(eventRef);
    console.log(`  ✅ Removed ${eventName} from participant ${participantId}`);
    return true;
  } catch (error) {
    console.error(`  ❌ Error removing ${eventName} from participant ${participantId}:`, error);
    return false;
  }
}

async function main() {
  console.log("🚀 Starting event eligibility removal script...\n");

  let totalRemoved = 0;
  let totalSkipped = 0;

  // Remove COCKTAIL eligibility
  console.log("📋 Removing COCKTAIL eligibility from participants...");
  for (const participantId of cocktailParticipants) {
    const removed = await removeEventFromParticipant(participantId, "COCKTAIL", "קוקטייל פתיחת התחרות המרכזית");
    if (removed) totalRemoved++;
    else totalSkipped++;
  }

  console.log("\n📋 Removing OPENING eligibility from participants...");
  for (const participantId of openingParticipants) {
    const removed = await removeEventFromParticipant(participantId, "OPENING", "קוקטייל פתיחת הפסטיבל");
    if (removed) totalRemoved++;
    else totalSkipped++;
  }

  console.log("\n" + "=".repeat(60));
  console.log(`✨ Script completed!`);
  console.log(`   - Events removed: ${totalRemoved}`);
  console.log(`   - Already removed/skipped: ${totalSkipped}`);
  console.log("=".repeat(60));

  process.exit(0);
}

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});

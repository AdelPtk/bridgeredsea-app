/**
 * Script to check which participants exist in Firestore and what events they have
 */

import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, doc, getDoc } from "firebase/firestore";
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

// Participants to check
const participantsToCheck = [
  "38", "47", "317", "344", "355", "356", "358", "359", "360", 
  "361", "362", "370", "374", "375", "379", "350", "349", "351", "354", "353"
];

async function checkParticipant(participantId: string) {
  try {
    // Check if participant exists
    const participantRef = doc(db, "years", YEAR, "participants", participantId);
    const participantSnap = await getDoc(participantRef);

    if (!participantSnap.exists()) {
      console.log(`❌ Participant ${participantId} does NOT exist in Firestore`);
      return;
    }

    const participantData = participantSnap.data();
    console.log(`✅ Participant ${participantId} exists: ${participantData.NAME || "No name"}`);

    // Check what events they have
    const eventsCol = collection(db, "years", YEAR, "participants", participantId, "events");
    const eventsSnap = await getDocs(eventsCol);

    if (eventsSnap.empty) {
      console.log(`   ⚠️  No events found`);
    } else {
      console.log(`   📋 Events:`);
      eventsSnap.forEach((eventDoc) => {
        const eventData = eventDoc.data();
        console.log(`      - ${eventDoc.id}: ${eventData.name || "No name"}`);
      });
    }
    console.log("");
  } catch (error) {
    console.error(`❌ Error checking participant ${participantId}:`, error);
  }
}

async function main() {
  console.log("🔍 Checking participants in Firestore...\n");

  for (const participantId of participantsToCheck) {
    await checkParticipant(participantId);
  }

  console.log("✨ Check completed!");
  process.exit(0);
}

main().catch((error) => {
  console.error("💥 Fatal error:", error);
  process.exit(1);
});

import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, increment, collectionGroup, getDocs, query, where, collection } from "firebase/firestore";

export type EventStats = {
  totalEligibleAdults: number;
  totalConsumedAdults: number;
  participants: number;
  updatedAt: string;
};

const eventStatsRef = (year: string, eventKey: string) =>
  doc(db, "years", year, "eventStats", eventKey);

export async function ensureEventStatsDoc(year: string, eventKey: string): Promise<void> {
  if (!db) return;
  const ref = eventStatsRef(year, eventKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      totalEligibleAdults: 0,
      totalConsumedAdults: 0,
      participants: 0,
      updatedAt: new Date().toISOString(),
    } as EventStats);
  }
}

export async function getEventStats(year: string, eventKey: string): Promise<EventStats> {
  if (!db) return { totalEligibleAdults: 0, totalConsumedAdults: 0, participants: 0, updatedAt: new Date().toISOString() };
  const ref = eventStatsRef(year, eventKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { totalEligibleAdults: 0, totalConsumedAdults: 0, participants: 0, updatedAt: new Date().toISOString() };
  }
  const d = snap.data() as any;
  return {
    totalEligibleAdults: Number(d.totalEligibleAdults ?? 0),
    totalConsumedAdults: Number(d.totalConsumedAdults ?? 0),
    participants: Number(d.participants ?? 0),
    updatedAt: String(d.updatedAt ?? new Date().toISOString()),
  };
}

export async function incrementEventStats(year: string, eventKey: string, deltas: {
  eligibleDelta?: number;
  consumedDelta?: number;
  participantsDelta?: number;
}) {
  if (!db) return;
  const ref = eventStatsRef(year, eventKey);
  await ensureEventStatsDoc(year, eventKey);
  await updateDoc(ref, {
    totalEligibleAdults: increment(Math.floor(deltas.eligibleDelta ?? 0)),
    totalConsumedAdults: increment(Math.floor(deltas.consumedDelta ?? 0)),
    participants: increment(Math.floor(deltas.participantsDelta ?? 0)),
    updatedAt: new Date().toISOString(),
  } as any);
}

// Rebuild event stats without requiring a collectionGroup index
// Works by iterating all participants and checking each one's events
export async function rebuildEventStats(year: string, eventKey: string): Promise<EventStats> {
  if (!db) return { totalEligibleAdults: 0, totalConsumedAdults: 0, participants: 0, updatedAt: new Date().toISOString() };
  
  // Get all participants for the year
  const participantsCol = collection(db, "years", year, "participants");
  const participantsSnap = await getDocs(participantsCol);
  
  let totalEligible = 0;
  let totalConsumed = 0;
  let participants = 0;
  
  // Check each participant's events subcollection
  for (const participantDoc of participantsSnap.docs) {
    const eventRef = doc(db, "years", year, "participants", participantDoc.id, "events", eventKey);
    const eventSnap = await getDoc(eventRef);
    
    if (eventSnap.exists()) {
      const d = eventSnap.data() as any;
      const qty = Number.isFinite(d.quantity) ? Number(d.quantity) : 1;
      const consumed = Number.isFinite(d.consumed) ? Number(d.consumed) : (d.redeemed ? qty : 0);
      totalEligible += qty;
      totalConsumed += consumed;
      participants += 1;
    }
  }
  
  const ref = eventStatsRef(year, eventKey);
  const payload: EventStats = {
    totalEligibleAdults: totalEligible,
    totalConsumedAdults: totalConsumed,
    participants,
    updatedAt: new Date().toISOString(),
  };
  await setDoc(ref, payload, { merge: true });
  return payload;
}

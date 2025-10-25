import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, updateDoc, increment, collectionGroup, getDocs, query, where } from "firebase/firestore";

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

// One-shot rebuild using collectionGroup; use sparingly (button in Admin only)
export async function rebuildEventStats(year: string, eventKey: string): Promise<EventStats> {
  if (!db) return { totalEligibleAdults: 0, totalConsumedAdults: 0, participants: 0, updatedAt: new Date().toISOString() };
  const cg = collectionGroup(db, "events");
  const q1 = query(cg, where("year", "==", year), where("eventKey", "==", eventKey));
  const snap = await getDocs(q1);
  let totalEligible = 0;
  let totalConsumed = 0;
  let participants = 0;
  snap.forEach((docSnap) => {
    const d = docSnap.data() as any;
    const qty = Number.isFinite(d.quantity) ? Number(d.quantity) : 1;
    const consumed = Number.isFinite(d.consumed) ? Number(d.consumed) : (d.redeemed ? qty : 0);
    totalEligible += qty;
    totalConsumed += consumed;
    participants += 1;
  });
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

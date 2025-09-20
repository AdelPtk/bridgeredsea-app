import { db } from "@/lib/firebase";
import { collection, doc, getDoc, getDocs, setDoc, deleteDoc } from "firebase/firestore";
import type { Participant } from "@/types/participant";

export const getYearKey = () =>
  (import.meta.env.VITE_EVENT_YEAR as string | undefined) ?? new Date().getFullYear().toString();

const participantDocRef = (year: string, participantId: string) =>
  doc(db, "years", year, "participants", participantId);

const eventDocRef = (year: string, participantId: string, eventKey: string) =>
  doc(db, "years", year, "participants", participantId, "events", eventKey);

export type EventSeed = {
  key: string;
  name: string;
  description?: string;
  allowedValue?: string; // raw value from CSV, e.g., not "NO"
  quantity?: number;
};

export type EventStatus = {
  redeemed: boolean;
  quantity: number;
};

/** Ensure participant doc exists with full CSV row, and seed event docs if missing. */
export async function upsertParticipantAndSeedEvents(
  year: string,
  participant: Participant | any,
  events: EventSeed[]
): Promise<void> {
  const pid = String(participant.ID ?? participant.id ?? participant["מזהה"] ?? "").trim();
  if (!pid) return;

  // store full participant row (merge)
  const pRef = participantDocRef(year, pid);
  await setDoc(
    pRef,
    {
      ...participant,
      ID: pid, // normalize
      _updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const qty = Number(participant.ADULTS ?? participant.adults) || 1;

  // seed events (only if missing)
  for (const e of events) {
    const eRef = eventDocRef(year, pid, e.key);
    const snap = await getDoc(eRef);
    if (!snap.exists()) {
      await setDoc(eRef, {
        name: e.name,
        description: e.description ?? "",
        value: e.allowedValue ?? "",
        quantity: e.quantity ?? qty,
        redeemed: false,
        _createdAt: new Date().toISOString(),
      });
    } else {
      // ensure quantity is present if previously missing
      const data = snap.data();
      if (typeof data.quantity !== "number") {
        await setDoc(eRef, { quantity: qty }, { merge: true });
      }
    }
  }
}

/** Fetch redeemed map and quantities for a set of event keys */
export async function fetchEventsStatus(
  year: string,
  participantId: string,
  eventKeys: string[]
): Promise<Record<string, EventStatus>> {
  const pid = String(participantId).trim();
  const result: Record<string, EventStatus> = {};
  // Single round-trip: read the entire events subcollection
  const col = collection(db, "years", year, "participants", pid, "events");
  const snap = await getDocs(col);
  const existing: Record<string, EventStatus> = {};
  snap.forEach((docSnap) => {
    const d = docSnap.data() as any;
    existing[docSnap.id] = {
      redeemed: Boolean(d.redeemed),
      quantity: typeof d.quantity === "number" ? d.quantity : 1,
    };
  });
  // Fill requested keys; assume defaults for missing
  for (const key of eventKeys) {
    result[key] = existing[key] ?? { redeemed: false, quantity: 1 };
  }
  return result;
}

/** Update redeemed state for an event */
export async function setEventRedeemed(
  year: string,
  participantId: string,
  eventKey: string,
  redeemed: boolean
) {
  const pid = String(participantId).trim();
  const ref = eventDocRef(year, pid, eventKey);
  await setDoc(
    ref,
    {
      redeemed,
      redeemedAt: redeemed ? new Date().toISOString() : null,
    },
    { merge: true }
  );
}

/** Remove a specific event doc for all participants in a year. Returns number of participants processed. */
export async function removeEventForAllParticipants(year: string, eventKey: string): Promise<number> {
  const participantsCol = collection(db, "years", year, "participants");
  const snap = await getDocs(participantsCol);
  let processed = 0;
  for (const docSnap of snap.docs) {
    const pid = docSnap.id;
    const ref = eventDocRef(year, pid, eventKey);
    await deleteDoc(ref);
    processed++;
  }
  return processed;
}

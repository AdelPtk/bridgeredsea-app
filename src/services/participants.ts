import { db } from "@/lib/firebase";
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, runTransaction, addDoc, serverTimestamp, orderBy, limit, writeBatch } from "firebase/firestore";
import { incrementEventStats } from "@/services/eventStats";
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
  consumed?: number; // redeemed adults so far
  redeemedAt?: string; // ISO timestamp when fully redeemed
  finalized?: boolean; // final voucher used
  exists?: boolean; // true if event doc exists in Firestore, false if removed (not eligible)
};
export type EventAggregate = {
  redeemedParticipants: number; // number of redeemed participant-docs
  redeemedAdults: number; // sum of quantity for redeemed docs
};

// Admin-configured schedule per event (global, per year)
export type EventSchedule = {
  date?: string;      // YYYY-MM-DD
  openTime?: string;  // HH:MM 24h
  closeTime?: string; // HH:MM 24h
  requireVerification?: boolean; // if true, show finalize button in EventsList
};

const eventScheduleDocRef = (year: string, eventKey: string) =>
  doc(db, "years", year, "eventSchedules", eventKey);

/** Get all event schedules for a year */
export async function getEventSchedules(year: string): Promise<Record<string, EventSchedule>> {
  if (!db) return {};
  const col = collection(db, "years", year, "eventSchedules");
  const snap = await getDocs(col);
  const out: Record<string, EventSchedule> = {};
  snap.forEach((d) => {
    out[d.id] = d.data() as EventSchedule;
  });
  return out;
}

/** Get a single event schedule */
export async function getEventSchedule(year: string, eventKey: string): Promise<EventSchedule | null> {
  if (!db) return null;
  const ref = eventScheduleDocRef(year, eventKey);
  const snap = await getDoc(ref);
  return snap.exists() ? ((snap.data() as EventSchedule) ?? null) : null;
}

/** Set/Update an event schedule */
export async function setEventSchedule(year: string, eventKey: string, schedule: EventSchedule): Promise<void> {
  if (!db) return;
  const ref = eventScheduleDocRef(year, eventKey);
  await setDoc(ref, { ...schedule }, { merge: true });
}

/** Clear an event schedule */
export async function clearEventSchedule(year: string, eventKey: string): Promise<void> {
  if (!db) return;
  const ref = eventScheduleDocRef(year, eventKey);
  await setDoc(ref, { date: null, openTime: null, closeTime: null }, { merge: true });
}

/** Ensure participant doc exists with full CSV row, and seed event docs if missing. */
export async function upsertParticipantAndSeedEvents(
  year: string,
  participant: Participant | any,
  events: EventSeed[]
): Promise<void> {
  if (!db) return; // Firestore not available – no-op
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
      const eventQty = e.quantity ?? qty;
      await setDoc(eRef, {
        eventKey: e.key,
        name: e.name,
        description: e.description ?? "",
        value: e.allowedValue ?? "",
        quantity: eventQty,
        consumed: 0,
        redeemed: false,
        finalized: false,
        year, // add year to support collectionGroup admin queries
        participantId: pid,
        _createdAt: new Date().toISOString(),
      });
      // Increment event stats: new participant eligible for this event
      await incrementEventStats(year, e.key, { 
        eligibleDelta: eventQty, 
        participantsDelta: 1 
      });
    } else {
      // ensure quantity is present if previously missing
      const data = snap.data();
      const patch: Record<string, any> = {};
      if (typeof data.quantity !== "number") patch.quantity = qty;
      if (typeof (data as any).consumed !== "number")
        patch.consumed = data.redeemed ? (typeof data.quantity === "number" ? data.quantity : qty) : 0;
      if (!data.eventKey) patch.eventKey = e.key;
      if (!data.year) patch.year = year;
      if (!data.participantId) patch.participantId = pid;
      if (typeof (data as any).finalized !== "boolean") patch.finalized = false;
      if (Object.keys(patch).length) await setDoc(eRef, patch, { merge: true });
    }
  }
}

/** Fetch redeemed map and quantities for a set of event keys */
export async function fetchEventsStatus(
  year: string,
  participantId: string,
  eventKeys: string[]
): Promise<Record<string, EventStatus>> {
  if (!db) {
    const fallback: Record<string, EventStatus> = {};
    for (const key of eventKeys) fallback[key] = { redeemed: false, quantity: 1 };
    return fallback;
  }
  const pid = String(participantId).trim();
  const result: Record<string, EventStatus> = {};
  // Single round-trip: read the entire events subcollection
  const col = collection(db, "years", year, "participants", pid, "events");
  const snap = await getDocs(col);
  const existing: Record<string, EventStatus> = {};
  snap.forEach((docSnap) => {
    const d = docSnap.data() as any;
    const qty = typeof d.quantity === "number" ? d.quantity : 1;
    const consumed = typeof d.consumed === "number" ? d.consumed : (d.redeemed ? qty : 0);
    existing[docSnap.id] = {
      redeemed: consumed >= qty || Boolean(d.redeemed),
      quantity: qty,
      consumed,
  redeemedAt: typeof d.redeemedAt === "string" ? d.redeemedAt : undefined,
  finalized: Boolean((d as any).finalized),
      exists: true,
    };
  });
  // Fill requested keys; mark missing events as not existing
  for (const key of eventKeys) {
    result[key] = existing[key] ?? { redeemed: false, quantity: 0, consumed: 0, exists: false };
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
  if (!db) return; // Firestore not available – no-op
  const pid = String(participantId).trim();
  const ref = eventDocRef(year, pid, eventKey);
  let snapshot: Record<string, any> = {};
  if (redeemed) {
    try {
      const pRef = participantDocRef(year, pid);
      const pSnap = await getDoc(pRef);
      if (pSnap.exists()) {
        const p = pSnap.data() as any;
        snapshot = {
          participantName: p.NAME ?? p.name ?? "",
          reservationNum: p.RESERVATION_NUM ?? p.reservation_num ?? p.reservationNum ?? "",
          hotel: p.HOTEL ?? p.hotel ?? "",
          adults: typeof p.ADULTS === "number" ? p.ADULTS : Number(p.ADULTS ?? p.adults ?? 1) || 1,
        };
      }
    } catch {}
  }
  // Use transaction to get before/after state, then update stats outside
  const deltaInfo = await runTransaction(db, async (tx) => {
    const before = await tx.get(ref);
    const prev: any = before.exists() ? before.data() : {};
    const qty = typeof prev.quantity === "number" ? prev.quantity : 1;
    const prevConsumed = typeof prev.consumed === "number" ? prev.consumed : (prev.redeemed ? qty : 0);
    const nextConsumed = redeemed ? qty : 0;
    const patch: any = {
      redeemed,
      redeemedAt: redeemed ? new Date().toISOString() : null,
      year,
      participantId: pid,
      ...(redeemed ? snapshot : {}),
      consumed: nextConsumed,
    };
    tx.set(ref, patch, { merge: true });
    return { delta: nextConsumed - prevConsumed };
  });
  
  // Update event stats OUTSIDE transaction for reliability
  if (deltaInfo.delta !== 0) {
    await incrementEventStats(year, eventKey, { consumedDelta: deltaInfo.delta });
  }
  // Ensure dashboard reads fresh data after a write
  invalidateCachesForEvent(year, eventKey);
}

/** Set final voucher usage (no further use allowed) */
export async function setEventFinalized(
  year: string,
  participantId: string,
  eventKey: string,
  finalized: boolean
) {
  if (!db) return;
  const pid = String(participantId).trim();
  const ref = eventDocRef(year, pid, eventKey);
  await setDoc(
    ref,
    {
      finalized,
      finalizedAt: finalized ? new Date().toISOString() : null,
      year,
      participantId: pid,
    },
    { merge: true }
  );
  
  // Update all redemptionLogs for this participant+event to reflect finalized status
  try {
    const logsCol = collection(db, "redemptionLogs");
    const logsQ = query(
      logsCol,
      where("year", "==", year),
      where("participantId", "==", pid),
      where("eventKey", "==", eventKey)
    );
    const logsSnap = await getDocs(logsQ);
    const batch = writeBatch(db);
    logsSnap.forEach((doc) => {
      batch.update(doc.ref, { finalized });
    });
    if (!logsSnap.empty) {
      await batch.commit();
    }
  } catch (error) {
    console.error('Error updating redemption logs finalized status:', error);
  }
  
  invalidateCachesForEvent(year, eventKey);
}

export async function redeemEventAdults(
  year: string,
  participantId: string,
  eventKey: string,
  count: number
) {
  if (!db) return;
  const pid = String(participantId).trim();
  const ref = eventDocRef(year, pid, eventKey);
  // Attempt a transactional increment
  const txResult = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists() ? (snap.data() as any) : {};
    const qty = typeof d.quantity === "number" ? d.quantity : 1;
    const prev = typeof d.consumed === "number" ? d.consumed : (d.redeemed ? qty : 0);
    const inc = Math.max(0, Math.floor(count || 0));
    const next = Math.max(0, Math.min(qty, prev + inc));
    const fully = next >= qty;
    const patch: any = {
      consumed: next,
      redeemed: fully,
      year,
      participantId: pid,
    };
    if (fully && !d.redeemedAt) patch.redeemedAt = new Date().toISOString();
    tx.set(ref, patch, { merge: true });
    return { next, qty, prev, delta: next - prev };
  });
  
  // Update event stats OUTSIDE transaction
  if (txResult.delta !== 0) {
    await incrementEventStats(year, eventKey, { consumedDelta: txResult.delta });
  }
  // Write a log entry for admin listing (one row per increment)
  try {
    // Best-effort denormalization to avoid N lookups during listing
    let participantName: string | undefined;
    let eventName: string | undefined;
    try {
      const pSnap = await getDoc(participantDocRef(year, pid));
      const p = pSnap.exists() ? (pSnap.data() as any) : null;
      participantName = p?.NAME ?? p?.name;
    } catch {}
    try {
      const eSnap = await getDoc(ref);
      const ed = eSnap.exists() ? (eSnap.data() as any) : null;
      eventName = ed?.name;
    } catch {}
    await addDoc(collection(db, "redemptionLogs"), {
      year,
      participantId: pid,
      eventKey,
      count: Math.max(1, Math.floor(count || 1)),
      at: serverTimestamp(),
      participantName: participantName ?? null,
      eventName: eventName ?? null,
      quantity: txResult?.qty ?? null,
      redeemedAfter: txResult ? (txResult.next >= (txResult.qty ?? 0)) : null,
    });
  } catch {}
  invalidateCachesForEvent(year, eventKey);
}

/** Remove log entries for a specific participant+event (used by admin 'unredeem'). */
export async function clearRedemptionLogsForParticipant(
  year: string,
  participantId: string,
  eventKey: string
) {
  if (!db) return 0;
  const logsCol = collection(db, "redemptionLogs");
  const q1 = query(logsCol, where("year", "==", year), where("participantId", "==", String(participantId)), where("eventKey", "==", eventKey));
  const snap = await getDocs(q1);
  let n = 0;
  for (const d of snap.docs) {
    await deleteDoc(d.ref);
    n++;
  }
  invalidateCachesForEvent(year, eventKey);
  return n;
}
/** Update the eligible quantity for a participant's event.
 * - Stores NON-NEGATIVE INTEGERS only (fractions are not allowed)
 * - Ensures consumed <= quantity
 * - Updates redeemed flag to consumed >= quantity
 */
export async function setParticipantEventQuantity(
  year: string,
  participantId: string,
  eventKey: string,
  quantity: number
): Promise<void> {
  if (!db) return;
  const pid = String(participantId).trim();
  const ref = eventDocRef(year, pid, eventKey);
  // Coerce to a non-negative integer
  const num = Number.isFinite(quantity as any) ? Number(quantity) : 0;
  const newQty = Math.max(0, Math.floor(num));
  const deltaInfo = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists() ? (snap.data() as any) : {};
    const prevQty = typeof d.quantity === "number" ? d.quantity : 1;
    const prevConsumed = typeof d.consumed === "number" ? d.consumed : (d.redeemed ? prevQty : 0);
    const nextConsumed = Math.min(prevConsumed, newQty);
    const redeemed = nextConsumed >= newQty && newQty > 0 ? true : false;
    const patch: any = {
      year,
      participantId: pid,
      eventKey,
      quantity: newQty,
      consumed: nextConsumed,
      redeemed,
    };
    // If newly redeemed and no timestamp recorded, set redeemedAt. If no longer redeemed, clear it.
    if (redeemed) {
      if (!d.redeemedAt) patch.redeemedAt = new Date().toISOString();
    } else {
      patch.redeemedAt = null;
    }
    tx.set(ref, patch, { merge: true });
    // Calculate deltas for event stats update
    const eligibleDelta = newQty - prevQty;
    const consumedDelta = nextConsumed - prevConsumed;
    return { eligibleDelta, consumedDelta };
  });
  
  // Update event stats OUTSIDE transaction
  if (deltaInfo.eligibleDelta !== 0 || deltaInfo.consumedDelta !== 0) {
    await incrementEventStats(year, eventKey, { 
      eligibleDelta: deltaInfo.eligibleDelta, 
      consumedDelta: deltaInfo.consumedDelta 
    });
  }
  invalidateCachesForEvent(year, eventKey);
}

/** Remove event from a specific participant (marks as "not eligible") */
export async function removeEventFromParticipant(year: string, participantId: string, eventKey: string): Promise<void> {
  if (!db) return;
  const ref = eventDocRef(year, participantId, eventKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  
  const data = snap.data();
  const prevQty = typeof data.quantity === "number" ? data.quantity : 0;
  const prevConsumed = typeof data.consumed === "number" ? data.consumed : 0;
  
  // Delete the event document
  await deleteDoc(ref);
  
  // Update event stats: remove this participant's eligibility
  await incrementEventStats(year, eventKey, { 
    eligibleDelta: -prevQty,
    consumedDelta: -prevConsumed,
    participantsDelta: -1
  });
  
  invalidateCachesForEvent(year, eventKey);
}

/** Add event back to a specific participant (restore eligibility) */
export async function addEventToParticipant(
  year: string,
  participantId: string,
  eventKey: string,
  eventName: string,
  quantity: number = 1
): Promise<void> {
  if (!db) return;
  const ref = eventDocRef(year, participantId, eventKey);
  const snap = await getDoc(ref);
  if (snap.exists()) return; // Already exists, don't re-add
  
  // Create new event document
  await setDoc(ref, {
    eventKey,
    name: eventName,
    description: "",
    value: "",
    quantity,
    consumed: 0,
    redeemed: false,
    finalized: false,
    year,
    participantId,
    _createdAt: new Date().toISOString(),
  });
  
  // Update event stats: add this participant's eligibility
  await incrementEventStats(year, eventKey, { 
    eligibleDelta: quantity,
    participantsDelta: 1
  });
  
  invalidateCachesForEvent(year, eventKey);
}

/** Delete participant - archives to deletedParticipants collection before removing */
export async function deleteParticipant(year: string, participantId: string): Promise<void> {
  if (!db) return;
  const pid = String(participantId).trim();
  if (!pid) return;
  
  // Get participant data for archiving
  const participantRef = participantDocRef(year, pid);
  const participantSnap = await getDoc(participantRef);
  
  if (!participantSnap.exists()) {
    throw new Error("Participant not found");
  }
  
  const participantData = participantSnap.data();
  
  // Get all events for this participant
  const eventsCol = collection(db, "years", year, "participants", pid, "events");
  const eventsSnap = await getDocs(eventsCol);
  
  // Collect all events data
  const eventsData: any[] = [];
  for (const eventDoc of eventsSnap.docs) {
    eventsData.push({
      eventKey: eventDoc.id,
      ...eventDoc.data()
    });
  }
  
  // Archive to deletedParticipants collection
  const deletedRef = doc(db, "years", year, "deletedParticipants", pid);
  await setDoc(deletedRef, {
    ...participantData,
    events: eventsData,
    _deletedAt: new Date().toISOString(),
    _originalId: pid,
  });
  
  // Now delete all event subdocs and update stats
  for (const eventDoc of eventsSnap.docs) {
    const eventData = eventDoc.data();
    const eventKey = eventDoc.id;
    const qty = typeof eventData.quantity === "number" ? eventData.quantity : 0;
    const consumed = typeof eventData.consumed === "number" ? eventData.consumed : 0;
    
    // Delete event doc
    await deleteDoc(eventDoc.ref);
    
    // Update event stats: remove this participant's contribution
    await incrementEventStats(year, eventKey, {
      eligibleDelta: -qty,
      consumedDelta: -consumed,
      participantsDelta: -1
    });
    
    invalidateCachesForEvent(year, eventKey);
  }
  
  // Finally, delete the participant document itself
  await deleteDoc(participantRef);
}

/** Restore deleted participant from archive */
export async function restoreDeletedParticipant(year: string, participantId: string): Promise<void> {
  if (!db) return;
  const pid = String(participantId).trim();
  if (!pid) return;
  
  // Get archived participant
  const deletedRef = doc(db, "years", year, "deletedParticipants", pid);
  const deletedSnap = await getDoc(deletedRef);
  
  if (!deletedSnap.exists()) {
    throw new Error("Deleted participant not found in archive");
  }
  
  const archivedData = deletedSnap.data();
  const { events, _deletedAt, _originalId, ...participantData } = archivedData;
  
  // Restore participant document
  const participantRef = participantDocRef(year, pid);
  await setDoc(participantRef, participantData);
  
  // Restore all events
  if (Array.isArray(events)) {
    for (const eventData of events) {
      const { eventKey, ...eventFields } = eventData;
      if (!eventKey) continue;
      
      const eventRef = eventDocRef(year, pid, eventKey);
      await setDoc(eventRef, eventFields);
      
      // Update event stats: add back this participant's contribution
      const qty = typeof eventFields.quantity === "number" ? eventFields.quantity : 0;
      const consumed = typeof eventFields.consumed === "number" ? eventFields.consumed : 0;
      
      await incrementEventStats(year, eventKey, {
        eligibleDelta: qty,
        consumedDelta: consumed,
        participantsDelta: 1
      });
      
      invalidateCachesForEvent(year, eventKey);
    }
  }
  
  // Remove from deleted collection
  await deleteDoc(deletedRef);
}

/** Get list of deleted participants */
export async function listDeletedParticipants(year: string): Promise<Array<{ id: string; name?: string; deletedAt?: string; [key: string]: any }>> {
  if (!db) return [];
  const deletedCol = collection(db, "years", year, "deletedParticipants");
  const snap = await getDocs(deletedCol);
  
  const deleted: Array<{ id: string; name?: string; deletedAt?: string; [key: string]: any }> = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    deleted.push({
      id: docSnap.id,
      name: data.NAME ?? data.name,
      deletedAt: data._deletedAt,
      ...data
    });
  });
  
  // Sort by deletion date (newest first)
  return deleted.sort((a, b) => {
    const dateA = a.deletedAt || "";
    const dateB = b.deletedAt || "";
    return dateB.localeCompare(dateA);
  });
}

/** Remove a specific event doc for all participants in a year. Returns number of participants processed. */
export async function removeEventForAllParticipants(year: string, eventKey: string): Promise<number> {
  if (!db) return 0; // Firestore not available
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

/** Aggregate redeemed counts per event across all participants for a given year. */
export async function getEventRedemptionStats(year: string): Promise<Record<string, EventAggregate>> {
  if (!db) return {};
  const aggregates: Record<string, EventAggregate> = {};
  // Try efficient collection group query if year metadata exists on event docs
  try {
    const cg = collectionGroup(db, "events");
    const q1 = query(cg, where("year", "==", year), where("redeemed", "==", true));
    const snap = await getDocs(q1);
    snap.forEach((docSnap) => {
      const key = docSnap.id; // subdoc id equals event key
      const d = docSnap.data() as any;
      const qty = typeof d.quantity === "number" ? d.quantity : 1;
      if (!aggregates[key]) aggregates[key] = { redeemedParticipants: 0, redeemedAdults: 0 };
      aggregates[key].redeemedParticipants += 1;
      aggregates[key].redeemedAdults += qty;
    });
    return aggregates;
  } catch (e) {
    // fallback to per-participant scan if collectionGroup not available or year field missing
  }

  const participantsCol = collection(db, "years", year, "participants");
  const pSnap = await getDocs(participantsCol);
  for (const p of pSnap.docs) {
    const eventsCol = collection(db, "years", year, "participants", p.id, "events");
    const eSnap = await getDocs(eventsCol);
    eSnap.forEach((ev) => {
      const d = ev.data() as any;
      if (d && d.redeemed) {
        const key = ev.id;
        const qty = typeof d.quantity === "number" ? d.quantity : 1;
        if (!aggregates[key]) aggregates[key] = { redeemedParticipants: 0, redeemedAdults: 0 };
        aggregates[key].redeemedParticipants += 1;
        aggregates[key].redeemedAdults += qty;
      }
    });
  }
  return aggregates;
}

export type RedeemedEntry = {
  eventKey: string;
  eventName?: string;
  participantId: string;
  participantName?: string;
  reservationNum?: string;
  hotel?: string;
  adults?: number;
  redeemedAt?: string;
  quantity?: number;
  consumed?: number;
  entryCount?: number; // count for this specific log entry (for partial redemptions)
  // Snapshot flags to avoid N lookups when listing; may be undefined for older logs
  _redeemedFlag?: boolean;
  _finalizedFlag?: boolean;
};

// Simple in-memory caches for the session
const _redeemedCache = new Map<string, { when: number; data: RedeemedEntry[] }>();
const _totalsCache = new Map<string, { when: number; data: EventTotals }>();
const _CACHE_TTL_MS = 60 * 1000; // 1 minute TTL

function invalidateCachesForEvent(year: string, eventKey: string) {
  const k = `${year}:${eventKey}`;
  _redeemedCache.delete(k);
  _totalsCache.delete(k);
}

/** List redeemed entries for a specific event (with participant snapshots if available). */
/** List redeemed entries (consumed > 0) for a specific event (with participant snapshots if available). */
export async function listRedeemedForEvent(year: string, eventKey: string, opts?: { force?: boolean }): Promise<RedeemedEntry[]> {
  if (!db) return [];
  const cacheKey = `${year}:${eventKey}`;
  const now = Date.now();
  if (!opts?.force) {
    const hit = _redeemedCache.get(cacheKey);
    if (hit && now - hit.when < _CACHE_TTL_MS) return hit.data;
  }
  
  try {
    // Use redemptionLogs: one row per redemption increment
    // This is MUCH faster because it only contains redeemed entries
    const logsCol = collection(db, "redemptionLogs");
    const logsQ = query(
      logsCol, 
      where("year", "==", year), 
      where("eventKey", "==", eventKey)
    );
    const logsSnap = await getDocs(logsQ);
    
    const entries: RedeemedEntry[] = [];
    logsSnap.forEach((docSnap) => {
      const d = docSnap.data() as any;
      const pid = String(d.participantId || "");
      const at = d.at && typeof d.at.toDate === "function" ? d.at.toDate().toISOString() : undefined;
      entries.push({
        eventKey,
        participantId: pid,
        redeemedAt: at,
        entryCount: typeof d.count === "number" ? d.count : 1,
        participantName: d.participantName ?? undefined,
        eventName: d.eventName ?? undefined,
        quantity: typeof d.quantity === "number" ? d.quantity : undefined,
        _redeemedFlag: typeof d.redeemedAfter === "boolean" ? d.redeemedAfter : undefined as any,
        _finalizedFlag: typeof d.finalized === "boolean" ? d.finalized : false,
      });
    });
    
    // Sort by timestamp (newest first)
    const sorted = entries.sort((a, b) => (b.redeemedAt || "").localeCompare(a.redeemedAt || ""));
    
    _redeemedCache.set(cacheKey, { when: now, data: sorted });
    return sorted;
  } catch (error) {
    console.error('Error loading redemption logs:', error);
    // Return empty array instead of falling back to expensive scan
    return [];
  }
}

export type EventTotals = {
  eligibleParticipants: number;
  eligibleAdults: number;
  redeemedParticipants: number;
  redeemedAdults: number;
};

/** Totals for a specific event: sum of quantities for all docs (eligibility) and for redeemed docs. */
export async function getEventTotalsForEvent(year: string, eventKey: string, opts?: { force?: boolean }): Promise<EventTotals> {
  if (!db) return { eligibleParticipants: 0, eligibleAdults: 0, redeemedParticipants: 0, redeemedAdults: 0 };
  const cacheKey = `${year}:${eventKey}`;
  const now = Date.now();
  if (!opts?.force) {
    const hit = _totalsCache.get(cacheKey);
    if (hit && now - hit.when < _CACHE_TTL_MS) return hit.data;
  }
  const totals: EventTotals = {
    eligibleParticipants: 0,
    eligibleAdults: 0,
    redeemedParticipants: 0,
    redeemedAdults: 0,
  };
  try {
    // Always compute eligibility from the authoritative events documents
    const cg = collectionGroup(db, "events");
    const q1 = query(cg, where("year", "==", year), where("eventKey", "==", eventKey));
    const snap = await getDocs(q1);
    snap.forEach((docSnap) => {
      const d = docSnap.data() as any;
      const qty = typeof d.quantity === "number" ? d.quantity : 1;
      totals.eligibleParticipants += 1;
      totals.eligibleAdults += qty;
      const consumed = typeof d.consumed === "number" ? d.consumed : (d.redeemed ? qty : 0);
      if (consumed > 0) {
        totals.redeemedParticipants += 1;
        totals.redeemedAdults += consumed;
      }
    });
  _totalsCache.set(cacheKey, { when: now, data: totals });
  return totals;
  } catch (e) {
    // fallback scan
  }
  const participantsCol = collection(db, "years", year, "participants");
  const pSnap = await getDocs(participantsCol);
  for (const p of pSnap.docs) {
    const pid = p.id;
    const evRef = eventDocRef(year, pid, eventKey);
    const evSnap = await getDoc(evRef);
    if (evSnap.exists()) {
      const d = evSnap.data() as any;
      const qty = typeof d.quantity === "number" ? d.quantity : 1;
      const consumed = typeof d.consumed === "number" ? d.consumed : (d.redeemed ? qty : 0);
      totals.eligibleParticipants += 1;
      totals.eligibleAdults += qty;
      if (consumed > 0) {
        totals.redeemedParticipants += 1;
        totals.redeemedAdults += consumed;
      }
    }
  }
  _totalsCache.set(cacheKey, { when: now, data: totals });
  return totals;
}

/** Get status for a single participant's event (includes finalized flag) */
export async function getEventStatusForParticipant(
  year: string,
  participantId: string,
  eventKey: string
): Promise<EventStatus> {
  const pid = String(participantId).trim();
  if (!db || !pid) return { redeemed: false, quantity: 1 };
  const ref = doc(db, "years", year, "participants", pid, "events", eventKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { redeemed: false, quantity: 1 };
  const d = snap.data() as any;
  const qty = typeof d.quantity === "number" ? d.quantity : 1;
  const consumed = typeof d.consumed === "number" ? d.consumed : (d.redeemed ? qty : 0);
  return {
    redeemed: consumed >= qty || Boolean(d.redeemed),
    quantity: qty,
    consumed,
    redeemedAt: typeof d.redeemedAt === "string" ? d.redeemedAt : undefined,
    finalized: Boolean(d.finalized),
  };
}

// ---- Participants directory helpers for Admin "Participant Management" ----

export type BasicParticipant = {
  id: string;
  name?: string;
  hotel?: string;
  adults?: number;
};

/** Fetch a participant document */
export async function getParticipant(year: string, participantId: string): Promise<any | null> {
  if (!db) return null;
  const pid = String(participantId || "").trim();
  if (!pid) return null;
  const ref = doc(db, "years", year, "participants", pid);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

/** Search participants by exact ID or by name (flexible search - finds partial matches anywhere in name) */
export async function searchParticipants(year: string, term: string): Promise<BasicParticipant[]> {
  if (!db) return [];
  const q = (term || "").trim().toLowerCase();
  if (!q) return [];
  const out: BasicParticipant[] = [];

  // Try exact ID first
  try {
    const idRef = doc(db, "years", year, "participants", term.trim());
    const idSnap = await getDoc(idRef);
    if (idSnap.exists()) {
      const d = idSnap.data() as any;
      out.push({ id: idSnap.id, name: d.NAME ?? d.name, hotel: d.HOTEL ?? d.hotel, adults: Number(d.ADULTS ?? d.adults) || 1 });
    }
  } catch {}

  // Flexible name search - get all participants and filter client-side
  // This allows finding "שמואל" in "כהן שמואל" regardless of word order
  try {
    const col = collection(db, "years", year, "participants");
    const snap = await getDocs(col);
    snap.forEach((d) => {
      if (!out.find((p) => p.id === d.id)) {
        const v = d.data() as any;
        const name = (v.NAME ?? v.name ?? "").toLowerCase();
        // Check if search term appears anywhere in the name
        if (name.includes(q)) {
          out.push({ id: d.id, name: v.NAME ?? v.name, hotel: v.HOTEL ?? v.hotel, adults: Number(v.ADULTS ?? v.adults) || 1 });
        }
      }
    });
  } catch {}

  return out;
}

export type ParticipantEventRow = {
  eventKey: string;
  name?: string;
  quantity: number;
  consumed: number;
  redeemed: boolean;
  finalized?: boolean;
};

/** List all event rows for a specific participant */
export async function listEventsForParticipant(year: string, participantId: string): Promise<ParticipantEventRow[]> {
  if (!db) return [];
  const pid = String(participantId || "").trim();
  if (!pid) return [];
  const col = collection(db, "years", year, "participants", pid, "events");
  const snap = await getDocs(col);
  const rows: ParticipantEventRow[] = [];
  snap.forEach((docSnap) => {
    const d = docSnap.data() as any;
    const qty = typeof d.quantity === "number" ? d.quantity : 1;
    const consumed = typeof d.consumed === "number" ? d.consumed : (d.redeemed ? qty : 0);
    rows.push({
      eventKey: docSnap.id,
      name: d.name,
      quantity: qty,
      consumed,
      redeemed: consumed >= qty || Boolean(d.redeemed),
      finalized: Boolean(d.finalized),
    });
  });
  // Keep a stable event order by key for nicer display
  return rows.sort((a, b) => a.eventKey.localeCompare(b.eventKey));
}

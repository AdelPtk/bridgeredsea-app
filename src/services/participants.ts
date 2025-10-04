import { db } from "@/lib/firebase";
import { collection, collectionGroup, doc, getDoc, getDocs, setDoc, deleteDoc, query, where, runTransaction, addDoc, serverTimestamp, orderBy, limit } from "firebase/firestore";
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
      await setDoc(eRef, {
        eventKey: e.key,
        name: e.name,
        description: e.description ?? "",
        value: e.allowedValue ?? "",
        quantity: e.quantity ?? qty,
        consumed: 0,
        redeemed: false,
        finalized: false,
        year, // add year to support collectionGroup admin queries
        participantId: pid,
        _createdAt: new Date().toISOString(),
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
    };
  });
  // Fill requested keys; assume defaults for missing
  for (const key of eventKeys) {
    result[key] = existing[key] ?? { redeemed: false, quantity: 1, consumed: 0 };
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
  await setDoc(
    ref,
    {
      redeemed,
      redeemedAt: redeemed ? new Date().toISOString() : null,
      year,
      participantId: pid,
      ...(redeemed ? snapshot : {}),
    },
    { merge: true }
  );
  try {
    // Sync consumed to quantity (or 0) when toggling full redeemed flag
    const evSnap = await getDoc(ref);
    if (evSnap.exists()) {
      const d = evSnap.data() as any;
      const qty = typeof d.quantity === "number" ? d.quantity : 1;
      await setDoc(ref, { consumed: redeemed ? qty : 0 }, { merge: true });
    }
  } catch {}
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
  invalidateCachesForEvent(year, eventKey);
}

/** Incrementally redeem adults for an event using a transaction */
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
  await runTransaction(db, async (tx) => {
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
  });
  // Write a log entry for admin listing (one row per increment)
  try {
    await addDoc(collection(db, "redemptionLogs"), {
      year,
      participantId: pid,
      eventKey,
      count: Math.max(1, Math.floor(count || 1)),
      at: serverTimestamp(),
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
  const out: RedeemedEntry[] = [];
  try {
    // Prefer logs: one row per redemption increment
    const logsCol = collection(db, "redemptionLogs");
    const logsQ = query(logsCol, where("year", "==", year), where("eventKey", "==", eventKey));
    const logsSnap = await getDocs(logsQ);
    const tmp: RedeemedEntry[] = [];
    logsSnap.forEach((docSnap) => {
      const d = docSnap.data() as any;
      const pid = String(d.participantId || "");
      const at = d.at && typeof d.at.toDate === "function" ? d.at.toDate().toISOString() : undefined;
      tmp.push({
        eventKey,
        participantId: pid,
        redeemedAt: at,
        entryCount: typeof d.count === "number" ? d.count : 1,
      });
    });
    if (tmp.length > 0) {
      // Enrich missing names by fetching participant docs (cached)
      const cache = new Map<string, any>();
      for (const e of tmp) {
        if (!e.participantName && e.participantId) {
          let p = cache.get(e.participantId);
          if (!p) {
            const pSnap = await getDoc(participantDocRef(year, e.participantId));
            p = pSnap.exists() ? pSnap.data() : null;
            cache.set(e.participantId, p);
          }
          if (p) {
            e.participantName = (p as any).NAME ?? (p as any).name ?? e.participantName;
          }
        }
      }
  const sorted = tmp.sort((a, b) => (a.redeemedAt || "").localeCompare(b.redeemedAt || ""));
  _redeemedCache.set(cacheKey, { when: now, data: sorted });
  // Do NOT seed totals cache here; let getEventTotalsForEvent compute authoritative eligible totals
  return sorted;
    }

    // Fallback: derive single row from events document consumed>0
    const cg = collectionGroup(db, "events");
    const q1 = query(cg, where("year", "==", year), where("eventKey", "==", eventKey));
    const snap = await getDocs(q1);
    const tmp2: RedeemedEntry[] = [];
    snap.forEach((docSnap) => {
      const d = docSnap.data() as any;
      const pid = d.participantId || (docSnap.ref.parent?.parent as any)?.id || "";
      const qty = typeof d.quantity === "number" ? d.quantity : 1;
      const consumed = typeof d.consumed === "number" ? d.consumed : (d.redeemed ? qty : 0);
      if (consumed > 0) {
        tmp2.push({
          eventKey,
          eventName: d.name,
          participantId: pid,
          participantName: d.participantName,
          redeemedAt: d.redeemedAt ?? undefined,
          quantity: qty,
          consumed,
          entryCount: consumed,
        });
      }
    });
    // Enrich missing names by fetching participant docs
    const cache = new Map<string, any>();
    for (const e of tmp) {
      if (!e.participantName && e.participantId) {
        let p = cache.get(e.participantId);
        if (!p) {
          const pSnap = await getDoc(participantDocRef(year, e.participantId));
          p = pSnap.exists() ? pSnap.data() : null;
          cache.set(e.participantId, p);
        }
        if (p) {
          e.participantName = (p as any).NAME ?? (p as any).name ?? e.participantName;
        }
      }
    }
    const sorted = tmp.sort((a, b) => (a.redeemedAt || "").localeCompare(b.redeemedAt || ""));
    // Update cache
  _redeemedCache.set(cacheKey, { when: now, data: sorted });
    return sorted;
  } catch (e) {
    // fallback: scan per participant
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
    if (consumed > 0) {
        const pdata = p.data() as any;
        out.push({
          eventKey,
          eventName: d.name,
          participantId: pid,
          participantName: pdata?.NAME ?? pdata?.name,
          redeemedAt: d.redeemedAt ?? undefined,
      quantity: qty,
      consumed,
        });
      }
    }
  }
  const sorted = out.sort((a, b) => (a.redeemedAt || "").localeCompare(b.redeemedAt || ""));
  _redeemedCache.set(cacheKey, { when: now, data: sorted });
  return sorted;
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

/** Search participants by exact ID or by name prefix (HEB/ENG) */
export async function searchParticipants(year: string, term: string): Promise<BasicParticipant[]> {
  if (!db) return [];
  const q = (term || "").trim();
  if (!q) return [];
  const out: BasicParticipant[] = [];

  // Try exact ID first
  try {
    const idRef = doc(db, "years", year, "participants", q);
    const idSnap = await getDoc(idRef);
    if (idSnap.exists()) {
      const d = idSnap.data() as any;
      out.push({ id: idSnap.id, name: d.NAME ?? d.name, hotel: d.HOTEL ?? d.hotel, adults: Number(d.ADULTS ?? d.adults) || 1 });
    }
  } catch {}

  // Name prefix search (requires index on NAME)
  try {
    const col = collection(db, "years", year, "participants");
    const q1 = query(col, orderBy("NAME"), where("NAME", ">=", q), where("NAME", "<=", q + "\uf8ff"), limit(10));
    const snap = await getDocs(q1);
    snap.forEach((d) => {
      if (!out.find((p) => p.id === d.id)) {
        const v = d.data() as any;
        out.push({ id: d.id, name: v.NAME ?? v.name, hotel: v.HOTEL ?? v.hotel, adults: Number(v.ADULTS ?? v.adults) || 1 });
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

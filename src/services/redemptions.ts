import { db } from "@/lib/firebase";
import { doc, getDoc, runTransaction, serverTimestamp } from "firebase/firestore";

const redemptionDocId = (participantId: string, eventKey: string) =>
  `${encodeURIComponent(String(participantId))}__${encodeURIComponent(eventKey)}`;

export async function isRedeemed(participantId: string, eventKey: string) {
  const ref = doc(db, "redemptions", redemptionDocId(participantId, eventKey));
  const snap = await getDoc(ref);
  return snap.exists();
}

export async function redeemOnce(
  participantId: string,
  eventKey: string,
  meta?: Record<string, any>
) {
  const ref = doc(db, "redemptions", redemptionDocId(participantId, eventKey));
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists()) {
      throw new Error("already-redeemed");
    }
    tx.set(ref, {
      participantId,
      eventKey,
      redeemedAt: serverTimestamp(),
      ...meta,
    });
  });
}

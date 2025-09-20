import { db } from "@/lib/firebase";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";

const TEST_COLLECTION = "app_health";

export async function pingFirestore() {
  const id = "ping";
  const ref = doc(db, TEST_COLLECTION, id);
  await setDoc(ref, { ts: serverTimestamp() }, { merge: true });
  const snap = await getDoc(ref);
  return snap.exists();
}

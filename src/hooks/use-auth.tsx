import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import app, { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, User } from "firebase/auth";
import { collection, doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";

export type AuthContextType = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  signInWithEmailPassword: (email: string, password: string) => Promise<void>;
  signOutNow: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function upsertUserByEmail(email: string, uid?: string) {
  if (!db) return;
  const emailKey = String(email || "").trim().toLowerCase();
  if (!emailKey) return;
  const ref = doc(collection(db, "users"), emailKey);
  await setDoc(ref, { email: emailKey, uid: uid || null, updatedAt: serverTimestamp() }, { merge: true });
}

async function fetchIsAdminByEmail(email?: string | null): Promise<boolean> {
  if (!db || !email) return false;
  const emailKey = String(email).trim().toLowerCase();
  if (!emailKey) return false;
  const ref = doc(collection(db, "users"), emailKey);
  const snap = await getDoc(ref);
  if (!snap.exists()) return false;
  const d = snap.data() as any;
  // Allow if explicit role/admin flag set true
  if (d && (d.role === "admin" || d.admin === true || d.allowed === true)) return true;
  return false;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const allowedFromEnv: string[] = useMemo(() => {
    const raw = (import.meta.env.VITE_ALLOWED_ADMIN_EMAILS as string | undefined) || "";
    return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  }, []);

  useEffect(() => {
    if (!auth) { setLoading(false); return; }
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u?.email) {
        try {
          await upsertUserByEmail(u.email, u.uid);
        } catch {}
        try {
          // Priority 1: explicit allow in users collection
          let ok = await fetchIsAdminByEmail(u.email);
          // Priority 2: env allow-list fallback (bootstrap). If matched, persist admin:true
          if (!ok && allowedFromEnv.includes(u.email.toLowerCase())) {
            try {
              if (db) {
                const ref = doc(collection(db, "users"), u.email.toLowerCase());
                await setDoc(ref, { email: u.email.toLowerCase(), admin: true, allowed: true, updatedAt: serverTimestamp() }, { merge: true });
              }
              ok = true;
            } catch {}
          }
          setIsAdmin(ok);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, []);

  const signInWithEmailPassword = async (email: string, password: string) => {
    if (!auth) return;
    await signInWithEmailAndPassword(auth, String(email || "").trim(), String(password || ""));
  };
  const signOutNow = async () => {
    if (!auth) return;
    await signOut(auth);
  };

  const value = useMemo(() => ({ user, loading, isAdmin, signInWithEmailPassword, signOutNow }), [user, loading, isAdmin]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

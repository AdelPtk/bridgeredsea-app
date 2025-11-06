import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function RequireAdmin({ children }: { children: React.ReactNode }) {
  const { loading, user, isAdmin, signInWithEmailPassword, signOutNow } = useAuth();
  const navigate = useNavigate();
  const [em, setEm] = useState("");
  const [pw, setPw] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // For the participant code box (same as /events?id=ENTER)
  const [enteredId, setEnteredId] = useState("");
  const [idError, setIdError] = useState<string | null>(null);

  const handleEnterSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const value = enteredId.trim();
    // Accept exactly 6 chars (alphanumeric)
    if (value.length !== 6) {
      setIdError("יש להזין קוד בן 6 תווים");
      return;
    }
    setIdError(null);
    navigate(`/events?id=${encodeURIComponent(value)}`);
  };

  if (loading) {
    return (
      <div className="min-h-[40vh] bg-white flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-bridge-blue" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[60vh] bg-white flex items-center justify-center">
        <div className="w-full max-w-sm text-center space-y-5 p-4">
          <div className="flex justify-center mb-6">
            <img
              src="/RedSea-MainText-HEB.svg"
              alt="ברידג' בים האדום"
              className="max-h-24 w-auto"
            />
          </div>
          {/* Participant code entry box (copied from /events?id=ENTER) */}
          <Card className="border border-bridge-blue/20 shadow-xl overflow-hidden rounded-lg text-right" dir="rtl">
            <CardHeader className="bg-gradient-to-r from-bridge-blue to-bridge-red text-white">
              <CardTitle className="text-center text-xl font-bold">כניסה עם קוד משתתף</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <form onSubmit={handleEnterSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="participant-id">קוד משתתף</Label>
                  <Input
                    id="participant-id"
                    inputMode="text"
                    maxLength={6}
                    value={enteredId}
                    onChange={(e) => setEnteredId(e.target.value.replace(/\s+/g, ""))}
                  />
                  {idError && <p className="text-sm text-red-600">{idError}</p>}
                </div>
                <Button type="submit" className="w-full bg-bridge-blue hover:bg-bridge-blue/90">
                  כניסה
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Separator and extra spacing below the participant code card */}
          <div className="mt-4 mb-2 border-t border-gray-200" />

          <div className="text-xl font-bold">התחברות מנהלים</div>
          <div className="grid gap-2 text-right" dir="rtl">
            <div className="text-right">
              <Label htmlFor="admin-email" className="block mb-1">אימייל</Label>
              <Input id="admin-email" type="email" value={em} onChange={(e) => setEm(e.target.value)} />
            </div>
            <div className="text-right">
              <Label htmlFor="admin-pass" className="block mb-1">סיסמה</Label>
              <Input id="admin-pass" type="password" value={pw} onChange={(e) => setPw(e.target.value)} />
            </div>
            {/* Error area reserved so the button isn't glued to the input */}
            <div className="min-h-[1.25rem] text-right">
              {err ? <div className="text-sm text-red-600">{err}</div> : null}
            </div>
            <Button
              onClick={async () => {
                setErr(null);
                setEmailLoading(true);
                try {
                  await signInWithEmailPassword(em, pw);
                } catch (e: any) {
                  const code: string = String(e?.code || "");
                  // Normalize common auth errors to a friendly Hebrew message
                  const badCred = [
                    "auth/invalid-credential",
                    "auth/wrong-password",
                    "auth/user-not-found",
                    "auth/invalid-email",
                  ].some((k) => code.includes(k));
                  const msg = badCred ? "סיסמה/שם משתמש שגויים?" : "שגיאת התחברות";
                  setErr(msg);
                } finally {
                  setEmailLoading(false);
                }
              }}
              className="mt-2"
              disabled={emailLoading || !em || !pw}
            >
              {emailLoading ? "מתחבר…" : "התחבר"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-lg font-bold">אין הרשאה</div>
          <div className="text-sm text-muted-foreground">המשתמש הנוכחי אינו מוגדר כמנהל</div>
          <Button variant="secondary" onClick={signOutNow}>התנתק</Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

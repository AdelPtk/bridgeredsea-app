import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import ParticipantCard from "@/components/ParticipantCard";
import EventsList from "@/components/EventsList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLang } from "@/hooks/use-lang";
import SiteFooter from "@/components/SiteFooter";

const ParticipantPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const idParamRaw = searchParams.get("id") ?? "";
  const id = decodeURIComponent(idParamRaw);
  const [participant, setParticipant] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const isEnterMode = id.trim().toUpperCase() === "ENTER";
  const [enteredId, setEnteredId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { isEnglish, setLang } = useLang();

  // Banner image source: mirrors Index behavior; supports file:// from dist
  const bannerSrc = useMemo(() => {
    try {
      const isFile = typeof window !== "undefined" && window.location?.protocol === "file:";
      const base = isFile ? "" : "/";
      return `${base}${isEnglish ? "RedSea-MainText-ENG.svg" : "RedSea-MainText-HEB.svg"}`;
    } catch {
      return isEnglish ? "/RedSea-MainText-ENG.svg" : "/RedSea-MainText-HEB.svg";
    }
  }, [isEnglish]);

  useEffect(() => {
    if (isEnterMode) {
      // Default to Hebrew when no participant context
      try { setLang("he"); } catch {}
      setLoading(false);
      return;
    }
    fetch("/DATA.csv")
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            const normalize = (v: any) => String(v ?? "").trim();
            const target = normalize(id);
            const found = results.data.find((row: any) => {
              const candidates = [row.ID, row.id, row["מזהה"], row.RESERVATION_NUM];
              return candidates.some((v) => normalize(v) === target);
            });
            setParticipant(found || null);
            setLoading(false);
          },
        });
      })
      .catch(() => setLoading(false));
  }, [id, isEnterMode]);

  // Set language based on participant.HUL: YES -> English, otherwise Hebrew
  useEffect(() => {
    if (participant) {
      const hul = String((participant as any).HUL ?? "").trim().toUpperCase();
      try { setLang(hul === "YES" ? "en" : "he"); } catch {}
    }
  }, [participant, setLang]);

  const handleEnterSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const value = enteredId.trim();
    // Accept exactly 6 chars (alphanumeric); adapt easily later if needed
    if (value.length !== 6) {
      setError("יש להזין קוד בן 6 תווים");
      return;
    }
    setError(null);
    navigate(`/events?id=${encodeURIComponent(value)}`);
  };

  if (isEnterMode) {
    return (
      <div className="min-h-screen bg-white" dir={isEnglish ? "ltr" : "rtl"}>
        <div className="container mx-auto px-4 py-8 max-w-md space-y-6">
          <div className="flex justify-center mb-6">
            <img src={bannerSrc} alt="RedSea Bridge Festival" className="max-h-24 w-auto" />
          </div>
          <Card className="border border-bridge-blue/20 shadow-xl overflow-hidden rounded-lg">
            <CardHeader className="bg-gradient-to-r from-bridge-blue to-bridge-red text-white">
              <CardTitle className="text-center text-xl font-bold">כניסה עם קוד משתתף</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <form onSubmit={handleEnterSubmit} className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="participant-id">קוד משתתף</Label>
                  <Input
                    id="participant-id"
                    inputMode="numeric"
                    maxLength={6}
                    value={enteredId}
                    onChange={(e) => setEnteredId(e.target.value.replace(/\s+/g, ""))}
                  />
                  {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
                <Button type="submit" className="w-full bg-bridge-blue hover:bg-bridge-blue/90">
                  כניסה
                </Button>
              </form>
            </CardContent>
          </Card>
          <SiteFooter />
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-12">טוען נתונים...</div>;
  }
  if (!participant) {
    return <div className="text-center py-12 text-red-600">משתתף לא נמצא</div>;
  }

  return (
  
    <div className="min-h-screen bg-white" dir={isEnglish ? "ltr" : "rtl"}>
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-6">
        {/* תמונת לוגו בראש העמוד - סטיקי למעלה */}
        <div className="sticky top-0 z-50 -mx-4 px-4 pt-2 pb-3 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 border-b">
          <div className="flex justify-center">
            <img src={bannerSrc} alt="RedSea Bridge Festival" className="max-h-24 w-auto" />
          </div>
        </div>
        {/* Language toggling is automatic based on participant.HUL */}
  <ParticipantCard participant={participant} />
        <EventsList participant={participant} />
        <SiteFooter />
      </div>
    </div>
  );
};

export default ParticipantPage;
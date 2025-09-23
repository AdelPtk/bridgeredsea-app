import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Papa from "papaparse";
import ParticipantCard from "@/components/ParticipantCard";
import EventsList from "@/components/EventsList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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

  useEffect(() => {
    if (isEnterMode) {
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
      <div className="min-h-screen bg-white" dir="rtl">
        <div className="container mx-auto px-4 py-8 max-w-md space-y-8">
          <div className="flex justify-center mb-6">
            <img src="/RedSea-MainText-HEB.svg" alt="RedSea Bridge Festival" className="max-h-24 w-auto" />
          </div>
          <Card className="border-2 border-bridge-blue/20 shadow-xl overflow-hidden rounded-lg">
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
  
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="container mx-auto px-4 py-8 max-w-2xl space-y-8">
        {/* תמונת לוגו בראש העמוד */}
        <div className="flex justify-center mb-6">
          <img src="/RedSea-MainText-HEB.svg" alt="RedSea Bridge Festival" className="max-h-24 w-auto" />
        </div>
  <ParticipantCard participant={participant} />
        <EventsList participant={participant} />
      </div>
    </div>
  );
};

export default ParticipantPage;
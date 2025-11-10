import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import SiteFooter from "@/components/SiteFooter";
import { useState } from "react";
import { useEffect, useMemo } from "react";
import Papa from "papaparse";
// קריאת DATA.csv מה-public
import { toast } from "@/hooks/use-toast";
import { upsertParticipantAndSeedEvents, getYearKey } from "@/services/participants";
// Home page is Hebrew-only per request

const Index = () => {
  const navigate = useNavigate();
  const [participantId, setParticipantId] = useState("");
  const [csvParticipants, setCsvParticipants] = useState<any[]>([]);
  const [syncingAll, setSyncingAll] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });

  // Allowed names to display on the home page
  const allowedNamesRaw = useMemo(
    () => [
      "בירמן דורי",
      "לוין אמיר",
      "בירמן אלון",
      "Petelko Lia",
      "בירמן דניאלה",
      "ברקת אילן",
      "Msika Daniel",
    ],
    []
  );
  const normalizeName = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  const allowedSet = useMemo(() => new Set(allowedNamesRaw.map(normalizeName)), [allowedNamesRaw]);
  const displayParticipants = useMemo(
    () => csvParticipants.filter((p) => allowedSet.has(normalizeName(String(p.NAME || "")))),
    [csvParticipants, allowedSet]
  );

  // קריאה ופרסינג של DATA.csv מה-public
  useEffect(() => {
    fetch("/DATA.csv")
      .then((res) => res.text())
      .then((csvText) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            setCsvParticipants(results.data);
          },
        });
      })
      .catch(() => {
        setCsvParticipants([]);
      });
  }, []);

  // Removed home-page stats widget per request

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvParticipants(results.data);
        toast({
          title: "הקובץ נטען בהצלחה!",
          description: `נמצאו ${results.data.length} משתתפים.`,
        });
      },
      error: () => {
        toast({
          title: "שגיאה",
          description: "התרחשה שגיאה בקריאת הקובץ.",
          variant: "destructive",
        });
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!participantId.trim()) {
      toast({
        title: "שגיאה",
        description: "אנא הכנס מזהה משתתף",
        variant: "destructive",
      });
      return;
    }
    navigate(`/events?id=${participantId.trim()}`);
  };

  const handleDemoClick = (id: string) => {
    navigate(`/events?id=${encodeURIComponent(id)}`);
  };

  // Build event seeds for a CSV row (align with EventsList mappings)
  const buildEventSeeds = (row: any) => {
    const seeds: { key: string; name: string; description?: string; allowedValue?: string; quantity?: number }[] = [];
    const pushIf = (key: string, name: string, description?: string) => {
      const v = row[key];
      if (typeof v === "string" && v.trim() !== "" && v !== "NO") {
        seeds.push({ key, name, description, allowedValue: v });
      }
    };
    pushIf("OPENING", "קוקטייל פתיחת הפסטיבל", "טקס פתיחה חגיגי של הפסטיבל");
    pushIf("RB1", "ארוחת ערב מיוחדת", "לאורחי מלון רויאל ביץ'");
    pushIf("TERRACE1", "שעה קולינרית", "כיבוד קל על המרפסת");
    pushIf("SOUPS", "קוקטייל חצות", "יין, מרקים, גבינות ומאפים");
    pushIf("COCKTAIL", "קוקטייל ערב", "קוקטייל חגיגי עם כיבוד עשיר והופעה");
    pushIf("TERRACE2", "שעה מתוקה", "ארוחת צהריים קלילה ומתוקה");
    pushIf("RB2", "ארוחת ברביקיו", "לאורחי מלון רויאל ביץ'");
    pushIf("TERRACE3", "שעה בלקנית", "טעמים ומוזיקה מהבלקן על המרפסת");
  pushIf("PRIZES", "טקס פרסים", "חלוקת פרסים וסיכום");
    return seeds;
  };

  const handleSyncAllToFirestore = async () => {
    try {
      setSyncingAll(true);
      const year = getYearKey();
      const total = csvParticipants.filter(row => {
        const pid = String(row.ID ?? row.id ?? row["מזהה"] ?? "").trim();
        return !!pid;
      }).length;
      
      setSyncProgress({ current: 0, total });
      let count = 0;
      
      for (const row of csvParticipants) {
        const pid = String(row.ID ?? row.id ?? row["מזהה"] ?? "").trim();
        if (!pid) continue;
        const seeds = buildEventSeeds(row);
        await upsertParticipantAndSeedEvents(year, row, seeds);
        count++;
        
        // עדכון אחוז התקדמות
        setSyncProgress({ current: count, total });
        const percentage = Math.round((count / total) * 100);
        console.log(`התקדמות: ${count}/${total} (${percentage}%)`);
      }
      
      toast({ title: "סנכרון הושלם", description: `נסנכרו ${count} משתתפים לשנה ${year}.` });
    } catch (e) {
      toast({ title: "שגיאת סנכרון", description: String(e), variant: "destructive" });
    } finally {
      setSyncingAll(false);
      setSyncProgress({ current: 0, total: 0 });
    }
  };

  // Removed WOW bulk-remove handler per request

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-bridge-blue/5 to-bridge-red/5" dir="rtl">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <img
            src={(typeof window !== 'undefined' && window.location.protocol === 'file:'
              ? "RedSea-MainText-HEB.svg"
              : "/RedSea-MainText-HEB.svg")}
            alt="פסטיבל ברידג' ים האדום"
            className="mx-auto mb-4 max-w-xs h-auto"
          />
        </div>

  {/* Main Card */}
  <Card className="w-full max-w-md mx-auto border-2 border-bridge-blue/20 shadow-xl overflow-hidden rounded-lg">
          <CardHeader className="text-white" style={{background: 'linear-gradient(to right, #1b248b, #e7354b)'}}>
            <CardTitle className="text-center text-xl font-bold">
              כניסה למערכת
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* טופס מזהה משתתף הוסר לפי בקשת המשתמש */}

            {/* כפתור גישה למסך הזנת קוד (ENTER) */}
            <div className="space-y-2">
              <Button
                className="w-full text-white shadow-md hover:shadow-lg"
                style={{background: 'linear-gradient(to right, #1b248b, #e7354b)'}}
                onClick={() => navigate("/events?id=ENTER")}
              >
                הזנת קוד משתתף
              </Button>
              <Button
                variant="outline"
                className="w-full border-bridge-blue text-bridge-blue hover:bg-bridge-blue hover:text-white"
                onClick={() => navigate("/admin")}
              >
                דשבורד ניהול
              </Button>
              <p className="text-xs text-muted-foreground text-center">לצוות: מעבר למסך הזנת קוד משתתף (6 ספרות)</p>
            </div>

            {/* אזור העלאת קובץ CSV והצגת משתתפים */}
            <>
              <div className="border-t pt-4">
                <p className="text-sm text-muted-foreground text-center mb-3">
                  צפייה בנתוני משתתפים מהקובץ:
                </p>
                <div className="space-y-2">
                  {displayParticipants.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center">לא נטען קובץ משתתפים.</p>
                  ) : (
                    displayParticipants.map((p, idx) => (
                      <Button
                        key={idx}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDemoClick((p.ID ?? p.id ?? p["מזהה"] ?? "").toString().trim())}
                        className="w-full border-bridge-blue text-bridge-blue hover:bg-bridge-blue hover:text-white"
                        disabled={!(p.ID || p.id || p["מזהה"]) }
                      >
                        {p.NAME || ""}
                      </Button>
                    ))
                  )}
                </div>
              </div>

              <div className="space-y-2 border-t pt-4">
                <Button
                  variant="outline"
                  className="w-full border-bridge-red text-bridge-red hover:bg-bridge-red hover:text-white"
                  onClick={handleSyncAllToFirestore}
                  disabled={syncingAll || csvParticipants.length === 0}
                >
                  {syncingAll && syncProgress.total > 0
                    ? `מסנכרן ${syncProgress.current}/${syncProgress.total} (${Math.round((syncProgress.current / syncProgress.total) * 100)}%)`
                    : syncingAll
                    ? "מסנכרן את כל המשתתפים…"
                    : "סנכרון כל המשתתפים ל-Firestore"}
                </Button>
              </div>
            </>
          </CardContent>
        </Card>

  {/* Stats card removed per request */}

        {/* Footer */}
        <SiteFooter />
      </div>
    </div>
  );
};

export default Index;

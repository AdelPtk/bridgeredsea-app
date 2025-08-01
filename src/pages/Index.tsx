import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BridgeSymbols from "@/components/BridgeSymbols";
import { useState } from "react";
import { useEffect } from "react";
import Papa from "papaparse";
// קריאת DATA.csv מה-public
import { toast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const [participantId, setParticipantId] = useState("");
  const [csvParticipants, setCsvParticipants] = useState<any[]>([]);

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
          variant: "success",
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
    navigate(`/events?id=${id}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-bridge-blue/5 to-bridge-red/5" dir="rtl">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <BridgeSymbols />
          <img
            src="/RedSea-MainText-HEB.svg"
            alt="פסטיבל ברידג' ים האדום"
            className="mx-auto mb-4 max-w-xs h-auto"
          />
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            ברוכים הבאים למערכת השוברים הדיגיטלית של פסטיבל הברידג' באילת
          </p>
        </div>

        {/* Main Card */}
        <Card className="w-full max-w-md mx-auto border-2 border-bridge-blue/20 shadow-xl">
          <CardHeader className="bg-gradient-to-r from-bridge-blue to-bridge-red text-white">
            <CardTitle className="text-center text-xl font-bold">
              כניסה למערכת
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            {/* טופס מזהה משתתף הוסר לפי בקשת המשתמש */}

            {/* אזור העלאת קובץ CSV */}
            {/* הצגת משתתפים מתוך DATA.csv */}

            <div className="border-t pt-4">
              <p className="text-sm text-muted-foreground text-center mb-3">
                צפייה בנתוני משתתפים מהקובץ:
              </p>
              <div className="space-y-2">
                {csvParticipants.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center">לא נטען קובץ משתתפים.</p>
                ) : (
                  csvParticipants.map((p, idx) => (
                    <Button
                      key={idx}
                      variant="outline"
                      size="sm"
                      onClick={() => handleDemoClick(p.id || p.ID || p["מזהה"] || "")}
                      className="w-full border-bridge-blue text-bridge-blue hover:bg-bridge-blue hover:text-white"
                      disabled={!p.id && !p.ID && !p["מזהה"]}
                    >
                      {p.NAME || ""}
                    </Button>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center pt-8">
          <BridgeSymbols className="opacity-50" />
        </div>
      </div>
    </div>
  );
};

export default Index;

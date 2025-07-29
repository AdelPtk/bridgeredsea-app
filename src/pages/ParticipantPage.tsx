import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import BridgeSymbols from "@/components/BridgeSymbols";
import ParticipantCard from "@/components/ParticipantCard";
import EventsList from "@/components/EventsList";
import { Participant } from "@/types/participant";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

// Sample data for demonstration - in production this would come from your CSV data
const sampleParticipants: Record<string, Participant> = {
  "258078566": {
    ID: "258078566",
    PARTICIPANT_NUM: "001",
    SERIAL_NUM: "001",
    RESERVATION_NUM: "RSV-2024-001",
    NAME: "יוסי כהן",
    HOTEL: "מלון דן אילת",
    ADULTS: 2,
    START: "15/03/2024",
    END: "22/03/2024",
    OPENING: "כן - 19:00",
    RB1: "כן - 10:00",
    SOUPS: "כן - 13:00",
    COCKTAIL: "כן - 18:30",
    RB2: "כן - 15:00",
    PRIZES: "כן - 20:00",
    WOW: "מופע מיוחד - 21:30"
  },
  "123456789": {
    ID: "123456789",
    PARTICIPANT_NUM: "002",
    SERIAL_NUM: "002",
    RESERVATION_NUM: "RSV-2024-002",
    NAME: "רחל לוי",
    HOTEL: "מלון רויאל ביץ'",
    ADULTS: 1,
    START: "16/03/2024",
    END: "20/03/2024",
    OPENING: "כן - 19:00",
    RB1: "NO",
    SOUPS: "כן - 13:00",
    COCKTAIL: "כן - 18:30",
    RB2: "כן - 15:00",
    PRIZES: "NO",
    WOW: "NO"
  }
};

const ParticipantPage = () => {
  const [searchParams] = useSearchParams();
  const [participant, setParticipant] = useState<Participant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const id = searchParams.get("id");
    
    if (!id) {
      setError("לא סופק מזהה משתתף");
      setLoading(false);
      return;
    }

    // Simulate loading delay
    setTimeout(() => {
      const foundParticipant = sampleParticipants[id];
      
      if (foundParticipant) {
        setParticipant(foundParticipant);
      } else {
        setError("משתתף לא נמצא");
      }
      
      setLoading(false);
    }, 1000);
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <BridgeSymbols className="animate-pulse" />
          <p className="text-lg text-muted-foreground">טוען פרטי משתתף...</p>
        </div>
      </div>
    );
  }

  if (error || !participant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardContent className="p-6 text-center space-y-4">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
            <h2 className="text-xl font-semibold text-destructive">שגיאה</h2>
            <p className="text-muted-foreground">{error}</p>
            <BridgeSymbols />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-bridge-blue/5 to-bridge-red/5" dir="rtl">
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Header with Bridge Symbols */}
        <div className="text-center space-y-4">
          <BridgeSymbols />
          <h1 className="text-4xl font-bold text-bridge-blue">
            פסטיבל ברידג' ים האדום - אילת
          </h1>
          <p className="text-lg text-muted-foreground">
            ברוכים הבאים לפסטיבל הברידג' המרגש ביותר במדינה!
          </p>
        </div>

        {/* Participant Details */}
        <ParticipantCard participant={participant} />

        {/* Events List */}
        <EventsList participant={participant} />

        {/* Footer */}
        <div className="text-center pt-8">
          <BridgeSymbols className="opacity-50" />
          <p className="text-sm text-muted-foreground mt-4">
            נתראה בפסטיבל! 🌊🏖️
          </p>
        </div>
      </div>
    </div>
  );
};

export default ParticipantPage;
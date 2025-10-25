import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, MapPin, Ticket } from "lucide-react";
import { User } from "lucide-react";
import { Participant } from "@/types/participant";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { generateParticipantDocxFromParticipant, generateParticipantPdfSimple } from "@/lib/participantCardPdf";
import { useLang } from "@/hooks/use-lang";

interface ParticipantCardProps {
  participant: Participant;
}

const ParticipantCard = ({ participant }: ParticipantCardProps) => {
  const { toast } = useToast();
  const { isEnglish } = useLang();
    const labels = {
      title: isEnglish ? "Participant Details" : "פרטי משתתף",
      reservation: isEnglish ? "Participant ID" : "מזהה משתתף",
      name: isEnglish ? "Name" : "שם",
      hotel: isEnglish ? "Hotel" : "בית מלון",
      adults: isEnglish ? "Number of Adults" : "מספר מבוגרים",
      start: isEnglish ? "Arrival Date" : "תאריך הגעה",
      end: isEnglish ? "Departure Date" : "תאריך עזיבה",
    } as const;
    // Hotel English mapping (expanded; handles common variants)
    const hotelEnMap: Record<string, string> = {
      "רויאל ביץ'": "Royal Beach",
      "רויאל ביץ": "Royal Beach",
      "רויאל גארדן": "Royal Garden",
      "ספורט": "Sport",
      "לגונה": "Laguna",
    };
    const normalizeHotel = (s: unknown) =>
      String(s ?? "")
        .trim()
        .replace(/[’"']/g, "'")
        .replace(/\s+/g, " ");
    const rawHotel = normalizeHotel(participant.HOTEL);
    const hotelDisplay = isEnglish ? (hotelEnMap[rawHotel] || rawHotel) : rawHotel;
  return (
    <Card className="w-full max-w-2xl mx-auto border border-bridge-blue/20 shadow-lg bg-white rounded-lg overflow-hidden" dir={isEnglish ? "ltr" : "rtl"}>
      <CardHeader className="bg-[#1b248b] text-white">
        <CardTitle className="text-center text-2xl font-bold">
            {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
  {/* PDF button temporarily removed to avoid extra spacing */}
  <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Ticket className="text-bridge-blue h-5 w-5" />
            <div>
                <p className="text-sm text-muted-foreground">{labels.reservation}</p>
              <p className="font-semibold text-bridge-black">{String((participant as any).ID ?? (participant as any).id ?? (participant as any)["מזהה"] ?? "")}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <User className="text-bridge-red h-5 w-5" />
            <div>
                <p className="text-sm text-muted-foreground">{labels.name}</p>
              <p className="font-semibold text-bridge-black">
                {participant.PARTNER && String(participant.PARTNER).trim().length > 0
                  ? `${participant.NAME}, ${participant.PARTNER}`
                  : participant.NAME}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <MapPin className="text-bridge-blue h-5 w-5" />
            <div>
                <p className="text-sm text-muted-foreground">{labels.hotel}</p>
                <p className="font-semibold text-bridge-black">{hotelDisplay}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Users className="text-bridge-red h-5 w-5" />
            <div>
                <p className="text-sm text-muted-foreground">{labels.adults}</p>
              <p className="font-semibold text-bridge-black">{participant.ADULTS}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Calendar className="text-bridge-blue h-5 w-5" />
            <div>
                <p className="text-sm text-muted-foreground">{labels.start}</p>
              <p className="font-semibold text-bridge-black">{participant.START}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Calendar className="text-bridge-red h-5 w-5" />
            <div>
                <p className="text-sm text-muted-foreground">{labels.end}</p>
              <p className="font-semibold text-bridge-black">{participant.END}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ParticipantCard;
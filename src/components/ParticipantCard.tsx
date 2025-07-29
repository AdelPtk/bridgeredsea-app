import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, MapPin, Ticket } from "lucide-react";
import { Participant } from "@/types/participant";

interface ParticipantCardProps {
  participant: Participant;
}

const ParticipantCard = ({ participant }: ParticipantCardProps) => {
  return (
    <Card className="w-full max-w-2xl mx-auto border-2 border-bridge-blue/20 shadow-lg">
      <CardHeader className="bg-gradient-to-r from-bridge-blue to-bridge-red text-white">
        <CardTitle className="text-center text-2xl font-bold">
          פרטי אורח - פסטיבל ברידג' ים האדום
        </CardTitle>
      </CardHeader>
      <CardContent className="p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Ticket className="text-bridge-blue h-5 w-5" />
            <div>
              <p className="text-sm text-muted-foreground">מספר הזמנה</p>
              <p className="font-semibold text-bridge-black">{participant.RESERVATION_NUM}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="text-bridge-red text-2xl">👤</div>
            <div>
              <p className="text-sm text-muted-foreground">שם</p>
              <p className="font-semibold text-bridge-black text-lg">{participant.NAME}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <MapPin className="text-bridge-blue h-5 w-5" />
            <div>
              <p className="text-sm text-muted-foreground">מלון</p>
              <p className="font-semibold text-bridge-black">{participant.HOTEL}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Users className="text-bridge-red h-5 w-5" />
            <div>
              <p className="text-sm text-muted-foreground">מספר מבוגרים</p>
              <Badge variant="outline" className="border-bridge-blue text-bridge-blue">
                {participant.ADULTS}
              </Badge>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Calendar className="text-bridge-blue h-5 w-5" />
            <div>
              <p className="text-sm text-muted-foreground">תאריך הגעה</p>
              <p className="font-semibold text-bridge-black">{participant.START}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Calendar className="text-bridge-red h-5 w-5" />
            <div>
              <p className="text-sm text-muted-foreground">תאריך עזיבה</p>
              <p className="font-semibold text-bridge-black">{participant.END}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ParticipantCard;
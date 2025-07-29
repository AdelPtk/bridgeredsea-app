import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Participant, EventInfo } from "@/types/participant";
import { Calendar, Crown, Utensils, Wine, Trophy, Sparkles, PartyPopper } from "lucide-react";

interface EventsListProps {
  participant: Participant;
}

const EventsList = ({ participant }: EventsListProps) => {
  const eventMappings: Record<string, EventInfo> = {
    OPENING: {
      name: "טקס פתיחה",
      value: participant.OPENING,
      description: "טקס פתיחה חגיגי של הפסטיבל",
      icon: "PartyPopper"
    },
    RB1: {
      name: "ברידג' 1",
      value: participant.RB1,
      description: "משחק ברידג' ראשון",
      icon: "Crown"
    },
    SOUPS: {
      name: "ארוחת מרקים",
      value: participant.SOUPS,
      description: "ארוחה חמה ומזינה",
      icon: "Utensils"
    },
    COCKTAIL: {
      name: "מסיבת קוקטיילים",
      value: participant.COCKTAIL,
      description: "מסיבה עם משקאות וחטיפים",
      icon: "Wine"
    },
    RB2: {
      name: "ברידג' 2",
      value: participant.RB2,
      description: "משחק ברידג' שני",
      icon: "Crown"
    },
    PRIZES: {
      name: "חלוקת פרסים",
      value: participant.PRIZES,
      description: "טקס חלוקת פרסים לזוכים",
      icon: "Trophy"
    },
    WOW: {
      name: "אירוע מיוחד",
      value: participant.WOW,
      description: "אירוע מפתיע ומיוחד",
      icon: "Sparkles"
    }
  };

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      PartyPopper,
      Crown,
      Utensils,
      Wine,
      Trophy,
      Sparkles
    };
    return icons[iconName] || Calendar;
  };

  const availableEvents = Object.entries(eventMappings).filter(
    ([_, event]) => event.value !== "NO" && event.value.trim() !== ""
  );

  if (availableEvents.length === 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">לא נמצאו אירועים עבור משתתף זה</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4" dir="rtl">
      <Card className="border-2 border-bridge-red/20">
        <CardHeader className="bg-gradient-to-r from-bridge-red to-bridge-blue text-white">
          <CardTitle className="text-center text-xl font-bold">
            אירועים כלולים באירוח
          </CardTitle>
        </CardHeader>
      </Card>
      
      <div className="space-y-3 max-h-96 overflow-y-auto px-2">
        {availableEvents.map(([key, event]) => {
          const IconComponent = getIconComponent(event.icon);
          
          return (
            <Card 
              key={key} 
              className="border border-border hover:border-bridge-blue/50 hover:shadow-md transition-all duration-200"
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-bridge-blue to-bridge-red flex items-center justify-center">
                      <IconComponent className="h-6 w-6 text-white" />
                    </div>
                  </div>
                  
                  <div className="flex-grow">
                    <h3 className="font-semibold text-bridge-black text-lg">
                      {event.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-2">
                      {event.description}
                    </p>
                    <Badge 
                      variant="outline" 
                      className="border-bridge-blue text-bridge-blue bg-bridge-blue/5"
                    >
                      {event.value}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
};

export default EventsList;
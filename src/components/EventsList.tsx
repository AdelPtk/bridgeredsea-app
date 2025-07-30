import AnimatedList from "./ui/AnimatedList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Participant, EventInfo } from "@/types/participant";
import { Calendar, Crown, Utensils, Wine, Trophy, Sparkles, PartyPopper } from "lucide-react";

interface EventsListProps {
  participant: Participant;
}

const EventsList = ({ participant }: EventsListProps) => {
  const eventMappings: Record<string, EventInfo & { date?: string; location?: string }> = {
    OPENING: {
      name: "קוקטייל פתיחת הפסטיבל",
      value: participant.OPENING,
      description: "טקס פתיחה חגיגי של הפסטיבל",
      icon: "PartyPopper",
      date: "13/11/2025 19:00",
      location: "מרפסת לובי רויאל ביץ'"
    },
    RB1: {
      name: "ארוחת ערב מיוחדת",
      value: participant.RB1,
      description: "לאורחי מלון רויאל ביץ'",
      icon: "Crown",
      date: "15/11/2025 19:00",
      location: "חדר אוכל רויאל ביץ'"
    },
    TERRACE1: {
      name: "שעה ים תיכונית",
      value: participant.TERRACE1,
      description: "ארוחת צהריים קלילה ומתוקה",
      icon: "Utensils",
      date: "16/11/2025 19:00",
      location: "מרפסת לובי רויאל ביץ'"
    },
    SOUPS: {
      name: "קוקטייל חצות",
      value: participant.SOUPS,
      description: "יין, מרקים, גבינות ומאפים",
      icon: "Utensils",
      date: "17/11/2025 23:30",
      location: "מרפסת לובי רויאל ביץ'"
    },
    COCKTAIL: {
      name: "קוקטייל פתיחת התחרות המרכזית",
      value: participant.COCKTAIL,
      description: "קוקטייל חגיגי עם כיבוד עשיר והופעה",
      icon: "Wine",
      date: "19/11/2025 19:00",
      location: "שפת בריכת מלון רויאל ביץ'"
    },
    TERRACE2: {
      name: "שעה מתוקה",
      value: participant.TERRACE2,
      description: "ארוחת צהריים קלילה ומתוקה",
      icon: "Crown",
      date: "20/11/2025 15:00",
      location: "מרפסת לובי רויאל ביץ'"
    },
    RB2: {
      name: "ארוחת ברביקיו",
      value: participant.RB2,
      description: "לאורחי מלון רויאל ביץ'",
      icon: "Utensils",
      date: "20/11/2025 19:00/20:30",
      location: "חדר אוכל רויאל ביץ'"
    },
    TERRACE3: {
      name: "שעה בלקנית",
      value: participant.TERRACE3,
      description: "ארוחת צהריים קלילה ומתוקה",
      icon: "Utensils",
      date: "21/11/2025 14:00",
      location: "מרפסת לובי רויאל ביץ'"
    },
    PRIZES: {
      name: "טקס חלוקת פרסים",
      value: participant.PRIZES,
      description: "טקס חלוקת פרסים חגיגי, קוקטייל ומסיבת ריקודים",
      icon: "Trophy",
      date: "21/11/2025 21:30",
      location: "אולם הכנסים רויאל ביץ'"
    },
    WOW: {
      name: "מופע ישרוטל WOW Bellissimo",
      value: participant.WOW,
      description: "כרטיסים חינם למופע המרהיב, איסוף בדלפק הברידג'",
      icon: "Sparkles",
      date: "שני-שבת, 20:30",
      location: "תיאטרון הרויאל גארדן"
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
      {/* Completely hide the scrollbar for the AnimatedList container */}
      <style>{`
        .animated-list-scrollbar::-webkit-scrollbar {
          width: 0px;
          background: transparent;
        }
        .animated-list-scrollbar::-webkit-scrollbar-thumb {
          background: transparent;
        }
        .animated-list-scrollbar {
          scrollbar-width: none;
          -ms-overflow-style: none;
        }
        .animated-list-scrollbar {
          overflow: -moz-scrollbars-none;
        }
      `}</style>
      <Card className="rounded-t-lg">
        <CardHeader className="bg-[#e7354b] text-white">
          <CardTitle className="text-center text-2xl font-bold">
            פרטי אירועים
          </CardTitle>
        </CardHeader>
      </Card>
      <AnimatedList
        items={availableEvents.map(([key, event]) => {
          const IconComponent = getIconComponent(event.icon);
          return (
            <div key={key} className="bg-white rounded-xl shadow-sm p-4 mb-4">
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
                  <div className="flex gap-2 mb-2 flex-wrap">
                    {event.date && (
                      <Badge variant="secondary" className="bg-bridge-blue/10 text-bridge-blue border-bridge-blue">
                        {event.date}
                      </Badge>
                    )}
                    {event.location && (
                      <Badge variant="secondary" className="bg-bridge-red/10 text-bridge-red border-bridge-red">
                        {event.location}
                      </Badge>
                    )}
                  </div>
                  {/* Removed event value chip */}
                </div>
              </div>
            </div>
          );
        })}
        onItemSelect={() => {}}
        showGradients={false}
        enableArrowNavigation={true}
        displayScrollbar={true}
        className="animated-list-scrollbar"
      />
    </div>
  );
};

export default EventsList;
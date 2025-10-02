import AnimatedList from "./ui/AnimatedList";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { useEffect, useState } from "react";
import { Participant, EventInfo } from "@/types/participant";
import {
  getYearKey,
  upsertParticipantAndSeedEvents,
  fetchEventsStatus,
  redeemEventAdults,
} from "@/services/participants";
import { Input } from "@/components/ui/input";
import { redeemOnce } from "@/services/redemptions";
// Icons not used in UI anymore; keeping icon names only as strings in mapping

interface EventsListProps {
  participant: Participant;
}

const EventsList = ({ participant }: EventsListProps) => {
  const [redeemedMap, setRedeemedMap] = useState<Record<string, boolean>>({});
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [consumedMap, setConsumedMap] = useState<Record<string, number>>({});
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);

  // Very light pastel rainbow-like colors (strongly mixed with white)
  const pastelBGs = [
    "#FFE4E6", // light rose/red (a bit darker)
    "#FFEDD5", // light orange (a bit darker)
    "#FEF3C7", // light yellow (a bit darker)
    "#D1FAE5", // light green (a bit darker)
    "#DBEAFE", // light blue (a bit darker)
    "#EDE9FE", // light indigo/purple (a bit darker)
    "#FCE7F3", // light pink/violet (a bit darker)
  ];
  // Fixed color per event key (rainbow order, cycling through the palette)
  const orderedEventKeys = [
    "OPENING",
    "RB1",
    "TERRACE1",
    "SOUPS",
    "COCKTAIL",
    "TERRACE2",
    "RB2",
    "TERRACE3",
    "PRIZES",
  ] as const;
  const eventColorMap: Record<string, string> = Object.fromEntries(
    orderedEventKeys.map((k, idx) => [k, pastelBGs[idx % pastelBGs.length]])
  );
  const eventMappings: Record<string, EventInfo & { date?: string; location?: string }> = {
    OPENING: {
      name: "קוקטייל פתיחת הפסטיבל",
      value: participant.OPENING,
      description: "טקס פתיחה חגיגי של הפסטיבל",
      icon: "PartyPopper",
      date: "13/11/2025 19:00",
      location: "מרפסת לובי רויאל ביץ'",
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
      location: "מרפסת לובי רויאל ביץ'",
    },
    SOUPS: {
      name: "קוקטייל חצות",
      value: participant.SOUPS,
      description: "יין, מרקים, גבינות ומאפים",
      icon: "Wine",
      date: "17/11/2025 15:00",
      location: "מרפסת לובי רויאל ביץ'",
    },
    COCKTAIL: {
      name: "קוקטייל פתיחת התחרות המרכזית",
      value: participant.COCKTAIL,
      description: "קוקטייל חגיגי עם כיבוד עשיר והופעה",
      icon: "Wine",
      date: "19/11/2025 19:00",
      location: "שפת בריכת מלון רויאל ביץ'",
    },
    TERRACE2: {
      name: "שעה מתוקה",
      value: participant.TERRACE2,
      description: "ארוחת צהריים קלילה ומתוקה",
      icon: "Crown",
      date: "20/11/2025 15:00",
      location: "מרפסת לובי רויאל ביץ'",
    },
    RB2: {
      name: "ארוחת ברביקיו",
      value: participant.RB2,
      description: "לאורחי מלון רויאל ביץ'",
      icon: "Utensils",
      date: "20/11/2025 19:00/20:30",
      location: "חדר אוכל רויאל ביץ'",
    },
    TERRACE3: {
      name: "שעה בלקנית",
      value: participant.TERRACE3,
      description: "ארוחת צהריים קלילה ומתוקה",
      icon: "Sparkles",
      date: "21/11/2025 15:00",
      location: "מרפסת לובי רויאל ביץ'",
    },
  PRIZES: {
      name: "טקס פרסים",
      value: participant.PRIZES,
      description: "טקס חלוקת פרסים חגיגי, קוקטייל ומסיבת ריקודים",
      icon: "Trophy",
      date: "21/11/2025 21:00",
      location: "מרכז הכנסים רויאל ביץ'",
    },
  };

  const availableEvents = Object.entries(eventMappings).filter(
    ([_, event]) => event.value !== "NO" && event.value.trim() !== ""
  );
  // Note: Background color is now determined solely by the fixed eventColorMap above

  // Seed participant+events and load redeemed state from Firestore on mount/participant change
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingStatus(true);
      const pid = String(participant.ID ?? (participant as any).id ?? (participant as any)["מזהה"] ?? "").trim();
      if (!pid) {
        setRedeemedMap({});
        setQuantityMap({});
        setLoadingStatus(false);
        return;
      }
      const year = getYearKey();
      try {
        // Seed participant and events if missing (once per session)
        const seededKey = `seeded:${year}:${pid}`;
        if (!sessionStorage.getItem(seededKey)) {
          const seeds = availableEvents.map(([key, ev]) => ({
            key,
            name: ev.name,
            description: ev.description,
            allowedValue: ev.value,
            quantity: Number((participant as any).ADULTS ?? (participant as any).adults) || 1,
          }));
          await upsertParticipantAndSeedEvents(year, participant, seeds);
          sessionStorage.setItem(seededKey, "1");
        }

        // Fetch current statuses
        const statuses = await fetchEventsStatus(year, pid, availableEvents.map(([k]) => k));
        if (!cancelled) {
          const rMap: Record<string, boolean> = {};
          const qMap: Record<string, number> = {};
          const cMap: Record<string, number> = {};
          for (const [k, st] of Object.entries(statuses)) {
            rMap[k] = st.redeemed;
            qMap[k] = st.quantity;
            cMap[k] = st.consumed ?? 0;
          }
          setRedeemedMap(rMap);
          setQuantityMap(qMap);
          setConsumedMap(cMap);
        }
      } catch (e) {
        if (!cancelled) {
          setRedeemedMap({});
          setQuantityMap({});
        }
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant.ID]);

  const redeemEvent = async (eventKey: string, eventName: string, count: number) => {
    const pid = String(participant.ID ?? (participant as any).id ?? (participant as any)["מזהה"] ?? "").trim();
    if (!pid) return;
    const year = getYearKey();
    try {
      await redeemEventAdults(year, pid, eventKey, count);
      // Best-effort: also write a top-level redemptions log (idempotent per participant+event)
      try {
        await redeemOnce(pid, eventKey, {
          year,
          eventName,
          participantName: (participant as any).NAME,
          hotel: (participant as any).HOTEL,
        });
      } catch (e: any) {
        // Ignore duplicate redemption error; surface others silently
        if (!(e && String(e.message || e).includes("already-redeemed"))) {
          // no-op; logging can be added if needed
        }
      }
      // update local state: increase consumed and mark redeemed when reached quantity
      setConsumedMap((prev) => {
        const current = prev[eventKey] ?? 0;
        const next = Math.max(0, Math.min((quantityMap[eventKey] ?? 1), current + count));
        const r = next >= (quantityMap[eventKey] ?? 1);
        setRedeemedMap((rm) => ({ ...rm, [eventKey]: r }));
        return { ...prev, [eventKey]: next };
      });
      toast({ title: "נרשמה כניסה", description: `עודכנה כניסה (${count}) ל- ${eventName}` });
    } catch (e: any) {
      toast({ title: "שגיאה", description: "אירעה שגיאה בעת סימון השובר", variant: "destructive" });
    }
  };

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
      <Card className="rounded-lg overflow-hidden">
        <CardHeader className="bg-[#e7354b] text-white">
          <CardTitle className="text-center text-2xl font-bold">
            פרטי אירועים
          </CardTitle>
        </CardHeader>
      </Card>
      <AnimatedList
        items={
          // Sort so redeemed events appear at the bottom; preserve relative order within groups
          [...availableEvents]
            .sort(([keyA], [keyB]) => {
              const aRedeemed = !!redeemedMap[keyA];
              const bRedeemed = !!redeemedMap[keyB];
              if (aRedeemed === bRedeemed) return 0;
              return aRedeemed ? 1 : -1;
            })
            .map(([key, event]) => {
              const bgColor = eventColorMap[key] ?? pastelBGs[0];
              const isRedeemed = redeemedMap[key];
              const remaining = Math.max(0, (quantityMap[key] ?? 1) - (consumedMap[key] ?? 0));
              return (
            <div
              key={key}
              className={`rounded-xl shadow-sm p-4 mb-4 border border-black/5 ${isRedeemed ? "opacity-70" : ""}`}
              style={{ backgroundColor: bgColor }}
            >
              <div className="flex items-start gap-4">
                <div className="flex-grow">
                  <h3 className="font-semibold text-bridge-black text-lg">
                    {event.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {event.description}
                  </p>
                  <div className="flex gap-2 mb-2 flex-wrap items-center">
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
                    {isRedeemed && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                        נוצל
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Left-side action button */}
                <div className="flex-shrink-0 self-center">
      {!isRedeemed && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          className="group bg-gradient-to-r from-bridge-blue to-bridge-red text-white hover:from-bridge-blue/90 hover:to-bridge-red/90 shadow-md hover:shadow-lg rounded-full px-3 py-1.5 text-sm leading-tight transition-all w-auto min-w-0"
        disabled={loadingStatus || remaining <= 0}
                        >
                          לכניסה
                          <ArrowLeft className="h-3.5 w-3.5 ml-1 transition-transform duration-200 group-hover:-translate-x-0.5" />
                        </Button>
                      </AlertDialogTrigger>
                       <AlertDialogContent dir="rtl">
                        <AlertDialogHeader>
                           <AlertDialogTitle className="text-center">אישור מימוש שובר</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-3 text-center">
                            <div>בחר/י כמות מבוגרים שנכנסת לאירוע:</div>
                            <div className="flex items-center justify-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={remaining}
                                defaultValue={remaining}
                                className="w-20 text-center"
                                id={`qty-${key}`}
                              />
                              <span className="text-xs text-muted-foreground">נכנסים {remaining} מתוך {remaining}</span>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>לא</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => {
                              const input = document.getElementById(`qty-${key}`) as HTMLInputElement | null;
                              const val = Math.max(1, Math.min(remaining, Number(input?.value || 1)));
                              redeemEvent(key, event.name, val);
                            }}
                          >
                            כן
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
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
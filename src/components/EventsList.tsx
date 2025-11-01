import AnimatedList from "./ui/AnimatedList";
import { ArrowLeft, ArrowRight, Ticket } from "lucide-react";
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
import { useLang } from "@/hooks/use-lang";
import { Participant, EventInfo } from "@/types/participant";
import { getEventSchedule, getEventSchedules, type EventSchedule, setEventFinalized } from "@/services/participants";
import {
  getYearKey,
  upsertParticipantAndSeedEvents,
  fetchEventsStatus,
  redeemEventAdults,
} from "@/services/participants";
import { Input } from "@/components/ui/input";
import { redeemOnce } from "@/services/redemptions";
// Icons not used in UI anymore; keeping icon names only as strings in mapping
// Assets for bottom links grid
import logoBooklet from "../../LOGO_BOOKLET25.png";
import logoWA from "../../LOGO_WA.png";
import logoRS from "../../LOGO_RS_BLUE.png";
import logoFB from "../../LOGO_FB.png";

interface EventsListProps {
  participant: Participant;
}

const EventsList = ({ participant }: EventsListProps) => {
  const [redeemedMap, setRedeemedMap] = useState<Record<string, boolean>>({});
  const [quantityMap, setQuantityMap] = useState<Record<string, number>>({});
  const [consumedMap, setConsumedMap] = useState<Record<string, number>>({});
  const [redeemedAtMap, setRedeemedAtMap] = useState<Record<string, string | undefined>>({});
  const [finalizedMap, setFinalizedMap] = useState<Record<string, boolean>>({});
  // Last redemption session count to show on voucher (fallback to total consumed if undefined)
  const [lastSessionCountMap, setLastSessionCountMap] = useState<Record<string, number | undefined>>({});
  const [loadingStatus, setLoadingStatus] = useState<boolean>(true);
  const { isEnglish, toggle } = useLang();

  // Hotel name translation map (Hebrew to English)
  const hotelNameMap: Record<string, string> = {
    "רויאל ביץ'": "Royal Beach",
    "המלך שלמה": "King Solomon",
    "ספורט": "Sport",
    "לגונה": "Lagoona",
    "ריביירה": "Riviera",
    "רויאל גארדן": "Royal Garden",
  };

  // Function to get hotel name in the appropriate language
  const getHotelName = (hebrewName: string): string => {
    if (!isEnglish) return hebrewName;
    return hotelNameMap[hebrewName] || hebrewName;
  };

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
  const eventMappings: Record<string, EventInfo & { date?: string; location?: string; nameEn: string; descriptionEn: string; locationEn?: string }> = {
    OPENING: {
      name: "קוקטייל פתיחת הפסטיבל",
      nameEn: "Festival Opening Cocktail",
      value: participant.OPENING,
      description: "אירוע פתיחה חגיגי של הפסטיבל",
      descriptionEn: "Festive opening of the festival",
      icon: "PartyPopper",
      date: "13/11/2025 19:00",
      location: "מרפסת לובי רויאל ביץ'",
      locationEn: "Royal Beach Lobby Terrace",
    },
    RB1: {
      name: "ארוחת ערב מיוחדת",
      nameEn: "Special Dinner",
      value: participant.RB1,
      description: "לאורחי מלון רויאל ביץ'",
      descriptionEn: "For guests of the Royal Beach Hotel",
      icon: "Crown",
      date: "15/11/2025 19:00",
      location: "מסעדת לובי רויאל ביץ'",
      locationEn: "Royal Beach Lobby Restaurant",
    },
    TERRACE1: {
      name: "שעה ים תיכונית",
      nameEn: "Mediterranean Hour",
      value: participant.TERRACE1,
      description: "טעמים מן הים התיכון",
      descriptionEn: "Mediterranean Flavors",
      icon: "Utensils",
      date: "16/11/2025 19:00",
      location: "מרפסת לובי רויאל ביץ'",
      locationEn: "Royal Beach Lobby Terrace",
    },
    SOUPS: {
      name: "קוקטייל חצות",
      nameEn: "Midnight Cocktail",
      value: participant.SOUPS,
      description: "יין, מרקים, גבינות ומאפים",
      descriptionEn: "Wine, soups, cheeses, and pastries",
      icon: "Wine",
      date: "17/11/2025 23:30",
      location: "מרפסת לובי רויאל ביץ'",
      locationEn: "Royal Beach Lobby Terrace",
    },
    COCKTAIL: {
      name: "קוקטייל פתיחת התחרות המרכזית",
      nameEn: "Main Competition Opening Cocktail",
      value: participant.COCKTAIL,
      description: "קוקטייל חגיגי עם כיבוד עשיר והופעה",
      descriptionEn: "Festive cocktail with rich refreshments and performance",
      icon: "Wine",
      date: "19/11/2025 19:00",
      location: "שפת בריכת מלון רויאל ביץ'",
      locationEn: "Royal Beach Poolside",
    },
    TERRACE2: {
      name: "שעה מתוקה",
      nameEn: "Sweet Hour",
      value: participant.TERRACE2,
      description: "נשנוש קליל ומתוק",
      descriptionEn: "A light and sweet snack",
      icon: "Crown",
      date: "20/11/2025 15:00",
      location: "מרפסת לובי רויאל ביץ'",
      locationEn: "Royal Beach Lobby Terrace",
    },
    RB2: {
      name: "ארוחת ברביקיו",
      nameEn: "Barbecue Dinner",
      value: participant.RB2,
      description: "לאורחי מלון רויאל ביץ'",
      descriptionEn: "For guests of the Royal Beach Hotel",
      icon: "Utensils",
      date: "20/11/2025 19:00/20:30",
      location: "מסעדת לובי רויאל ביץ'",
      locationEn: "Royal Beach Lobby Restaurant",
    },
    TERRACE3: {
      name: "שעה בלקנית",
      nameEn: "Balkan Hour",
      value: participant.TERRACE3,
      description: "טעימות מן הבלקן",
      descriptionEn: "Balkan Tasting",
      icon: "Sparkles",
      date: "21/11/2025 15:00",
      location: "מרפסת לובי רויאל ביץ'",
      locationEn: "Royal Beach Lobby Terrace",
    },
    PRIZES: {
      name: "טקס פרסים",
      nameEn: "Awards Ceremony",
      value: participant.PRIZES,
      description: "טקס חלוקת פרסים חגיגי, קוקטייל ומסיבת ריקודים",
      descriptionEn: "Festive awards ceremony, cocktail, and dance party",
      icon: "Trophy",
      date: "21/11/2025 21:00",
      location: "מרכז הכנסים רויאל ביץ'",
      locationEn: "Royal Beach Conference Center",
    },
  };

  const availableEvents = Object.entries(eventMappings).filter(
    ([_, event]) => event.value !== "NO" && event.value.trim() !== ""
  );
  // Load admin schedules (optional). We store per eventKey schedule here.
  const [schedules, setSchedules] = useState<Record<string, EventSchedule>>({});
  // Modal dialog state for blocked redemption outside schedule
  const [blockedInfo, setBlockedInfo] = useState<{ open: boolean; key?: string } | null>(null);
  // Track which events are currently active according to schedule
  const [activeEventKeys, setActiveEventKeys] = useState<string[]>([]);
  useEffect(() => {
    let cancelled = false;
    const loadOnce = async () => {
      try {
        const year = getYearKey();
        const all = await getEventSchedules(year);
        if (cancelled) return;
        const onlyNeeded: Record<string, EventSchedule> = {};
        for (const [k] of availableEvents) {
          if (all[k]) onlyNeeded[k] = all[k];
        }
        setSchedules(onlyNeeded);
      } catch {}
    };
    loadOnce();
    // Periodically refresh schedules so Admin changes appear without reload
    const iv = setInterval(loadOnce, 30_000);
    // Refresh when page regains focus
    const onFocus = () => loadOnce();
    window.addEventListener('focus', onFocus);
    return () => { cancelled = true; clearInterval(iv); window.removeEventListener('focus', onFocus); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [participant.ID, availableEvents.length]);

  // Helper: is the event active now according to schedule
  const isNowWithin = (sch?: EventSchedule | null) => {
    if (!sch || !sch.date || !sch.openTime || !sch.closeTime) return false;
    const now = new Date();
    const [y, m, d] = sch.date.split("-").map(Number);
    const [oh, om] = sch.openTime.split(":").map(Number);
    const [ch, cm] = sch.closeTime.split(":").map(Number);
    if (!y || !m || !d || oh == null || om == null || ch == null || cm == null) return false;
    // Treat schedule as local time; convert to UTC baseline for comparison
    const start = new Date(Date.UTC(y, m - 1, d, oh, om, 0));
    const end = new Date(Date.UTC(y, m - 1, d, ch, cm, 0));
    const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return nowUTC >= start && nowUTC <= end;
  };

  // Helper: has the event ended (current time strictly after close time)?
  const isEnded = (sch?: EventSchedule | null) => {
    if (!sch || !sch.date || !sch.openTime || !sch.closeTime) return false;
    const now = new Date();
    const [y, m, d] = sch.date.split("-").map(Number);
    const [ch, cm] = sch.closeTime.split(":").map(Number);
    if (!y || !m || !d || ch == null || cm == null) return false;
    const end = new Date(Date.UTC(y, m - 1, d, ch, cm, 0));
    const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    return nowUTC > end;
  };

  // Recompute active events periodically
  useEffect(() => {
    const compute = () => {
      const keys = availableEvents
        .map(([k]) => k)
        .filter((k) => isNowWithin(schedules[k]));
      setActiveEventKeys(keys);
    };
    compute();
    const id = setInterval(compute, 30_000); // every 30s
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(schedules), participant.ID]);
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
          const aMap: Record<string, string | undefined> = {};
          const fMap: Record<string, boolean> = {};
          for (const [k, st] of Object.entries(statuses)) {
            // Skip events that don't exist in Firestore (removed by admin)
            if (st.exists === false) continue;
            
            rMap[k] = st.redeemed;
            qMap[k] = st.quantity;
            cMap[k] = st.consumed ?? 0;
            aMap[k] = (st as any).redeemedAt;
            fMap[k] = Boolean((st as any).finalized);
          }
          setRedeemedMap(rMap);
          setQuantityMap(qMap);
          setConsumedMap(cMap);
          setRedeemedAtMap(aMap);
          setFinalizedMap(fMap);
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
    // Enforce schedule - MUST be configured and within time window
    const sch = schedules[eventKey];
    // If no schedule OR schedule exists but we're outside time window → block
    if (!sch || !sch.date || !sch.openTime || !sch.closeTime) {
      // No schedule defined - block access
      setBlockedInfo({ open: true, key: eventKey });
      return;
    }
    // Schedule exists - check if we're within time window
    const now = new Date();
    const [y, m, d] = sch.date.split("-").map(Number);
    const [oh, om] = sch.openTime.split(":").map(Number);
    const [ch, cm] = sch.closeTime.split(":").map(Number);
    const start = new Date(Date.UTC(y!, (m! - 1), d!, oh!, om!, 0));
    const end = new Date(Date.UTC(y!, (m! - 1), d!, ch!, cm!, 0));
    const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
    const within = nowUTC >= start && nowUTC <= end;
    if (!within) {
      setBlockedInfo({ open: true, key: eventKey });
      return;
    }
    try {
      await redeemEventAdults(year, pid, eventKey, count);
  // Track last session count for voucher display
  setLastSessionCountMap((m) => ({ ...m, [eventKey]: count }));
      // Opening a new usage session: mark voucher as not-finalized anymore (UI + DB)
      if (finalizedMap[eventKey]) {
        try {
          await setEventFinalized(year, pid, eventKey, false);
        } catch {}
        setFinalizedMap((m) => ({ ...m, [eventKey]: false }));
      }
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
        if (r) setRedeemedAtMap((am) => ({ ...am, [eventKey]: new Date().toISOString() }));
        return { ...prev, [eventKey]: next };
      });
      toast({
        title: isEnglish ? "Redemption recorded" : "נרשמה כניסה",
        description: isEnglish ? `Updated entry (${count}) for ${eventName}` : `עודכנה כניסה (${count}) ל- ${eventName}`,
      });
    } catch (e: any) {
      toast({ title: isEnglish ? "Error" : "שגיאה", description: isEnglish ? "An error occurred while redeeming" : "אירעה שגיאה בעת סימון השובר", variant: "destructive" });
    }
  };

  const finalizeVoucher = async (eventKey: string) => {
    const pid = String(participant.ID ?? (participant as any).id ?? (participant as any)["מזהה"] ?? "").trim();
    if (!pid) return;
    const year = getYearKey();
    try {
      await setEventFinalized(year, pid, eventKey, true);
      setFinalizedMap((m) => ({ ...m, [eventKey]: true }));
      toast({ title: isEnglish ? "Voucher finalized" : "השובר ננעל", description: isEnglish ? "This voucher can no longer be used" : "לא ניתן להשתמש שוב בשובר זה" });
    } catch (e: any) {
      toast({ title: isEnglish ? "Error" : "שגיאה", description: isEnglish ? "Could not finalize voucher" : "לא ניתן לנעול את השובר", variant: "destructive" });
    }
  };

  if (availableEvents.length === 0) {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">{isEnglish ? "No events found for this participant" : "לא נמצאו אירועים עבור משתתף זה"}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto space-y-4" dir={isEnglish ? "ltr" : "rtl"}>
      {/* Now Happening banners */}
      {activeEventKeys.length > 0 && (
        <div className="space-y-3">
          {activeEventKeys.map((key) => {
            const ev = eventMappings[key as keyof typeof eventMappings];
            const bg = eventColorMap[key] ?? "#F5F5F5";
            const sch = schedules[key];
            // Show original date+time as stored in mapping (ev.date)
            const combinedDateTime = ev?.date || "";
            const locText = isEnglish ? ev?.locationEn : ev?.location;
    const displayName = isEnglish ? (ev as any).nameEn : ev.name;
            const consumed = consumedMap[key] ?? 0;
            const remaining = Math.max(0, (quantityMap[key] ?? 1) - consumed);
            const hasAnyConsumed = consumed > 0;
            const isFinalized = !!finalizedMap[key];
            const sessionCount = lastSessionCountMap[key] ?? consumed;
            return (
              <div key={`now-${key}`} className="rounded-xl border border-black/10 shadow-sm p-4" style={{ backgroundColor: bg }}>
                <div className="flex flex-col gap-3">
                  {/* Title: bold and large, centered */}
  <div className="text-center text-2xl font-bold text-bridge-black">
                    {displayName}
                  </div>
                  {/* Badges row: combined date+time (blue), location (red) */}
                  <div className="flex gap-2 flex-wrap justify-center">
                    {combinedDateTime && (
                      <Badge variant="secondary" className="bg-bridge-blue/10 text-bridge-blue border-bridge-blue">
                        {combinedDateTime}
                      </Badge>
                    )}
                    {locText && (
                      <Badge variant="secondary" className="bg-bridge-red/10 text-bridge-red border-bridge-red">
                        {locText}
                      </Badge>
                    )}
                  </div>
                  {/* Voucher appears as soon as there's any redemption; stays green until finalized */}
                  {hasAnyConsumed ? (
        <div className={`relative mt-1 mx-auto w-full max-w-sm rounded-xl border-2 border-dashed ${finalizedMap[key] ? 'border-red-600 bg-red-100 ticket-notch-left ticket-notch-right ticket-notch-red' : 'border-green-600 bg-green-100 ticket-notch-left ticket-notch-right ticket-notch-green'} text-black p-4 text-center shadow-sm`}>
                      {/* Ticket notches - semicircles */}
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ backgroundColor: bg }} />
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ backgroundColor: bg }} />
                      {/* Voucher header */}
                      <div className={`flex items-center justify-center gap-2 mb-1 ${finalizedMap[key] ? 'text-red-800' : 'text-green-800'}`}>
                        <Ticket className="w-4 h-4" />
                        <span className="text-sm font-semibold">{isEnglish ? "Event Entry Voucher" : "שובר הכניסה לאירוע"}</span>
                      </div>
                      {(() => {
                        const ts = redeemedAtMap[key];
                        const d = ts ? new Date(ts) : new Date();
                        const hh = String(d.getHours()).padStart(2, '0');
                        const mm = String(d.getMinutes()).padStart(2, '0');
                        const timeText = `${hh}:${mm}`;
            return (
                          <>
          <div className="mb-1 font-bold">{isEnglish ? "Entry recorded" : "בוצעה כניסה"} - {timeText}</div>
              <div className="text-base font-semibold">{isEnglish ? "Number of adults" : "כמות מבוגרים"} - {sessionCount}</div>
                            {!isFinalized && (schedules[key]?.requireVerification ?? false) && (
                              <div className="mt-3">
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button className="bg-green-600 hover:bg-green-700 text-white">
                                      {isEnglish ? "Entrance system verification ✓" : "אימות מערכת בכניסה ✓"}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent dir={isEnglish ? 'ltr' : 'rtl'} className="sm:max-w-md">
                                    <AlertDialogHeader>
                                      <AlertDialogTitle className="text-center text-xl">{isEnglish ? "Dear guest, do not press this button" : "אורח יקר, אין ללחוץ על כפתור זה"}</AlertDialogTitle>
                                      <AlertDialogDescription className="text-center text-lg">
                                        {isEnglish ? "Finalize voucher usage?" : "מימוש סופי של השובר?"}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter className="flex !flex-row w-full justify-center gap-3">
                                      <AlertDialogCancel className="w-28 justify-center !mt-0">{isEnglish ? 'No' : 'לא'}</AlertDialogCancel>
                                      <AlertDialogAction className="w-28 justify-center" onClick={() => finalizeVoucher(key)}>{isEnglish ? 'Yes' : 'כן'}</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                  <div className="pt-1 flex justify-center">
                    <div className="relative w-full max-w-sm rounded-xl border-2 border-dashed border-bridge-blue bg-white/80 text-black p-4 text-center shadow-sm ticket-notch-left ticket-notch-right ticket-notch-blue">
                      {/* Ticket notches - semicircles */}
                      <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ backgroundColor: bg }} />
                      <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full" style={{ backgroundColor: bg }} />
                      {/* Voucher header */}
                      <div className="flex items-center justify-center gap-2 mb-2 text-bridge-blue">
                        <Ticket className="w-4 h-4" />
                        <span className="text-sm font-semibold">{isEnglish ? "Event Entry Voucher" : "שובר הכניסה לאירוע"}</span>
                      </div>
                      <AlertDialog>
                        <AlertDialogTrigger asChild onClick={(e) => {
                          // Check schedule: must be defined AND within time window
                          const sch = schedules[key];
                          if (!sch || !sch.date || !sch.openTime || !sch.closeTime) {
                            e.preventDefault();
                            setBlockedInfo({ open: true, key });
                            return;
                          }
                          // Since this is the "Now Happening" banner, we should already be within time
                          // But double-check to be safe
                          if (!isNowWithin(sch)) {
                            e.preventDefault();
                            setBlockedInfo({ open: true, key });
                          }
                        }}>
                          <Button
                            className="mx-auto group bg-gradient-to-r from-bridge-blue to-bridge-red text-white hover:from-bridge-blue/90 hover:to-bridge-red/90 shadow-md hover:shadow-lg rounded-full px-4 py-2 text-base leading-tight transition-all w-auto min-w-[8rem] justify-center"
                            disabled={loadingStatus || remaining <= 0}
                          >
                            {isEnglish ? "Redeem" : "לכניסה"}
                            {isEnglish ? (
                              <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform duration-200 group-hover:translate-x-0.5" />
                            ) : (
                              <ArrowLeft className="h-3.5 w-3.5 ml-1 transition-transform duration-200 group-hover:-translate-x-0.5" />
                            )}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent dir={isEnglish ? "ltr" : "rtl"} className="sm:max-w-md">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-center text-xl">{isEnglish ? "Confirm redemption" : "אישור מימוש שובר"}</AlertDialogTitle>
                            <AlertDialogDescription className="space-y-3 text-center text-lg">
                              <div>{isEnglish ? "Select number of adults entering the event:" : "בחר/י כמות מבוגרים שנכנסים לאירוע:"}</div>
                              <div className="flex items-center justify-center gap-2">
                                <Input
                                  type="number"
                                  min={1}
                                  max={remaining}
                                  defaultValue={remaining}
                                  className="w-20 text-center"
                                  id={`banner-qty-${key}`}
                                />
                                <span className="text-xs text-muted-foreground">{isEnglish ? `Entering ${remaining} of ${remaining}` : `נכנסים ${remaining} מתוך ${remaining}`}</span>
                              </div>
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="flex !flex-row w-full justify-center gap-3">
                            <AlertDialogCancel className="w-28 justify-center !mt-0">{isEnglish ? "No" : "לא"}</AlertDialogCancel>
                            <AlertDialogAction className="w-28 justify-center"
                              onClick={() => {
                                const input = document.getElementById(`banner-qty-${key}`) as HTMLInputElement | null;
                                const val = Math.max(1, Math.min(remaining, Number(input?.value || 1)));
                                redeemEvent(key, ev.name, val);
                              }}
                            >
                              {isEnglish ? "Yes" : "כן"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {/* Language toggle moved to ParticipantPage header */}
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
        /* Ticket notch styling - semicircle cutout effect */
        .ticket-notch-left::before,
        .ticket-notch-right::before {
          content: '';
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 12px;
          height: 12px;
          border-radius: 50%;
          border: 2px dashed;
        }
        .ticket-notch-left::before {
          left: -3px;
          border-right: none;
          clip-path: polygon(0 0, 50% 0, 50% 100%, 0 100%);
        }
        .ticket-notch-right::before {
          right: -3px;
          border-left: none;
          clip-path: polygon(50% 0, 100% 0, 100% 100%, 50% 100%);
        }
        .ticket-notch-green::before {
          border-color: #16a34a;
        }
        .ticket-notch-red::before {
          border-color: #dc2626;
        }
        .ticket-notch-blue::before {
          border-color: #1e40af;
        }
      `}</style>
      <Card className="rounded-lg overflow-hidden">
        <CardHeader className="bg-[#e7354b] text-white">
          <CardTitle className="text-center text-2xl font-bold">
            {isEnglish ? "Event Details" : "פרטי אירועים"}
          </CardTitle>
        </CardHeader>
      </Card>
      <AnimatedList
        items={
          // Filter out events that don't exist in Firestore (removed by admin)
          // Sort so redeemed events appear at the bottom; preserve relative order within groups
          [...availableEvents]
            .filter(([key]) => quantityMap[key] !== undefined) // Only show events that exist in Firestore
            .sort(([keyA], [keyB]) => {
              const aBottom = !!redeemedMap[keyA] || isEnded(schedules[keyA]);
              const bBottom = !!redeemedMap[keyB] || isEnded(schedules[keyB]);
              if (aBottom === bBottom) return 0;
              return aBottom ? 1 : -1; // push ended or redeemed to the bottom
            })
            .map(([key, event]) => {
              const bgColor = eventColorMap[key] ?? pastelBGs[0];
              const isFinalized = !!finalizedMap[key];
              const qty = quantityMap[key] ?? 1;
              const consumed = consumedMap[key] ?? 0;
              const fullyRedeemed = consumed >= qty;
              const isRedeemed = fullyRedeemed; // "Redeemed" badge only for actual redeemed
              const ended = isEnded(schedules[key]);
              const isDeprioritized = isRedeemed || ended; // grey-out when redeemed or ended
              const remaining = Math.max(0, qty - consumed);
              const displayName = isEnglish ? (event as any).nameEn : event.name;
              const displayDesc = isEnglish ? (event as any).descriptionEn : event.description;
              const displayLoc = isEnglish ? (event as any).locationEn : event.location;
              return (
            <div
              key={key}
              className={`rounded-xl shadow-sm p-4 mb-4 border border-black/5 ${isDeprioritized ? "opacity-70" : ""}`}
              style={{ backgroundColor: bgColor }}
            >
              <div className={`flex items-start gap-4 ${isEnglish ? 'flex-row' : 'flex-row'}`}>
                <div className="flex-grow">
                  <h3 className="font-bold text-bridge-black text-xl">
                    {displayName}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {displayDesc}
                  </p>
                  <div className="flex gap-2 mb-2 flex-wrap items-center">
                    {event.date && (
                      <Badge variant="secondary" className="bg-bridge-blue/10 text-bridge-blue border-bridge-blue">
                        {event.date}
                      </Badge>
                    )}
                    {displayLoc && (
                      <Badge variant="secondary" className="bg-bridge-red/10 text-bridge-red border-bridge-red">
                        {displayLoc}
                      </Badge>
                    )}
                    {isRedeemed && (
                      <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-300">
                        {isEnglish ? "Redeemed" : "נוצל"}
                      </Badge>
                    )}
                  </div>
                </div>
                {/* Left-side action button */}
                <div className={`flex-shrink-0 self-center ${isEnglish ? '' : ''}`}>
  {!fullyRedeemed && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild onClick={(e) => {
                        // Check schedule: must be defined AND within time window
                        const sch = schedules[key];
                        // Block if no schedule OR outside time window
                        if (!sch || !sch.date || !sch.openTime || !sch.closeTime) {
                          e.preventDefault();
                          setBlockedInfo({ open: true, key });
                          return;
                        }
                        const now = new Date();
                        const [y, m, d] = sch.date.split("-").map(Number);
                        const [oh, om] = sch.openTime.split(":").map(Number);
                        const [ch, cm] = sch.closeTime.split(":").map(Number);
                        const start = new Date(Date.UTC(y!, (m! - 1), d!, oh!, om!, 0));
                        const end = new Date(Date.UTC(y!, (m! - 1), d!, ch!, cm!, 0));
                        const nowUTC = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
                        const within = nowUTC >= start && nowUTC <= end;
                        if (!within) {
                          e.preventDefault();
                          setBlockedInfo({ open: true, key });
                        }
                      }}>
                        <Button
                          className="group bg-gradient-to-r from-bridge-blue to-bridge-red text-white hover:from-bridge-blue/90 hover:to-bridge-red/90 shadow-md hover:shadow-lg rounded-full px-3 py-1.5 text-sm leading-tight transition-all w-auto min-w-0"
        disabled={loadingStatus || remaining <= 0}
                        >
                          {isEnglish ? "Redeem" : "לכניסה"}
                          {isEnglish ? (
                            <ArrowRight className="h-3.5 w-3.5 ml-1 transition-transform duration-200 group-hover:translate-x-0.5" />
                          ) : (
                            <ArrowLeft className="h-3.5 w-3.5 ml-1 transition-transform duration-200 group-hover:-translate-x-0.5" />
                          )}
                        </Button>
                      </AlertDialogTrigger>
                       <AlertDialogContent dir={isEnglish ? "ltr" : "rtl"} className="sm:max-w-md">
                        <AlertDialogHeader>
                           <AlertDialogTitle className="text-center text-xl">{isEnglish ? "Confirm redemption" : "אישור מימוש שובר"}</AlertDialogTitle>
                          <AlertDialogDescription className="space-y-3 text-center text-lg">
                            <div>{isEnglish ? "Select number of adults entering the event:" : "בחר/י כמות מבוגרים שנכנסת לאירוע:"}</div>
                            <div className="flex items-center justify-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={remaining}
                                defaultValue={remaining}
                                className="w-20 text-center"
                                id={`qty-${key}`}
                              />
                              <span className="text-xs text-muted-foreground">{isEnglish ? `Entering ${remaining} of ${remaining}` : `נכנסים ${remaining} מתוך ${remaining}`}</span>
                            </div>
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="flex !flex-row w-full justify-center gap-3">
                          <AlertDialogCancel className="w-28 justify-center !mt-0">{isEnglish ? "No" : "לא"}</AlertDialogCancel>
                          <AlertDialogAction className="w-28 justify-center"
                            onClick={() => {
                              const input = document.getElementById(`qty-${key}`) as HTMLInputElement | null;
                              const val = Math.max(1, Math.min(remaining, Number(input?.value || 1)));
                              redeemEvent(key, event.name, val);
                            }}
                          >
                            {isEnglish ? "Yes" : "כן"}
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
      
      {/* Coffee & Cake Voucher */}
      <div className="mt-6 mb-6 rounded-lg" style={{
        background: 'linear-gradient(to right, #1b248b, #e7354b)'
      }}>
        <Card className="rounded-lg overflow-hidden shadow-lg border-4 border-dashed border-white bg-transparent">
          <CardContent className="p-6 space-y-4" style={{
            background: 'linear-gradient(to right, #1b248b, #e7354b)'
          }}>
            <h2 className="text-center text-4xl font-bold text-white leading-tight">
              {isEnglish ? "Coffee & Cake" : "שובר קפה ועוגה"}
            </h2>
            {/* Participant details */}
            <div className="text-center space-y-1 text-white text-sm font-medium">
              <div>
                {isEnglish ? "Name: " : "שם: "}
                <span className="font-bold">{participant.NAME || ""}</span>
              </div>
              <div>
                {isEnglish ? "Hotel: " : "מלון: "}
                <span className="font-bold">{getHotelName(participant.HOTEL || "")}</span>
              </div>
            </div>
            {/* Instructions text */}
            <p className="text-base italic text-white px-4 text-center max-w-sm mx-auto leading-relaxed">
              {isEnglish 
                ? "Present this voucher during game sessions at the Royal Beach Hall to receive coffee or cake"
                : "יש להציג שובר זה בעת המשחקים באולם רויאל ביץ׳ לקבלת קפה או עוגה"
              }
            </p>
            {/* Divider line */}
            <div className="border-t-2 border-dashed border-white my-4"></div>
            {/* Icons */}
            <div className="text-center text-6xl">
              ☕ 🍰
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Useful links grid - 2x2 with images and captions */}
      <Card className="rounded-lg overflow-hidden shadow-lg" style={{
        background: 'linear-gradient(to right, #1b248b, #e7354b)'
      }}>
        <CardHeader className="text-white">
          <CardTitle className="text-center text-2xl font-bold">
            {isEnglish ? "Useful Links" : "קישורים שימושיים"}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 bg-white">
          <div className="grid grid-cols-2 gap-6">
            {/* TL - Booklet */}
            <div className="flex flex-col items-center text-center">
              <a href="https://online.anyflip.com/wsbi/yfqs/mobile/index.html" target="_blank" rel="noopener noreferrer" className="block">
                <img src={logoBooklet} alt="Festival Booklet" className="h-20 w-20 object-contain mx-auto" />
              </a>
              <a href="https://online.anyflip.com/wsbi/yfqs/mobile/index.html" target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-muted-foreground hover:underline">
                {isEnglish ? "View the festival booklet" : "לצפייה בחוברת הפסטיבל לחצו כאן"}
              </a>
            </div>
            {/* TR - WhatsApp */}
            <div className="flex flex-col items-center text-center">
              <a href="https://chat.whatsapp.com/JBiL4ycstf13J0zPn4MOwp" target="_blank" rel="noopener noreferrer" className="block">
                <img src={logoWA} alt="Festival WhatsApp Group" className="h-20 w-20 object-contain mx-auto" />
              </a>
              <a href="https://chat.whatsapp.com/JBiL4ycstf13J0zPn4MOwp" target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-muted-foreground hover:underline">
                {isEnglish ? "Join the festival WhatsApp group" : "להצטרפות לקבוצת הוואטסאפ של הפסטיבל לחצו כאן"}
              </a>
            </div>
            {/* BL - Website */}
            <div className="flex flex-col items-center text-center">
              <a href="https://www.bridgeredsea.com/" target="_blank" rel="noopener noreferrer" className="block">
                <img src={logoRS} alt="Festival Website" className="h-20 w-20 object-contain mx-auto" />
              </a>
              <a href="https://www.bridgeredsea.com/" target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-muted-foreground hover:underline">
                {isEnglish ? "Visit the festival website" : "לצפייה באתר הפסטיבל"}
              </a>
            </div>
            {/* BR - Facebook */}
            <div className="flex flex-col items-center text-center">
              <a href="https://www.facebook.com/profile.php?id=100064564367174" target="_blank" rel="noopener noreferrer" className="block">
                <img src={logoFB} alt="Festival Facebook Page" className="h-20 w-20 object-contain mx-auto" />
              </a>
              <a href="https://www.facebook.com/profile.php?id=100064564367174" target="_blank" rel="noopener noreferrer" className="mt-2 text-xs text-muted-foreground hover:underline">
                {isEnglish ? "Visit the festival Facebook page" : "לצפייה בעמוד הפייסבוק של הפסטיבל"}
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
      {/* Blocked redemption dialog */}
      {blockedInfo?.open && (
        <AlertDialog open={blockedInfo.open} onOpenChange={(v) => setBlockedInfo(v ? blockedInfo : null)}>
          <AlertDialogContent dir={isEnglish ? "ltr" : "rtl"} className="sm:max-w-md">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-center">
                {isEnglish ? "Voucher can only be redeemed during the event time" : "ניתן לממש את השובר רק בשעת האירוע!"}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {(() => {
                  const key = blockedInfo?.key as keyof typeof eventMappings | undefined;
                  const ev = key ? eventMappings[key] : undefined;
                  const sch = key ? schedules[key] : undefined;
                  
                  // Check if schedule is not defined at all
                  const noSchedule = !sch || !sch.date || !sch.openTime || !sch.closeTime;
                  
                  if (noSchedule) {
                    return (
                      <div className="space-y-2 text-center">
                        <div className="font-bold text-lg">
                          {isEnglish ? "Event schedule not yet published" : "מועד האירוע טרם פורסם"}
                        </div>
                        <div className="text-muted-foreground">
                          {isEnglish 
                            ? "Please check back later for event timing details" 
                            : "נא לבדוק שוב מאוחר יותר לפרטי מועד האירוע"}
                        </div>
                      </div>
                    );
                  }
                  
                  // Schedule exists but we're outside the time window
                  // Format date as DD/MM/YYYY
                  let dateText = "";
                  if (sch?.date) {
                    const [y, m, d] = sch.date.split("-");
                    dateText = `${d}/${m}/${y}`;
                  } else if (ev?.date) {
                    dateText = ev.date.split(" ")[0];
                  }
                  const timeText = sch?.openTime ? sch.openTime : "";
                  const locText = isEnglish ? ev?.locationEn : ev?.location;
                  return (
                    <div className="space-y-1 text-center">
                      <div className="font-bold">{isEnglish ? "Date" : "תאריך"}: {dateText}</div>
                      <div className="font-bold">{isEnglish ? "Time" : "שעה"}: {timeText}</div>
                      <div className="font-bold">{isEnglish ? "Location" : "מיקום"}: {locText}</div>
                    </div>
                  );
                })()}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="flex w-full justify-center items-center">
              <AlertDialogAction className="w-28" onClick={() => setBlockedInfo(null)}>
                {isEnglish ? "OK" : "אישור"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
};

export default EventsList;
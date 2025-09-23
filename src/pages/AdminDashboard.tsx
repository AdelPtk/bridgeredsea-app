import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getYearKey, getEventRedemptionStats, listRedeemedForEvent, setEventRedeemed, getEventTotalsForEvent } from "@/services/participants";
import { eventColorMap } from "@/lib/eventColors";
import { X } from "lucide-react";

const eventNameMap: Record<string, string> = {
  OPENING: "קוקטייל פתיחת הפסטיבל",
  RB1: "ארוחת ערב מיוחדת",
  TERRACE1: "שעה ים תיכונית",
  SOUPS: "קוקטייל חצות",
  COCKTAIL: "קוקטייל פתיחת התחרות המרכזית",
  TERRACE2: "שעה מתוקה",
  RB2: "ארוחת ברביקיו",
  TERRACE3: "שעה בלקנית",
  PRIZES: "טקס פרסים",
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<Record<string, { redeemedParticipants: number; redeemedAdults: number }>>({});
  const [loading, setLoading] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<string | null>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedTotals, setSelectedTotals] = useState<{
    eligibleParticipants: number;
    eligibleAdults: number;
    redeemedParticipants: number;
    redeemedAdults: number;
  } | null>(null);

  const orderedKeys = useMemo(() => (
    ["OPENING","RB1","TERRACE1","SOUPS","COCKTAIL","TERRACE2","RB2","TERRACE3","PRIZES"]
  ), []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const agg = await getEventRedemptionStats(getYearKey());
        setStats(agg);
      } finally {
        setLoading(false);
      }
    })();
  }, [refreshKey]);

  const loadEntries = async (eventKey: string, opts?: { force?: boolean }) => {
    setSelectedEvent(eventKey);
    setLoadingEntries(true);
    try {
      const list = await listRedeemedForEvent(getYearKey(), eventKey, { force: opts?.force });
      setEntries(list);
      const totals = await getEventTotalsForEvent(getYearKey(), eventKey, { force: opts?.force });
      setSelectedTotals({
        eligibleParticipants: totals.eligibleParticipants,
        eligibleAdults: totals.eligibleAdults,
        redeemedParticipants: totals.redeemedParticipants,
        redeemedAdults: totals.redeemedAdults,
      });
    } finally {
      setLoadingEntries(false);
    }
  };

  const unredeem = async (participantId: string) => {
    if (!selectedEvent) return;
    await setEventRedeemed(getYearKey(), participantId, selectedEvent, false);
    // local refresh
    await loadEntries(selectedEvent);
    setRefreshKey((k) => k + 1);
  };

  const formatDate = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(d); // yields DD/MM/YY
  };

  const formatTime = (iso?: string) => {
    if (!iso) return "";
    const d = new Date(iso);
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jerusalem",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(d);
    const hh = parts.find(p => p.type === "hour")?.value ?? "00";
    const mm = parts.find(p => p.type === "minute")?.value ?? "00";
    // Show HH:MM (hours first)
    return `${hh}:${mm}`;
  };

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        <Card className="border-2 border-bridge-blue/20 shadow-xl overflow-hidden rounded-lg">
          <CardHeader className="bg-gradient-to-r from-bridge-blue to-bridge-red text-white">
            <CardTitle className="text-center text-xl font-bold">דשבורד ניהול</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-8">
                {selectedTotals ? (
                  <>
                    <div className="text-center">
                      <div className="text-3xl font-extrabold leading-none">{selectedTotals.redeemedAdults}</div>
                      <div className="text-xs text-muted-foreground mt-1">כמות כניסות</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-extrabold leading-none">{selectedTotals.eligibleAdults}</div>
                      <div className="text-xs text-muted-foreground mt-1">סה"כ זכאות</div>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">בחר אירוע להצגת סטטיסטיקה</span>
                )}
              </div>
              <Button
                onClick={async () => {
                  setRefreshKey((k) => k + 1);
                  if (selectedEvent) await loadEntries(selectedEvent, { force: true });
                }}
                disabled={loading}
              >
                {loading ? "מרענן…" : "רענן נתונים"}
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {orderedKeys.map((k) => (
                <button
                  key={k}
                  onClick={() => loadEntries(k)}
                  className="w-full rounded-md p-3 text-right border shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: eventColorMap[k] || "#F5F5F5" }}
                >
                  <div className="font-medium">{eventNameMap[k] ?? k}</div>
                  {/* info removed per request */}
                </button>
              ))}
            </div>

            {/* Table-like list */}
            {selectedEvent && (
              <div className="space-y-3">
                <h3 className="font-bold text-lg">{eventNameMap[selectedEvent] ?? selectedEvent}</h3>
                {loadingEntries ? (
                  <p className="text-muted-foreground">טוען רשימת כניסות…</p>
                ) : entries.length === 0 ? (
                  <p className="text-muted-foreground">אין כניסות עדיין.</p>
                ) : (
                  <>
                    {/* Mobile list (stacked cards) */}
                    <div className="sm:hidden rounded-md border divide-y">
                      {entries.map((e: any, idx: number) => (
                        <div key={idx} className="p-3 grid grid-cols-2 gap-2 text-center">
                          <div className="col-span-2 font-medium truncate" title={e.participantName ?? ""}>
                            {e.participantName ?? ""}
                          </div>
                          <div className="text-xs whitespace-nowrap">{formatDate(e.redeemedAt)}</div>
                          <div className="text-xs whitespace-nowrap">{formatTime(e.redeemedAt)}</div>
                          <div className="col-span-2 text-xs whitespace-nowrap">{e.participantId}</div>
                          <div className="col-span-2 flex items-center justify-center gap-3 pt-1">
                            <span className="inline-flex h-6 min-w-10 items-center justify-center rounded bg-muted px-2 text-sm">
                              {e.quantity ?? ""}
                            </span>
                            <Button variant="destructive" size="sm" onClick={() => unredeem(e.participantId)} aria-label="בטל">
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Desktop/tablet table */}
                    <div className="hidden sm:block overflow-auto rounded-md border">
                      <table className="w-full min-w-[720px] text-sm sm:table-fixed table-auto">
                      <colgroup>
                        <col style={{ width: "12%" }} /> {/* Date */}
                        <col style={{ width: "12%" }} /> {/* Time */}
                        <col style={{ width: "18%" }} /> {/* Participant ID */}
                        <col style={{ width: "10%" }} /> {/* Quantity */}
                        <col style={{ width: "36%" }} /> {/* Name (widest but reduced) */}
                        <col style={{ width: "12%" }} /> {/* Actions */}
                      </colgroup>
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-center whitespace-nowrap">תאריך</th>
                          <th className="p-2 text-center whitespace-nowrap">שעה</th>
                          <th className="p-2 text-center whitespace-nowrap">מזהה משתתף</th>
                          <th className="p-2 text-center whitespace-nowrap">כמות</th>
                          <th className="p-2 text-center">שם</th>
                          <th className="p-2 text-center whitespace-nowrap">פעולות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 text-center whitespace-nowrap">{formatDate(e.redeemedAt)}</td>
                            <td className="p-2 text-center whitespace-nowrap">{formatTime(e.redeemedAt)}</td>
                            <td className="p-2 text-center whitespace-nowrap">{e.participantId}</td>
                            <td className="p-2 text-center whitespace-nowrap">{e.quantity ?? ""}</td>
                            <td className="p-2 text-center truncate" title={e.participantName ?? ""}>{e.participantName ?? ""}</td>
                            <td className="p-2 text-center whitespace-nowrap">
                              <Button variant="destructive" size="sm" onClick={() => unredeem(e.participantId)} aria-label="בטל">
                                <X className="h-4 w-4" />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

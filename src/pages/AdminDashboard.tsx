import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getYearKey, getEventRedemptionStats, listRedeemedForEvent, setEventRedeemed, getEventTotalsForEvent, clearRedemptionLogsForParticipant, getEventSchedule, setEventSchedule, type EventSchedule, getEventStatusForParticipant, searchParticipants, listEventsForParticipant, setEventFinalized, setParticipantEventQuantity } from "@/services/participants";
import { getEventStats, rebuildEventStats } from "@/services/eventStats";
import { eventColorMap } from "@/lib/eventColors";
import { X, Loader2 } from "lucide-react";
import SiteFooter from "@/components/SiteFooter";

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

// Default schedules from the original event definitions
const defaultSchedules: Record<string, { date: string; openTime: string; closeTime: string }> = {
  OPENING: { date: "2025-11-13", openTime: "19:00", closeTime: "22:00" },
  RB1: { date: "2025-11-15", openTime: "19:00", closeTime: "22:00" },
  TERRACE1: { date: "2025-11-16", openTime: "19:00", closeTime: "22:00" },
  SOUPS: { date: "2025-11-17", openTime: "23:30", closeTime: "02:00" },
  COCKTAIL: { date: "2025-11-19", openTime: "19:00", closeTime: "22:00" },
  TERRACE2: { date: "2025-11-20", openTime: "15:00", closeTime: "18:00" },
  RB2: { date: "2025-11-20", openTime: "19:00", closeTime: "21:00" },
  TERRACE3: { date: "2025-11-21", openTime: "15:00", closeTime: "18:00" },
  PRIZES: { date: "2025-11-21", openTime: "21:00", closeTime: "02:00" },
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
  const [statsLoading, setStatsLoading] = useState(false);
  const [schedule, setSchedule] = useState<EventSchedule | null>(null);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [clearingSchedule, setClearingSchedule] = useState(false);
  const [testingSchedule, setTestingSchedule] = useState(false);
  const [settingAllSchedules, setSettingAllSchedules] = useState(false);

  // Top tab: events vs participants
  const [activeTab, setActiveTab] = useState<"events" | "participants">("events");

  // Participant management state
  const [searchTerm, setSearchTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<Array<{ id: string; name?: string; hotel?: string; adults?: number }>>([]);
  const [selectedPid, setSelectedPid] = useState<string | null>(null);
  const [participantRows, setParticipantRows] = useState<Array<{ eventKey: string; name?: string; quantity: number; consumed: number; redeemed: boolean; finalized?: boolean }>>([]);
  const [loadingParticipantRows, setLoadingParticipantRows] = useState(false);
  const [qtyEdits, setQtyEdits] = useState<Record<string, string>>({});
  const [savingQty, setSavingQty] = useState<Record<string, boolean>>({});

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

  // Load event stats quickly (just the counters)
  const loadEventStats = async (eventKey: string) => {
    setSelectedEvent(eventKey);
    setStatsLoading(true);
    try {
      const es = await getEventStats(getYearKey(), eventKey);
      setSelectedTotals({
        eligibleParticipants: es.participants,
        eligibleAdults: es.totalEligibleAdults,
        redeemedParticipants: 0,
        redeemedAdults: es.totalConsumedAdults,
      });
      // Load schedule too (fast)
      const sch = await getEventSchedule(getYearKey(), eventKey);
      setSchedule(sch ?? { date: "", openTime: "", closeTime: "" });
    } finally {
      setStatsLoading(false);
    }
  };

  // Load participant entries (slower, only when needed)
  const loadEntries = async (opts?: { force?: boolean }) => {
    if (!selectedEvent) return;
    setLoadingEntries(true);
    try {
      const list = await listRedeemedForEvent(getYearKey(), selectedEvent, { force: opts?.force });
      setEntries(list);
    } finally {
      setLoadingEntries(false);
    }
  };

  const unredeem = async (participantId: string) => {
    if (!selectedEvent) return;
  // Clear event state and related log entries for this participant/event
    await setEventRedeemed(getYearKey(), participantId, selectedEvent, false);
  await clearRedemptionLogsForParticipant(getYearKey(), participantId, selectedEvent);
    // local refresh
    await loadEntries();
    setRefreshKey((k) => k + 1);
  };

  // Participant management helpers
  const runSearch = async () => {
    const term = searchTerm.trim();
    if (!term) { setResults([]); return; }
    setSearching(true);
    try {
      const r = await searchParticipants(getYearKey(), term);
      setResults(r);
    } finally {
      setSearching(false);
    }
  };

  const loadParticipantEvents = async (pid: string) => {
    setSelectedPid(pid);
    setLoadingParticipantRows(true);
    try {
      const rows = await listEventsForParticipant(getYearKey(), pid);
      setParticipantRows(rows);
      // Initialize edit fields with current quantities
      const init: Record<string, string> = {};
      rows.forEach(r => { init[r.eventKey] = String(r.quantity); });
      setQtyEdits(init);
    } finally {
      setLoadingParticipantRows(false);
    }
  };

  const toggleRedeemedForParticipant = async (pid: string, eventKey: string, redeemed: boolean) => {
    await setEventRedeemed(getYearKey(), pid, eventKey, redeemed);
    if (!redeemed) {
      try { await clearRedemptionLogsForParticipant(getYearKey(), pid, eventKey); } catch {}
    }
    await loadParticipantEvents(pid);
  };

  const toggleFinalizeForParticipant = async (pid: string, eventKey: string, finalized: boolean) => {
    await setEventFinalized(getYearKey(), pid, eventKey, finalized);
    await loadParticipantEvents(pid);
  };

  // Parse quantity input: integers only (non-negative)
  const parseQuantityInput = (val: string): number | null => {
    if (!val) return null;
    const s = val.trim();
    if (!/^\d+$/.test(s)) return null; // only digits allowed
    const n = Number(s);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.floor(n);
  };

  const saveQuantityForRow = async (pid: string, eventKey: string) => {
    const raw = qtyEdits[eventKey] ?? "";
    const parsed = parseQuantityInput(raw);
    if (parsed === null || parsed < 0) return; // ignore invalid
    setSavingQty((m) => ({ ...m, [eventKey]: true }));
    try {
      await setParticipantEventQuantity(getYearKey(), pid, eventKey, parsed);
      await loadParticipantEvents(pid);
    } finally {
      setSavingQty((m) => ({ ...m, [eventKey]: false }));
    }
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

  // Helpers to compute date/time strings in Asia/Jerusalem for schedule presets
  const getJerusalemParts = (d: Date) => {
    const fmt = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    });
    const parts = fmt.formatToParts(d);
    const val = (t: string) => parts.find(p => p.type === t)?.value ?? '';
    return {
      y: val('year'),
      m: val('month'),
      d: val('day'),
      hh: val('hour'),
      mm: val('minute'),
    };
  };

  const presetNowPlus2h = () => {
    const now = new Date();
    const end = new Date(now.getTime() + 2 * 60 * 60 * 1000);
    const a = getJerusalemParts(now);
    const b = getJerusalemParts(end);
    return {
      date: `${a.y}-${a.m}-${a.d}`,
      openTime: `${a.hh}:${a.mm}`,
      closeTime: `${b.hh}:${b.mm}`,
    } as EventSchedule;
  };

  const setAllEventSchedules = async () => {
    setSettingAllSchedules(true);
    try {
      const year = getYearKey();
      for (const [eventKey, sched] of Object.entries(defaultSchedules)) {
        await setEventSchedule(year, eventKey, { 
          ...sched, 
          requireVerification: false 
        });
      }
      alert("✅ כל התזמונים הוגדרו בהצלחה!");
      // If an event is selected, refresh its schedule
      if (selectedEvent) {
        const sch = await getEventSchedule(year, selectedEvent);
        setSchedule(sch ?? { date: "", openTime: "", closeTime: "" });
      }
    } catch (err) {
      console.error(err);
      alert("❌ שגיאה בהגדרת התזמונים");
    } finally {
      setSettingAllSchedules(false);
    }
  };

  return (
    <div className="min-h-screen bg-white" dir="rtl">
      <div className="container mx-auto px-4 py-8 space-y-6 max-w-6xl">
        <Card className="border-2 border-bridge-blue/20 shadow-xl overflow-hidden rounded-lg">
          <CardHeader className="bg-gradient-to-r from-bridge-blue to-bridge-red text-white">
            <CardTitle className="text-center text-xl font-bold">דשבורד ניהול</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <Tabs value={activeTab} onValueChange={(v: string) => setActiveTab(v as any)} dir="rtl" className="w-full">
              <div className="flex justify-center">
                <TabsList>
                  <TabsTrigger value="events">ניהול אירועים</TabsTrigger>
                  <TabsTrigger value="participants">ניהול משתתפים</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="events" className="space-y-6">
              <div className="flex items-center justify-center flex-wrap gap-4">
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
                {selectedTotals ? (
                  <>
                    <div className="text-center">
                      <div className="text-3xl font-extrabold leading-none">{selectedTotals.eligibleAdults}</div>
                      <div className="text-xs text-muted-foreground mt-1">כמות זכאות</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-extrabold leading-none">{selectedTotals.redeemedAdults}</div>
                      <div className="text-xs text-muted-foreground mt-1">כניסות שבוצעו</div>
                    </div>
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">בחר אירוע להצגת סטטיסטיקה</span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {orderedKeys.map((k) => (
                <button
                  key={k}
                  onClick={() => loadEventStats(k)}
                  className="w-full rounded-md p-3 text-right border shadow-sm hover:opacity-90 transition"
                  style={{ backgroundColor: eventColorMap[k] || "#F5F5F5" }}
                >
                  <div className="font-medium">{eventNameMap[k] ?? k}</div>
                  {/* info removed per request */}
                </button>
              ))}
            </div>

            {/* Event details section */}
            {selectedEvent && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{eventNameMap[selectedEvent] ?? selectedEvent}</h3>
                  <Button
                    variant="outline"
                    onClick={() => loadEntries()}
                    disabled={loadingEntries}
                  >
                    {loadingEntries ? (
                      <>
                        <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                        טוען רשימת משתתפים...
                      </>
                    ) : (
                      entries.length > 0 ? "רענן רשימה" : "טען רשימת משתתפים"
                    )}
                  </Button>
                </div>
                {/* Schedule editor */}
                <div className="rounded-md border p-3 space-y-3">
                  <div className="font-medium text-center sm:text-right">הגדרת שעות לאירוע</div>
                  <div className="grid grid-cols-1 gap-3">
                    <div>
                      <label className="block text-sm mb-1 text-center sm:text-right">תאריך</label>
                      <input
                        type="date"
                        className="w-full border rounded px-2 py-1.5 text-center sm:text-right"
                        value={schedule?.date ?? ""}
                        onChange={(e) => setSchedule((s) => ({ ...(s ?? {}), date: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm mb-1 text-center sm:text-right">שעת פתיחה</label>
                        <input
                          type="time"
                          className="w-full border rounded px-2 py-1.5 text-center"
                          value={schedule?.openTime ?? ""}
                          onChange={(e) => setSchedule((s) => ({ ...(s ?? {}), openTime: e.target.value }))}
                        />
                      </div>
                      <div>
                        <label className="block text-sm mb-1 text-center sm:text-right">שעת סגירה</label>
                        <input
                          type="time"
                          className="w-full border rounded px-2 py-1.5 text-center"
                          value={schedule?.closeTime ?? ""}
                          onChange={(e) => setSchedule((s) => ({ ...(s ?? {}), closeTime: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-3 pt-3">
                    <Checkbox
                      id="requireVerification"
                      checked={!!schedule?.requireVerification}
                      onCheckedChange={(val) => setSchedule((s) => ({ ...(s ?? {}), requireVerification: val === true }))}
                    />
                    <label htmlFor="requireVerification" className="text-sm select-none cursor-pointer">
                      ביצוע אימות מערכת בכניסה
                    </label>
                  </div>
                  <div className="flex flex-col items-center gap-2 pt-2">
                    <div className="flex flex-wrap justify-center gap-2">
                      <Button
                        variant="secondary"
                        disabled={clearingSchedule || testingSchedule}
                        onClick={async () => {
                          if (!selectedEvent) return;
                          const cleared: EventSchedule = { date: "", openTime: "", closeTime: "", requireVerification: schedule?.requireVerification };
                          setClearingSchedule(true);
                          try {
                            await setEventSchedule(getYearKey(), selectedEvent, cleared);
                            setSchedule(cleared);
                          } finally {
                            setClearingSchedule(false);
                          }
                        }}
                      >
                        {clearingSchedule ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            מאתחל…
                          </span>
                        ) : (
                          "איפוס תזמון אירוע"
                        )}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={testingSchedule || clearingSchedule}
                        onClick={async () => {
                          if (!selectedEvent) return;
                          const preset = { ...presetNowPlus2h(), requireVerification: schedule?.requireVerification } as EventSchedule;
                          setTestingSchedule(true);
                          try {
                            setSchedule(preset);
                            await setEventSchedule(getYearKey(), selectedEvent, preset);
                          } finally {
                            setTestingSchedule(false);
                          }
                        }}
                      >
                        {testingSchedule ? (
                          <span className="inline-flex items-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            מגדיר…
                          </span>
                        ) : (
                          "טסטינג"
                        )}
                      </Button>
                    </div>
                    <div className="flex gap-2 justify-center">
                    <Button
                      onClick={async () => {
                        if (!selectedEvent || !schedule) return;
                        setSavingSchedule(true);
                        try {
                          await setEventSchedule(getYearKey(), selectedEvent, schedule);
                        } finally {
                          setSavingSchedule(false);
                        }
                      }}
                      disabled={savingSchedule}
                    >
                      {savingSchedule ? "שומר…" : "שמור הגדרות"}
                    </Button>
                    </div>
                  </div>
                </div>
                
                {/* Participant entries list */}
                {entries.length > 0 ? (
                  <div className="space-y-3">
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
                          <div className="col-span-2 flex items-center justify-center gap-2 pt-1">
                            <span className="inline-flex h-6 min-w-10 items-center justify-center rounded bg-muted px-2 text-xs">
                              {e.entryCount ?? e.quantity ?? ""}
                            </span>
                            <span className={`inline-flex h-6 min-w-10 items-center justify-center rounded px-2 text-xs ${e._redeemedFlag ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                              {e._redeemedFlag ? 'נוצל' : 'לא נוצל'}
                            </span>
                            <span className={`inline-flex h-6 min-w-10 items-center justify-center rounded px-2 text-xs ${e._finalizedFlag ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'}`}>
                              {e._finalizedFlag ? 'ננעל' : 'לא ננעל'}
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
                        <col style={{ width: "10%" }} /> {/* Date */}
                        <col style={{ width: "10%" }} /> {/* Time */}
                        <col style={{ width: "18%" }} /> {/* Participant ID */}
                        <col style={{ width: "8%" }} /> {/* Quantity */}
                        <col style={{ width: "20%" }} /> {/* Name */}
                        <col style={{ width: "12%" }} /> {/* Redeemed */}
                        <col style={{ width: "12%" }} /> {/* Finalized */}
                        <col style={{ width: "10%" }} /> {/* Actions */}
                      </colgroup>
                      <thead className="bg-muted">
                        <tr>
                          <th className="p-2 text-center whitespace-nowrap">תאריך</th>
                          <th className="p-2 text-center whitespace-nowrap">שעה</th>
                          <th className="p-2 text-center whitespace-nowrap">מזהה משתתף</th>
                          <th className="p-2 text-center whitespace-nowrap">כמות</th>
                          <th className="p-2 text-center">שם</th>
                          <th className="p-2 text-center whitespace-nowrap">ניצול שובר</th>
                          <th className="p-2 text-center whitespace-nowrap">ניצול סופי</th>
                          <th className="p-2 text-center whitespace-nowrap">פעולות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map((e: any, idx: number) => (
                          <tr key={idx} className="border-t">
                            <td className="p-2 text-center whitespace-nowrap">{formatDate(e.redeemedAt)}</td>
                            <td className="p-2 text-center whitespace-nowrap">{formatTime(e.redeemedAt)}</td>
                            <td className="p-2 text-center whitespace-nowrap">{e.participantId}</td>
                            <td className="p-2 text-center whitespace-nowrap">{e.entryCount ?? e.quantity ?? ""}</td>
                            <td className="p-2 text-center truncate" title={e.participantName ?? ""}>{e.participantName ?? ""}</td>
                            <td className="p-2 text-center whitespace-nowrap">
                              <span className={`inline-flex h-6 min-w-10 items-center justify-center rounded px-2 text-xs ${e._redeemedFlag ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                                {e._redeemedFlag ? 'כן' : '—'}
                              </span>
                            </td>
                            <td className="p-2 text-center whitespace-nowrap">
                              <span className={`inline-flex h-6 min-w-10 items-center justify-center rounded px-2 text-xs ${e._finalizedFlag ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'}`}>
                                {e._finalizedFlag ? 'כן' : '—'}
                              </span>
                            </td>
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
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <p>לחץ על "טען רשימת משתתפים" כדי לראות את המשתתפים שנכנסו לאירוע</p>
                  </div>
                )}
              </div>
            )}
              </TabsContent>

              <TabsContent value="participants" className="space-y-6">
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="חפש לפי מזהה או שם"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') runSearch(); }}
                    className="max-w-sm"
                  />
                  <Button onClick={runSearch} disabled={searching}>{searching ? "מחפש…" : "חפש"}</Button>
                </div>

                {/* Results */}
                {results.length > 0 && (
                  <div className="rounded-md border divide-y">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => loadParticipantEvents(r.id)}
                        className={`w-full text-right p-3 hover:bg-muted/50 ${selectedPid === r.id ? 'bg-muted/50' : ''}`}
                      >
                        <div className="font-medium">{r.name ?? r.id}</div>
                        <div className="text-xs text-muted-foreground flex gap-3">
                          <span>מזהה: {r.id}</span>
                          {r.hotel ? <span>מלון: {r.hotel}</span> : null}
                          {typeof r.adults === 'number' ? <span>מבוגרים: {r.adults}</span> : null}
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {/* Participant events table */}
                {selectedPid && (
                  <div className="space-y-2">
                    <h3 className="font-bold text-lg">ניהול אירועים למשתתף {selectedPid}</h3>
                    {loadingParticipantRows ? (
                      <p className="text-muted-foreground">טוען אירועים…</p>
                    ) : participantRows.length === 0 ? (
                      <p className="text-muted-foreground">לא נמצאו אירועים למשתתף זה.</p>
                    ) : (
                      <div className="overflow-auto rounded-md border">
                        <table className="w-full min-w-[680px] text-sm table-auto">
                          <colgroup>
                            <col style={{ width: "28%" }} /> {/* Event name on the right */}
                            <col style={{ width: "12%" }} /> {/* Quantity */}
                            <col style={{ width: "12%" }} /> {/* Consumed */}
                            <col style={{ width: "16%" }} /> {/* Redeemed */}
                            <col style={{ width: "16%" }} /> {/* Finalized */}
                            <col style={{ width: "16%" }} /> {/* Actions */}
                          </colgroup>
                          <thead className="bg-muted">
                            <tr>
                              <th className="p-2 text-right whitespace-nowrap">שם אירוע</th>
                              <th className="p-2 text-center whitespace-nowrap">כמות</th>
                              <th className="p-2 text-center whitespace-nowrap">נצלו</th>
                              <th className="p-2 text-center whitespace-nowrap">ניצול שובר</th>
                              <th className="p-2 text-center whitespace-nowrap">ניצול סופי</th>
                              <th className="p-2 text-center whitespace-nowrap">פעולות</th>
                            </tr>
                          </thead>
                          <tbody>
                            {participantRows.map((row) => (
                              <tr key={row.eventKey} className="border-t">
                                <td className="p-2 text-right whitespace-nowrap" title={row.name ?? row.eventKey}>
                                  {row.name ?? row.eventKey}
                                </td>
                                <td className="p-2 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-2">
                                    <input
                                      type="number"
                                      inputMode="numeric"
                                      step={1}
                                      min={0}
                                      pattern="\\d*"
                                      className="w-20 border rounded px-2 py-1 text-center"
                                      value={qtyEdits[row.eventKey] ?? ""}
                                      onChange={(e) => {
                                        const v = e.target.value;
                                        // Keep only digits in state for smoother UX
                                        const cleaned = v.replace(/[^0-9]/g, "");
                                        setQtyEdits((m) => ({ ...m, [row.eventKey]: cleaned }));
                                      }}
                                    />
                                    <Button size="sm"
                                      onClick={() => saveQuantityForRow(selectedPid!, row.eventKey)}
                                      disabled={!!savingQty[row.eventKey] || parseQuantityInput(qtyEdits[row.eventKey] ?? "") === null}
                                    >
                                      {savingQty[row.eventKey] ? "שומר…" : "שמור"}
                                    </Button>
                                  </div>
                                </td>
                                <td className="p-2 text-center whitespace-nowrap">{row.consumed}</td>
                                <td className="p-2 text-center whitespace-nowrap">
                                  <span className={`inline-flex h-6 min-w-10 items-center justify-center rounded px-2 text-xs ${row.redeemed ? 'bg-green-100 text-green-800' : 'bg-muted text-muted-foreground'}`}>
                                    {row.redeemed ? 'כן' : 'לא'}
                                  </span>
                                </td>
                                <td className="p-2 text-center whitespace-nowrap">
                                  <span className={`inline-flex h-6 min-w-10 items-center justify-center rounded px-2 text-xs ${row.finalized ? 'bg-red-100 text-red-800' : 'bg-muted text-muted-foreground'}`}>
                                    {row.finalized ? 'כן' : 'לא'}
                                  </span>
                                </td>
                                <td className="p-2 text-center whitespace-nowrap">
                                  <div className="flex items-center justify-center gap-2">
                                    {row.redeemed ? (
                                      <Button size="sm" variant="destructive" onClick={() => toggleRedeemedForParticipant(selectedPid!, row.eventKey, false)}>בטל</Button>
                                    ) : (
                                      <Button size="sm" onClick={() => toggleRedeemedForParticipant(selectedPid!, row.eventKey, true)}>נצל מלא</Button>
                                    )}
                                    <Button size="sm" variant={row.finalized ? "secondary" : "default"} onClick={() => toggleFinalizeForParticipant(selectedPid!, row.eventKey, !row.finalized)}>
                                      {row.finalized ? 'פתח' : 'נעל'}
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <SiteFooter />
      </div>
    </div>
  );
}

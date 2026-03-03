"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Check, Car, Users, Coffee, Sun, X, Trash2, ChevronLeft, ChevronRight, Lock } from "lucide-react";
import type { Thing, Booking } from "@/types";
import { createBooking, cancelBooking, setReminderPreference } from "@/app/[owner-slug]/[thing-slug]/actions";
import ModalShell from "@/components/ModalShell";
import AuthGate from "@/components/AuthGate";

// ── Fairness error → toast copy ────────────────────────────────────────────────
import type { BookingResult } from "@/app/[owner-slug]/[thing-slug]/actions";

function fmtMaxLength(mins: number): string {
  if (mins === 30)  return "30 minutes";
  if (mins === 60)  return "1 hour";
  if (mins === 120) return "2 hours";
  if (mins === 240) return "half a day";
  if (mins === 480) return "one day";
  if (mins % 60 === 0) return `${mins / 60} hours`;
  return `${mins} minutes`;
}

function fmtTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hour   = h % 12 || 12;
  return m === 0 ? `${hour}${suffix}` : `${hour}:${m.toString().padStart(2, "0")}${suffix}`;
}

function bookingErrorToToast(result: Extract<BookingResult, { error: string }>): string {
  switch (result.error) {
    case "MAX_LENGTH":
      return `Sorry, you can't book longer than ${fmtMaxLength(result.maxLengthMins)}.`;
    case "BOOK_AHEAD":
      return "Sorry, you can't book that far ahead.";
    case "AVAIL_HOURS":
      return `Sorry, you can only book ${fmtTime(result.availStart)}–${fmtTime(result.availEnd)}.`;
    case "AVAIL_WEEKENDS":
      return "Sorry, you can only book weekdays.";
    case "MAX_CONCURRENT":
      return `Sorry, you have ${result.currentCount} booking${result.currentCount === 1 ? "" : "s"} already. You'll need to cancel one.`;
    case "OVERLAP":
      return "Sorry, someone's literally just booked this.";
    case "GENERIC":
    default:
      return "Something's gone wobbly. Please try again.";
  }
}

// ── Constants ──────────────────────────────────────────────────────────────────
import { ORANGE_DARK, ORANGE, ORANGE_BOOKED, ORANGE_MID, ORANGE_LIGHT, GREY, GREY_LIGHT, GREY_HINT, DARK, WHITE, BORDER, SYS, SIZE_XS, SIZE_SM, SIZE_BASE, W_REGULAR, W_MEDIUM, W_BOLD } from "@/lib/constants";

const SLOT_H   = 36;
const HAIRLINE = 1;
const PILL_GAP = 5;

const DAYS      = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
const MONTHS    = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const FULL_DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];

const ICON_MAP: Record<string, React.ComponentType<{ size: number; strokeWidth: number; color: string }>> = {
  car: Car, users: Users, coffee: Coffee, sun: Sun,
};

const S_IDLE    = "idle";
const S_PICKING = "picking";
const S_SEEN    = "seen";
const S_READY   = "ready";
const S_MODAL   = "modal";

const ALL_SLOTS: string[] = [];
for (let h = 0; h < 24; h++) {
  ALL_SLOTS.push(`${h}:00`);
  ALL_SLOTS.push(`${h}:30`);
}
const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i);

function slotY(i: number) {
  return Math.floor(i / 2) * (2 * SLOT_H + HAIRLINE + PILL_GAP) + (i % 2) * (SLOT_H + HAIRLINE);
}
const totalH = 24 * (2 * SLOT_H + HAIRLINE + PILL_GAP);

function slotIdx(s: string) { return ALL_SLOTS.indexOf(s); }

function fmtHour(n: number) {
  if (n === 0) return "12am";
  if (n < 12) return `${n}am`;
  if (n === 12) return "12pm";
  return `${n - 12}pm`;
}

function fmtSlot(s: string) {
  if (!s) return "";
  const [h, m] = s.split(":");
  const n = parseInt(h);
  const base = n === 0 ? "12" : n <= 12 ? `${n}` : `${n - 12}`;
  const suffix = n < 12 ? "am" : "pm";
  return m === "30" ? `${base}:30${suffix}` : `${base}${suffix}`;
}

function fmtEndTime(endSlot: string) {
  const [h, m] = endSlot.split(":").map(Number);
  let mins = h * 60 + m + 30;
  if (mins >= 24 * 60) mins = 24 * 60;
  const nh = Math.floor(mins / 60) % 24;
  const nm = mins % 60;
  return fmtSlot(`${nh}:${nm === 0 ? "00" : "30"}`);
}

function bookingToSlots(b: Booking, dateStr: string): string[] {
  const start = new Date(b.starts_at);
  const end   = new Date(b.ends_at);
  const localDate = start.toLocaleDateString("en-CA");
  if (localDate !== dateStr) return [];
  const slots: string[] = [];
  const cur = new Date(start);
  while (cur < end) {
    slots.push(`${cur.getHours()}:${cur.getMinutes() === 0 ? "00" : "30"}`);
    cur.setMinutes(cur.getMinutes() + 30);
  }
  return slots;
}

function getWeekDates(offset = 0) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

function TickRow({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      <div style={{ width: "16px", height: "16px", borderRadius: "50%", background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Check size={9} strokeWidth={3} color={WHITE} />
      </div>
      <span style={{ fontSize: "14px", fontWeight: W_MEDIUM, color: DARK, fontFamily: SYS }}>{label}</span>
    </div>
  );
}

function Toast({ message, visible }: { message: string; visible: boolean }) {
  return (
    <div style={{
      position: "fixed", bottom: "80px", left: "50%",
      transform: `translateX(-50%) translateY(${visible ? 0 : 8}px)`,
      opacity: visible ? 1 : 0, transition: "all 0.2s ease",
      background: "rgba(80,74,68,0.82)", color: WHITE,
      fontSize: SIZE_SM, fontWeight: W_MEDIUM, fontFamily: SYS,
      padding: "10px 20px", borderRadius: "24px",
      pointerEvents: "none", zIndex: 300, whiteSpace: "nowrap",
    }}>
      {message}
    </div>
  );
}

interface BookerSession {
  email:     string;
  firstName: string;
}

interface CalendarProps {
  thing:            Thing;
  orgName:          string;
  ownerSlug:        string;
  thingSlug:        string;
  bookings:         Booking[];
  bookerSession:    BookerSession | null;
}

export default function Calendar({ thing, orgName, ownerSlug, thingSlug, bookings, bookerSession }: CalendarProps) {
  const [weekOffset, setWeekOffset]   = useState(0);
  const [selectedDay, setSelectedDay] = useState(0);

  const [today, setToday] = useState<Date | null>(null);
  useEffect(() => {
    const now = new Date();
    setToday(now);
    const day = now.getDay();
    setSelectedDay(day === 0 ? 6 : day - 1);
  }, []);
  const [phase, setPhase]           = useState(S_IDLE);
  const [start, setStart]           = useState<string | null>(null);
  const [end, setEnd]               = useState<string | null>(null);
  const [confirmed, setConfirmed]     = useState(false);
  const [confirmedBookingId, setConfirmedBookingId] = useState<string | null>(null);
  const [reminderOptIn, setReminderOptIn] = useState(false);
  const [reminderNote, setReminderNote]   = useState("");
  const [reminderSaved, setReminderSaved] = useState(false);
  // Identity comes from the server-side session cookie (set by the magic link flow).
  // We keep local state so returning-device fallback (localStorage) can still populate them.
  const [bookerName, setBookerName]   = useState<string>(bookerSession?.firstName ?? "");
  const [bookerEmail, setBookerEmail] = useState<string>(bookerSession?.email ?? "");
  const [submitting, setSubmitting]   = useState(false);
  const [cancelTarget, setCancelTarget] = useState<{ id: string; timeStr: string } | null>(null);
  const [toast, setToast]             = useState({ visible: false, message: "" });

  const scrollRef   = useRef<HTMLDivElement>(null);
  const calRef      = useRef<HTMLDivElement>(null);
  const hasScrolled = useRef(false);
  const [calH, setCalH] = useState(300);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hintTimer  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router     = useRouter();

  // ── Pending / activation state ────────────────────────────────────────────
  const [showGate, setShowGate]                       = useState(false);
  const ThingIcon = ICON_MAP[thing.icon] || Car;
  const dates     = today ? getWeekDates(weekOffset) : Array.from({ length: 7 }, () => new Date(0));
  const selDate   = dates[selectedDay];
  const dateStr   = selDate.toLocaleDateString("en-CA");

  // Is this a returning booker on this device?
  // A booker is "known" if they authenticated via the gate (session cookie)
  // or if they previously booked on this device (localStorage fallback).
  const isKnownBooker = bookerSession !== null || (bookerName !== "" && bookerEmail !== "");

  // Convert a slot string ("10:00") + the selected date into an ISO timestamp
  function slotToISO(slot: string, plusMins = 0): string {
    const [h, m] = slot.split(":").map(Number);
    const d = new Date(selDate);
    d.setHours(h, m + plusMins, 0, 0);
    return d.toISOString();
  }

  const { bookingMap, bookingIdMap, YOURS } = useMemo(() => {
    const bookingMap: Record<string, string> = {};
    const bookingIdMap: Record<string, string> = {};
    bookings.forEach((b) => {
      bookingToSlots(b, dateStr).forEach((slot) => {
        bookingMap[slot] = b.booker_name;
        bookingIdMap[slot] = b.id;
      });
    });
    const YOURS: string[] = Object.entries(bookingMap)
      .filter(([, name]) => name === bookerName && bookerName !== "")
      .map(([slot]) => slot);
    return { bookingMap, bookingIdMap, YOURS };
  }, [bookings, dateStr, bookerName]);

  const dateLabel = `${FULL_DAYS[selectedDay]} ${selDate.getDate()} ${MONTHS[selDate.getMonth()]}`;

  // If we have a session from the cookie, that's authoritative.
  // Otherwise fall back to localStorage for any users pre-gate-rollout.
  useEffect(() => {
    if (bookerSession) return; // Session cookie wins — no localStorage needed
    const storedName  = localStorage.getItem("bookerName");
    const storedEmail = localStorage.getItem("bookerEmail");
    if (storedName)  setBookerName(storedName);
    if (storedEmail && storedEmail.includes("@") && storedEmail.includes(".")) {
      setBookerEmail(storedEmail);
    } else if (storedEmail) {
      localStorage.removeItem("bookerEmail");
      localStorage.removeItem("bookerName");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!calRef.current) return;
    const ro = new ResizeObserver((e) => {
      for (const ev of e) setCalH(ev.contentRect.height);
    });
    ro.observe(calRef.current);
    return () => ro.disconnect();
  }, []);

  // Reset the scroll gate whenever the user navigates to a different day or week
  useEffect(() => { hasScrolled.current = false; }, [selectedDay, weekOffset]);

  useEffect(() => {
    if (!scrollRef.current || hasScrolled.current) return;
    // 24/7 resource → open at 8am. Otherwise open at avail_start.
    const availStart = (thing.avail_start as string) ?? "09:00";
    const scrollTo = availStart === "00:00" ? "08:00" : availStart;
    const [h, m] = scrollTo.split(":").map(Number);
    const startSlotIdx = h * 2 + (m >= 30 ? 1 : 0);
    scrollRef.current.scrollTop = Math.max(0, slotY(startSlotIdx) - 16);
    hasScrolled.current = true;
  }, [calH, selectedDay, weekOffset]);

  const showToast = useCallback((msg: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast({ visible: true, message: msg });
    toastTimer.current = setTimeout(() => setToast((t) => ({ ...t, visible: false })), 2000);
  }, []);

  const reset = () => {
    if (seenTimer.current) clearTimeout(seenTimer.current);
    if (hintTimer.current) clearTimeout(hintTimer.current);
    setPhase(S_IDLE); setStart(null); setEnd(null); setConfirmed(false);
    setConfirmedBookingId(null); setReminderOptIn(false); setReminderNote(""); setReminderSaved(false);
  };

  const changeDay = (i: number) => { setSelectedDay(i); reset(); };
  const changeWeek = (dir: number) => { setWeekOffset((w) => w + dir); reset(); };

  const inRange = (s: string) => {
    if (!start) return false;
    const si = slotIdx(start);
    const ei = end ? slotIdx(end) : si;
    const idx = slotIdx(s);
    if (idx < 0) return false;
    return idx >= Math.min(si, ei) && idx <= Math.max(si, ei);
  };

  const rangeRadius = (slot: string): string => {
    if (!start) return "8px";
    const si = slotIdx(start);
    const ei = end ? slotIdx(end) : si;
    const lo = Math.min(si, ei);
    const hi = Math.max(si, ei);
    const idx = slotIdx(slot);
    if (lo === hi) return "8px";
    if (idx === lo) return "8px 8px 0 0";
    if (idx === hi) return "0 0 8px 8px";
    return "0";
  };

  const hasConflict = (a: string, b: string) => {
    const lo = Math.min(slotIdx(a), slotIdx(b));
    const hi = Math.max(slotIdx(a), slotIdx(b));
    return ALL_SLOTS.slice(lo, hi + 1).some((s) => bookingMap[s] && !YOURS.includes(s));
  };

  const handleSlot = (s: string) => {
    if (bookingMap[s] && !YOURS.includes(s)) { showToast("Sorry, not available."); return; }
    if (YOURS.includes(s)) {
      const id = bookingIdMap[s];
      const slotTimeStr = `${fmtSlot(s)} – ${fmtEndTime(s)}`;
      setCancelTarget({ id, timeStr: slotTimeStr });
      return;
    }

    if (phase === S_IDLE || phase === S_READY) {
      setStart(s); setEnd(null); setPhase(S_PICKING);
      if (hintTimer.current) clearTimeout(hintTimer.current);
      hintTimer.current = setTimeout(() => showToast("Choose the end of your session"), 4000);
      return;
    }
    if (phase === S_PICKING) {
      if (hasConflict(start!, s)) {
        showToast("Sorry, not available.");
        setStart(s); setEnd(null); setPhase(S_PICKING); return;
      }
      const lo = Math.min(slotIdx(start!), slotIdx(s));
      const hi = Math.max(slotIdx(start!), slotIdx(s));
      setStart(ALL_SLOTS[lo]); setEnd(ALL_SLOTS[hi]); setPhase(S_SEEN);
      if (seenTimer.current) clearTimeout(seenTimer.current);
      seenTimer.current = setTimeout(() => setPhase(S_READY), 500);
    }
  };

  const handleSelectionTap = () => {
    if (phase !== S_READY) return;
    if (!isKnownBooker) {
      setShowGate(true); // auth first — onDone resumes to S_MODAL
    } else {
      setPhase(S_MODAL);
    }
  };

  const slotBg = (s: string) => {
    if (!inRange(s)) return ORANGE_LIGHT;
    // S_PICKING: only start slot is active — keep it light so "From X" label is readable
    if (phase === S_PICKING) return ORANGE_LIGHT;
    // S_SEEN: range selected but not yet confirmed — mid orange so "Until X" label is readable
    if (phase === S_SEEN) return ORANGE_MID;
    // S_READY: confirmed range, full orange — "Book it" label renders white on orange
    return ORANGE;
  };

  const startLabel = (slot: string) => {
    if (slot !== start) return null;
    if (phase === S_PICKING || phase === S_SEEN)
      return <span style={{ fontSize: "11px", fontWeight: W_MEDIUM, color: ORANGE, fontFamily: SYS }}>From {fmtSlot(start)}</span>;
    if (phase === S_READY) {
      const rangeStr = end && end !== start ? `${fmtSlot(start)} – ${fmtEndTime(end)}` : `${fmtSlot(start)} – ${fmtEndTime(start)}`;
      return (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", fontFamily: SYS }}>
          <span style={{ fontSize: "12px", fontWeight: W_MEDIUM, color: WHITE }}>{rangeStr}</span>
          <span style={{ fontSize: "12px", fontWeight: W_MEDIUM, color: ORANGE, background: WHITE, borderRadius: "20px", padding: "3px 10px", flexShrink: 0 }}>Book it</span>
        </div>
      );
    }
    return null;
  };

  const endLabel = (slot: string) => {
    if (!end || slot !== end || slot === start) return null;
    const untilStr = fmtEndTime(end);
    if (phase === S_SEEN)
      return <span style={{ fontSize: "11px", fontWeight: W_MEDIUM, color: "rgba(232,114,42,0.8)", fontFamily: SYS }}>Until {untilStr}</span>;
    if (phase === S_READY)
      return null;
    return null;
  };

  const timeStr = start
    ? end && end !== start
      ? `${fmtSlot(start)} – ${fmtEndTime(end)}`
      : `${fmtSlot(start)} – ${fmtEndTime(start)}`
    : "";

  type Group = {
    type: string; name?: string; id?: string;
    startIdx: number; endIdx: number;
    s1?: string; s2?: string; slot?: string;
  };

  const groups = useMemo<Group[]>(() => {
    const groups: Group[] = [];
    let i = 0;
    while (i < ALL_SLOTS.length) {
      const slot = ALL_SLOTS[i];
      const id   = bookingIdMap[slot];
      const name = bookingMap[slot];
      const yours = YOURS.includes(slot);

      if (id && !yours) {
        // Merge only slots belonging to the same booking ID
        let j = i;
        while (j < ALL_SLOTS.length && bookingIdMap[ALL_SLOTS[j]] === id) j++;
        groups.push({ type: "booking", name, id, startIdx: i, endIdx: j - 1 });
        i = j;
      } else if (yours) {
        // Merge only slots belonging to the same booking ID
        let j = i;
        while (j < ALL_SLOTS.length && bookingIdMap[ALL_SLOTS[j]] === id) j++;
        groups.push({ type: "yours", id, startIdx: i, endIdx: j - 1 });
        i = j;
      } else {
        const next = ALL_SLOTS[i + 1];
        const sameHour = next && slot.split(":")[0] === next.split(":")[0];
        if (sameHour && !bookingMap[next] && !YOURS.includes(next)) {
          groups.push({ type: "pill", startIdx: i, endIdx: i + 1, s1: slot, s2: next });
          i += 2;
        } else {
          groups.push({ type: "half", startIdx: i, endIdx: i, slot });
          i++;
        }
      }
    }
    return groups;
  }, [bookingMap, bookingIdMap, YOURS]);
  const groupH = (si: number, ei: number) => slotY(ei) + SLOT_H - slotY(si);

  return (
    <>
      <style>{`
        button { font-family: 'Poppins', sans-serif; outline: none; }
        button:focus, button:focus-visible { outline: none; }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes readyPop { 0% { filter: brightness(1); } 50% { filter: brightness(1.06); } 100% { filter: brightness(1); } }
        .ready-pop { animation: readyPop 0.3s ease; }
        .cal-scroll::-webkit-scrollbar { width: 5px; display: block; }
        .cal-scroll::-webkit-scrollbar-track { background: transparent; }
        .cal-scroll::-webkit-scrollbar-thumb { background: rgba(232,114,42,0.2); border-radius: 99px; }
        .cal-scroll::-webkit-scrollbar-thumb:hover { background: rgba(232,114,42,0.45); }
        .cal-scroll { scrollbar-width: thin; scrollbar-color: rgba(232,114,42,0.2) transparent; }
        @media (max-width: 779px) {
          .cal-scroll::-webkit-scrollbar { display: none; }
          .cal-scroll { scrollbar-width: none; }
        }
      `}</style>

      {/* Card */}
      <div style={{
        height: "calc(100dvh - 72px)",
        minHeight: "520px",
        background: WHITE,
        borderRadius: "24px",
        boxShadow: "0 8px 48px rgba(0,0,0,0.09)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        fontFamily: SYS,
      }}>

        {/* Card header */}
        <div style={{ flexShrink: 0, padding: "22px 20px 0" }}>

          {/* Thing identity */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "4px" }}>
            <div style={{
              width: "38px", height: "38px", borderRadius: "50%",
              background: ORANGE,
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <ThingIcon size={17} strokeWidth={1.75} color={WHITE} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: "19px", fontWeight: W_BOLD, color: DARK, letterSpacing: "-0.4px", overflowWrap: "break-word", wordBreak: "break-word" }}>
                {thing.name}
              </div>
              {orgName && (
                <div style={{ fontSize: SIZE_XS, fontWeight: W_BOLD, letterSpacing: "1px", textTransform: "uppercase", color: GREY_LIGHT, marginTop: "2px" }}>
                  {orgName}
                </div>
              )}
            </div>

            {/* Lock / Tick */}
            <button
              onClick={() => { if (!bookerSession) setShowGate(true); }}
              style={{ width: "32px", height: "32px", borderRadius: "50%", background: ORANGE_LIGHT, border: "none", cursor: bookerSession ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}
            >
              {bookerSession ? (
                <Check size={14} strokeWidth={2.5} color={ORANGE} />
              ) : (
                <Lock size={13} strokeWidth={2.5} color={ORANGE} />
              )}
            </button>
          </div>

          {/* Day strip */}
          <div style={{ display: "grid", gridTemplateColumns: "16px 1fr 1fr 1fr 1fr 1fr 1fr 1fr 16px", gap: "1px", alignItems: "center", marginBottom: "12px", marginTop: "16px" }}>
            <button onClick={() => changeWeek(-1)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center", color: weekOffset <= 0 ? GREY_HINT : "#aaa" }}><ChevronLeft size={26} strokeWidth={1.75} /></button>
            {DAYS.map((day, i) => {
              const d = dates[i];
              const sel = i === selectedDay;
              const isToday = today !== null && d.toDateString() === today.toDateString();
              return (
                <button key={day} onClick={() => changeDay(i)} style={{
                  background: sel ? ORANGE_LIGHT : "transparent",
                  border: "none", borderRadius: "8px", padding: "6px 1px",
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "3px",
                }}>
                  <span style={{ fontSize: "8px", fontWeight: W_MEDIUM, letterSpacing: "0.4px", textTransform: "uppercase", color: sel ? ORANGE : "#ccc" }}>{day}</span>
                  <span style={{ fontSize: "14px", fontWeight: isToday ? W_BOLD : sel ? W_BOLD : W_REGULAR, color: sel ? ORANGE : isToday ? DARK : GREY_LIGHT }}>{d.getDate()}</span>
                  {isToday && !sel && <div style={{ width: "3px", height: "3px", borderRadius: "50%", background: ORANGE }} />}
                </button>
              );
            })}
            <button onClick={() => changeWeek(1)} style={{ background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center", color: "#aaa" }}><ChevronRight size={26} strokeWidth={1.75} /></button>
          </div>

          {/* Date row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "12px", paddingBottom: "14px", borderTop: `1px solid ${BORDER}` }}>
            <span style={{ fontSize: SIZE_BASE, fontWeight: W_BOLD, color: DARK, letterSpacing: "-0.3px" }}>
              {dateLabel}
            </span>
            {phase !== S_IDLE && (
              <button onClick={reset} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", padding: "4px" }}>
                <X size={15} strokeWidth={2} />
              </button>
            )}
          </div>
        </div>

        {/* Calendar scroll area */}
        <div ref={calRef} style={{ flex: 1, minHeight: 0, position: "relative", overflow: "hidden" }}>
          <div
            ref={scrollRef}
            className="cal-scroll"
            style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "10px 16px 10px 16px" }}
          >
            <div style={{ position: "relative", height: `${totalH}px`, paddingLeft: "40px" }}>

              {ALL_HOURS.map((h) => (
                <div key={h} style={{ position: "absolute", left: 0, top: `${slotY(h * 2)}px`, width: "36px", height: `${SLOT_H}px`, display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: SIZE_XS, color: "#ccc", fontWeight: W_MEDIUM }}>{fmtHour(h)}</span>
                </div>
              ))}

              <div style={{ position: "absolute", left: "40px", right: 0, top: 0 }}>

                {/* ── Gap fill: underlay covering PILL_GAP between groups — colour matches phase ── */}
                {start && end && (() => {
                  const lo = Math.min(slotIdx(start), slotIdx(end));
                  const hi = Math.max(slotIdx(start), slotIdx(end));
                  const fillBg = phase === S_READY ? ORANGE : ORANGE_MID;
                  return (
                    <div style={{
                      position: "absolute",
                      top: slotY(lo),
                      left: 0,
                      right: 0,
                      height: slotY(hi) + SLOT_H - slotY(lo),
                      background: fillBg,
                      borderRadius: "8px",
                      pointerEvents: "none",
                      zIndex: 0,
                    }} />
                  );
                })()}

                {groups.map((group, gi) => {
                  const top    = slotY(group.startIdx);
                  const height = groupH(group.startIdx, group.endIdx);

                  if (group.type === "booking") return (
                    <div key={`booking-${group.startIdx}`} onClick={() => showToast("Sorry, not available.")}
                      style={{ position: "absolute", top, left: 0, right: 0, height, background: ORANGE_BOOKED, borderRadius: "8px", display: "flex", alignItems: "flex-start", padding: "8px 11px", cursor: "pointer" }}>
                      <span style={{ fontSize: "11px", fontWeight: W_MEDIUM, color: ORANGE_DARK }}>{group.name}</span>
                    </div>
                  );

                  if (group.type === "yours") return (
                    <div
                    key={`yours-${group.startIdx}`}
                    onClick={() => {
                      const s = ALL_SLOTS[group.startIdx];
                      const e = ALL_SLOTS[group.endIdx];
                      setCancelTarget({ id: group.id!, timeStr: `${fmtSlot(s)} – ${fmtEndTime(e)}` });
                    }}
                    style={{ position: "absolute", top, left: 0, right: 0, height, background: ORANGE, borderRadius: "8px", display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "8px 11px", cursor: "pointer" }}>
                      <span style={{ fontSize: "11px", fontWeight: W_BOLD, color: WHITE }}>Your booking</span>
                      <Trash2 size={13} strokeWidth={2} color="rgba(255,255,255,0.6)" />
                    </div>
                  );

                  if (group.type === "pill") {
                    const a1 = inRange(group.s1!);
                    const a2 = inRange(group.s2!);
                    const anyA = a1 || a2;
                    const bothActive = a1 && a2;
                    const ready = anyA && phase === S_READY;

                    // Wrapper radius: driven by range position when both slots active
                    let wrapRadius = "8px";
                    if (bothActive && start) {
                      const lo = Math.min(slotIdx(start), end ? slotIdx(end) : slotIdx(start));
                      const hi = Math.max(slotIdx(start), end ? slotIdx(end) : slotIdx(start));
                      const topR = slotIdx(group.s1!) === lo ? "8px" : "0";
                      const botR = slotIdx(group.s2!) === hi ? "8px" : "0";
                      wrapRadius = `${topR} ${topR} ${botR} ${botR}`;
                    }

                    return (
                      <div key={`pill-${group.startIdx}`}
                        className={ready ? "ready-pop" : ""}
                        onClick={ready ? handleSelectionTap : undefined}
                        style={{ position: "absolute", top, left: 0, right: 0, height,
                          borderRadius: wrapRadius, overflow: "hidden",
                          border: bothActive ? "none" : "2px solid transparent",
                          boxSizing: "border-box", cursor: ready ? "pointer" : "default",
                          transition: "border 0.15s", zIndex: 1 }}>
                        <button
                          onClick={ready ? handleSelectionTap : () => handleSlot(group.s1!)}
                          style={{ display: "flex", alignItems: "flex-start", paddingLeft: "11px", paddingTop: "14px", width: "100%", height: `${SLOT_H}px`,
                            background: slotBg(group.s1!), border: "none",
                            borderBottom: bothActive ? "none" : `${HAIRLINE}px solid rgba(232,114,42,0.1)`,
                            outline: a1 && !a2 ? `2px solid ${ORANGE}` : "none", outlineOffset: "-2px",
                            borderRadius: a1 && !a2 ? rangeRadius(group.s1!) : "0",
                            cursor: "pointer", boxSizing: "border-box", textAlign: "left", transition: "background 0.3s" }}>
                          {startLabel(group.s1!)}
                          {endLabel(group.s1!)}
                        </button>
                        <button
                          onClick={ready ? handleSelectionTap : () => handleSlot(group.s2!)}
                          style={{ display: "flex", alignItems: "center", paddingLeft: "11px", width: "100%", height: `${SLOT_H}px`,
                            background: slotBg(group.s2!), border: "none",
                            outline: a2 && !a1 ? `2px solid ${ORANGE}` : "none", outlineOffset: "-2px",
                            borderRadius: a2 && !a1 ? rangeRadius(group.s2!) : "0",
                            cursor: "pointer", boxSizing: "border-box", textAlign: "left", transition: "background 0.3s" }}>
                          {endLabel(group.s2!)}
                          {startLabel(group.s2!)}
                        </button>
                      </div>
                    );
                  }

                  const slot = group.slot!;
                  const active = inRange(slot);
                  const ready = active && phase === S_READY;

                  return (
                    <button key={`half-${group.startIdx}`}
                      className={ready ? "ready-pop" : ""}
                      onClick={ready ? handleSelectionTap : () => handleSlot(slot)}
                      style={{ position: "absolute", top, left: 0, right: 0, height: `${SLOT_H}px`,
                        background: slotBg(slot),
                        border: active ? `2px solid ${ORANGE}` : "2px solid transparent",
                        borderRadius: active ? rangeRadius(slot) : "8px", cursor: "pointer",
                        display: "flex", alignItems: "center", paddingLeft: "11px",
                        boxSizing: "border-box", textAlign: "left", transition: "background 0.3s, border 0.15s",
                        zIndex: 1 }}>
                      {startLabel(slot)}
                      {endLabel(slot)}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
          {/* Fade at top of scroll */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "32px", background: "linear-gradient(to top, transparent, rgba(255,255,255,0.98))", pointerEvents: "none" }} />
          {/* Fade at bottom of scroll */}
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: "32px", background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.98))", pointerEvents: "none" }} />
        </div>

      </div>

      <Toast message={toast.message} visible={toast.visible} />

      {/* Modal */}
      {phase === S_MODAL && (
        <ModalShell onBackdropClick={reset}>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            {!confirmed ? (
              <>
                <div style={{ fontSize: "22px", fontWeight: W_BOLD, color: DARK, letterSpacing: "-0.4px", marginBottom: "20px" }}>
                  Book {thing.name}
                </div>

                {/* Time + date summary */}
                <div style={{ background: ORANGE_LIGHT, borderRadius: "14px", padding: "16px 18px", display: "flex", flexDirection: "column", gap: "10px", marginBottom: "20px" }}>
                  <TickRow label={timeStr} />
                  <TickRow label={dateLabel} />
                </div>

                {/* Booking identity — always known by this point (gate intercepts otherwise) */}
                <div style={{ fontSize: SIZE_SM, color: GREY_LIGHT, marginBottom: "20px", fontFamily: SYS }}>
                  Booking as <span style={{ color: DARK, fontWeight: W_MEDIUM }}>
                    {bookerSession?.firstName ?? bookerName}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "10px" }}>
                  <button onClick={reset}
                    className="btn btn-secondary btn-sm"
                    style={{ flex: 1 }}>
                    Not now
                  </button>
                  <button
                    disabled={submitting}
                    onClick={async () => {
                      if (!start) return;
                      const name  = bookerSession?.firstName ?? bookerName;
                      const email = bookerSession?.email     ?? bookerEmail;
                      if (!name || !email) return;
                      setSubmitting(true);
                      const endSlot = end ?? start;
                      const result = await createBooking({
                        thingId:     thing.id,
                        bookerName:  name,
                        bookerEmail: email,
                        startsAt:    slotToISO(start),
                        endsAt:      slotToISO(endSlot, 30),
                      });
                      setSubmitting(false);
                      if ("error" in result) {
                        showToast(bookingErrorToToast(result));
                        reset();
                        return;
                      }
                      setConfirmedBookingId(result.bookingId);
                      setConfirmed(true);
                      router.refresh();
                    }}
                    style={{
                      flex: 1, padding: "14px", borderRadius: "12px", border: "none",
                      background: submitting ? ORANGE_MID : ORANGE,
                      cursor: submitting ? "default" : "pointer",
                      fontSize: "14px", fontWeight: W_MEDIUM,
                      color: submitting ? ORANGE : WHITE,
                      fontFamily: SYS, transition: "all 0.15s",
                    }}>
                    {submitting ? "Booking…" : "Confirm"}
                  </button>
                </div>
              </>
            ) : (
              <div style={{ textAlign: "center", padding: "8px 0", position: "relative" }}>
                <button onClick={reset} style={{ position: "absolute", top: 0, right: 0, background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "22px", lineHeight: 1, padding: "4px" }}>
                  ×
                </button>
                <div style={{ width: "52px", height: "52px", borderRadius: "50%", background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px" }}>
                  <Check size={26} strokeWidth={2.5} color={WHITE} />
                </div>
                <div style={{ fontSize: "22px", fontWeight: W_BOLD, color: DARK, marginBottom: "12px", letterSpacing: "-0.4px" }}>
                  All booked, {bookerSession?.firstName ?? bookerName}
                </div>
                <div style={{ fontSize: "14px", color: GREY_LIGHT, lineHeight: 1.6, marginBottom: "24px" }}>
                  Check your email for a calendar invite.
                </div>

                {/* Reminder opt-in — YES / NO */}
                <div style={{ borderTop: `1px solid ${BORDER}`, paddingTop: "20px" }}>

                  {/* Default — show YES / NO */}
                  {!reminderOptIn && !reminderSaved && (
                    <>
                      <div style={{ fontSize: "14px", fontWeight: W_MEDIUM, color: DARK, textAlign: "center", marginBottom: "14px", fontFamily: SYS }}>
                        Want a reminder?
                      </div>
                      <div style={{ display: "flex", gap: "10px" }}>
                        <button
                          onClick={reset}
                          style={{
                            flex: 1, padding: "12px", borderRadius: "12px",
                            border: `1.5px solid ${BORDER}`, background: WHITE,
                            color: GREY_LIGHT, fontFamily: SYS, fontSize: SIZE_SM, fontWeight: W_MEDIUM,
                            cursor: "pointer",
                          }}
                        >
                          No thanks
                        </button>
                        <button
                          onClick={() => setReminderOptIn(true)}
                          style={{
                            flex: 1, padding: "12px", borderRadius: "12px",
                            border: `1.5px solid ${ORANGE}`, background: ORANGE_LIGHT,
                            color: ORANGE, fontFamily: SYS, fontSize: SIZE_SM, fontWeight: W_BOLD,
                            cursor: "pointer",
                          }}
                        >
                          Yes please
                        </button>
                      </div>
                    </>
                  )}

                  {/* Yes — note field + save */}
                  {reminderOptIn && !reminderSaved && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <input
                        autoFocus
                        type="text"
                        placeholder="What's it for? e.g. Meeting with Colin"
                        value={reminderNote}
                        onChange={e => setReminderNote(e.target.value)}
                        style={{
                          width: "100%", padding: "13px 16px", borderRadius: "12px",
                          border: `1.5px solid ${BORDER}`, background: ORANGE_LIGHT,
                          fontSize: SIZE_SM, fontWeight: W_REGULAR, fontFamily: SYS,
                          color: DARK, outline: "none", boxSizing: "border-box" as const,
                        }}
                      />
                      <button
                        onClick={async () => {
                          if (!confirmedBookingId) return;
                          await setReminderPreference({ bookingId: confirmedBookingId, optIn: true, note: reminderNote });
                          setReminderSaved(true);
                        }}
                        style={{
                          width: "100%", padding: "13px", borderRadius: "12px", border: "none",
                          background: ORANGE, color: WHITE,
                          fontFamily: SYS, fontSize: SIZE_SM, fontWeight: W_BOLD, cursor: "pointer",
                        }}
                      >
                        Save reminder
                      </button>
                    </div>
                  )}

                  {/* Saved — in-place confirmation */}
                  {reminderSaved && (
                    <div style={{ textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", padding: "4px 0" }}>
                      <div style={{
                        width: "36px", height: "36px", borderRadius: "50%", background: ORANGE_LIGHT,
                        display: "flex", alignItems: "center", justifyContent: "center",
                      }}>
                        <Check size={16} strokeWidth={2.5} color={ORANGE} />
                      </div>
                      <div style={{ fontSize: SIZE_BASE, fontWeight: W_BOLD, color: DARK, fontFamily: SYS }}>
                        Reminder set
                      </div>
                      {reminderNote && (
                        <div style={{ fontSize: SIZE_SM, color: GREY, fontFamily: SYS }}>
                          &ldquo;{reminderNote}&rdquo;
                        </div>
                      )}
                      <div style={{ fontSize: "12px", color: GREY_LIGHT, fontFamily: SYS }}>
                        We&rsquo;ll email you the morning before.
                      </div>
                    </div>
                  )}

                </div>
              </div>
            )}
          </div>
        </ModalShell>
      )}
      {/* Cancel modal */}
      {cancelTarget && (
        <ModalShell onBackdropClick={() => setCancelTarget(null)}>
          <div
            onMouseDown={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: "22px", fontWeight: W_BOLD, color: DARK, letterSpacing: "-0.4px", marginBottom: "6px" }}>
              Cancel your booking?
            </div>
            <div style={{ fontSize: SIZE_SM, color: GREY_LIGHT, marginBottom: "24px", fontFamily: SYS }}>
              {thing.name} · {cancelTarget.timeStr} · {dateLabel}
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button
                onClick={() => setCancelTarget(null)}
                className="btn btn-secondary btn-sm"
                style={{ flex: 1 }}>
                Keep it
              </button>
              <button
                onClick={async () => {
                  const result = await cancelBooking(cancelTarget.id);
                  if ("error" in result) { showToast(result.error); }
                  setCancelTarget(null);
                  router.refresh();
                }}
                className="btn btn-primary btn-sm"
                style={{ flex: 1 }}>
                Cancel it
              </button>
            </div>
          </div>
        </ModalShell>
      )}

      {showGate && !bookerSession && (
        <AuthGate
          onDone={() => { setShowGate(false); setPhase(S_MODAL); }}
          thingId={thing.id}
          thingName={thing.name}
          ownerSlug={ownerSlug}
          thingSlug={thingSlug}
          onClose={() => setShowGate(false)}
        />
      )}

    </>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import {
  Car, Users, Coffee, Sun, Wrench, Monitor, Home, Plus, Check, Clock,
} from "lucide-react";
import { createThing } from "./actions";
import { sendCodeword } from "@/app/codeword-actions";
import AuthGate from "@/components/AuthGate";

// ─── TIMEZONE HELPERS ─────────────────────────────────────────────────────────

const TZ_FRIENDLY: Record<string, string> = {
  "Pacific/Auckland":    "New Zealand",
  "Pacific/Chatham":     "Chatham Islands",
  "Australia/Sydney":    "Sydney",
  "Australia/Melbourne": "Melbourne",
  "Australia/Brisbane":  "Brisbane",
  "Australia/Perth":     "Perth",
  "Australia/Adelaide":  "Adelaide",
  "Asia/Tokyo":          "Tokyo",
  "Asia/Singapore":      "Singapore",
  "Asia/Hong_Kong":      "Hong Kong",
  "Asia/Shanghai":       "China",
  "Asia/Kolkata":        "India",
  "Asia/Dubai":          "Dubai",
  "Europe/London":       "London",
  "Europe/Paris":        "Paris",
  "Europe/Berlin":       "Berlin",
  "Europe/Amsterdam":    "Amsterdam",
  "Europe/Stockholm":    "Stockholm",
  "Europe/Zurich":       "Zurich",
  "America/New_York":    "New York",
  "America/Chicago":     "Chicago",
  "America/Denver":      "Denver",
  "America/Los_Angeles": "Los Angeles",
  "America/Toronto":     "Toronto",
  "America/Vancouver":   "Vancouver",
  "America/Sao_Paulo":   "São Paulo",
  "America/Mexico_City": "Mexico City",
  "UTC":                 "UTC",
};

const TZ_LIST = Object.entries(TZ_FRIENDLY).map(([iana, label]) => ({ iana, label }));

function tzFriendly(iana: string): string {
  return TZ_FRIENDLY[iana] ?? iana.replace(/_/g, " ").split("/").pop() ?? iana;
}

function detectTimezone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch { return "UTC"; }
}

import { ORANGE, ORANGE_MID, ORANGE_LIGHT, GREY, GREY_LIGHT, DARK, WHITE, BORDER, BACKGROUND, SYS, SIZE_SM, SIZE_BASE, SIZE_XL, W_REGULAR, W_MEDIUM, W_BOLD } from "@/lib/constants";

const ICONS = [
  { key: "car",     Icon: Car     },
  { key: "users",   Icon: Users   },
  { key: "coffee",  Icon: Coffee  },
  { key: "sun",     Icon: Sun     },
  { key: "wrench",  Icon: Wrench  },
  { key: "monitor", Icon: Monitor },
  { key: "home",    Icon: Home    },
  { key: "other",   Icon: Plus    },
];

const AVAIL_PRESETS = [
  { key: "9-5", label: "9 – 5"    },
  { key: "24",  label: "24 / 7"   },
  { key: "set", label: "Set hours" },
];

const LENGTH_PRESETS = [
  { key: "30",   label: "30 mins"  },
  { key: "120",  label: "2 hours"  },
  { key: "hd",   label: "Half day" },
  { key: "none", label: "No limits"},
];

const AHEAD_PRESETS = [
  { key: "1",    label: "1 month"  },
  { key: "3",    label: "3 months" },
  { key: "6",    label: "6 months" },
  { key: "12",   label: "1 year"   },
];

const CONCURRENT_PRESETS = [
  { key: "3",    label: "3"          },
  { key: "5",    label: "5"          },
  { key: "10",   label: "10"         },
  { key: "none", label: "Have at it" },
];

const BUFFER_PRESETS = [
  { key: "0",  label: "No need"  },
  { key: "15", label: "15 mins"  },
  { key: "30", label: "30 mins"  },
];

function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`btn-selector${active ? " active" : ""}`}>
      {label}
    </button>
  );
}

function Field({ label, explainer, children }: { label: string; explainer?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ marginBottom: "12px" }}>
        <div style={{ fontSize: "14px", fontWeight: W_BOLD, color: DARK, fontFamily: SYS, marginBottom: "2px" }}>{label}</div>
        {explainer && <div style={{ fontSize: SIZE_SM, fontWeight: W_REGULAR, color: GREY, fontFamily: SYS }}>{explainer}</div>}
      </div>
      {children}
    </div>
  );
}

function OrangeBlock({ label }: { label: string }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", background: ORANGE, borderRadius: "8px", padding: "0 10px", height: "32px", marginBottom: "16px" }}>
      <span style={{ fontSize: SIZE_SM, fontWeight: W_MEDIUM, color: WHITE, fontFamily: SYS, letterSpacing: "-0.5px" }}>{label}</span>
    </div>
  );
}

// ─── MODALS ──────────────────────────────────────────────────────────────────

// ─── MOCK CALENDAR ───────────────────────────────────────────────────────────

function MockCalendar({ name, iconKey }: { name: string; iconKey: string | null }) {
  const IconComp = ICONS.find(i => i.key === iconKey)?.Icon || Car;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const today = mounted ? new Date() : new Date(0);
  const day = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday); d.setDate(monday.getDate() + i); return d;
  });
  const todayIdx = mounted ? (day === 0 ? 6 : day - 1) : -1;
  const days = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const hours = [8,9,10,11,12,13,14,15,16,17];
  const fmtH = (h: number) => h === 12 ? "12pm" : h < 12 ? `${h}am` : `${h-12}pm`;

  return (
    <div style={{ height: "100%", background: WHITE, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{ padding: "18px 18px 0", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "4px" }}>
          <div style={{ width: "34px", height: "34px", borderRadius: "50%", background: ORANGE, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <IconComp size={15} strokeWidth={1.75} color={WHITE} />
          </div>
          <div>
            <div style={{ fontSize: "16px", fontWeight: W_BOLD, color: DARK, letterSpacing: "-0.3px", fontFamily: SYS }}>{name}</div>
            <div style={{ fontSize: "9px", fontWeight: W_BOLD, letterSpacing: "1px", textTransform: "uppercase" as const, color: GREY_LIGHT, fontFamily: SYS }}>Harbour Works</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: "2px", margin: "14px 0 10px" }}>
          {days.map((d, i) => {
            const sel = i === todayIdx;
            return (
              <div key={d} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "3px", padding: "5px 2px", borderRadius: "7px", background: sel ? ORANGE_LIGHT : "transparent" }}>
                <span style={{ fontSize: "7px", fontWeight: W_BOLD, letterSpacing: "0.3px", textTransform: "uppercase" as const, color: sel ? ORANGE : "#ccc", fontFamily: SYS }}>{d}</span>
                <span style={{ fontSize: SIZE_SM, fontWeight: sel ? W_BOLD : W_REGULAR, color: sel ? ORANGE : "#ccc", fontFamily: SYS }}>{weekDates[i].getDate()}</span>
              </div>
            );
          })}
        </div>
        <div style={{ height: "1px", background: BORDER, marginBottom: "10px" }} />
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 18px 16px" }}>
        {hours.map(h => (
          <div key={h} style={{ display: "flex", gap: "8px", marginBottom: "3px" }}>
            <div style={{ width: "32px", fontSize: "9px", color: "#ccc", fontWeight: W_MEDIUM, fontFamily: SYS, paddingTop: "10px", textAlign: "right" as const, flexShrink: 0 }}>{fmtH(h)}</div>
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
              <div style={{ height: "26px", background: ORANGE_LIGHT, borderRadius: "6px" }} />
              <div style={{ height: "26px", background: ORANGE_LIGHT, borderRadius: "6px" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN ────────────────────────────────────────────────────────────────────

export default function SetupPage() {
  const [name, setName]             = useState("");
  const [icon, setIcon]             = useState<string | null>(null);
  const [otherLabel, setOtherLabel] = useState("");
  const [avail, setAvail]           = useState("9-5");
  const [fromH, setFromH]           = useState(9);
  const [toH, setToH]               = useState(17);
  const [weekends, setWeekends]     = useState(false);
  const [timezone, setTimezone]     = useState("UTC");
  useEffect(() => { setTimezone(detectTimezone()); }, []);
  const [tzSearch, setTzSearch]     = useState("");
  const [tzOpen, setTzOpen]         = useState(false);
  const [notes, setNotes]           = useState("");
  const [maxLen, setMaxLen]         = useState("120");
  const [ahead, setAhead]           = useState("1");
  const [concurrent, setConcurrent] = useState("3");
  const [buffer, setBuffer]         = useState("0");
  const [side, setSide]             = useState<"front" | "back">("front");
  const [flipping, setFlipping]     = useState(false);
  const [showGate, setShowGate] = useState(false);
  const [nameFocus, setNameFocus]   = useState(false);
  const [notesFocus, setNotesFocus] = useState(false);

  // Passed from onBeforeSend → used by onDone to call createThing
  const pendingRef = useRef<{ email: string; firstName: string } | null>(null);

  const trimmed   = name.trim();
  const canFlip   = !!trimmed;

  const flip = (to: "front" | "back") => {
    if (flipping) return;
    setFlipping(true);
    setTimeout(() => { setSide(to); setFlipping(false); }, 400);
  };

  const fmtH = (h: number) => {
    if (h === 0)  return "12am";
    if (h < 12)   return `${h}am`;
    if (h === 12) return "12pm";
    return `${h - 12}pm`;
  };
  const hours = Array.from({ length: 24 }, (_, i) => i);

  const selectStyle = {
    padding: "10px 14px", borderRadius: "10px",
    border: `1.5px solid ${BORDER}`, fontFamily: SYS,
    fontSize: "14px", fontWeight: W_MEDIUM, color: DARK,
    background: WHITE, cursor: "pointer", outline: "none",
  };

  // Called by AuthGate after email + name collected — sends the codeword email.
  const handleBeforeSend = async (email: string, firstName: string) => {
    pendingRef.current = { email: email.trim().toLowerCase(), firstName: firstName.trim() };
    const result = await sendCodeword({
      context: "setup", email: email.trim(), firstName: firstName.trim(),
      ownerSlug: "", thingSlug: "",
    });
    if ("error" in result) return { error: result.error };
    return { ownerSlug: "", thingSlug: "" };
  };

  // Called by AuthGate after codeword verified — creates the thing.
  const handleDone = async (result?: { orgName?: string }) => {
    const p = pendingRef.current;
    if (!p) return;
    const outcome = await createThing({
      name: trimmed, icon: icon || "car",
      avail, fromH, toH, weekends, notes,
      maxLen, ahead, concurrent, buffer,
      timezone,
      email:     p.email,
      firstName: p.firstName,
      orgName:   result?.orgName || "My Organisation",
    });
    if ("error" in outcome) {
      console.error("createThing failed:", outcome.error);
      return;
    }
    return { doneUrl: outcome.url };
  };

  return (
    <div style={{ background: BACKGROUND, minHeight: "100vh", fontFamily: SYS, position: "relative", zIndex: 0 }}>
      <style>{`
        @keyframes flipOut { 0% { transform: rotateY(0deg); opacity: 1; } 100% { transform: rotateY(-90deg); opacity: 0; } }
        @keyframes flipIn  { 0% { transform: rotateY(90deg); opacity: 0; } 100% { transform: rotateY(0deg); opacity: 1; } }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .flip-out { animation: flipOut 0.4s cubic-bezier(0.4,0,0.2,1) forwards; }
        .flip-in  { animation: flipIn  0.4s cubic-bezier(0.4,0,0.2,1) forwards; }
      `}</style>

      {/* Calendar backdrop — visible during AuthGate */}
      {showGate && (
        <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", padding: "90px 24px 60px" }}>
          <div style={{ width: "100%", maxWidth: "390px", height: "100%", maxHeight: "700px", background: WHITE, borderRadius: "24px", overflow: "hidden", boxShadow: "0 8px 48px rgba(0,0,0,0.09)" }}>
            <MockCalendar name={trimmed} iconKey={icon} />
          </div>
        </div>
      )}

      {/* AuthGate — email + name + org + codeword + done */}
      {showGate && (
        <AuthGate
          thingName={trimmed}
          isOwner={true}
          context="setup"
          onBeforeSend={handleBeforeSend}
          onDone={handleDone}
          onClose={() => setShowGate(false)}
          doneName={trimmed}
        />
      )}

      {/* Form */}
      {!showGate && (
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "100px 24px 140px" }}>
          <style>{`.setup-icon-grid { display: grid; grid-template-columns: repeat(8, 1fr); gap: 8px; } @media (max-width: 600px) { .setup-icon-grid { grid-template-columns: repeat(4, 1fr); } .setup-card { padding: 28px 24px 28px !important; } }`}</style>

          <div
            className={`setup-card ${flipping ? (side === "front" ? "flip-out" : "flip-in") : ""}`}
            style={{ background: WHITE, borderRadius: "24px", padding: "44px 44px 40px", boxShadow: "0 4px 32px rgba(0,0,0,0.07)" }}
          >

            {/* ── WHITE 1 ── */}
            {side === "front" && (
              <>
                <OrangeBlock label="Set up" />
                <div style={{ fontSize: SIZE_XL, fontWeight: W_BOLD, color: DARK, letterSpacing: "-0.8px", lineHeight: 1.15, fontFamily: SYS, marginBottom: "8px", paddingRight: "4px" }}>
                  What are you sharing?
                </div>
                <div style={{ fontSize: SIZE_BASE, color: GREY, fontFamily: SYS, fontWeight: W_REGULAR, marginBottom: "36px" }}>
                  It only takes a minute to set up your thing.
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

                  <Field label="What's it called?" explainer="The simpler the better. Call it what it is.">
                    <input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      onFocus={() => setNameFocus(true)}
                      onBlur={() => setNameFocus(false)}
                      placeholder="The Car Park"
                      maxLength={40}
                      style={{
                        width: "100%", padding: "14px 18px", borderRadius: "14px",
                        border: `1.5px solid ${trimmed ? ORANGE : nameFocus ? ORANGE : BORDER}`,
                        background: trimmed ? ORANGE_LIGHT : WHITE,
                        fontSize: "18px", fontWeight: W_MEDIUM, fontFamily: SYS, color: DARK,
                        outline: "none", transition: "all 0.15s", boxSizing: "border-box" as const,
                      }}
                    />
                  </Field>

                  <Field label="Choose an icon" explainer="To help you remember which thing is which.">
                    <div className="setup-icon-grid">
                      {ICONS.map(({ key, Icon }) => {
                        const active = icon === key;
                        return (
                          <button key={key} onClick={() => setIcon(key)} style={{
                            padding: "14px 8px", borderRadius: "12px",
                            border: active ? `1.5px solid ${ORANGE}` : `1.5px solid ${BORDER}`,
                            background: active ? ORANGE_LIGHT : WHITE,
                            cursor: "pointer", display: "flex", alignItems: "center",
                            justifyContent: "center", transition: "all 0.15s",
                          }}>
                            <Icon size={20} strokeWidth={1.75} color={active ? ORANGE : "#ccc"} />
                          </button>
                        );
                      })}
                    </div>
                    {icon === "other" && (
                      <input
                        value={otherLabel}
                        onChange={e => setOtherLabel(e.target.value)}
                        placeholder="What is it?"
                        maxLength={30}
                        autoFocus
                        style={{
                          marginTop: "12px", width: "220px", padding: "10px 14px",
                          borderRadius: "10px", border: `1.5px solid ${ORANGE}`,
                          background: ORANGE_LIGHT, fontSize: "14px", fontWeight: W_MEDIUM,
                          fontFamily: SYS, color: DARK, outline: "none", boxSizing: "border-box" as const,
                        }}
                      />
                    )}
                  </Field>

                  <Field label="When's it available?" explainer="Keeps the calendar nice and simple.">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {AVAIL_PRESETS.map(({ key, label }) => (
                        <Pill key={key} label={label} active={avail === key} onClick={() => setAvail(key)} />
                      ))}
                    </div>
                    {avail === "set" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "16px" }}>
                        <select value={fromH} onChange={e => setFromH(parseInt(e.target.value))} style={selectStyle}>
                          {hours.map(h => <option key={h} value={h}>{fmtH(h)}</option>)}
                        </select>
                        <span style={{ fontSize: "14px", color: GREY_LIGHT, fontWeight: W_MEDIUM }}>to</span>
                        <select value={toH} onChange={e => setToH(parseInt(e.target.value))} style={selectStyle}>
                          {hours.map(h => <option key={h} value={h}>{fmtH(h)}</option>)}
                        </select>
                      </div>
                    )}
                    {avail !== "24" && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "16px" }}>

                        {/* Weekends checkbox */}
                        <button onClick={() => setWeekends(!weekends)}
                          style={{ display: "flex", alignItems: "center", gap: "10px", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: SYS }}>
                          <div style={{
                            width: "18px", height: "18px", borderRadius: "5px",
                            border: weekends ? "none" : `1.5px solid ${BORDER}`,
                            background: weekends ? ORANGE : WHITE,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0, transition: "all 0.15s",
                          }}>
                            {weekends && <Check size={10} strokeWidth={3} color={WHITE} />}
                          </div>
                          <span style={{ fontSize: "14px", fontWeight: W_MEDIUM, color: "#555" }}>Include weekends</span>
                        </button>

                        {/* Timezone */}
                        <div style={{ position: "relative" }}>
                          <button onClick={() => { setTzOpen(!tzOpen); setTzSearch(""); }}
                            style={{ display: "flex", alignItems: "center", gap: "6px", background: "none", border: "none", cursor: "pointer", padding: 0, fontFamily: SYS }}>
                            <Clock size={18} color={"#555"} strokeWidth={1.75} />
                            <span style={{ fontSize: "14px", fontWeight: W_MEDIUM, color: "#555" }}>{tzFriendly(timezone)} time</span>
                          </button>

                          {tzOpen && (
                            <div style={{
                              position: "absolute", right: 0, top: "calc(100% + 8px)",
                              background: WHITE, borderRadius: "14px", padding: "10px 0",
                              boxShadow: "0 4px 24px rgba(0,0,0,0.12)", zIndex: 100,
                              minWidth: "200px",
                            }}>
                              <div style={{ padding: "0 12px 8px" }}>
                                <input
                                  autoFocus
                                  value={tzSearch}
                                  onChange={e => setTzSearch(e.target.value)}
                                  placeholder="Search..."
                                  style={{
                                    width: "100%", padding: "8px 10px", borderRadius: "8px",
                                    border: `1.5px solid ${BORDER}`, background: WHITE,
                                    fontSize: SIZE_SM, fontFamily: SYS, outline: "none",
                                    boxSizing: "border-box" as const,
                                  }}
                                />
                              </div>
                              <div style={{ maxHeight: "180px", overflowY: "auto" }}>
                                {TZ_LIST
                                  .filter(tz => tz.label.toLowerCase().includes(tzSearch.toLowerCase()))
                                  .map(tz => (
                                    <button key={tz.iana}
                                      onClick={() => { setTimezone(tz.iana); setTzOpen(false); }}
                                      style={{
                                        display: "block", width: "100%", textAlign: "left",
                                        padding: "9px 16px", background: tz.iana === timezone ? ORANGE_LIGHT : "none",
                                        border: "none", cursor: "pointer", fontFamily: SYS,
                                        fontSize: SIZE_SM, fontWeight: tz.iana === timezone ? W_BOLD : W_REGULAR,
                                        color: tz.iana === timezone ? ORANGE : DARK,
                                      }}>
                                      {tz.label}
                                    </button>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Field>

                  <Field label="Stuff people need to know" explainer="Any special rules or quirks?">
                    <textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      onFocus={() => setNotesFocus(true)}
                      onBlur={() => setNotesFocus(false)}
                      placeholder="e.g. Park on the left side only. Or don't forget the hot water."
                      rows={3}
                      maxLength={300}
                      style={{
                        width: "100%", padding: "14px 18px", borderRadius: "14px",
                        border: `2px solid ${notesFocus ? ORANGE : BORDER}`,
                        background: WHITE, fontSize: "14px", fontWeight: W_REGULAR,
                        fontFamily: SYS, color: DARK, outline: "none",
                        resize: "none" as const, lineHeight: 1.7, boxSizing: "border-box" as const,
                        transition: "border 0.15s",
                      }}
                    />
                    <div style={{ fontSize: "12px", color: GREY_LIGHT, marginTop: "12px", fontFamily: SYS }}>
                      Keep it short and practical. No access codes or private information.
                    </div>
                  </Field>

                </div>

                <button
                  onClick={() => canFlip && flip("back")}
                  disabled={!canFlip}
                  className={`btn ${canFlip ? "btn-primary" : "btn-inactive"}`}
                  style={{ marginTop: "40px", fontSize: "16px", letterSpacing: "-0.3px" }}
                >
                  Set your rules
                </button>
              </>
            )}

            {/* ── WHITE 2 ── */}
            {side === "back" && (
              <>
                <OrangeBlock label="Rules" />
                <div style={{ fontSize: SIZE_XL, fontWeight: W_BOLD, color: DARK, letterSpacing: "-0.8px", lineHeight: 1.15, fontFamily: SYS, marginBottom: "8px", paddingRight: "4px" }}>
                  How will you share it?
                </div>
                <div style={{ fontSize: SIZE_BASE, color: GREY, fontFamily: SYS, fontWeight: W_REGULAR, marginBottom: "36px" }}>
                  Simple rules to make it fair for everyone.
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "32px" }}>

                  <Field label="Max time" explainer="So people don't stay all day.">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {LENGTH_PRESETS.map(({ key, label }) => (
                        <Pill key={key} label={label} active={maxLen === key} onClick={() => setMaxLen(key)} />
                      ))}
                    </div>
                  </Field>

                  <Field label="How far ahead?" explainer="So people can plan.">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {AHEAD_PRESETS.map(({ key, label }) => (
                        <Pill key={key} label={label} active={ahead === key} onClick={() => setAhead(key)} />
                      ))}
                    </div>
                  </Field>

                  <Field label="Max bookings" explainer="So nobody hogs your thing.">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {CONCURRENT_PRESETS.map(({ key, label }) => (
                        <Pill key={key} label={label} active={concurrent === key} onClick={() => setConcurrent(key)} />
                      ))}
                    </div>
                  </Field>

                  <Field label="Breathing room" explainer="Time between bookings.">
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                      {BUFFER_PRESETS.map(({ key, label }) => (
                        <Pill key={key} label={label} active={buffer === key} onClick={() => setBuffer(key)} />
                      ))}
                    </div>
                  </Field>

                </div>

                <button
                  onClick={() => setShowGate(true)}
                  style={{
                    width: "100%", marginTop: "40px", padding: "18px",
                    borderRadius: "14px", border: "none",
                    background: ORANGE, color: WHITE,
                    fontSize: "16px", fontWeight: W_BOLD, fontFamily: SYS,
                    cursor: "pointer", letterSpacing: "-0.3px",
                  }}
                >
                  Lock it in
                </button>


                <button
                  onClick={() => flip("front")}
                  style={{ display: "block", margin: "16px auto 0", background: "none", border: "none", cursor: "pointer", fontSize: SIZE_SM, color: GREY_LIGHT, fontFamily: SYS, fontWeight: W_MEDIUM }}
                >
                  ← Back
                </button>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
}

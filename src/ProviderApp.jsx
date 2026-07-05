import React, { useState, useEffect, useRef, useCallback } from "react";
import { io } from "socket.io-client";
import {
  Power,
  MapPin,
  Navigation2,
  Phone,
  MessageSquare,
  Star,
  Wrench,
  ChevronRight,
  Image as ImageIcon,
  Camera,
  X,
  Loader2,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Design concept: "dispatch console" — instrument-panel gauges reused as the
// through-line (the online toggle is a dial, the offer countdown is a gauge
// ring, job progress is a gauge arc). Dark charcoal base + hi-vis amber, the
// one color every one of FixedNow's trades already wears on site.
// ---------------------------------------------------------------------------

const COLORS = {
  base: "#12151A",
  panel: "#1B2028",
  panelRaised: "#232A34",
  hairline: "#2E3642",
  textPrimary: "#EDEFF3",
  textSecondary: "#8B94A3",
  textFaint: "#5A6270",
  amber: "#FFB800",
  amberDim: "#8A6300",
  green: "#3ECF6B",
  red: "#FF5A52",
};

// ---------------------------------------------------------------------------
// API layer — talks to the FixedNow matching API. Update API_BASE_URL to
// point at your deployed instance.
// ---------------------------------------------------------------------------

const API_BASE_URL = "https://fixednow-api.onrender.com";

// Stand-in for real provider auth/login, which doesn't exist yet — this is
// the seeded demo provider from seed.sql (Davey Quinn, Mechanic/Tyre
// Fitter/Roadside Assistance/Handyman near Rathmines, Dublin).
const DEMO_PROVIDER = {
  id: "11111111-1111-1111-1111-111111111111",
  name: "Davey Quinn",
};

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(body?.error || `Request failed (${res.status})`);
  }
  return body;
}

const JOB_STAGES = ["En route", "Arrived", "In progress", "Complete"];

function useCountdown(active, seconds, onExpire) {
  const [remaining, setRemaining] = useState(seconds);
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!active) return;
    setRemaining(seconds);
    expiredRef.current = false;
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, seconds - elapsed);
      setRemaining(left);
      if (left <= 0 && !expiredRef.current) {
        expiredRef.current = true;
        clearInterval(id);
        onExpire && onExpire();
      }
    }, 100);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, seconds]);

  return remaining;
}

function StatusBar() {
  return (
    <div
      className="flex items-center justify-between px-6"
      style={{ height: 28, color: COLORS.textSecondary, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}
    >
      <span>9:41</span>
      <span style={{ letterSpacing: 1 }}>FIXEDNOW · PROVIDER</span>
      <span>82%</span>
    </div>
  );
}

function DialToggle({ isOnline, onToggle }) {
  const ticks = Array.from({ length: 28 });
  return (
    <div className="flex flex-col items-center justify-center" style={{ padding: "28px 0 12px" }}>
      <button
        onClick={onToggle}
        className="relative flex items-center justify-center"
        style={{
          width: 220,
          height: 220,
          borderRadius: 999,
          background: "transparent",
          border: "none",
          cursor: "pointer",
        }}
        aria-label={isOnline ? "Go offline" : "Go online"}
      >
        {/* tick ring */}
        {ticks.map((_, i) => {
          const angle = (360 / ticks.length) * i;
          const lit = isOnline;
          return (
            <span
              key={i}
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: 3,
                height: 10,
                borderRadius: 2,
                background: lit ? COLORS.amber : COLORS.hairline,
                transform: `rotate(${angle}deg) translate(0, -104px)`,
                transformOrigin: "center",
                opacity: lit ? 0.9 : 0.6,
                transition: "background 300ms ease",
              }}
            />
          );
        })}

        {/* outer glow when online */}
        {isOnline && (
          <span
            className="absolute animate-pulse"
            style={{
              width: 176,
              height: 176,
              borderRadius: 999,
              boxShadow: `0 0 40px 6px ${COLORS.amberDim}`,
            }}
          />
        )}

        {/* main dial face */}
        <span
          className="flex flex-col items-center justify-center"
          style={{
            width: 168,
            height: 168,
            borderRadius: 999,
            background: `radial-gradient(circle at 35% 30%, ${COLORS.panelRaised}, ${COLORS.panel})`,
            border: `2px solid ${isOnline ? COLORS.amber : COLORS.hairline}`,
            transition: "border-color 300ms ease",
          }}
        >
          <Power size={30} color={isOnline ? COLORS.amber : COLORS.textFaint} strokeWidth={2.25} />
          <span
            style={{
              marginTop: 10,
              fontFamily: "'Big Shoulders Display', sans-serif",
              fontWeight: 700,
              fontSize: 26,
              letterSpacing: 1.5,
              color: isOnline ? COLORS.amber : COLORS.textSecondary,
              textTransform: "uppercase",
            }}
          >
            {isOnline ? "Online" : "Offline"}
          </span>
          <span
            style={{
              marginTop: 2,
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 10,
              color: COLORS.textFaint,
              letterSpacing: 0.5,
            }}
          >
            {isOnline ? "receiving jobs" : "tap to start"}
          </span>
        </span>
      </button>
    </div>
  );
}

function StatCard({ label, value, unit }) {
  return (
    <div
      className="flex-1 flex flex-col"
      style={{
        background: COLORS.panel,
        border: `1px solid ${COLORS.hairline}`,
        borderRadius: 10,
        padding: "12px 14px",
      }}
    >
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textFaint, letterSpacing: 0.5 }}>
        {label}
      </span>
      <span style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 600, fontSize: 24, color: COLORS.textPrimary, marginTop: 2 }}>
        {value}
        {unit && <span style={{ fontSize: 13, color: COLORS.textSecondary, marginLeft: 3 }}>{unit}</span>}
      </span>
    </div>
  );
}

function HistoryRow({ category, area, payout, time }) {
  return (
    <div
      className="flex items-center justify-between"
      style={{ padding: "10px 2px", borderBottom: `1px solid ${COLORS.hairline}` }}
    >
      <div className="flex items-center gap-3">
        <span
          className="flex items-center justify-center"
          style={{ width: 30, height: 30, borderRadius: 7, background: COLORS.panelRaised }}
        >
          <Wrench size={14} color={COLORS.textSecondary} />
        </span>
        <div className="flex flex-col">
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.textPrimary }}>{category}</span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textFaint }}>{area} · {time}</span>
        </div>
      </div>
      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 13, color: COLORS.green }}>+€{payout}</span>
    </div>
  );
}

function HomeScreen({ isOnline, onToggle, earnings, jobsToday }) {
  return (
    <div className="flex flex-col h-full" style={{ padding: "0 20px 20px" }}>
      <div className="flex items-center justify-between" style={{ padding: "6px 0 0" }}>
        <div className="flex items-center gap-2">
          <span
            style={{
              fontFamily: "'Big Shoulders Display', sans-serif",
              fontWeight: 700,
              fontSize: 20,
              color: COLORS.textPrimary,
              letterSpacing: 0.5,
            }}
          >
            FIXEDNOW
          </span>
          <span
            style={{
              fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 9,
              color: COLORS.textFaint,
              border: `1px solid ${COLORS.hairline}`,
              borderRadius: 4,
              padding: "1px 5px",
            }}
          >
            PROVIDER
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Star size={13} color={COLORS.amber} fill={COLORS.amber} />
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, color: COLORS.textSecondary }}>4.9</span>
        </div>
      </div>

      <DialToggle isOnline={isOnline} onToggle={onToggle} />

      <div className="flex gap-2.5" style={{ marginTop: 4 }}>
        <StatCard label="TODAY" value={`€${earnings}`} />
        <StatCard label="JOBS" value={jobsToday} unit="today" />
        <StatCard label="ONLINE" value="5.2" unit="hrs" />
      </div>

      {isOnline && (
        <div
          className="flex items-center justify-center gap-2"
          style={{
            marginTop: 14,
            padding: "10px 0",
            borderRadius: 8,
            border: `1px dashed ${COLORS.hairline}`,
            color: COLORS.textFaint,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 11,
            letterSpacing: 0.3,
          }}
        >
          <Loader2 size={12} className="animate-spin" />
          Waiting for job requests…
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textFaint, letterSpacing: 0.5 }}>
          RECENT JOBS
        </span>
        <div style={{ marginTop: 6 }}>
          <HistoryRow category="Tyre Fitter" area="Ranelagh" payout="38" time="11:20" />
          <HistoryRow category="Handyman" area="Rathgar" payout="62" time="09:45" />
          <HistoryRow category="Roadside Assist" area="M50 J9" payout="55" time="08:12" />
        </div>
      </div>
    </div>
  );
}

function OfferScreen({ offer, onAccept, onDecline, onExpire }) {
  const timeoutSeconds = offer.timeoutSeconds || 20;
  const remaining = useCountdown(true, timeoutSeconds, onExpire);
  const pct = remaining / timeoutSeconds;
  const r = 54;
  const circumference = 2 * Math.PI * r;
  const dashoffset = circumference * (1 - pct);
  const urgent = remaining <= 5;

  return (
    <div className="flex flex-col h-full" style={{ padding: "20px 20px 24px" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.amber, letterSpacing: 1 }}>
          ● NEW JOB PING
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textFaint }}>{offer.jobId}</span>
      </div>

      <div className="flex flex-col items-center" style={{ marginTop: 22 }}>
        <div className="relative flex items-center justify-center" style={{ width: 132, height: 132 }}>
          <svg width="132" height="132" style={{ transform: "rotate(-90deg)" }}>
            <circle cx="66" cy="66" r={r} fill="none" stroke={COLORS.hairline} strokeWidth="6" />
            <circle
              cx="66"
              cy="66"
              r={r}
              fill="none"
              stroke={urgent ? COLORS.red : COLORS.amber}
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashoffset}
              style={{ transition: "stroke-dashoffset 100ms linear, stroke 300ms ease" }}
            />
          </svg>
          <span
            className="absolute"
            style={{
              fontFamily: "'Big Shoulders Display', sans-serif",
              fontWeight: 700,
              fontSize: 40,
              color: urgent ? COLORS.red : COLORS.textPrimary,
            }}
          >
            {Math.ceil(remaining)}
          </span>
        </div>

        <span
          style={{
            marginTop: 16,
            fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 10,
            color: COLORS.textFaint,
            letterSpacing: 1,
          }}
        >
          {offer.urgency.toUpperCase()}
        </span>
        <span
          style={{
            fontFamily: "'Big Shoulders Display', sans-serif",
            fontWeight: 700,
            fontSize: 26,
            color: COLORS.textPrimary,
            marginTop: 2,
          }}
        >
          {offer.category}
        </span>

        <div className="flex items-center gap-1.5" style={{ marginTop: 8 }}>
          <MapPin size={13} color={COLORS.textSecondary} />
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.textSecondary }}>
            {offer.area}
          </span>
        </div>

        {offer.photoCount > 0 && (
          <div
            className="flex items-center gap-2.5"
            style={{
              marginTop: 14,
              width: "100%",
              background: COLORS.panel,
              border: `1px solid ${COLORS.hairline}`,
              borderRadius: 10,
              padding: "10px 12px",
            }}
          >
            <div className="flex gap-1.5">
              {Array.from({ length: offer.photoCount }).map((_, i) => (
                <span
                  key={i}
                  className="flex items-center justify-center"
                  style={{ width: 34, height: 34, borderRadius: 6, background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}` }}
                >
                  <ImageIcon size={14} color={COLORS.textSecondary} />
                </span>
              ))}
            </div>
            <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: COLORS.textSecondary, lineHeight: 1.3 }}>
              Customer attached {offer.photoCount} photo{offer.photoCount > 1 ? "s" : ""} — check against stock before accepting
            </span>
          </div>
        )}

        <div className="flex gap-2.5" style={{ marginTop: 18, width: "100%" }}>
          <StatCard label="DISTANCE" value={offer.distanceKm} unit="km" />
          <StatCard label="PAYOUT" value={offer.payout != null ? `€${offer.payout}` : "TBD"} />
        </div>
      </div>

      <div className="flex-1" />

      <div className="flex gap-3">
        <button
          onClick={onDecline}
          className="flex-1"
          style={{
            padding: "14px 0",
            borderRadius: 10,
            border: `1px solid ${COLORS.hairline}`,
            background: "transparent",
            color: COLORS.textSecondary,
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 600,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Decline
        </button>
        <button
          onClick={onAccept}
          className="flex-1"
          style={{
            padding: "14px 0",
            borderRadius: 10,
            border: "none",
            background: COLORS.green,
            color: "#0B1A10",
            fontFamily: "'IBM Plex Sans', sans-serif",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          Accept job
        </button>
      </div>
    </div>
  );
}

function GaugeStepper({ stageIndex }) {
  return (
    <div className="flex items-center" style={{ padding: "4px 0" }}>
      {JOB_STAGES.map((stage, i) => {
        const done = i < stageIndex;
        const current = i === stageIndex;
        return (
          <React.Fragment key={stage}>
            <div className="flex flex-col items-center" style={{ width: 60 }}>
              <span
                className="flex items-center justify-center"
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 999,
                  background: done || current ? COLORS.amber : COLORS.panelRaised,
                  border: `1px solid ${done || current ? COLORS.amber : COLORS.hairline}`,
                  color: done || current ? "#2A1D00" : COLORS.textFaint,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                {i + 1}
              </span>
              <span
                style={{
                  marginTop: 5,
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: 8.5,
                  color: current ? COLORS.amber : COLORS.textFaint,
                  textAlign: "center",
                  letterSpacing: 0.3,
                }}
              >
                {stage.toUpperCase()}
              </span>
            </div>
            {i < JOB_STAGES.length - 1 && (
              <span style={{ flex: 1, height: 2, background: i < stageIndex ? COLORS.amber : COLORS.hairline, marginBottom: 14 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function ActiveJobScreen({ offer, stageIndex, onAdvance, onFinish, onRequirePhoto }) {
  const isLast = stageIndex === JOB_STAGES.length - 1;
  const [photos, setPhotos] = useState([]);
  const needsPhoto = offer.requiresCompletionPhoto && photos.length === 0;
  const MAX_PHOTOS = 3;

  const addPhoto = () => {
    if (photos.length >= MAX_PHOTOS) return;
    setPhotos((p) => [...p, p.length + 1]);
  };
  const removePhoto = (idx) => setPhotos((p) => p.filter((_, i) => i !== idx));

  const handlePrimaryClick = () => {
    if (!isLast) return onAdvance();
    if (needsPhoto) return onRequirePhoto();
    onFinish(photos);
  };

  return (
    <div className="flex flex-col h-full" style={{ padding: "20px 20px 24px" }}>
      <div className="flex items-center justify-between">
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.green, letterSpacing: 1 }}>
          ● JOB ACCEPTED
        </span>
        <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textFaint }}>{offer.jobId}</span>
      </div>

      <span style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 700, fontSize: 24, color: COLORS.textPrimary, marginTop: 12 }}>
        {offer.category}
      </span>
      <div className="flex items-center gap-1.5" style={{ marginTop: 4 }}>
        <MapPin size={13} color={COLORS.textSecondary} />
        <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 13, color: COLORS.textSecondary }}>{offer.area}</span>
      </div>

      <div style={{ marginTop: 24 }}>
        <GaugeStepper stageIndex={stageIndex} />
      </div>

      <div
        className="flex items-center justify-between"
        style={{ marginTop: 20, background: COLORS.panel, border: `1px solid ${COLORS.hairline}`, borderRadius: 10, padding: "12px 14px" }}
      >
        <div className="flex flex-col">
          <span style={{ fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 14, color: COLORS.textPrimary, fontWeight: 600 }}>
            Aoife Byrne
          </span>
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textFaint }}>Customer</span>
        </div>
        <div className="flex gap-2">
          <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.panelRaised }}>
            <Phone size={14} color={COLORS.textSecondary} />
          </span>
          <span className="flex items-center justify-center" style={{ width: 34, height: 34, borderRadius: 8, background: COLORS.panelRaised }}>
            <MessageSquare size={14} color={COLORS.textSecondary} />
          </span>
        </div>
      </div>

      <button
        className="flex items-center justify-center gap-2"
        style={{
          marginTop: 12,
          padding: "12px 0",
          borderRadius: 10,
          border: `1px solid ${COLORS.hairline}`,
          background: "transparent",
          color: COLORS.textPrimary,
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: 600,
          fontSize: 13,
          cursor: "pointer",
        }}
      >
        <Navigation2 size={15} color={COLORS.amber} />
        Navigate to job
      </button>

      {isLast && offer.requiresCompletionPhoto && (
        <div
          style={{
            marginTop: 14,
            background: COLORS.panel,
            border: `1px solid ${needsPhoto ? COLORS.amberDim : COLORS.hairline}`,
            borderRadius: 10,
            padding: "12px 14px",
          }}
        >
          <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: COLORS.textFaint, letterSpacing: 0.5 }}>
            PROOF OF WORK · REQUIRED TO COMPLETE
          </span>
          <div className="flex gap-2" style={{ marginTop: 8 }}>
            {photos.map((_, i) => (
              <span
                key={i}
                className="relative flex items-center justify-center"
                style={{ width: 44, height: 44, borderRadius: 8, background: COLORS.panelRaised, border: `1px solid ${COLORS.hairline}` }}
              >
                <ImageIcon size={16} color={COLORS.textSecondary} />
                <button
                  onClick={() => removePhoto(i)}
                  className="absolute flex items-center justify-center"
                  style={{ top: -6, right: -6, width: 16, height: 16, borderRadius: 999, background: COLORS.red, border: "none", cursor: "pointer" }}
                  aria-label="Remove photo"
                >
                  <X size={10} color="#1A0403" />
                </button>
              </span>
            ))}
            {photos.length < MAX_PHOTOS && (
              <button
                onClick={addPhoto}
                className="flex flex-col items-center justify-center gap-0.5"
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 8,
                  border: `1px dashed ${COLORS.amber}`,
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <Camera size={16} color={COLORS.amber} />
              </button>
            )}
          </div>
          <span
            style={{
              display: "block",
              marginTop: 8,
              fontFamily: "'IBM Plex Sans', sans-serif",
              fontSize: 11,
              color: needsPhoto ? COLORS.amber : COLORS.textSecondary,
            }}
          >
            {needsPhoto
              ? "Add at least 1 photo of the finished work"
              : `${photos.length} photo${photos.length > 1 ? "s" : ""} attached`}
          </span>
        </div>
      )}

      <div className="flex-1" />

      <button
        onClick={handlePrimaryClick}
        className="flex items-center justify-center gap-1.5"
        style={{
          padding: "14px 0",
          borderRadius: 10,
          border: "none",
          background: isLast && needsPhoto ? COLORS.panelRaised : COLORS.amber,
          color: isLast && needsPhoto ? COLORS.textFaint : "#2A1D00",
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontWeight: 700,
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        {isLast ? `Mark complete${offer.payout != null ? ` · earn €${offer.payout}` : ""}` : `Mark as ${JOB_STAGES[stageIndex + 1]}`}
        {!isLast && <ChevronRight size={16} />}
      </button>
    </div>
  );
}

function ToastBanner({ message, tone }) {
  if (!message) return null;
  const color = tone === "success" ? COLORS.green : tone === "error" ? COLORS.red : COLORS.amber;
  return (
    <div
      className="absolute left-0 right-0 flex justify-center"
      style={{ top: 34, zIndex: 30, pointerEvents: "none" }}
    >
      <span
        style={{
          background: COLORS.panelRaised,
          border: `1px solid ${color}`,
          color,
          fontFamily: "'IBM Plex Mono', monospace",
          fontSize: 11,
          padding: "7px 14px",
          borderRadius: 8,
        }}
      >
        {message}
      </span>
    </div>
  );
}

function ConnectionStatus({ status, error, onRetry }) {
  if (status === "checking") {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ padding: 24 }}>
        <Loader2 size={20} color={COLORS.amber} className="animate-spin" />
        <span style={{ marginTop: 10, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: COLORS.textSecondary, textAlign: "center" }}>
          Connecting to {API_BASE_URL}
        </span>
      </div>
    );
  }
  if (status === "unreachable") {
    return (
      <div className="flex flex-col items-center justify-center h-full" style={{ padding: 24, textAlign: "center" }}>
        <span style={{ fontFamily: "'Big Shoulders Display', sans-serif", fontWeight: 700, fontSize: 17, color: COLORS.textPrimary }}>
          Can't reach the API
        </span>
        <span style={{ marginTop: 8, fontFamily: "'IBM Plex Sans', sans-serif", fontSize: 11.5, color: COLORS.textSecondary, maxWidth: 260 }}>
          {error || "Unknown error"}
        </span>
        <button
          onClick={onRetry}
          style={{
            marginTop: 18, padding: "10px 22px", borderRadius: 10, border: "none",
            background: COLORS.amber, color: "#2A1D00",
            fontFamily: "'IBM Plex Sans', sans-serif", fontWeight: 700, fontSize: 13, cursor: "pointer",
          }}
        >
          Retry
        </button>
      </div>
    );
  }
  return null;
}

export default function ProviderApp() {
  const [screen, setScreen] = useState("home"); // home | offer | active
  const [isOnline, setIsOnline] = useState(false);
  const [earnings, setEarnings] = useState(184.5);
  const [jobsToday, setJobsToday] = useState(6);
  const [stageIndex, setStageIndex] = useState(0);
  const [toast, setToast] = useState(null);
  const [activeOffer, setActiveOffer] = useState(null);

  const [apiStatus, setApiStatus] = useState("checking"); // checking | ready | unreachable
  const [apiError, setApiError] = useState(null);
  const [retryToken, setRetryToken] = useState(0);

  const socketRef = useRef(null);
  const categoriesRef = useRef([]);

  const flashToast = useCallback((message, tone) => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 2400);
  }, []);

  // Connect to the API + real-time socket once. Categories are cached in a
  // ref (not state) purely so the socket's 'job:offer' handler — set up
  // once on mount — always reads the latest list without needing to be
  // re-subscribed every time categories change (they never do at runtime).
  useEffect(() => {
    let cancelled = false;
    setApiStatus("checking");
    setApiError(null);

    (async () => {
      try {
        await apiFetch("/health");
        const catData = await apiFetch("/categories");
        if (cancelled) return;
        categoriesRef.current = catData.categories;
        setApiStatus("ready");
      } catch (err) {
        if (!cancelled) {
          setApiStatus("unreachable");
          setApiError(err.message);
        }
        return;
      }

      const socket = io(API_BASE_URL, { transports: ["websocket", "polling"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket.emit("identify", { type: "provider", id: DEMO_PROVIDER.id });
        // Sync the server to match this app's local "offline by default"
        // state, since there's no login flow to read the real status from.
        socket.emit("provider:setOnline", { providerId: DEMO_PROVIDER.id, isOnline: false });
      });

      socket.on("job:offer", async (payload) => {
        try {
          const job = await apiFetch(`/jobs/${payload.jobId}`);
          const category = categoriesRef.current.find((c) => c.id === job.category_id);
          setActiveOffer({
            offerId: payload.offerId,
            jobId: payload.jobId,
            category: category?.name || "Job",
            urgency: (job.urgency_level || "standard").replace(/^./, (c) => c.toUpperCase()),
            distanceKm: payload.distanceKm,
            area: job.address_text || "Address provided after accept",
            payout: job.price_quoted ?? job.price_final ?? null,
            timeoutSeconds: payload.timeoutSeconds,
            photoCount: Array.isArray(job.photo_urls) ? job.photo_urls.length : 0,
            requiresCompletionPhoto: category?.requires_completion_photo ?? true,
          });
          setScreen("offer");
        } catch (err) {
          console.error("Failed to load offer details:", err.message);
        }
      });

      socket.on("job:offerCancelled", () => {
        setScreen((current) => {
          if (current === "offer") {
            flashToast("Job taken by another provider", "info");
            return "home";
          }
          return current;
        });
      });
    })();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [retryToken]);

  const handleToggleOnline = () => {
    setIsOnline((v) => {
      const next = !v;
      socketRef.current?.emit("provider:setOnline", { providerId: DEMO_PROVIDER.id, isOnline: next });
      flashToast(next ? "You're online — receiving job pings" : "You're offline", next ? "success" : "info");
      return next;
    });
  };

  const handleAccept = async () => {
    if (!activeOffer) return;
    try {
      await apiFetch(`/jobs/${activeOffer.jobId}/offers/${activeOffer.offerId}/accept`, {
        method: "POST",
        body: JSON.stringify({ providerId: DEMO_PROVIDER.id }),
      });
      setStageIndex(0);
      setScreen("active");
      flashToast("Job accepted", "success");
    } catch (err) {
      flashToast(err.message, "error");
      setScreen("home");
    }
  };

  const handleDecline = async () => {
    if (!activeOffer) return;
    try {
      await apiFetch(`/jobs/${activeOffer.jobId}/offers/${activeOffer.offerId}/decline`, {
        method: "POST",
        body: JSON.stringify({ providerId: DEMO_PROVIDER.id }),
      });
    } catch (err) {
      // Offer may have already expired/resolved server-side — not fatal.
      console.error("Decline error:", err.message);
    }
    setScreen("home");
    flashToast("Declined — job passed to another provider", "info");
  };

  const handleExpire = () => {
    // No API call needed — the server's own expiry worker independently
    // expires the offer and cascades to the next provider on its own timer.
    setScreen("home");
    flashToast("Offer expired", "error");
  };

  const handleAdvanceStage = async () => {
    if (!activeOffer) return;
    const nextStatus = stageIndex === 0 ? "arrived" : stageIndex === 1 ? "in_progress" : null;
    if (!nextStatus) return;
    try {
      await apiFetch(`/jobs/${activeOffer.jobId}/status`, {
        method: "POST",
        body: JSON.stringify({ providerId: DEMO_PROVIDER.id, status: nextStatus }),
      });
      setStageIndex((i) => Math.min(i + 1, JOB_STAGES.length - 1));
    } catch (err) {
      flashToast(err.message, "error");
    }
  };

  const handleFinish = async (photos) => {
    if (!activeOffer) return;
    try {
      const photoUrls = photos.map((_, i) => `demo://completion-photo-${i + 1}.jpg`);
      await apiFetch(`/jobs/${activeOffer.jobId}/complete`, {
        method: "POST",
        body: JSON.stringify({ providerId: DEMO_PROVIDER.id, photoUrls }),
      });
      if (activeOffer.payout != null) {
        setEarnings((e) => +(e + activeOffer.payout).toFixed(2));
      }
      setJobsToday((j) => j + 1);
      setScreen("home");
      flashToast(
        `Job complete${activeOffer.payout != null ? ` — €${activeOffer.payout} added` : ""} · ${photos.length} photo${photos.length !== 1 ? "s" : ""} attached`,
        "success"
      );
    } catch (err) {
      flashToast(err.message, "error");
    }
  };

  const handleRequirePhoto = () => {
    flashToast("Add a photo of the finished work first", "error");
  };

  return (
    <div
      className="flex items-center justify-center"
      style={{ minHeight: "100vh", background: "#05060A", padding: 24 }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@600;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
      `}</style>

      {/* Phone frame */}
      <div
        className="relative"
        style={{
          width: 360,
          height: 720,
          borderRadius: 40,
          background: "#000",
          padding: 10,
          boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 0 1px #1c1f26",
        }}
      >
        <div
          className="relative flex flex-col"
          style={{
            width: "100%",
            height: "100%",
            borderRadius: 30,
            background: COLORS.base,
            overflow: "hidden",
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          {/* notch */}
          <div
            className="absolute"
            style={{ top: 0, left: "50%", transform: "translateX(-50%)", width: 120, height: 20, background: "#000", borderBottomLeftRadius: 14, borderBottomRightRadius: 14, zIndex: 40 }}
          />

          <ToastBanner message={toast?.message} tone={toast?.tone} />

          <StatusBar />

          <div className="flex-1" style={{ overflowY: "auto" }}>
            {apiStatus !== "ready" && (
              <ConnectionStatus status={apiStatus} error={apiError} onRetry={() => setRetryToken((t) => t + 1)} />
            )}

            {apiStatus === "ready" && screen === "home" && (
              <HomeScreen
                isOnline={isOnline}
                onToggle={handleToggleOnline}
                earnings={earnings}
                jobsToday={jobsToday}
              />
            )}
            {apiStatus === "ready" && screen === "offer" && activeOffer && (
              <OfferScreen offer={activeOffer} onAccept={handleAccept} onDecline={handleDecline} onExpire={handleExpire} />
            )}
            {apiStatus === "ready" && screen === "active" && activeOffer && (
              <ActiveJobScreen
                offer={activeOffer}
                stageIndex={stageIndex}
                onAdvance={handleAdvanceStage}
                onFinish={handleFinish}
                onRequirePhoto={handleRequirePhoto}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

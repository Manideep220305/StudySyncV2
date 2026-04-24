import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Pause, Play, RotateCcw, Settings, Timer, Watch, Flag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

// ─────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────

type CountdownMode = 'pomodoro' | 'custom';
type PomodoroPhase = 'work' | 'break';

// Exported so Dashboard can reference it cleanly
export interface FocusTimerProps {
  /** Called when a timed session ends — pass XP amount to wire into XP system later */
  onSessionComplete?: (xp: number) => void;
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/** Format seconds → "MM:SS" */
const fmt = (s: number): string =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

/** Format seconds → "HH:MM:SS" or "MM:SS" depending on duration */
const fmtWatch = (s: number): string => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
};

// ─────────────────────────────────────────────
// SVG COUNTDOWN RING
// Draining arc that represents time remaining as a fraction
// ─────────────────────────────────────────────

interface RingProps {
  progress: number; // 0 = empty, 1 = full
  color: string;    // hex stroke color
  size?: number;
}

const Ring: React.FC<RingProps> = ({ progress, color, size = 148 }) => {
  const r = (size - 14) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - Math.max(0, Math.min(1, progress)));
  return (
    <svg width={size} height={size} className="-rotate-90">
      {/* Track — faint background ring */}
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
      {/* Progress arc — drains as time passes */}
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth="8" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.6s ease, stroke 0.4s ease' }}
      />
    </svg>
  );
};

// ─────────────────────────────────────────────
// SVG CLOCK FACE
// Analog-style stopwatch face: 60 tick marks around the edge,
// a sweeping second hand, and a progress arc that fills clockwise
// ─────────────────────────────────────────────

interface ClockFaceProps {
  elapsed: number; // total seconds elapsed
}

const ClockFace: React.FC<ClockFaceProps> = ({ elapsed }) => {
  const size = 180;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = 80;
  const innerMajorR = 70; // major tick inner end
  const innerMinorR = 75; // minor tick inner end

  // Generate 60 ticks — one per second on the face
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const angle = (i / 60) * 2 * Math.PI - Math.PI / 2;
    const isMajor = i % 5 === 0; // highlight every 5 seconds
    const r1 = isMajor ? innerMajorR : innerMinorR;
    const filled = i < elapsed % 60; // tick is "lit" if elapsed past it
    return {
      x1: cx + r1 * Math.cos(angle),
      y1: cy + r1 * Math.sin(angle),
      x2: cx + outerR * Math.cos(angle),
      y2: cy + outerR * Math.sin(angle),
      isMajor,
      filled,
    };
  });

  // Second hand angle — sweeps 360° every 60 seconds
  const secondAngle = ((elapsed % 60) / 60) * 2 * Math.PI - Math.PI / 2;
  const handLen = 58;

  // Progress arc radius — sits between outer and inner major rings
  const arcR = (outerR + innerMajorR) / 2 + 2;
  const arcCirc = 2 * Math.PI * arcR;

  return (
    <svg width={size} height={size}>
      {/* Outer ring border */}
      <circle cx={cx} cy={cy} r={outerR} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />

      {/* 60 tick marks — violet when elapsed, faint when not */}
      {ticks.map((t, i) => (
        <line
          key={i} x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2}
          stroke={t.filled
            ? (t.isMajor ? '#a78bfa' : '#7c3aed')
            : (t.isMajor ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)')}
          strokeWidth={t.isMajor ? 2 : 1}
          strokeLinecap="round"
        />
      ))}

      {/* Progress arc — fills clockwise as seconds tick */}
      <circle
        cx={cx} cy={cy} r={arcR}
        fill="none"
        stroke="rgba(139,92,246,0.35)"
        strokeWidth="5"
        strokeDasharray={arcCirc}
        strokeDashoffset={arcCirc * (1 - (elapsed % 60) / 60)}
        strokeLinecap="round"
        style={{
          transform: `rotate(-90deg)`,
          transformOrigin: `${cx}px ${cy}px`,
          transition: 'stroke-dashoffset 0.5s ease',
        }}
      />

      {/* Second hand */}
      <line
        x1={cx} y1={cy}
        x2={cx + handLen * Math.cos(secondAngle)}
        y2={cy + handLen * Math.sin(secondAngle)}
        stroke="#a78bfa" strokeWidth="2" strokeLinecap="round"
      />

      {/* Center cap */}
      <circle cx={cx} cy={cy} r="5" fill="#0f172a" stroke="#a78bfa" strokeWidth="2" />
      <circle cx={cx} cy={cy} r="2" fill="#fff" />
    </svg>
  );
};

// ─────────────────────────────────────────────
// SETTINGS NUMBER INPUT
// ─────────────────────────────────────────────

interface NumInputProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}

const NumInput: React.FC<NumInputProps> = ({ label, value, min, max, onChange }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</label>
    <input
      type="number" min={min} max={max} value={value}
      onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
      className="w-full rounded-xl border border-white/10 bg-slate-800/60 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
    />
  </div>
);

// ─────────────────────────────────────────────
// LEFT PANEL — Pomodoro + Custom countdown
// Both modes share the same ring display and controls.
// Settings panel slides in below the ring without overflowing.
// ─────────────────────────────────────────────

interface CountdownPanelProps {
  onSessionComplete?: (xp: number) => void;
}

const CountdownPanel: React.FC<CountdownPanelProps> = ({ onSessionComplete }) => {
  const { toast } = useToast();
  const [mode, setMode] = useState<CountdownMode>('pomodoro');
  const [isRunning, setIsRunning] = useState(false);
  const [remaining, setRemaining] = useState(25 * 60);
  const [phase, setPhase] = useState<PomodoroPhase>('work');
  const [sessionCount, setSessionCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);

  // User-configurable durations (in minutes)
  const [pomWork, setPomWork] = useState(25);
  const [pomBreak, setPomBreak] = useState(5);
  const [customMins, setCustomMins] = useState(30);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Total duration in seconds — used to calculate ring progress
  const total = mode === 'pomodoro'
    ? (phase === 'work' ? pomWork : pomBreak) * 60
    : customMins * 60;

  // progress: 0 = just started, 1 = complete (ring full → drains to empty)
  const progress = total > 0 ? 1 - remaining / total : 0;

  // Ring color changes green during break phase
  const ringColor = phase === 'break' && mode === 'pomodoro' ? '#22c55e' : '#3b82f6';

  // Reset remaining when mode switches (only when not running)
  useEffect(() => {
    if (isRunning) return;
    setRemaining(mode === 'pomodoro' ? pomWork * 60 : customMins * 60);
    setPhase('work');
  }, [mode]);

  // Sync remaining if work duration config changes while paused
  useEffect(() => {
    if (!isRunning && mode === 'pomodoro' && phase === 'work') setRemaining(pomWork * 60);
  }, [pomWork]);

  // Sync remaining if custom duration config changes while paused
  useEffect(() => {
    if (!isRunning && mode === 'custom') setRemaining(customMins * 60);
  }, [customMins]);

  // Called when countdown hits zero — handles pomodoro phase transitions
  const handleEnd = useCallback(() => {
    setIsRunning(false);
    if (mode === 'pomodoro') {
      if (phase === 'work') {
        const n = sessionCount + 1;
        setSessionCount(n);
        setPhase('break');
        setRemaining(pomBreak * 60);
        toast({
          title: '🍅 Focus session done!',
          description: `Take a ${pomBreak}-min break. Session #${n} complete.`,
        });
        onSessionComplete?.(25); // 25 XP per pomodoro session
      } else {
        setPhase('work');
        setRemaining(pomWork * 60);
        toast({ title: '⚡ Break over!', description: 'Time to lock back in.' });
      }
    } else {
      toast({ title: '✅ Timer complete!', description: `${customMins}-minute session done.` });
      onSessionComplete?.(customMins); // 1 XP per minute for custom
      setRemaining(customMins * 60);
    }
  }, [mode, phase, sessionCount, pomWork, pomBreak, customMins, onSessionComplete, toast]);

  // Interval tick — runs every second when active
  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) { handleEnd(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning, handleEnd]);

  const reset = () => {
    setIsRunning(false);
    setPhase('work');
    setSessionCount(0);
    setRemaining(mode === 'pomodoro' ? pomWork * 60 : customMins * 60);
  };

  return (
    <div className="flex h-full flex-col gap-3">

      {/* ── Mode tabs: Pomodoro / Custom ── */}
      <div className="flex gap-1 rounded-xl bg-white/5 p-1">
        {(['pomodoro', 'custom'] as CountdownMode[]).map((m) => (
          <button
            key={m}
            onClick={() => { if (!isRunning) { setMode(m); setShowSettings(false); } }}
            disabled={isRunning}
            className={`relative flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all
              ${mode === m ? 'text-white' : 'text-slate-500 hover:text-slate-300'}
              ${isRunning ? 'cursor-not-allowed opacity-60' : ''}`}
          >
            {mode === m && (
              <motion.div
                layoutId="cdTab"
                className="absolute inset-0 rounded-lg bg-white/10"
                transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-1.5 capitalize">
              <Timer className="h-3.5 w-3.5" /> {m}
            </span>
          </button>
        ))}
      </div>

      {/* ── Circular ring + digital readout ── */}
      <div className="relative flex flex-1 flex-col items-center justify-center">
        {/* Ambient glow behind ring */}
        <div
          className="pointer-events-none absolute h-32 w-32 rounded-full blur-3xl opacity-15"
          style={{ background: ringColor }}
        />
        <div className="relative flex items-center justify-center">
          <Ring progress={progress} color={ringColor} size={148} />
          <div className="absolute flex flex-col items-center">
            <span className="font-mono text-4xl font-bold tracking-tight text-white">{fmt(remaining)}</span>
            {mode === 'pomodoro' && (
              <span className={`mt-1 text-[11px] font-bold uppercase tracking-widest ${phase === 'work' ? 'text-blue-400' : 'text-green-400'}`}>
                {phase === 'work' ? '🎯 Focus' : '☕ Break'}
              </span>
            )}
          </div>
        </div>
        {mode === 'pomodoro' && sessionCount > 0 && (
          <p className="mt-2 text-xs text-slate-500">
            {sessionCount} session{sessionCount !== 1 ? 's' : ''} done today
          </p>
        )}
      </div>

      {/* ── Settings panel — slides in cleanly, never clips ── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl border border-white/10 bg-slate-800/50 p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-500">Settings</p>
              <div className="grid grid-cols-2 gap-3">
                {mode === 'pomodoro' ? (
                  <>
                    <NumInput label="Work (min)" value={pomWork} min={1} max={120} onChange={setPomWork} />
                    <NumInput label="Break (min)" value={pomBreak} min={1} max={60} onChange={setPomBreak} />
                  </>
                ) : (
                  <div className="col-span-2">
                    <NumInput label="Duration (min)" value={customMins} min={1} max={300} onChange={setCustomMins} />
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Controls: Settings gear, Reset, Start/Pause ── */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => setShowSettings((s) => !s)}
          className={`rounded-xl p-2.5 transition-all ${showSettings ? 'bg-white/10 text-white' : 'text-slate-500 hover:bg-white/8 hover:text-white'}`}
          title="Settings"
        >
          <Settings className="h-4 w-4" />
        </button>
        <button
          onClick={reset}
          className="rounded-xl p-2.5 text-slate-500 hover:bg-white/8 hover:text-white transition-all"
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        <button
          onClick={() => setIsRunning((r) => !r)}
          className={`flex items-center gap-2 rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-lg transition-all
            ${isRunning ? 'bg-slate-700 hover:bg-slate-600' : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30'}`}
        >
          {isRunning
            ? <><Pause className="h-4 w-4" /> Pause</>
            : <><Play className="h-4 w-4" /> Start</>}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// RIGHT PANEL — Stopwatch
// Analog clock face with sweeping second hand,
// digital readout, and lap tracking.
// No local aurora effects — global AuroraLayer handles background.
// ─────────────────────────────────────────────

const StopwatchPanel: React.FC = () => {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [laps, setLaps] = useState<number[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastLapRef = useRef(0); // elapsed at the start of the current lap

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => setElapsed((p) => p + 1), 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isRunning]);

  const reset = () => {
    setIsRunning(false);
    setElapsed(0);
    setLaps([]);
    lastLapRef.current = 0;
  };

  const recordLap = () => {
    const lapTime = elapsed - lastLapRef.current;
    lastLapRef.current = elapsed;
    setLaps((prev) => [lapTime, ...prev]); // newest lap at top
  };

  return (
    <div className="flex h-full flex-col gap-3">

      {/* ── Header with running pulse indicator ── */}
      <div className="flex items-center gap-2">
        <Watch className="h-4 w-4 text-violet-400" />
        <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">Stopwatch</span>
        {/* Pulse dot when running */}
        {isRunning && <div className="ml-auto h-2 w-2 rounded-full bg-violet-400 animate-pulse" />}
      </div>

      {/* ── Clock face + digital readout ── */}
      <div className="flex flex-1 flex-col items-center justify-center gap-2">
        <ClockFace elapsed={elapsed} />
        <div className="flex flex-col items-center">
          <span className="font-mono text-3xl font-bold tracking-tight text-white">
            {fmtWatch(elapsed)}
          </span>
          {/* Current lap delta — shown only while running */}
          {isRunning && (
            <span className="mt-0.5 text-xs text-slate-500">
              Lap {laps.length + 1} · +{fmt(elapsed - lastLapRef.current)}
            </span>
          )}
        </div>
      </div>

      {/* ── Laps list — max 3 rows visible, scrollable ── */}
      {laps.length > 0 && (
        <div className="max-h-[68px] overflow-y-auto rounded-xl border border-white/8 bg-white/3 px-3 py-2 space-y-1">
          {laps.map((l, i) => (
            <div key={i} className="flex items-center justify-between text-xs">
              <div className="flex items-center gap-1.5 text-slate-500">
                <Flag className="h-3 w-3" />
                <span>Lap {laps.length - i}</span>
              </div>
              <span className="font-mono text-white">{fmt(l)}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Controls: Reset, Lap (when running), Start/Pause ── */}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={reset}
          className="rounded-xl p-2.5 text-slate-500 hover:bg-white/8 hover:text-white transition-all"
          title="Reset"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
        {isRunning && (
          <button
            onClick={recordLap}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-white/10 transition-all"
          >
            <Flag className="mr-1 inline h-3.5 w-3.5" />Lap
          </button>
        )}
        <button
          onClick={() => setIsRunning((r) => !r)}
          className={`flex items-center gap-2 rounded-xl px-7 py-2.5 text-sm font-bold text-white shadow-lg transition-all
            ${isRunning ? 'bg-slate-700 hover:bg-slate-600' : 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/30'}`}
        >
          {isRunning
            ? <><Pause className="h-4 w-4" /> Pause</>
            : <><Play className="h-4 w-4" /> Start</>}
        </button>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// MAIN EXPORT — FocusTimer
// Split card: countdown (left) + stopwatch (right)
// Each half has a colored 2px accent bar at the top.
// bg-slate-900/60 + backdrop-blur-md makes cards semi-transparent
// so the global AuroraLayer shows through behind them.
// ─────────────────────────────────────────────

const FocusTimer: React.FC<FocusTimerProps> = ({ onSessionComplete }) => (
  <div className="grid h-full grid-cols-1 overflow-hidden rounded-2xl border border-white/10 md:grid-cols-2">

    {/* LEFT — Countdown timer (Pomodoro / Custom) */}
    <div className="relative flex flex-col border-b border-white/10 bg-slate-900 border-r border-white-[0.05] p-6 md:border-b-0 md:border-r overflow-y-auto blend-scrollbar">
      {/* Blue accent bar */}
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-tl-2xl bg-gradient-to-r from-blue-500 to-cyan-400" />
      <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-500">Focus Timer</p>
      <CountdownPanel onSessionComplete={onSessionComplete} />
    </div>

    {/* RIGHT — Stopwatch */}
    <div className="relative flex flex-col bg-slate-900 border-r border-white-[0.05] p-6 overflow-y-auto blend-scrollbar">
      {/* Violet accent bar */}
      <div className="absolute inset-x-0 top-0 h-[2px] rounded-tr-2xl bg-gradient-to-r from-violet-500 to-purple-400" />
      <StopwatchPanel />
    </div>

  </div>
);

export default FocusTimer;

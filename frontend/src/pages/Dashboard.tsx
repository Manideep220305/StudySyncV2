import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clock,
  Flame,
  Hash,
  Loader2,
  Plus,
  PlayCircle,
  Sparkles,
  Target,
  Timer,
  Trophy,
  Zap,
} from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import QuestLog from '@/components/dashboard/Questlog';
import FocusTimer from '@/components/FocusTimer';
import { SidebarLayout } from '@/components/SidebarLayout';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import groupService, { Group } from '@/services/groupService';
import pointsService from '@/services/pointsService';
import profileService, { AccuracyTopic, ProfileResponse } from '@/services/profileService';
import taskService from '@/services/taskService';

// ─────────────────────────────────────────────
// DASHBOARD DESIGN NOTE
// This page is intentionally a "control layer" (planning + execution triggers),
// while communication lives in Rooms. Most data is derived from:
//   1) profileService.getMyProfile()   -> XP events, rank, summary stats
//   2) taskService.getTasks()          -> task queue + category signals
// The memoized blocks below transform those raw records into high-signal widgets.
// ─────────────────────────────────────────────

type ModalType = 'create' | 'join' | null;

interface DashboardTask {
  _id: string;
  title: string;
  isCompleted: boolean;
  xpValue?: number;
  category?: 'DSA' | 'Development' | 'College' | 'Other';
  createdAt?: string;
  updatedAt?: string;
}

interface FocusSession {
  id: string;
  title: string;
  startsAt: string;
  status: 'done' | 'upcoming';
}

// Shared framer-motion container for staggered child reveals.
// Used in high-density blocks so cards animate sequentially instead of popping together.
const staggerContainer = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.05,
    },
  },
};

const fadeItem = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } },
};

const AuroraLayer: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-[#020617]">
    <div
      className="absolute inset-0 opacity-20 animate-wave-aurora"
      style={{
        backgroundImage: `radial-gradient(circle at 15% 50%, rgba(37, 99, 235, 0.15), transparent 25%),
                          radial-gradient(circle at 85% 30%, rgba(139, 92, 246, 0.15), transparent 25%)`,
        filter: 'blur(100px)',
      }}
    />
  </div>
);

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  accent: string;
  iconBg: string;
  delay?: number;
}

// Top summary card component (XP/Rank/Groups).
// Kept generic so adding future stats doesn't duplicate UI styles.
const StatCard: React.FC<StatCardProps> = ({ icon, label, value, accent, iconBg, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95, y: 15 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
    whileHover={{ y: -5, scale: 1.02 }}
    className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-6 shadow-sm backdrop-blur-xl ring-1 ring-white/5 transition-all"
  >
    <div className="absolute inset-x-0 top-0 h-[2px] w-full" style={{ background: accent }} />
    <div
      className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full blur-3xl opacity-20 transition-opacity group-hover:opacity-40"
      style={{ background: accent }}
    />
    <div className="flex items-center gap-5">
      <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${iconBg} shadow-lg ring-1 ring-white/10`}>{icon}</div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">{label}</p>
        <p className="mt-1 text-3xl font-extrabold tracking-tight text-white">{value}</p>
      </div>
    </div>
  </motion.div>
);

interface TrendCardProps {
  title: string;
  value: string;
  subText: string;
  positive: boolean;
}

// Small reusable trend tile used in the weekly trend row.
const TrendCard: React.FC<TrendCardProps> = ({ title, value, subText, positive }) => (
  <motion.div
    whileHover={{ y: -4, scale: 1.02 }}
    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    className="rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-5 shadow-xl backdrop-blur-xl ring-1 ring-white/5"
  >
    <div className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{title}</div>
    <div className="mt-3 text-3xl font-extrabold tracking-tight text-white">{value}</div>
    <div className={`mt-2 flex items-center gap-1 text-[13px] font-medium ${positive ? 'text-emerald-400' : 'text-amber-400'}`}>
      <span className={`inline-block h-1.5 w-1.5 rounded-full ${positive ? 'bg-emerald-400' : 'bg-amber-400'}`} />
      {subText}
    </div>
  </motion.div>
);

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

// Shared modal shell used by both Create and Join group dialogs.
// Keeps visual language + close behavior consistent.
const ModalShell: React.FC<ModalShellProps> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.18 }}
      className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-sm"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 to-violet-500" />
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-bold text-white">{title}</h2>
        <button onClick={onClose} className="text-slate-400 transition hover:text-white">x</button>
      </div>
      {children}
    </motion.div>
  </div>
);

const CreateGroupModal: React.FC<{ onClose: () => void; onCreated: (group: Group) => void }> = ({ onClose, onCreated }) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Creates a group via API, then bubbles the created payload up to Dashboard
  // so the parent can refresh summary data and close the modal.
  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ description: 'Group name is required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const newGroup = await groupService.createGroup({
        name: name.trim(),
        description: description.trim(),
      });
      onCreated(newGroup);
      toast({ description: `Group "${newGroup.name}" created` });
      onClose();
    } catch {
      toast({ description: 'Failed to create group', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Create Study Group" onClose={onClose}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Group Name</label>
      <input
        className="w-full rounded-xl border border-white/10 bg-slate-800/70 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
        placeholder="e.g. DSA Grind Squad"
        value={name}
        onChange={(event) => setName(event.target.value)}
        maxLength={50}
      />
      <label className="mb-1 mt-4 block text-xs font-semibold uppercase tracking-widest text-slate-500">Description</label>
      <textarea
        className="w-full resize-none rounded-xl border border-white/10 bg-slate-800/70 px-4 py-3 text-sm text-white focus:border-blue-500 focus:outline-none"
        rows={3}
        placeholder="What will this group focus on?"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={200}
      />
      <Button className="mt-5 w-full bg-blue-600 hover:bg-blue-500" onClick={handleCreate} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
        Create Group
      </Button>
    </ModalShell>
  );
};

const JoinGroupModal: React.FC<{ onClose: () => void; onJoined: (group: Group) => void }> = ({ onClose, onJoined }) => {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  // Joins by code and normalizes API response shape.
  // Some backend handlers return { group }, some return the object directly.
  const handleJoin = async () => {
    if (!code.trim()) {
      toast({ description: 'Join code is required', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const response = await groupService.joinGroup(code.trim().toUpperCase());
      const joined = response.group ?? response;
      onJoined(joined);
      toast({ description: `Joined "${joined.name}"` });
      onClose();
    } catch {
      toast({ description: 'Invalid join code or already in group', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Join Study Group" onClose={onClose}>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-slate-500">Join Code</label>
      <input
        className="w-full rounded-xl border border-white/10 bg-slate-800/70 px-4 py-3 text-center font-mono text-sm uppercase tracking-[0.35em] text-white focus:border-blue-500 focus:outline-none"
        placeholder="ABC123"
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        maxLength={6}
      />
      <Button className="mt-5 w-full bg-emerald-600 hover:bg-emerald-500" onClick={handleJoin} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hash className="mr-2 h-4 w-4" />}
        Join Group
      </Button>
    </ModalShell>
  );
};

const reasonLabel: Record<string, string> = {
  task_resolved: 'Task',
  pomodoro: 'Pomodoro',
  quiz_win: 'Quiz',
};

export default function Dashboard() {
  // --- Core app hooks ---
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();

  // --- Source-of-truth state for dashboard data ---
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [tasks, setTasks] = useState<DashboardTask[]>([]);
  // Real quiz-topic accuracy payload (replaces previous task-proxy radar source).
  const [accuracyTopics, setAccuracyTopics] = useState<AccuracyTopic[]>([]);

  // --- UI-only state ---
  const [profileLoading, setProfileLoading] = useState(true);
  const [activeModal, setActiveModal] = useState<ModalType>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Refs used for smooth "jump to block" actions.
  const timerSectionRef = useRef<HTMLDivElement | null>(null);
  const questSectionRef = useRef<HTMLDivElement | null>(null);

  // Generic helper used by quick-actions and activity feed buttons.
  const scrollToSection = (ref: React.RefObject<HTMLDivElement | null>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (searchParams.get('focus') !== 'quests') return;
    const timeout = setTimeout(() => {
      questSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => clearTimeout(timeout);
  }, [searchParams]);

  // Fetch profile + tasks together so all derived widgets stay in sync.
  // This is intentionally a single dashboard loader to avoid stale cross-widget states.
  const loadDashboardData = useCallback(async () => {
    try {
      setProfileLoading(true);
      const [profileData, taskData] = await Promise.all([
        profileService.getMyProfile(),
        taskService.getTasks(),
      ]);

      // Accuracy fetch is isolated so dashboard still loads even if analytics API fails.
      profileService
        .getMyAccuracy()
        .then((accuracyData) => {
          setAccuracyTopics(Array.isArray(accuracyData?.topics) ? accuracyData.topics : []);
        })
        .catch(() => {
          setAccuracyTopics([]);
        });

      setProfile(profileData);

      const normalizedTasks = Array.isArray(taskData)
        ? taskData
        : Array.isArray(taskData?.data)
          ? taskData.data
          : [];

      setTasks(normalizedTasks);
    } catch {
      toast({ description: 'Failed to load dashboard data', variant: 'destructive' });
    } finally {
      setProfileLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    // Initial mount fetch for full dashboard payload.
    loadDashboardData();
  }, [loadDashboardData]);

  // Timer completion callback: persist XP event, then refresh summary cards.
  // If XP logging fails, timer UX still succeeds and user gets a non-blocking toast.
  const handleSessionComplete = useCallback((xp: number) => {
    pointsService
      .logPomodoroCompletion(xp)
      .then(() => loadDashboardData())
      .catch(() => toast({ description: 'Could not sync pomodoro points', variant: 'destructive' }));
  }, [loadDashboardData, toast]);

  const statValues = useMemo(() => ({
    // Top stat cards are intentionally simple and resilient to missing data.
    xp: profile?.user.totalPoints ?? '--',
    rank: profile?.globalRank ? `#${profile.globalRank}` : '--',
    groups: profile?.groupsCount ?? '--',
  }), [profile]);

  const todayMetrics = useMemo(() => {
    // Mission-strip metrics are computed only from today's events + adaptive targets.
    // Targets are intentionally adaptive so beginners are not overwhelmed and advanced
    // users still see meaningful daily goals.
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const events = profile?.recentEvents ?? [];

    const todayEvents = events.filter((event) => new Date(event.createdAt) >= startOfToday);
    const xpToday = todayEvents.reduce((total, event) => total + event.points, 0);
    const pomodoroDone = todayEvents.filter((event) => event.reason === 'pomodoro').length;
    const tasksDone = todayEvents.filter((event) => event.reason === 'task_resolved').length;

    const totalXp = profile?.user.totalPoints ?? 0;
    // IMPORTANT: Adaptive XP target tiers. Tune these 3 numbers to change overall daily difficulty.
    const xpTarget = totalXp < 500 ? 120 : totalXp < 1500 ? 180 : 250;
    const pomodoroTarget = 6;
    const taskTarget = 5;
    const hasLiveToday = todayEvents.length > 0;

    return {
      xpToday,
      pomodoroDone,
      tasksDone,
      xpTarget,
      pomodoroTarget,
      taskTarget,
      hasLiveToday,
    };
  }, [profile]);

  const missionStripMetrics = useMemo(() => {
    return {
      xpToday: todayMetrics.xpToday,
      pomodoroDone: todayMetrics.pomodoroDone,
      tasksDone: todayMetrics.tasksDone,
      source: todayMetrics.hasLiveToday ? 'live' as const : 'empty' as const,
    };
  }, [todayMetrics.hasLiveToday, todayMetrics.pomodoroDone, todayMetrics.tasksDone, todayMetrics.xpToday]);

  const priorityTasks = useMemo(() => {
    // Priority Queue score combines age (urgency), XP value (impact), and category weight.
    // Age grows urgency over time so old unfinished tasks naturally rise.
    // IMPORTANT: Category weight strongly affects queue rank. DSA is intentionally highest priority.
    const categoryWeight: Record<string, number> = {
      DSA: 14,
      Development: 10,
      College: 8,
      Other: 5,
    };

    const now = Date.now();

    return tasks
      .filter((task) => !task.isCompleted)
      .map((task) => {
        const createdTime = task.createdAt ? new Date(task.createdAt).getTime() : now;
        const ageDays = Math.max(0, (now - createdTime) / (1000 * 60 * 60 * 24));
        // IMPORTANT: Urgency coefficient (2.8) controls how quickly old tasks climb the queue.
        const urgencyScore = Math.min(20, ageDays * 2.8);
        // IMPORTANT: Impact coefficient (1.2) defines how much XP value influences rank.
        const impactScore = Math.min(20, (task.xpValue ?? 10) * 1.2);
        const categoryScore = categoryWeight[task.category || 'Other'] || 5;
        const score = urgencyScore + impactScore + categoryScore;
        return { ...task, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [tasks]);

  const finishByEstimate = useMemo(() => {
    // "Finish by" is an estimate: remaining focus load mapped to future clock time.
    // This is a soft planning hint, not a strict deadline.
    if (!todayMetrics.hasLiveToday) {
      return 'Not started';
    }

    const now = new Date();
    const remainingPomodoros = Math.max(0, todayMetrics.pomodoroTarget - missionStripMetrics.pomodoroDone);
    const remainingTasks = Math.max(0, todayMetrics.taskTarget - missionStripMetrics.tasksDone);

    if (remainingPomodoros === 0 && remainingTasks === 0) {
      return 'Done for today';
    }

    const focusMinutes = Math.max(25, (remainingPomodoros + remainingTasks) * 25);
    const finishDate = new Date(now.getTime() + focusMinutes * 60 * 1000);
    return finishDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }, [missionStripMetrics.pomodoroDone, missionStripMetrics.tasksDone, todayMetrics.hasLiveToday, todayMetrics.pomodoroTarget, todayMetrics.taskTarget]);

  const trendMetrics = useMemo(() => {
    // Weekly trend cards compare current 7-day window vs previous 7-day window.
    // Percentage helper gracefully handles prev=0 so we avoid divide-by-zero noise.
    const events = profile?.recentEvents ?? [];
    const now = Date.now();
    const oneDay = 24 * 60 * 60 * 1000;
    const startCurrent = now - 7 * oneDay;
    const startPrevious = now - 14 * oneDay;

    const current = events.filter((event) => {
      const t = new Date(event.createdAt).getTime();
      return t >= startCurrent;
    });

    const previous = events.filter((event) => {
      const t = new Date(event.createdAt).getTime();
      return t >= startPrevious && t < startCurrent;
    });

    const currentXp = current.reduce((sum, event) => sum + event.points, 0);
    const previousXp = previous.reduce((sum, event) => sum + event.points, 0);

    const currentPomodoros = current.filter((event) => event.reason === 'pomodoro').length;
    const previousPomodoros = previous.filter((event) => event.reason === 'pomodoro').length;

    const currentTasks = current.filter((event) => event.reason === 'task_resolved').length;
    const previousTasks = previous.filter((event) => event.reason === 'task_resolved').length;

    const pct = (curr: number, prev: number) => {
      if (prev === 0 && curr > 0) return 100;
      if (prev === 0 && curr === 0) return 0;
      return Math.round(((curr - prev) / prev) * 100);
    };

    return {
      xp: { value: currentXp, delta: pct(currentXp, previousXp) },
      focusHours: {
        value: (currentPomodoros * 25) / 60,
        delta: pct(currentPomodoros, previousPomodoros),
      },
      completionRate: {
        value: Math.round((currentTasks / Math.max(1, todayMetrics.taskTarget * 7)) * 100),
        delta: pct(currentTasks, previousTasks),
      },
    };
  }, [profile, todayMetrics.taskTarget]);

  const milestone = useMemo(() => {
    // Milestone ladder: next 500-XP checkpoint for progress motivation.
    // Progress is clamped to [0,100] to avoid rendering glitches from edge cases.
    const xp = profile?.user.totalPoints ?? 0;
    // IMPORTANT: XP milestone spacing. Lower value = more frequent milestone celebrations.
    const step = 500;
    const next = Math.ceil((xp + 1) / step) * step;
    const previous = Math.floor(xp / step) * step;
    const progress = Math.min(100, Math.max(0, ((xp - previous) / (next - previous || step)) * 100));
    return { xp, next, progress: Math.round(progress) };
  }, [profile]);

  const streak = useMemo(() => {
    // Streak model: continuity with token-based forgiveness for missed days.
    // Loop walks backward from today and consumes token(s) only when a day is missed.
    const events = profile?.recentEvents ?? [];
    const activeDays = new Set(events.map((event) => new Date(event.createdAt).toDateString()));
    const totalXp = profile?.user.totalPoints ?? 0;
    // IMPORTANT: Recovery token scaling. Every +1500 XP adds forgiveness, capped at 3.
    const totalTokens = Math.min(3, 1 + Math.floor(totalXp / 1500));

    let remainingTokens = totalTokens;
    let streakDays = 0;
    for (let offset = 0; offset < 60; offset += 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - offset);

      if (activeDays.has(day.toDateString())) {
        streakDays += 1;
      } else if (remainingTokens > 0) {
        remainingTokens -= 1;
        streakDays += 1;
      } else {
        break;
      }
    }

    return {
      days: streakDays,
      recoveryTokens: remainingTokens,
      totalTokens,
    };
  }, [profile]);

  const heatmapCells = useMemo(() => {
    // 12-week activity heatmap (84 days) with 5 intensity levels.
    // Level thresholds are relative to the user's own max activity so visualization
    // remains meaningful across light and heavy usage patterns.
    const events = profile?.recentEvents ?? [];
    const countByDate = new Map<string, number>();

    const keyFor = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    events.forEach((event) => {
      const key = keyFor(new Date(event.createdAt));
      countByDate.set(key, (countByDate.get(key) || 0) + 1);
    });

    const cells: Array<{ key: string; count: number; level: number; label: string }> = [];
    const maxCount = Math.max(1, ...Array.from(countByDate.values()));
    for (let i = 83; i >= 0; i -= 1) {
      const day = new Date();
      day.setHours(0, 0, 0, 0);
      day.setDate(day.getDate() - i);
      const key = keyFor(day);
      const count = countByDate.get(key) || 0;
      const ratio = count / maxCount;
      // IMPORTANT: Heatmap level thresholds. Adjust these to make cells appear denser/sparser.
      const level = count === 0 ? 0 : ratio < 0.35 ? 1 : ratio < 0.65 ? 2 : ratio < 0.9 ? 3 : 4;
      cells.push({
        key,
        count,
        level,
        label: `${day.toLocaleDateString()}: ${count} activities`,
      });
    }

    return cells;
  }, [profile]);

  const focusPlan = useMemo<FocusSession[]>(() => {
    // Focus plan creates practical upcoming sessions anchored to priority tasks.
    // Session count is bounded so the panel remains actionable and not noisy.
    if (!priorityTasks.length && !todayMetrics.hasLiveToday) {
      return [];
    }

    const remainingPomodoros = Math.max(0, todayMetrics.pomodoroTarget - todayMetrics.pomodoroDone);
    // IMPORTANT: Focus session count bounds. Keeps planning panel actionable (not too short or noisy).
    const plannedCount = Math.max(4, Math.min(8, remainingPomodoros + 2));
    const baseHour = new Date();
    baseHour.setMinutes(0, 0, 0);
    const startsAt = new Date(baseHour.getTime() + 60 * 60 * 1000);

    return Array.from({ length: plannedCount }, (_, index) => {
      const slot = new Date(startsAt.getTime() + index * 55 * 60 * 1000);
      const sourceTask = priorityTasks[index % Math.max(1, priorityTasks.length)];
      return {
        id: `session-${index}`,
        title: sourceTask?.title || `Deep Work Sprint ${index + 1}`,
        startsAt: slot.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        status: index < todayMetrics.pomodoroDone ? 'done' : 'upcoming',
      };
    });
  }, [priorityTasks, todayMetrics.pomodoroDone, todayMetrics.pomodoroTarget]);

  const nextSession = useMemo(
    () => focusPlan.find((session) => session.status === 'upcoming') || null,
    [focusPlan]
  );

  const weakTopicRadar = useMemo(() => {
    // Weak Topic Radar now uses true quiz attempt analytics from /api/profile/accuracy.
    // IMPORTANT: Weak-topic threshold rule remains the same for continuity in UX expectations.
    return (accuracyTopics || [])
      .map((topic) => {
        const attempts = topic.currentAttempts || 0;
        const currAccuracy = topic.currentAccuracy || 0;
        const delta = topic.delta || 0;
        return {
          topic: topic.topic,
          currentAccuracy: currAccuracy,
          previousAccuracy: topic.previousAccuracy || 0,
          delta,
          attempts,
          isWeak: attempts >= 2 && (delta <= -10 || currAccuracy < 60),
        };
      })
      .sort((a, b) => {
        if (a.isWeak !== b.isWeak) {
          return a.isWeak ? -1 : 1;
        }
        return a.delta - b.delta;
      });
  }, [accuracyTopics]);

  const systemPulse = useMemo(() => {
    const groupsJoined = profile?.groupsCount ?? 0;
    const completionProgress = Math.round(
      ((missionStripMetrics.pomodoroDone + missionStripMetrics.tasksDone) /
        Math.max(1, todayMetrics.pomodoroTarget + todayMetrics.taskTarget)) * 100
    );

    if (!todayMetrics.hasLiveToday && !priorityTasks.length && groupsJoined === 0) {
      return {
        sprintLabel: 'No active session',
        sprintSummary: 'Create your first task or complete one focus cycle to generate live guidance.',
        suggestedMinutes: 0,
        teammateLine: 'Join or create a group to unlock room-based activity signals.',
        confidence: 0,
        riskLine: 'No active risk signals yet.',
        promptQuestion: 'What is the first task you want to finish today?',
      };
    }

    return {
      sprintLabel: priorityTasks[0]?.title || 'Next focus block',
      sprintSummary: priorityTasks.length
        ? 'Your highest-priority pending task is ready for a focused session.'
        : 'You have activity today, but no pending priority tasks right now.',
      suggestedMinutes: priorityTasks.length ? 25 : 0,
      teammateLine:
        groupsJoined > 0
          ? `You are currently in ${groupsJoined} group${groupsJoined === 1 ? '' : 's'}.`
          : 'No study groups joined yet.',
      confidence: completionProgress,
      riskLine: priorityTasks.length
        ? `Main blocker: ${priorityTasks[0].title} is still pending.`
        : 'No pending blockers detected.',
      promptQuestion: priorityTasks.length
        ? 'Can you close your top-priority task in the next 25 minutes?'
        : 'What is the next concrete action you want to take?',
    };
  }, [missionStripMetrics.pomodoroDone, missionStripMetrics.tasksDone, priorityTasks, profile?.groupsCount, todayMetrics.hasLiveToday, todayMetrics.pomodoroTarget, todayMetrics.taskTarget]);

  const handleStartNextSession = () => {
    // Button flow: mark active session in UI -> scroll to timer -> show toast confirmation.
    if (!nextSession) {
      toast({ description: 'All planned focus sessions are done for today.' });
      return;
    }

    setActiveSessionId(nextSession.id);
    scrollToSection(timerSectionRef);
    toast({ description: `Starting: ${nextSession.title}` });
  };

  return (
    <>
      <AuroraLayer />
      <SidebarLayout>
        {/*
          Main content stack order:
          1) Identity + top stats
          2) Daily planning (mission, queue, streak)
          3) Consistency + execution blocks
          4) Navigation/action helpers
          5) Trends, radar, and execution tools (timer/tasks)
        */}
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col gap-10 pb-24 pt-4">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="flex items-baseline gap-3">
              <h1 className="text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                Welcome back,{' '}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
                  {user?.username || 'Scholar'}
                </span>
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Use Dashboard to plan your day, then open Rooms to create, join, and chat inside study groups.
            </p>
          </motion.div>

          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 gap-4 sm:grid-cols-3"
          >
            <motion.div variants={fadeItem} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
            <StatCard
              icon={<Zap className="h-5 w-5 text-amber-300" />}
              label="Total XP"
              value={statValues.xp}
              accent="linear-gradient(90deg,#f59e0b,#fbbf24)"
              iconBg="bg-amber-500/15 border border-amber-500/20"
              delay={0.05}
            />
            </motion.div>
            <motion.div variants={fadeItem} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
            <StatCard
              icon={<Trophy className="h-5 w-5 text-blue-300" />}
              label="Global Rank"
              value={statValues.rank}
              accent="linear-gradient(90deg,#3b82f6,#60a5fa)"
              iconBg="bg-blue-500/15 border border-blue-500/20"
              delay={0.1}
            />
            </motion.div>
            <motion.div variants={fadeItem} whileHover={{ y: -3 }} transition={{ type: 'spring', stiffness: 220, damping: 20 }}>
            <StatCard
              icon={<Target className="h-5 w-5 text-violet-300" />}
              label="Groups Joined"
              value={statValues.groups}
              accent="linear-gradient(90deg,#8b5cf6,#a78bfa)"
              iconBg="bg-violet-500/15 border border-violet-500/20"
              delay={0.15}
            />
            </motion.div>
          </motion.div>

          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
            className="relative overflow-hidden rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5"
          >
            {/* Subtle mesh background for premium feel */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5 pointer-events-none mix-blend-overlay"></div>
            
            {/* Daily mission strip: all cards derive from today's events + adaptive targets. */}
            <div className="mb-6 flex items-center justify-between relative z-10">
              <div>
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Today's Mission</h2>
                <p className="mt-1 text-sm text-slate-400">Your personal targets and finish estimate for today.</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-500/10 ring-1 ring-cyan-500/20">
                <CalendarClock className="h-6 w-6 text-cyan-400" />
              </div>
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.25 }}
              className="grid grid-cols-1 gap-5 md:grid-cols-4 relative z-10"
            >
              <motion.div variants={fadeItem} whileHover={{ y: -4, scale: 1.02 }} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-sm transition-all">
                <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">XP Target</div>
                <div className="mt-3 text-3xl font-extrabold tracking-tight text-white">
                  {missionStripMetrics.xpToday} <span className="text-lg text-slate-500 font-medium">/ {todayMetrics.xpTarget}</span>
                </div>
                <div className="mt-4 h-2.5 rounded-full bg-slate-800/80 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                    style={{ width: `${Math.min(100, (missionStripMetrics.xpToday / todayMetrics.xpTarget) * 100)}%` }}
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeItem} whileHover={{ y: -4, scale: 1.02 }} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-sm transition-all">
                <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Pomodoros</div>
                <div className="mt-3 text-3xl font-extrabold tracking-tight text-white">
                  {missionStripMetrics.pomodoroDone} <span className="text-lg text-slate-500 font-medium">/ {todayMetrics.pomodoroTarget}</span>
                </div>
                <div className="mt-4 h-2.5 rounded-full bg-slate-800/80 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300 shadow-[0_0_10px_rgba(59,130,246,0.5)]"
                    style={{ width: `${Math.min(100, (missionStripMetrics.pomodoroDone / todayMetrics.pomodoroTarget) * 100)}%` }}
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeItem} whileHover={{ y: -4, scale: 1.02 }} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-sm transition-all">
                <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Tasks</div>
                <div className="mt-3 text-3xl font-extrabold tracking-tight text-white">
                  {missionStripMetrics.tasksDone} <span className="text-lg text-slate-500 font-medium">/ {todayMetrics.taskTarget}</span>
                </div>
                <div className="mt-4 h-2.5 rounded-full bg-slate-800/80 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-400 shadow-[0_0_10px_rgba(139,92,246,0.5)]"
                    style={{ width: `${Math.min(100, (missionStripMetrics.tasksDone / todayMetrics.taskTarget) * 100)}%` }}
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeItem} whileHover={{ y: -4, scale: 1.02 }} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-sm transition-all">
                <div className="text-[11px] font-bold uppercase tracking-[0.15em] text-slate-400">Finish By</div>
                <div className="mt-3 text-3xl font-extrabold tracking-tight text-white">{finishByEstimate}</div>
                <p className="mt-3 text-[11px] leading-relaxed text-slate-400 font-medium">
                  {todayMetrics.hasLiveToday
                    ? 'Estimated from pending focus load'
                    : 'Starts calculating after your first action.'}
                </p>
              </motion.div>
            </motion.div>
          </motion.section>

          {/* Moved Tasklog up based on user request - Execution Hub */}
          <motion.section
            ref={questSectionRef}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.25, ease: 'easeOut' }}
            className="relative w-full rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5"
          >
             <div className="mb-6 flex items-baseline justify-between relative z-10">
                <h2 className="text-2xl font-extrabold text-white tracking-tight">Active Quests & Tasks</h2>
             </div>
            <div className="h-[600px] overflow-y-auto blend-scrollbar pr-2 pb-2">
              <QuestLog />
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.27, ease: 'easeOut' }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-3"
          >
            {/* Priority queue (left) + streak resilience panel (right). */}
            <div className="flex flex-col rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5 lg:col-span-2">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Smart Priority Queue</h2>
                  <p className="mt-1 text-sm text-slate-400">Top 3 tasks sorted by urgency and impact.</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                    <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                </div>
              </div>

              {priorityTasks.length ? (
                <div className="space-y-3 flex-1">
                  {/* Each row shows priority rank + category context + XP impact. */}
                  {priorityTasks.map((task, index) => (
                    <motion.div whileHover={{ x: 4 }} key={task._id} className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-5 py-4 transition-all hover:bg-white/[0.04]">
                      <div>
                        <div className="text-base font-semibold text-white">
                          <span className="mr-2 text-slate-500">#{index + 1}</span>
                          {task.title}
                        </div>
                        <div className="mt-1.5 flex items-center gap-3 text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                          <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" />{task.category || 'Other'}</span>
                          <span className="text-amber-400/80">{task.xpValue ?? 10} XP</span>
                        </div>
                      </div>
                      <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-400 shadow-sm">
                        Priority {Math.round(task.score)}
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/5 p-8 text-sm text-slate-400">
                  No pending tasks. Add new quests to generate your queue.
                </div>
              )}

              <div className="mt-6">
                <Button variant="outline" className="w-full sm:w-auto h-11 border-white/10 bg-white/5 hover:bg-white/10 text-white rounded-xl" onClick={() => scrollToSection(questSectionRef)}>
                  Open Task Board <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="flex flex-col justify-between rounded-3xl border border-slate-700/50 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-orange-900/20 via-[#0f172a]/80 to-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5 relative overflow-hidden">
              <div className="absolute -top-12 -right-12 h-32 w-32 bg-orange-500/20 blur-3xl rounded-full"></div>
              <div>
                  <div className="mb-4 flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20 text-orange-400">
                        <Flame className="h-4 w-4" />
                    </div>
                    <h3 className="text-sm font-bold uppercase tracking-widest text-white/90">Streak</h3>
                  </div>
                  <div className="text-5xl font-extrabold tracking-tighter text-white drop-shadow-md">{streak.days} <span className="text-2xl text-slate-500 font-medium">days</span></div>
                  <p className="mt-2 text-sm text-slate-400">Consistency streak (active days)</p>
              </div>
              <div className="mt-8 rounded-2xl border border-white/10 bg-black/20 p-5 backdrop-blur-md">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-400">Recovery Tokens</div>
                <div className="mt-2 flex items-baseline gap-2">
                    <span className="text-3xl font-extrabold text-cyan-400">{streak.recoveryTokens}</span>
                    <span className="text-sm font-medium text-slate-500">/ {streak.totalTokens} available</span>
                </div>
                <p className="mt-2 text-[10px] leading-relaxed text-slate-500">Used to preserve your streak if you miss a day.</p>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.28, ease: 'easeOut' }}
            className="rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5"
          >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">System Pulse</h2>
                  <p className="mt-1 text-sm text-slate-400">Live dashboard guidance based on your actual activity.</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                  <Sparkles className="h-5 w-5 text-violet-400" />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              <motion.div whileHover={{ y: -3, scale: 1.01 }} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-sm transition-all hover:bg-white/[0.04]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Suggested Block</p>
                <p className="mt-3 text-base font-semibold text-white">{systemPulse.sprintLabel}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-400">{systemPulse.sprintSummary}</p>
                <div className="mt-4 inline-flex items-center rounded-lg bg-blue-500/10 px-3 py-1.5 text-xs font-medium text-blue-400 ring-1 ring-blue-500/20">
                  <PlayCircle className="mr-2 h-3.5 w-3.5" />
                  {systemPulse.suggestedMinutes} min deep block
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -3, scale: 1.01 }} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-sm transition-all hover:bg-white/[0.04]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Cohort Momentum</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-300">{systemPulse.teammateLine}</p>
                <div className="mt-4 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]" style={{ width: `${systemPulse.confidence}%` }}></div>
                  </div>
                  <span className="text-xs font-bold text-emerald-400">{systemPulse.confidence}%</span>
                </div>
              </motion.div>

              <motion.div whileHover={{ y: -3, scale: 1.01 }} className="rounded-2xl border border-white/5 bg-white/[0.02] p-5 shadow-sm transition-all hover:bg-white/[0.04]">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Risk Radar</p>
                <div className="mt-3 flex items-start gap-2">
                   <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
                   <p className="text-sm leading-relaxed text-amber-200/90">{systemPulse.riskLine}</p>
                </div>
                <p className="mt-3 border-t border-white/5 pt-3 text-xs italic text-slate-400">"{systemPulse.promptQuestion}"</p>
              </motion.div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.29, ease: 'easeOut' }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-3"
          >
            {/* Heatmap visualizes long-term consistency; focus plan converts it into next actions. */}
            <div className="rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5 lg:col-span-2">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">Consistency Heatmap</h2>
                  <p className="mt-1 text-sm text-slate-400">Last 12 weeks of activity intensity.</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
                   <Activity className="h-5 w-5 text-emerald-400" />
                </div>
              </div>

              <div className="overflow-x-auto blend-scrollbar pb-2">
                {/* 7 rows x 12 weeks-ish columns. Cells animate into view for progressive reveal. */}
                <div className="grid grid-flow-col grid-rows-7 gap-1.5 min-w-[620px] pt-2">
                  {heatmapCells.map((cell, idx) => {
                    const levelClass =
                      cell.level === 0
                        ? 'bg-slate-800/50 border border-white/5'
                        : cell.level === 1
                          ? 'bg-emerald-900/60 border border-emerald-800/50'
                          : cell.level === 2
                            ? 'bg-emerald-700/70 border border-emerald-600/50'
                            : cell.level === 3
                              ? 'bg-emerald-500/80 border border-emerald-400/50'
                              : 'bg-emerald-300 shadow-[0_0_8px_rgba(110,231,183,0.6)]';
                    return (
                      <motion.div
                        key={cell.key}
                        initial={{ opacity: 0, scale: 0.5 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, amount: 0.35 }}
                        transition={{ duration: 0.2, delay: Math.min(0.4, idx * 0.005) }}
                        title={cell.label}
                        className={`h-4 w-4 rounded-sm transition-all hover:scale-125 hover:z-10 ${levelClass}`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="mt-5 flex items-center justify-end gap-2 text-[11px] font-medium tracking-wider uppercase text-slate-500">
                <span>Less</span>
                <span className="h-3 w-3 rounded-[2px] bg-slate-800/50 border border-white/5" />
                <span className="h-3 w-3 rounded-[2px] bg-emerald-900/60 border border-emerald-800/50" />
                <span className="h-3 w-3 rounded-[2px] bg-emerald-700/70 border border-emerald-600/50" />
                <span className="h-3 w-3 rounded-[2px] bg-emerald-500/80 border border-emerald-400/50" />
                <span className="h-3 w-3 rounded-[2px] bg-emerald-300 shadow-sm" />
                <span>More</span>
              </div>
            </div>

            <div className="flex flex-col rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5 relative overflow-hidden">
              <div className="absolute top-0 right-0 h-40 w-40 bg-cyan-500/10 blur-[50px] pointer-events-none"></div>
              
              <div className="mb-6 flex items-center justify-between z-10">
                <h3 className="text-xl font-bold text-white tracking-tight">Focus Plan</h3>
                <PlayCircle className="h-5 w-5 text-cyan-400" />
              </div>

              <div className="space-y-3 flex-1 z-10">
                {/* Upcoming sessions are generated from current queue + remaining daily target load. */}
                {focusPlan.length > 0 ? (
                  focusPlan.slice(0, 5).map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, x: 10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, amount: 0.2 }}
                      transition={{ duration: 0.3 }}
                      className={`rounded-2xl border px-4 py-3 transition-all ${
                        session.status === 'done'
                          ? 'border-emerald-500/20 bg-emerald-500/10 opacity-70'
                          : activeSessionId === session.id
                            ? 'border-cyan-400/50 bg-cyan-500/10 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-sm font-semibold text-white truncate">{session.title}</div>
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 shrink-0">{session.startsAt}</div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-6 text-center text-sm text-slate-400">
                    No focus plan yet. Add a task or start a session to build one.
                  </div>
                )}
              </div>

              <Button className="mt-6 w-full h-12 rounded-xl bg-cyan-600 font-bold hover:bg-cyan-500 shadow-lg shadow-cyan-500/20 z-10 transition-transform active:scale-[0.98]" onClick={handleStartNextSession} disabled={!nextSession}>
                Start Next Session <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: 'easeOut' }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-3"
          >
            {/* Compact quick-action nav plus contextual "Now Snapshot". */}
            <div className="flex flex-col rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5 lg:col-span-2">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">One-Click Actions</h2>
                  <p className="mt-1 text-sm text-slate-400">Compact shortcuts + priority context.</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 ring-1 ring-blue-500/20">
                  <Sparkles className="h-5 w-5 text-blue-400" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 mb-6">
                <Button size="sm" className="h-10 justify-between bg-blue-600 px-4 text-xs font-bold hover:bg-blue-500 shadow-md shadow-blue-500/20" onClick={() => navigate('/rooms')}>
                  Rooms <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-10 justify-between border-white/10 bg-white/5 px-4 text-xs hover:bg-white/10" onClick={() => navigate('/leaderboard')}>
                  Board <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-10 justify-between border-white/10 bg-white/5 px-4 text-xs hover:bg-white/10" onClick={() => navigate('/profile')}>
                  Profile <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-10 justify-between border-white/10 bg-white/5 px-4 text-xs hover:bg-white/10" onClick={() => setActiveModal('create')}>
                  Create <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-10 justify-between border-white/10 bg-white/5 px-4 text-xs hover:bg-white/10" onClick={() => setActiveModal('join')}>
                  Join <Hash className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-10 justify-between border-white/10 bg-white/5 px-4 text-xs hover:bg-white/10" onClick={() => scrollToSection(timerSectionRef)}>
                  Focus <Timer className="h-3.5 w-3.5 text-cyan-400" />
                </Button>
              </div>

              <div className="mt-auto grid grid-cols-1 gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 pb-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Now</div>
                  <div className="mt-2 truncate text-sm font-semibold text-white">
                    {priorityTasks[0]?.title || 'No urgent task'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 pb-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Next Focus</div>
                  <div className="mt-2 truncate text-sm font-semibold text-white">
                    {nextSession ? `${nextSession.startsAt} - ${nextSession.title}` : 'Plan complete'}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 pb-4">
                  <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Recovery</div>
                  <div className="mt-2 text-sm font-semibold text-cyan-400">
                    {streak.recoveryTokens} / {streak.totalTokens} tokens left
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5">
              {/* Recent events are intentionally actionable (open task/timer/leaderboard). */}
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white tracking-tight">Recent Activity</h3>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 ring-1 ring-violet-500/20">
                  <Clock className="h-5 w-5 text-violet-400" />
                </div>
              </div>
              
              <div className="flex-1 overflow-auto blend-scrollbar pr-1 relative mask-image-b">
                {profileLoading ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
                  </div>
                ) : profile?.recentEvents?.length ? (
                  <div className="space-y-3">
                    {profile.recentEvents.slice(0, 5).map((event) => (
                      <div key={event._id} className="rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3 transition-colors hover:bg-white/[0.04]">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-slate-300">{reasonLabel[event.reason] || event.reason}</span>
                          <span className="text-sm font-bold text-emerald-400">+{event.points} XP</span>
                        </div>
                        <div className="mt-2">
                          {event.reason === 'task_resolved' ? (
                            <button onClick={() => scrollToSection(questSectionRef)} className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300">
                              View task board
                            </button>
                          ) : event.reason === 'pomodoro' ? (
                            <button onClick={() => scrollToSection(timerSectionRef)} className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300">
                              Start next focus
                            </button>
                          ) : (
                            <button onClick={() => navigate('/leaderboard')} className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 hover:text-cyan-300">
                              View leaderboard
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-slate-500 italic mt-2">No activity yet. Logs will appear here.</div>
                )}
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4, ease: 'easeOut' }}
            className="grid grid-cols-1 gap-6 lg:grid-cols-4"
          >
            {/* Week-over-week performance summary + milestone checkpoint. */}
            <div className="lg:col-span-3 grid grid-cols-1 gap-6 md:grid-cols-3">
              <TrendCard
                title="XP Trend"
                value={`${trendMetrics.xp.value} XP`}
                subText={`${trendMetrics.xp.delta >= 0 ? '+' : ''}${trendMetrics.xp.delta}% vs last week`}
                positive={trendMetrics.xp.delta >= 0}
              />
              <TrendCard
                title="Focus Hours"
                value={`${trendMetrics.focusHours.value.toFixed(1)}h`}
                subText={`${trendMetrics.focusHours.delta >= 0 ? '+' : ''}${trendMetrics.focusHours.delta}% vs last week`}
                positive={trendMetrics.focusHours.delta >= 0}
              />
              <TrendCard
                title="Completion Rate"
                value={`${trendMetrics.completionRate.value}%`}
                subText={`${trendMetrics.completionRate.delta >= 0 ? '+' : ''}${trendMetrics.completionRate.delta}% vs last week`}
                positive={trendMetrics.completionRate.delta >= 0}
              />
            </div>

            <div className="flex flex-col justify-center rounded-3xl border border-amber-500/30 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/10 via-[#0f172a]/80 to-[#0f172a]/80 p-8 shadow-[0_0_20px_rgba(245,158,11,0.1)] backdrop-blur-xl ring-1 ring-white/5 relative overflow-hidden">
               <div className="absolute top-0 right-0 h-32 w-32 bg-amber-500/10 blur-3xl rounded-full"></div>
              <div className="mb-4 flex items-center gap-3 text-base font-bold text-white relative z-10">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                  <Trophy className="h-5 w-5 text-amber-400" />
                </div>
                Milestone
              </div>
              <div className="text-sm font-semibold tracking-wider text-slate-400 uppercase relative z-10">{milestone.xp} / {milestone.next} XP</div>
              <div className="mt-4 h-2.5 rounded-full bg-slate-800/80 shadow-inner relative z-10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300 shadow-[0_0_10px_rgba(245,158,11,0.5)]"
                  style={{ width: `${milestone.progress}%` }}
                />
              </div>
              <div className="mt-3 text-[11px] font-bold tracking-widest text-amber-400/80 uppercase relative z-10">{milestone.progress}% to next achievement</div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.42, ease: 'easeOut' }}
            className="rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5"
          >
            {/* Weak-topic radar highlights categories requiring corrective attention this week. */}
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Weak Topic Radar</h2>
                <p className="mt-1 text-sm text-slate-400">Accuracy trend this week by topic (task-completion proxy).</p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
              {weakTopicRadar.map((item, idx) => (
                <motion.div
                  key={item.topic}
                  initial={{ opacity: 0, scale: 0.98 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.3, delay: idx * 0.05 }}
                  className={`rounded-2xl border px-5 py-4 transition-all hover:bg-white/[0.04] ${
                    item.isWeak ? 'border-amber-500/30 bg-amber-500/10 shadow-[0_0_15px_rgba(245,158,11,0.05)]' : 'border-white/5 bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-base font-bold text-white">{item.topic}</div>
                    <div className={`rounded-full px-2.5 py-1 text-xs font-bold ${item.delta >= 0 ? 'bg-emerald-500/10 text-emerald-400 ring-1 ring-emerald-500/20' : 'bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/20'}`}>
                      {item.delta >= 0 ? '+' : ''}{item.delta}%
                    </div>
                  </div>

                  <div className="mt-3 flex items-baseline justify-between text-sm text-slate-400">
                    <div>Accuracy: <span className="text-white font-bold">{item.currentAccuracy}%</span></div>
                    <div className="text-xs uppercase tracking-wider text-slate-500">{item.attempts} attempts</div>
                  </div>

                  <div className="mt-3 h-2 rounded-full bg-slate-800/80 shadow-inner">
                    <div
                      className={`h-full rounded-full ${item.isWeak ? 'bg-gradient-to-r from-amber-500 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]' : 'bg-gradient-to-r from-emerald-500 to-cyan-300 shadow-[0_0_8px_rgba(52,211,153,0.5)]'}`}
                      style={{ width: `${Math.min(100, item.currentAccuracy)}%` }}
                    />
                  </div>

                  {item.isWeak ? (
                    <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-amber-400">Needs attention this week</div>
                  ) : (
                    <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-slate-500">Stable trend</div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.div
            ref={timerSectionRef}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3, ease: "easeOut" }}
            className="rounded-3xl border border-slate-700/50 bg-[#0f172a]/80 p-8 shadow-sm backdrop-blur-xl ring-1 ring-white/5"
          >
            {/* Execution panel: countdown + stopwatch. Wrapper is scrollable for small screens/content growth. */}
            <FocusTimer onSessionComplete={handleSessionComplete} />
          </motion.div>
        </div>
      </SidebarLayout>

      <AnimatePresence>
        {/* Modal routing kept at page root so overlays always sit above dashboard content. */}
        {activeModal === 'create' && (
          <CreateGroupModal
            onClose={() => setActiveModal(null)}
            onCreated={() => {
              setActiveModal(null);
              loadDashboardData();
            }}
          />
        )}
        {activeModal === 'join' && (
          <JoinGroupModal
            onClose={() => setActiveModal(null)}
            onJoined={() => {
              setActiveModal(null);
              loadDashboardData();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
}



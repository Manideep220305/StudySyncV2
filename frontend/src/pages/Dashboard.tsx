import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { faker } from '@faker-js/faker';
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
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

// Standard upward fade-in variant used by cards and small blocks.
const fadeItem = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// Full-page ambient background. The dashboard cards are semi-transparent,
// so this moving aurora gives depth without having to animate every card itself.
const AuroraLayer: React.FC = () => (
  <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-[#020617]">
    <div
      className="absolute inset-0 opacity-30 animate-wave-aurora"
      style={{
        backgroundImage: `linear-gradient(
          to right,
          transparent 0%,
          #172554 20%,
          #1e40af 40%,
          #2563eb 60%,
          #172554 80%,
          transparent 100%
        )`,
        backgroundSize: '200% 100%',
        filter: 'blur(80px)',
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
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.35, delay }}
    className="relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md"
  >
    <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-2xl" style={{ background: accent }} />
    <div
      className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl opacity-20"
      style={{ background: accent }}
    />
    <div className="flex items-center gap-4">
      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconBg} shadow-lg`}>{icon}</div>
      <div>
        <p className="text-[11px] font-bold uppercase tracking-widest text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
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
    whileHover={{ y: -3, scale: 1.01 }}
    transition={{ type: 'spring', stiffness: 240, damping: 20 }}
    className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md"
  >
    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</div>
    <div className="mt-2 text-2xl font-bold text-white">{value}</div>
    <div className={`mt-1 text-xs ${positive ? 'text-emerald-300' : 'text-amber-300'}`}>{subText}</div>
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
      className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/90 p-6 shadow-2xl"
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

const seedFromString = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
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
    if (todayMetrics.hasLiveToday) {
      return {
        xpToday: todayMetrics.xpToday,
        pomodoroDone: todayMetrics.pomodoroDone,
        tasksDone: todayMetrics.tasksDone,
        source: 'live' as const,
      };
    }

    // Show a clearly-marked projection when no events are logged yet today.
    // This keeps the strip informative without pretending it's real activity data.
    const projectionSeed = seedFromString(
      `mission-${user?._id || 'guest'}-${todayMetrics.xpTarget}-${todayMetrics.taskTarget}`
    );
    faker.seed(projectionSeed);

    return {
      xpToday: faker.number.int({ min: 24, max: Math.max(30, Math.floor(todayMetrics.xpTarget * 0.45)) }),
      pomodoroDone: faker.number.int({ min: 1, max: Math.max(1, Math.floor(todayMetrics.pomodoroTarget / 2)) }),
      tasksDone: faker.number.int({ min: 1, max: Math.max(1, Math.floor(todayMetrics.taskTarget / 2)) }),
      source: 'projected' as const,
    };
  }, [todayMetrics.hasLiveToday, todayMetrics.pomodoroDone, todayMetrics.pomodoroTarget, todayMetrics.taskTarget, todayMetrics.xpTarget, todayMetrics.xpToday, user?._id]);

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
    if (missionStripMetrics.source === 'projected') {
      return 'Start session';
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
  }, [missionStripMetrics.pomodoroDone, missionStripMetrics.source, missionStripMetrics.tasksDone, todayMetrics.pomodoroTarget, todayMetrics.taskTarget]);

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

  const fakerBriefing = useMemo(() => {
    const seedKey = `${user?._id || 'guest'}-${todayMetrics.xpToday}-${streak.days}-${priorityTasks.length}`;
    faker.seed(seedFromString(seedKey));

    const suggestedMinutes = faker.number.int({ min: 35, max: 120 });
    const teammateName = faker.person.firstName();
    const teammateFocus = faker.number.int({ min: 58, max: 97 });
    const confidence = faker.number.int({ min: 62, max: 96 });

    return {
      sprintLabel: `${faker.company.buzzNoun()} ${faker.word.adjective()} sprint`,
      sprintSummary: faker.company.catchPhrase(),
      suggestedMinutes,
      teammateLine: `${teammateName} is projected at ${teammateFocus}% focus consistency today.`,
      riskLine: faker.helpers.arrayElement([
        'Potential bottleneck: context switching between DSA and development tasks.',
        'Potential bottleneck: low recovery window between two deep work blocks.',
        'Potential bottleneck: too many medium-priority tasks competing for early slots.',
      ]),
      confidence,
      promptQuestion: faker.helpers.arrayElement([
        'Which task can you close in the next 25 minutes?',
        'What single blocker is slowing your highest-priority quest?',
        'Can you convert one pending task into a concrete done criterion right now?',
      ]),
    };
  }, [priorityTasks.length, streak.days, todayMetrics.xpToday, user?._id]);

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
        <div className="relative z-10 flex w-full flex-col gap-8 pb-16">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <div className="flex items-baseline gap-3">
              <h1 className="text-3xl font-bold text-white">
                Welcome back,{' '}
                <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-300 bg-clip-text text-transparent">
                  {user?.username || 'Scholar'}
                </span>
              </h1>
            </div>
            <p className="mt-1 text-sm text-slate-500">
              Dashboard now focuses on momentum and actions, while chat stays in Rooms.
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
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md"
          >
            {/* Daily mission strip: all cards derive from today's events + adaptive targets. */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Today Mission Strip</h2>
                <p className="text-sm text-slate-500">Your personal targets and finish estimate for today.</p>
                {missionStripMetrics.source === 'projected' && (
                  <p className="mt-1 text-xs text-cyan-300">No points logged today yet - showing faker projection preview.</p>
                )}
              </div>
              <CalendarClock className="h-5 w-5 text-cyan-300" />
            </div>

            <motion.div
              variants={staggerContainer}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.25 }}
              className="grid grid-cols-1 gap-4 md:grid-cols-4"
            >
              <motion.div variants={fadeItem} whileHover={{ y: -2, scale: 1.01 }} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">XP Target</div>
                <div className="mt-2 text-xl font-bold text-white">
                  {missionStripMetrics.xpToday} / {todayMetrics.xpTarget}
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
                    style={{ width: `${Math.min(100, (missionStripMetrics.xpToday / todayMetrics.xpTarget) * 100)}%` }}
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeItem} whileHover={{ y: -2, scale: 1.01 }} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Pomodoros</div>
                <div className="mt-2 text-xl font-bold text-white">
                  {missionStripMetrics.pomodoroDone} / {todayMetrics.pomodoroTarget}
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300"
                    style={{ width: `${Math.min(100, (missionStripMetrics.pomodoroDone / todayMetrics.pomodoroTarget) * 100)}%` }}
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeItem} whileHover={{ y: -2, scale: 1.01 }} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Tasks</div>
                <div className="mt-2 text-xl font-bold text-white">
                  {missionStripMetrics.tasksDone} / {todayMetrics.taskTarget}
                </div>
                <div className="mt-2 h-2 rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-300"
                    style={{ width: `${Math.min(100, (missionStripMetrics.tasksDone / todayMetrics.taskTarget) * 100)}%` }}
                  />
                </div>
              </motion.div>

              <motion.div variants={fadeItem} whileHover={{ y: -2, scale: 1.01 }} className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">Finish By</div>
                <div className="mt-2 text-xl font-bold text-white">{finishByEstimate}</div>
                <p className="mt-2 text-xs text-slate-400">
                  {missionStripMetrics.source === 'projected'
                    ? 'Will switch to real estimate after your first tracked action today.'
                    : 'Estimated from pending focus load'}
                </p>
              </motion.div>
            </motion.div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            {/* Priority queue (left) + streak resilience panel (right). */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Smart Priority Queue</h2>
                  <p className="text-sm text-slate-500">Top 3 tasks sorted by urgency and impact.</p>
                </div>
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
              </div>

              {priorityTasks.length ? (
                <div className="space-y-2">
                  {/* Each row shows priority rank + category context + XP impact. */}
                  {priorityTasks.map((task, index) => (
                    <div key={task._id} className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                      <div>
                        <div className="text-sm font-semibold text-white">#{index + 1} {task.title}</div>
                        <div className="mt-1 text-xs text-slate-400">
                          {task.category || 'Other'} • {task.xpValue ?? 10} XP
                        </div>
                      </div>
                      <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
                        Priority {Math.round(task.score)}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-slate-400">
                  No pending tasks. Add new quests to generate your queue.
                </div>
              )}

              <div className="mt-4">
                <Button variant="outline" className="border-white/10 bg-white/5 hover:bg-white/10" onClick={() => scrollToSection(questSectionRef)}>
                  Open task board <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
              <div className="mb-3 flex items-center gap-2">
                <Flame className="h-4 w-4 text-orange-300" />
                <h3 className="text-sm font-semibold text-white">Streak + Recovery</h3>
              </div>
              <div className="text-3xl font-bold text-white">{streak.days} days</div>
              <p className="mt-1 text-xs text-slate-400">Consistency streak (based on active days)</p>
              <div className="mt-4 rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="text-xs text-slate-400">Recovery Tokens</div>
                <div className="mt-1 text-lg font-semibold text-cyan-300">{streak.recoveryTokens}</div>
                <div className="mt-1 text-[11px] text-slate-500">of {streak.totalTokens} available</div>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.205 }}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Faker Live Briefing</h2>
                <p className="text-sm text-slate-500">Extra demo insights generated via faker.js for richer dashboard context.</p>
              </div>
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Suggested Sprint</p>
                <p className="mt-2 text-sm font-semibold text-white">{fakerBriefing.sprintLabel}</p>
                <p className="mt-1 text-xs text-slate-400">{fakerBriefing.sprintSummary}</p>
                <p className="mt-2 text-xs text-cyan-300">Recommended: {fakerBriefing.suggestedMinutes} min deep block</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Team Pulse</p>
                <p className="mt-2 text-sm text-slate-200">{fakerBriefing.teammateLine}</p>
                <p className="mt-2 text-xs text-emerald-300">Confidence score: {fakerBriefing.confidence}%</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-xs uppercase tracking-wider text-slate-500">Risk Radar</p>
                <p className="mt-2 text-sm text-amber-200">{fakerBriefing.riskLine}</p>
                <p className="mt-2 text-xs text-slate-300">{fakerBriefing.promptQuestion}</p>
              </div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.21 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            {/* Heatmap visualizes long-term consistency; focus plan converts it into next actions. */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">Consistency Heatmap</h2>
                  <p className="text-sm text-slate-500">Last 12 weeks of activity intensity.</p>
                </div>
                <Activity className="h-5 w-5 text-emerald-300" />
              </div>

              <div className="overflow-x-auto">
                {/* 7 rows x 12 weeks-ish columns. Cells animate into view for progressive reveal. */}
                <div className="grid grid-flow-col grid-rows-7 gap-1 min-w-[620px]">
                  {heatmapCells.map((cell, idx) => {
                    const levelClass =
                      cell.level === 0
                        ? 'bg-slate-800/70'
                        : cell.level === 1
                          ? 'bg-emerald-900/80'
                          : cell.level === 2
                            ? 'bg-emerald-700/80'
                            : cell.level === 3
                              ? 'bg-emerald-500/85'
                              : 'bg-lime-300/90';
                    return (
                      <motion.div
                        key={cell.key}
                        initial={{ opacity: 0, scale: 0.7 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true, amount: 0.35 }}
                        transition={{ duration: 0.15, delay: Math.min(0.35, idx * 0.004) }}
                        title={cell.label}
                        className={`h-3.5 w-3.5 rounded-[3px] ${levelClass} shadow-inner`}
                      />
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-end gap-2 text-[11px] text-slate-500">
                <span>Less</span>
                <span className="h-2.5 w-2.5 rounded-[2px] bg-slate-800/70" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-900/80" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-700/80" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-emerald-500/85" />
                <span className="h-2.5 w-2.5 rounded-[2px] bg-lime-300/90" />
                <span>More</span>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-white">Focus Plan</h3>
                <PlayCircle className="h-4 w-4 text-cyan-300" />
              </div>

              <div className="space-y-2">
                {/* Upcoming sessions are generated from current queue + remaining daily target load. */}
                {focusPlan.slice(0, 5).map((session) => (
                  <motion.div
                    key={session.id}
                    initial={{ opacity: 0, x: 8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, amount: 0.2 }}
                    transition={{ duration: 0.2 }}
                    className={`rounded-xl border px-3 py-2 ${
                      session.status === 'done'
                        ? 'border-emerald-500/20 bg-emerald-500/10'
                        : activeSessionId === session.id
                          ? 'border-cyan-400/50 bg-cyan-500/10 animate-pulse'
                          : 'border-white/10 bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-medium text-white truncate">{session.title}</div>
                      <div className="text-[10px] uppercase tracking-wide text-slate-400">{session.startsAt}</div>
                    </div>
                  </motion.div>
                ))}
              </div>

              <Button className="mt-4 w-full bg-cyan-600 hover:bg-cyan-500" onClick={handleStartNextSession}>
                Start Next Session <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.22 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-3"
          >
            {/* Compact quick-action nav plus contextual "Now Snapshot". */}
            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md lg:col-span-2">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-white">One-Click Quick Actions</h2>
                  <p className="text-sm text-slate-500">Compact shortcuts + immediate context.</p>
                </div>
                <Sparkles className="h-5 w-5 text-cyan-300" />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
                <Button size="sm" className="h-9 justify-between bg-blue-600 px-3 text-xs hover:bg-blue-500" onClick={() => navigate('/rooms')}>
                  Rooms <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-9 justify-between border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10" onClick={() => navigate('/leaderboard')}>
                  Board <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-9 justify-between border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10" onClick={() => navigate('/profile')}>
                  Profile <ArrowRight className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-9 justify-between border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10" onClick={() => setActiveModal('create')}>
                  Create <Plus className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-9 justify-between border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10" onClick={() => setActiveModal('join')}>
                  Join <Hash className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="outline" className="h-9 justify-between border-white/10 bg-white/5 px-3 text-xs hover:bg-white/10" onClick={() => scrollToSection(timerSectionRef)}>
                  Focus <Timer className="h-3.5 w-3.5" />
                </Button>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Now</div>
                  <div className="mt-1 truncate text-xs font-medium text-white">
                    {priorityTasks[0]?.title || 'No urgent task'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Next Focus</div>
                  <div className="mt-1 text-xs font-medium text-white">
                    {nextSession ? `${nextSession.startsAt} - ${nextSession.title}` : 'Plan complete'}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <div className="text-[11px] uppercase tracking-wider text-slate-500">Recovery</div>
                  <div className="mt-1 text-xs font-medium text-cyan-300">
                    {streak.recoveryTokens}/{streak.totalTokens} tokens left
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md">
              {/* Recent events are intentionally actionable (open task/timer/leaderboard). */}
              <div className="mb-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-violet-300" />
                <h3 className="text-sm font-semibold text-white">Recent Activity Feed</h3>
              </div>
              {profileLoading ? (
                <div className="text-sm text-slate-500">Loading...</div>
              ) : profile?.recentEvents?.length ? (
                <div className="space-y-2">
                  {profile.recentEvents.slice(0, 5).map((event) => (
                    <div key={event._id} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-300">{reasonLabel[event.reason] || event.reason}</span>
                        <span className="text-emerald-300">+{event.points} XP</span>
                      </div>
                      <div className="mt-2">
                        {event.reason === 'task_resolved' ? (
                          <button onClick={() => scrollToSection(questSectionRef)} className="text-[11px] text-cyan-300 hover:text-cyan-200">
                            Open task board
                          </button>
                        ) : event.reason === 'pomodoro' ? (
                          <button onClick={() => scrollToSection(timerSectionRef)} className="text-[11px] text-cyan-300 hover:text-cyan-200">
                            Start next focus session
                          </button>
                        ) : (
                          <button onClick={() => navigate('/leaderboard')} className="text-[11px] text-cyan-300 hover:text-cyan-200">
                            Open leaderboard
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-500">No activity yet.</div>
              )}
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.24 }}
            className="grid grid-cols-1 gap-4 lg:grid-cols-4"
          >
            {/* Week-over-week performance summary + milestone checkpoint. */}
            <div className="lg:col-span-3 grid grid-cols-1 gap-4 md:grid-cols-3">
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

            <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 backdrop-blur-md">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-white">
                <Trophy className="h-4 w-4 text-amber-300" />
                Milestone
              </div>
              <div className="text-xs text-slate-400">{milestone.xp} XP {'->'} {milestone.next} XP</div>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 to-yellow-300"
                  style={{ width: `${milestone.progress}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-amber-200">{milestone.progress}% to next achievement</div>
            </div>
          </motion.section>

          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.26 }}
            className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 backdrop-blur-md"
          >
            {/* Weak-topic radar highlights categories requiring corrective attention this week. */}
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-white">Weak Topic Radar</h2>
                <p className="text-sm text-slate-500">Accuracy trend this week by topic (task-completion proxy).</p>
              </div>
              <AlertTriangle className="h-5 w-5 text-amber-300" />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {weakTopicRadar.map((item, idx) => (
                <motion.div
                  key={item.topic}
                  initial={{ opacity: 0, y: 8 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, amount: 0.2 }}
                  transition={{ duration: 0.2, delay: idx * 0.04 }}
                  className={`rounded-xl border px-4 py-3 ${
                    item.isWeak ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-white">{item.topic}</div>
                    <div className={`text-xs ${item.delta >= 0 ? 'text-emerald-300' : 'text-amber-300'}`}>
                      {item.delta >= 0 ? '+' : ''}{item.delta}%
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-400">
                    Accuracy: <span className="text-white font-medium">{item.currentAccuracy}%</span> this week
                    {' '}({item.attempts} attempts)
                  </div>

                  <div className="mt-2 h-2 rounded-full bg-slate-800">
                    <div
                      className={`h-full rounded-full ${item.isWeak ? 'bg-gradient-to-r from-amber-500 to-yellow-300' : 'bg-gradient-to-r from-emerald-500 to-cyan-300'}`}
                      style={{ width: `${Math.min(100, item.currentAccuracy)}%` }}
                    />
                  </div>

                  {item.isWeak ? (
                    <div className="mt-2 text-[11px] text-amber-200">Needs attention this week</div>
                  ) : (
                    <div className="mt-2 text-[11px] text-slate-500">Stable trend</div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.section>

          <motion.div
            ref={timerSectionRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="h-[520px] overflow-y-auto blend-scrollbar"
          >
            {/* Execution panel: countdown + stopwatch. Wrapper is scrollable for small screens/content growth. */}
            <FocusTimer onSessionComplete={handleSessionComplete} />
          </motion.div>

          <motion.div
            ref={questSectionRef}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.35 }}
            className="h-[520px] overflow-y-auto blend-scrollbar"
          >
            {/* Task board panel: intentionally larger and scrollable to avoid clipping. */}
            <QuestLog />
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


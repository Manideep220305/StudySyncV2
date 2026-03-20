import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock3, Crown, Flame, Loader2, Medal, Sparkles, Trophy, Users } from 'lucide-react';

import { SidebarLayout } from '@/components/SidebarLayout';
import { useSocket } from '@/context/SocketContext';
import { useToast } from '@/hooks/use-toast';
import groupService, { Group } from '@/services/groupService';
import leaderboardService, { LeaderboardEntry } from '@/services/leaderboardService';

const panelClass =
  'relative overflow-hidden rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-md';

const AuroraLayer = () => (
  <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-[#020617]">
    <div
      className="absolute inset-0 opacity-30 animate-wave-aurora"
      style={{
        backgroundImage:
          'linear-gradient(to right, transparent 0%, #172554 20%, #1e40af 40%, #2563eb 60%, #172554 80%, transparent 100%)',
        backgroundSize: '200% 100%',
        filter: 'blur(80px)',
      }}
    />
  </div>
);

const rankBadge = (rank: number) => {
  if (rank === 1) return <Crown className="h-4 w-4 text-yellow-300" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-300" />;
  if (rank === 3) return <Medal className="h-4 w-4 text-amber-400" />;
  return <span className="text-xs font-semibold text-slate-400">#{rank}</span>;
};

interface LeaderboardTableProps {
  title: string;
  subtitle: string;
  rows: LeaderboardEntry[];
  loading: boolean;
}

/**
 * Shared table for both global and group ranking.
 * Keeping it reusable avoids duplicated row rendering logic.
 */
const LeaderboardTable = ({ title, subtitle, rows, loading }: LeaderboardTableProps) => (
  <section className={`${panelClass} flex h-[560px] flex-col p-5`}>
    <div className="mb-4 flex items-center justify-between">
      <div>
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">{subtitle}</p>
      </div>
      <Trophy className="h-5 w-5 text-blue-300" />
    </div>

    {loading ? (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      </div>
    ) : rows.length === 0 ? (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-white/5 p-6 text-center text-sm text-slate-500">
        No data yet. Start completing tasks and focus sessions.
      </div>
    ) : (
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 blend-scrollbar-nebula">
        {rows.map((row) => (
          <div
            key={String(row.userId)}
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-800">
              {rankBadge(row.rank)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{row.username}</p>
              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">Rank #{row.rank}</p>
            </div>
            <div className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-200">
              {row.totalPoints} XP
            </div>
          </div>
        ))}
      </div>
    )}
  </section>
);

export default function LeaderboardPage() {
  const { socket, isConnected } = useSocket();
  const { toast } = useToast();
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  const [globalRows, setGlobalRows] = useState<LeaderboardEntry[]>([]);
  const [groupRows, setGroupRows] = useState<LeaderboardEntry[]>([]);
  const [loadingGlobal, setLoadingGlobal] = useState(true);
  const [loadingGroup, setLoadingGroup] = useState(false);
  const [lastLiveUpdateAt, setLastLiveUpdateAt] = useState<string>('');

  const loadGlobalRows = async (showToast = true) => {
    try {
      setLoadingGlobal(true);
      const rows = await leaderboardService.getGlobalLeaderboard(20);
      setGlobalRows(rows);
    } catch {
      if (showToast) {
        toast({ description: 'Failed to load global leaderboard', variant: 'destructive' });
      }
    } finally {
      setLoadingGlobal(false);
    }
  };

  const loadGroupRows = async (groupId: string, showToast = true) => {
    try {
      setLoadingGroup(true);
      const rows = await leaderboardService.getGroupLeaderboard(groupId, 20);
      setGroupRows(rows);
    } catch {
      if (showToast) {
        toast({ description: 'Failed to load group leaderboard', variant: 'destructive' });
      }
    } finally {
      setLoadingGroup(false);
    }
  };

  useEffect(() => {
    loadGlobalRows();
  }, []);

  useEffect(() => {
    const loadGroups = async () => {
      try {
        const data = await groupService.getUserGroups();
        setGroups(data);
        if (data.length > 0) {
          setSelectedGroupId(data[0]._id);
        }
      } catch {
        setGroups([]);
      }
    };
    loadGroups();
  }, []);

  useEffect(() => {
    if (!selectedGroupId) {
      setGroupRows([]);
      return;
    }

    loadGroupRows(selectedGroupId);
  }, [selectedGroupId]);

  const selectedGroupName = useMemo(
    () => groups.find((group) => group._id === selectedGroupId)?.name || 'Select group',
    [groups, selectedGroupId]
  );
  const selectedGroup = useMemo(
    () => groups.find((group) => group._id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const insights = useMemo(() => {
    const safeGlobalRows = Array.isArray(globalRows) ? globalRows : [];
    const safeGroupRows = Array.isArray(groupRows) ? groupRows : [];

    const globalLeader = safeGlobalRows[0] || null;
    const groupLeader = safeGroupRows[0] || null;

    const globalAverage =
      safeGlobalRows.length > 0
        ? Math.round(safeGlobalRows.reduce((sum, row) => sum + row.totalPoints, 0) / safeGlobalRows.length)
        : 0;

    const groupAverage =
      safeGroupRows.length > 0
        ? Math.round(safeGroupRows.reduce((sum, row) => sum + row.totalPoints, 0) / safeGroupRows.length)
        : 0;

    const podiumSpread =
      safeGlobalRows.length >= 2
        ? Math.max(0, safeGlobalRows[0].totalPoints - safeGlobalRows[1].totalPoints)
        : 0;

    return {
      globalLeader,
      groupLeader,
      globalAverage,
      groupAverage,
      podiumSpread,
    };
  }, [globalRows, groupRows]);

  useEffect(() => {
    if (!socket || !isConnected || !selectedGroup?.joinCode) return;

    // Join selected group's socket room so leaderboard events from that room reach this page.
    socket.emit('join-group', { joinCode: selectedGroup.joinCode });
  }, [socket, isConnected, selectedGroup?.joinCode]);

  useEffect(() => {
    if (!socket) return;

    const handleLiveRefresh = async (payload: { groupId?: string }) => {
      // Only refresh if event belongs to currently selected group.
      if (payload?.groupId && String(payload.groupId) !== String(selectedGroupId)) return;

      await Promise.all([
        loadGlobalRows(false),
        selectedGroupId ? loadGroupRows(selectedGroupId, false) : Promise.resolve(),
      ]);
      setLastLiveUpdateAt(new Date().toLocaleTimeString());
    };

    socket.on('leaderboard-updated', handleLiveRefresh);
    socket.on('quiz-finished', handleLiveRefresh);

    return () => {
      socket.off('leaderboard-updated', handleLiveRefresh);
      socket.off('quiz-finished', handleLiveRefresh);
    };
  }, [socket, selectedGroupId]);

  return (
    <>
      <AuroraLayer />
      <SidebarLayout>
        <div className="relative z-10 flex w-full flex-col gap-5 pb-8">
          <div className={`${panelClass} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-semibold text-white">Leaderboard</h1>
                <p className="text-sm text-slate-400">Track progress across all students and inside your own groups.</p>
              </div>
              <Users className="h-6 w-6 text-violet-300" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs uppercase tracking-[0.25em] text-slate-500">Group Scope</span>
              <select
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
                className="rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none"
              >
                {groups.length === 0 ? (
                  <option value="">No groups available</option>
                ) : (
                  groups.map((group) => (
                    <option key={group._id} value={group._id}>
                      {group.name}
                    </option>
                  ))
                )}
              </select>
              <span className="ml-auto text-xs text-slate-500">
                {isConnected ? 'Live connected' : 'Live disconnected'}
                {lastLiveUpdateAt ? ` | Updated ${lastLiveUpdateAt}` : ''}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            <LeaderboardTable
              title="Global Ranking"
              subtitle="Platform-wide XP"
              rows={globalRows}
              loading={loadingGlobal}
            />
            <LeaderboardTable
              title={selectedGroupName}
              subtitle="Group XP"
              rows={groupRows}
              loading={loadingGroup}
            />
          </div>

          <section className={`${panelClass} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Performance Insights</h2>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Live competitive snapshot</p>
              </div>
              <Sparkles className="h-5 w-5 text-cyan-300" />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Global Leader</p>
                <p className="mt-2 truncate text-base font-semibold text-white">{insights.globalLeader?.username || 'No data yet'}</p>
                <p className="mt-1 text-xs text-blue-200">{insights.globalLeader ? `${insights.globalLeader.totalPoints} XP` : 'Start earning points'}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Group Leader</p>
                <p className="mt-2 truncate text-base font-semibold text-white">{insights.groupLeader?.username || 'No group selected'}</p>
                <p className="mt-1 text-xs text-violet-200">{insights.groupLeader ? `${insights.groupLeader.totalPoints} XP` : 'Pick a group to compare'}</p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-slate-500">Podium Gap</p>
                <p className="mt-2 text-base font-semibold text-white">{insights.podiumSpread} XP</p>
                <p className="mt-1 text-xs text-amber-200">Difference between global #1 and #2</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Users className="h-4 w-4 text-cyan-300" />
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Average XP</p>
                </div>
                <p className="text-sm text-slate-300">Global avg: <span className="font-semibold text-white">{insights.globalAverage}</span></p>
                <p className="text-sm text-slate-300">Group avg: <span className="font-semibold text-white">{insights.groupAverage}</span></p>
              </div>

              <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
                <div className="mb-1 flex items-center gap-2">
                  <Flame className="h-4 w-4 text-amber-300" />
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Momentum Hint</p>
                </div>
                <p className="text-sm text-slate-300">
                  {insights.podiumSpread > 40
                    ? 'Top spot is contested but still open. One quiz streak can close this gap.'
                    : 'Leaderboard is super tight right now. Small wins can flip ranks quickly.'}
                </p>
              </div>
            </div>
          </section>

          <section className={`${panelClass} p-5`}>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Points Breakdown</h2>
                <p className="text-xs uppercase tracking-[0.25em] text-slate-500">How XP is awarded</p>
              </div>
              <Trophy className="h-5 w-5 text-amber-300" />
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Task Resolved</p>
                </div>
                <p className="text-sm text-slate-300">XP = task value</p>
                <p className="text-sm text-slate-300">Default: <span className="font-semibold text-white">10 XP</span></p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-blue-300" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Pomodoro</p>
                </div>
                <p className="text-sm text-slate-300">Default: <span className="font-semibold text-white">25 XP</span></p>
                <p className="text-sm text-slate-300">Allowed range: <span className="font-semibold text-white">1-120 XP</span></p>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <div className="mb-2 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-300" />
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Quiz Correct</p>
                </div>
                <p className="text-sm text-slate-300">Default: <span className="font-semibold text-white">50 XP</span></p>
                <p className="text-sm text-slate-300">Allowed range: <span className="font-semibold text-white">1-200 XP</span></p>
              </div>
            </div>
          </section>
        </div>
      </SidebarLayout>
    </>
  );
}

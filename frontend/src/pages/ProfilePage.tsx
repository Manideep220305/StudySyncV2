import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Sparkles, Trophy } from 'lucide-react';
import { format } from 'date-fns';

import { SidebarLayout } from '@/components/SidebarLayout';
import { useToast } from '@/hooks/use-toast';
import profileService, { ProfileResponse } from '@/services/profileService';

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

const reasonLabel: Record<string, string> = {
  task_resolved: 'Task Completed',
  pomodoro: 'Pomodoro Session',
  quiz_win: 'Quiz Correct',
};

export default function ProfilePage() {
  const { toast } = useToast();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const data = await profileService.getMyProfile();
        setProfile(data);
      } catch {
        toast({ description: 'Failed to load profile data', variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, [toast]);

  const totalActions = useMemo(() => {
    if (!profile) return 0;
    return (
      profile.reasonBreakdown.task_resolved.count +
      profile.reasonBreakdown.pomodoro.count +
      profile.reasonBreakdown.quiz_win.count
    );
  }, [profile]);

  return (
    <>
      <AuroraLayer />
      <SidebarLayout>
        <div className="relative z-10 flex flex-col gap-5 pb-6">
          {loading ? (
            <div className={`${panelClass} flex h-full items-center justify-center`}>
              <Loader2 className="h-6 w-6 animate-spin text-slate-300" />
            </div>
          ) : !profile ? (
            <div className={`${panelClass} p-6 text-center text-slate-400`}>No profile data available.</div>
          ) : (
            <>
              <section className={`${panelClass} p-6`}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-600 text-2xl font-bold text-white">
                      {profile.user.username?.[0]?.toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h1 className="text-2xl font-semibold text-white">{profile.user.username}</h1>
                      <p className="text-sm text-slate-400">{profile.user.email}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                      Global Rank #{profile.globalRank}
                    </span>
                    <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-semibold text-blue-200">
                      {profile.user.totalPoints} XP
                    </span>
                  </div>
                </div>
              </section>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                <section className={`${panelClass} p-5`}>
                  <div className="mb-3 flex items-center gap-2 text-slate-200">
                    <Sparkles className="h-4 w-4 text-violet-300" />
                    <h2 className="font-semibold">Activity Snapshot</h2>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <p>Total Actions: <span className="font-semibold text-white">{totalActions}</span></p>
                    <p>Groups Joined: <span className="font-semibold text-white">{profile.groupsCount}</span></p>
                    <p>Joined Since: <span className="font-semibold text-white">{format(new Date(profile.user.createdAt), 'dd MMM yyyy')}</span></p>
                  </div>
                </section>

                <section className={`${panelClass} p-5`}>
                  <div className="mb-3 flex items-center gap-2 text-slate-200">
                    <Trophy className="h-4 w-4 text-blue-300" />
                    <h2 className="font-semibold">Points Breakdown</h2>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <p>Task XP: <span className="font-semibold text-white">{profile.reasonBreakdown.task_resolved.points}</span></p>
                    <p>Pomodoro XP: <span className="font-semibold text-white">{profile.reasonBreakdown.pomodoro.points}</span></p>
                    <p>Quiz XP: <span className="font-semibold text-white">{profile.reasonBreakdown.quiz_win.points}</span></p>
                  </div>
                </section>

                <section className={`${panelClass} p-5`}>
                  <div className="mb-3 flex items-center gap-2 text-slate-200">
                    <CalendarDays className="h-4 w-4 text-amber-300" />
                    <h2 className="font-semibold">Event Counts</h2>
                  </div>
                  <div className="space-y-2 text-sm text-slate-300">
                    <p>Tasks Done: <span className="font-semibold text-white">{profile.reasonBreakdown.task_resolved.count}</span></p>
                    <p>Pomodoros: <span className="font-semibold text-white">{profile.reasonBreakdown.pomodoro.count}</span></p>
                    <p>Quiz Wins: <span className="font-semibold text-white">{profile.reasonBreakdown.quiz_win.count}</span></p>
                  </div>
                </section>
              </div>

              <section className={`${panelClass} flex h-[360px] flex-col p-5`}>
                <h2 className="mb-4 text-lg font-semibold text-white">Recent Activity</h2>
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 blend-scrollbar-nebula">
                  {profile.recentEvents.length === 0 ? (
                    <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm text-slate-500">
                      No activity yet.
                    </div>
                  ) : (
                    profile.recentEvents.map((event) => (
                      <div
                        key={event._id}
                        className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-semibold text-white">{reasonLabel[event.reason] || event.reason}</p>
                          <p className="text-[11px] text-slate-500">{format(new Date(event.createdAt), 'dd MMM yyyy, HH:mm')}</p>
                        </div>
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-200">
                          +{event.points} XP
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </SidebarLayout>
    </>
  );
}


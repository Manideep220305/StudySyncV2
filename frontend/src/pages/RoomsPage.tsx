import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock3,
  Copy,
  Crown,
  Hash,
  Info,
  Loader2,
  LogOut,
  Paperclip,
  Plus,
  Search,
  ShieldCheck,
  Target,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { SidebarLayout } from '@/components/SidebarLayout';
import GroupChat from '@/components/GroupChat';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/hooks/use-toast';
import groupService, { Group, GroupUploadedFile } from '@/services/groupService';
import taskService from '@/services/taskService';

type Task = {
  _id: string;
  title: string;
  isCompleted: boolean;
};

type Member = {
  _id: string;
  userId: { _id: string; username: string; avatar?: string };
  role: 'leader' | 'member';
};

type Goal = {
  id: string;
  text: string;
  done: boolean;
};

type ConfirmAction =
  | { type: 'kick'; memberId: string; username: string }
  | { type: 'promote'; memberId: string; username: string }
  | { type: 'delete' }
  | { type: 'leave' };

const panelClass =
  'relative overflow-hidden rounded-2xl border border-cyan-300/10 bg-slate-900/60 backdrop-blur-md rooms-glass-pulse';

const RailHandleIcon = () => (
  <div className="flex flex-col gap-[4px]" aria-hidden="true">
    <span className="h-[2px] w-5 rounded-full bg-cyan-100/80" />
    <span className="h-[2px] w-5 rounded-full bg-cyan-100/70" />
    <span className="h-[2px] w-5 rounded-full bg-cyan-100/60" />
  </div>
);

const AuroraLayer = () => (
  <div className="pointer-events-none fixed inset-0 z-[-1] overflow-hidden bg-[#020617]">
    <div className="absolute inset-0 animate-neon-drift bg-[radial-gradient(circle_at_14%_20%,rgba(14,165,233,0.28),transparent_38%),radial-gradient(circle_at_84%_16%,rgba(59,130,246,0.24),transparent_34%),radial-gradient(circle_at_56%_82%,rgba(6,182,212,0.2),transparent_35%)]" />
    <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(to_right,rgba(148,163,184,0.1)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.08)_1px,transparent_1px)] [background-size:52px_52px]" />
    <div
      className="absolute inset-0 opacity-30 animate-wave-aurora"
      style={{
        backgroundImage: `linear-gradient(
          to right,
          transparent 0%, #172554 20%, #1e40af 40%, #2563eb 60%, #172554 80%, transparent 100%
        )`,
        backgroundSize: '200% 100%',
        filter: 'blur(80px)',
      }}
    />
  </div>
);

const PanelTexture = () => (
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 opacity-[0.03]"
    style={{
      backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)',
      backgroundSize: '16px 16px',
    }}
  />
);

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  confirmVariant?: 'red' | 'yellow';
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const ConfirmModal = ({
  title,
  message,
  confirmLabel,
  confirmVariant = 'red',
  onConfirm,
  onCancel,
  loading = false,
}: ConfirmModalProps) => (
  <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onCancel}>
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      transition={{ duration: 0.16 }}
      className="relative w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className={`absolute inset-x-0 top-0 h-[2px] ${confirmVariant === 'red' ? 'bg-red-500' : 'bg-yellow-500'}`} />
      <div className="mb-3 flex items-center gap-3">
        <div
          className={`flex h-10 w-10 items-center justify-center rounded-xl ${
            confirmVariant === 'red'
              ? 'border border-red-500/20 bg-red-500/10'
              : 'border border-yellow-500/20 bg-yellow-500/10'
          }`}
        >
          <AlertTriangle className={`h-4 w-4 ${confirmVariant === 'red' ? 'text-red-400' : 'text-yellow-400'}`} />
        </div>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>
      <p className="mb-5 text-sm leading-relaxed text-slate-400">{message}</p>
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1 border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
          onClick={onCancel}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button
          className={`flex-1 ${
            confirmVariant === 'red'
              ? 'bg-red-600 text-white hover:bg-red-500'
              : 'bg-yellow-600 text-white hover:bg-yellow-500'
          }`}
          onClick={onConfirm}
          disabled={loading}
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : confirmLabel}
        </Button>
      </div>
    </motion.div>
  </div>
);

interface ModalShellProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

const ModalShell = ({ title, onClose, children }: ModalShellProps) => (
  <div className="fixed inset-0 z-[65] flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
    <motion.div
      initial={{ opacity: 0, scale: 0.96, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, y: 12 }}
      transition={{ duration: 0.16 }}
      className="relative w-full max-w-md overflow-hidden rounded-2xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl"
      onClick={(event) => event.stopPropagation()}
    >
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-blue-500 to-violet-500" />
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <button onClick={onClose} className="text-slate-400 transition hover:text-white">
          <X className="h-5 w-5" />
        </button>
      </div>
      {children}
    </motion.div>
  </div>
);

const CreateGroupModal = ({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (group: Group) => void;
}) => {
  const { toast } = useToast();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast({ description: 'Group name is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const created = await groupService.createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      onCreated(created);
      onClose();
      toast({ description: `Created ${created.name}` });
    } catch {
      toast({ description: 'Failed to create group', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Create Study Group" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">Group Name</label>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="MERN Sprint Squad"
            maxLength={50}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">Description</label>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            maxLength={200}
            placeholder="What is this group trying to finish?"
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <Button className="w-full bg-blue-600 text-white hover:bg-blue-500" onClick={handleCreate} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Create Group
        </Button>
      </div>
    </ModalShell>
  );
};

const JoinGroupModal = ({
  onClose,
  onJoined,
}: {
  onClose: () => void;
  onJoined: (group: Group) => void;
}) => {
  const { toast } = useToast();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handleJoin = async () => {
    if (!code.trim()) {
      toast({ description: 'Join code is required', variant: 'destructive' });
      return;
    }

    setLoading(true);
    try {
      const response = await groupService.joinGroup(code.trim().toUpperCase());
      const joinedGroup = response.group ?? response;
      onJoined(joinedGroup);
      onClose();
      toast({ description: `Joined ${joinedGroup.name}` });
    } catch {
      toast({ description: 'Could not join group', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell title="Join Study Group" onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="text-[11px] font-semibold uppercase tracking-[0.35em] text-slate-500">Join Code</label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={6}
            className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-center text-sm font-mono uppercase tracking-[0.4em] text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
          />
        </div>
        <Button className="w-full bg-emerald-600 text-white hover:bg-emerald-500" onClick={handleJoin} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Hash className="mr-2 h-4 w-4" />}
          Join Group
        </Button>
      </div>
    </ModalShell>
  );
};

interface LeftPanelProps {
  groups: Group[];
  loading: boolean;
  selectedId: string | null;
  expanded: boolean;
  onExpandChange: (expanded: boolean) => void;
  onSelect: (group: Group) => void;
  onCreate: () => void;
  onJoin: () => void;
}

const LeftPanel = ({ groups, loading, selectedId, expanded, onExpandChange, onSelect, onCreate, onJoin }: LeftPanelProps) => {
  const [search, setSearch] = useState('');
  const filteredGroups = useMemo(
    () => groups.filter((group) => group.name.toLowerCase().includes(search.toLowerCase())),
    [groups, search]
  );

  return (
    <motion.aside
      initial={false}
      animate={{ width: expanded ? 272 : 0 }}
      transition={{ type: 'spring', stiffness: 240, damping: 28 }}
      className={`${panelClass} absolute left-0 top-0 z-40 flex h-full flex-col rounded-none border-y-0 border-l-0 border-r ${expanded ? 'pointer-events-auto' : 'pointer-events-none'}`}
    >
      <PanelTexture />

      {expanded ? (
        <motion.div
          key="expanded-content"
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -8 }}
          className="h-full"
        >
          <div className="relative border-b border-white/10 px-4 py-5">
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                onClick={() => onExpandChange(false)}
                className="rounded-lg border border-cyan-300/20 bg-cyan-400/10 p-2 text-cyan-100 transition hover:bg-cyan-300/20"
                aria-label="Collapse groups rail"
              >
                <RailHandleIcon />
              </button>
              <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Study Groups</p>
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search groups"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-10 py-2.5 text-xs text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="relative flex-1 overflow-y-auto blend-scrollbar-nebula px-3 py-3 [scrollbar-gutter:stable]">
            {loading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((value) => (
                  <div key={value} className="h-14 animate-pulse rounded-2xl bg-white/5" />
                ))}
              </div>
            ) : filteredGroups.length === 0 ? (
              <div className="flex h-40 flex-col items-center justify-center text-center text-slate-500">
                <Users className="mb-3 h-8 w-8 opacity-40" />
                <p className="text-sm">No groups found</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredGroups.map((group) => {
                  const isSelected = selectedId === group._id;
                  return (
                    <motion.button
                      key={group._id}
                      whileHover={{ scale: 1.015, y: -1 }}
                      onClick={() => onSelect(group)}
                      className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                        isSelected
                          ? 'border-blue-500/30 bg-blue-600/20'
                          : 'border-transparent bg-white/5 hover:border-white/10 hover:bg-white/[0.08]'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl text-sm font-semibold ${isSelected ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-300'}`}>
                          {group.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-sm font-semibold text-white">{group.name}</span>
                            {group.role === 'leader' && <Crown className="h-3.5 w-3.5 text-yellow-400" />}
                          </div>
                          <p className="text-[11px] capitalize text-slate-500">{group.role || 'member'}</p>
                        </div>
                      </div>
                    </motion.button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="relative border-t border-white/10 p-3">
            <div className="flex gap-2">
              <Button className="flex-1 bg-blue-600 text-white hover:bg-blue-500" size="sm" onClick={onCreate}>
                <Plus className="mr-1 h-3.5 w-3.5" />
                Create
              </Button>
              <Button
                variant="outline"
                className="flex-1 border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                size="sm"
                onClick={onJoin}
              >
                Join
              </Button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </motion.aside>
  );
};

interface InfoPanelProps {
  isOpen: boolean;
  group: Group | null;
  members: Member[];
  files: GroupUploadedFile[];
  loading: boolean;
  filesLoading: boolean;
  currentUserId?: string;
  onClose: () => void;
  onCopyCode: () => void;
  onSharePlaceholder: () => void;
  onAction: (action: ConfirmAction) => void;
}

const InfoPanel = ({
  isOpen,
  group,
  members,
  files,
  loading,
  filesLoading,
  currentUserId,
  onClose,
  onCopyCode,
  onSharePlaceholder,
  onAction,
}: InfoPanelProps) => {
  if (!group) return null;
  const isLeader = group.role === 'leader';

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.button
            type="button"
            className="absolute inset-0 z-20 bg-black/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="absolute right-0 top-0 z-30 h-full w-80 border-l border-white/10 bg-slate-950/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex h-full flex-col gap-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-lg font-semibold text-white">
                    {group.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">{group.name}</h3>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] font-mono text-slate-300">
                        #{group.joinCode}
                      </code>
                      <button onClick={onCopyCode} className="text-xs font-semibold text-blue-300 transition hover:text-blue-200">
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
                <button onClick={onClose} className="text-slate-400 transition hover:text-white">
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Role</span>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${isLeader ? 'border border-yellow-500/30 bg-yellow-500/10 text-yellow-300' : 'border border-blue-500/30 bg-blue-500/10 text-blue-300'}`}>
                    {isLeader ? 'Leader' : 'Member'}
                  </span>
                </div>
                <button
                  onClick={onSharePlaceholder}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-amber-500/10 px-3 py-3 text-sm font-semibold text-amber-200 transition hover:border-amber-400/40"
                >
                  <Paperclip className="h-4 w-4" />
                  File Share Placeholder
                </button>

                <div className="mt-3 rounded-xl border border-white/10 bg-slate-950/40 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Uploaded File Names</span>
                    <span className="text-[10px] text-slate-500">{files.length}</span>
                  </div>
                  <div className="max-h-32 overflow-y-auto space-y-1 pr-1 blend-scrollbar-nebula">
                    {filesLoading ? (
                      <p className="text-xs text-slate-500">Loading files...</p>
                    ) : files.length === 0 ? (
                      <p className="text-xs text-slate-500">No files uploaded yet</p>
                    ) : (
                      files
                        .filter((file) => file?.name)
                        .map((file, index) => (
                          <div key={`${file.name}-${file.uploadedAt || ''}-${index}`} className="rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-xs text-slate-200">
                            <span className="truncate">{file.name}</span>
                          </div>
                        ))
                    )}
                  </div>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 flex-col">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Members</p>
                  <span className="text-xs text-slate-500">{members.length}</span>
                </div>

                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 blend-scrollbar-nebula">
                  {loading ? (
                    [1, 2, 3].map((value) => <div key={value} className="h-12 animate-pulse rounded-2xl bg-white/5" />)
                  ) : (
                    members.map((member) => {
                      if (!member?.userId?._id || !member?.userId?.username) return null;
                      const isCurrentUser = member.userId._id === currentUserId;
                      const memberIsLeader = member.role === 'leader';
                      return (
                        <div key={member._id} className="group rounded-2xl border border-white/10 bg-white/5 p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-sm font-semibold text-white">
                              {member.userId.username.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1">
                                <span className="truncate text-sm text-white">{member.userId.username}</span>
                                {isCurrentUser && <span className="text-[10px] text-slate-500">(you)</span>}
                              </div>
                              <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">{member.role}</p>
                            </div>
                          </div>

                          {isLeader && !isCurrentUser && !memberIsLeader && (
                            <div className="mt-3 flex gap-2 opacity-0 transition group-hover:opacity-100">
                              <button
                                onClick={() =>
                                  onAction({
                                    type: 'promote',
                                    memberId: member.userId._id,
                                    username: member.userId.username,
                                  })
                                }
                                className="flex items-center gap-1 rounded-full border border-yellow-500/30 px-2 py-1 text-[10px] font-semibold text-yellow-300"
                              >
                                <ShieldCheck className="h-3 w-3" />
                                Promote
                              </button>
                              <button
                                onClick={() =>
                                  onAction({
                                    type: 'kick',
                                    memberId: member.userId._id,
                                    username: member.userId.username,
                                  })
                                }
                                className="rounded-full border border-red-500/30 px-2 py-1 text-[10px] font-semibold text-red-400"
                              >
                                Kick
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                {isLeader ? (
                  <button
                    onClick={() => onAction({ type: 'delete' })}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-300"
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </button>
                ) : (
                  <button
                    onClick={() => onAction({ type: 'leave' })}
                    className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs font-semibold text-orange-300"
                  >
                    <LogOut className="h-4 w-4" />
                    Leave
                  </button>
                )}
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};

export default function RoomsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [groupsRailExpanded, setGroupsRailExpanded] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalInput, setGoalInput] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [groupFiles, setGroupFiles] = useState<GroupUploadedFile[]>([]);
  const [groupFilesLoading, setGroupFilesLoading] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [modal, setModal] = useState<'create' | 'join' | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerPhase, setTimerPhase] = useState<'focus' | 'break'>('focus');

  const fetchGroups = useCallback(async () => {
    try {
      const data = await groupService.getUserGroups();
      setGroups(data);
      setSelectedGroup((previous) => {
        if (!data.length) return null;
        if (!previous) return data[0];
        return data.find((group) => group._id === previous._id) ?? data[0];
      });
    } catch {
      toast({ description: 'Failed to load groups', variant: 'destructive' });
    } finally {
      setGroupsLoading(false);
    }
  }, [toast]);

  const fetchTasks = useCallback(async () => {
    try {
      const data = await taskService.getTasks();
      if (Array.isArray(data)) {
        setTasks(data.filter((task) => !task.isCompleted).slice(0, 3));
      }
    } catch {
      setTasks([]);
    }
  }, []);

  const fetchMembers = useCallback(async (groupId: string) => {
    setMembersLoading(true);
    try {
      const data = await groupService.getGroupMembers(groupId);
      setMembers(
        Array.isArray(data)
          ? data.filter((member) => member?.userId?._id && member?.userId?.username)
          : []
      );
    } catch {
      setMembers([]);
      toast({ description: 'Failed to load members', variant: 'destructive' });
    } finally {
      setMembersLoading(false);
    }
  }, [toast]);

  const fetchGroupFiles = useCallback(async (groupId: string) => {
    setGroupFilesLoading(true);
    try {
      const data = await groupService.getGroupFiles(groupId);
      setGroupFiles(Array.isArray(data) ? data : []);
    } catch {
      setGroupFiles([]);
      toast({ description: 'Failed to load file names', variant: 'destructive' });
    } finally {
      setGroupFilesLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchGroups();
    fetchTasks();
  }, [fetchGroups, fetchTasks]);

  useEffect(() => {
    if (!selectedGroup) {
      setGoals([]);
      return;
    }
    setGoals([
      { id: `${selectedGroup._id}-1`, text: 'Finish the current sprint deliverable', done: false },
      { id: `${selectedGroup._id}-2`, text: 'Review notes before the next standup', done: false },
      { id: `${selectedGroup._id}-3`, text: 'Close two pending bugs tonight', done: false },
    ]);
  }, [selectedGroup]);

  useEffect(() => {
    if (!infoOpen || !selectedGroup) return;
    fetchMembers(selectedGroup._id);
    fetchGroupFiles(selectedGroup._id);
  }, [fetchMembers, fetchGroupFiles, infoOpen, selectedGroup]);

  useEffect(() => {
    if (!isTimerRunning) return;
    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(current - 1, 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [isTimerRunning]);

  useEffect(() => {
    if (secondsLeft > 0) return;
    setIsTimerRunning(false);
    if (timerPhase === 'focus') {
      setTimerPhase('break');
      setSecondsLeft(5 * 60);
    } else {
      setTimerPhase('focus');
      setSecondsLeft(25 * 60);
    }
  }, [secondsLeft, timerPhase]);

  const formatTime = (value: number) => {
    const minutes = Math.floor(value / 60).toString().padStart(2, '0');
    const seconds = (value % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  };

  const handleTaskToggle = async (task: Task) => {
    const previousTasks = tasks;
    setTasks((current) => current.filter((item) => item._id !== task._id));
    try {
      await taskService.updateTask(task._id, { isCompleted: true });
    } catch {
      setTasks(previousTasks);
      toast({ description: 'Failed to update task', variant: 'destructive' });
    }
  };

  const handleAddGoal = () => {
    if (!goalInput.trim()) return;
    setGoals((current) => [
      ...current,
      { id: `${Date.now()}`, text: goalInput.trim(), done: false },
    ]);
    setGoalInput('');
  };

  const handleConfirm = async () => {
    if (!confirmAction || !selectedGroup || !user?._id) return;
    setActionLoading(true);

    try {
      if (confirmAction.type === 'kick') {
        await groupService.kickMember(selectedGroup._id, confirmAction.memberId);
        toast({ description: `${confirmAction.username} removed from group` });
      }

      if (confirmAction.type === 'promote') {
        await groupService.promoteToLeader(selectedGroup._id, confirmAction.memberId);
        toast({ description: `${confirmAction.username} promoted to leader` });
      }

      if (confirmAction.type === 'leave' || confirmAction.type === 'delete') {
        await groupService.kickMember(selectedGroup._id, user._id);
        toast({
          description:
            confirmAction.type === 'leave'
              ? `You left ${selectedGroup.name}`
              : `${selectedGroup.name} removed from your list`,
        });
      }

      setConfirmAction(null);
      setInfoOpen(false);
      await fetchGroups();
      if (selectedGroup) await fetchMembers(selectedGroup._id);
    } catch {
      toast({ description: 'Action failed', variant: 'destructive' });
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <>
      <AuroraLayer />

      <SidebarLayout contentClassName="p-0 md:p-0 gap-0">
        <div className="relative h-full w-full overflow-hidden">
          <div className="relative z-10 flex h-full w-full">
            <LeftPanel
              groups={groups}
              loading={groupsLoading}
              selectedId={selectedGroup?._id ?? null}
              expanded={groupsRailExpanded}
              onExpandChange={setGroupsRailExpanded}
              onSelect={setSelectedGroup}
              onCreate={() => setModal('create')}
              onJoin={() => setModal('join')}
            />

            <div className="flex min-w-0 flex-1">
              <motion.section
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                className="min-w-0 flex-1"
              >
                <div className="h-full bg-slate-900/20">
                  <GroupChat
                    groupId={selectedGroup?._id}
                    groupCode={selectedGroup?.joinCode ?? ''}
                    userId={user?._id ?? ''}
                    groupName={selectedGroup?.name}
                    userRole={selectedGroup?.role}
                    onToggleGroups={() => setGroupsRailExpanded((current) => !current)}
                    onOpenInfo={() => setInfoOpen(true)}
                    onFilesUpdated={() => {
                      if (selectedGroup?._id) {
                        fetchGroupFiles(selectedGroup._id);
                      }
                    }}
                  />
                </div>
              </motion.section>

              <motion.aside
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.35, delay: 0.05 }}
                className={`${panelClass} flex h-full w-[300px] flex-shrink-0 flex-col gap-3 overflow-y-auto rounded-none border-y-0 border-r-0 p-3 blend-scrollbar-nebula`}
              >
                <PanelTexture />

                <motion.section
                  whileHover={{ y: -2 }}
                  className="relative flex-shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3.5"
                >
                  <div className="mb-3 flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-violet-400" />
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Focus Zone</p>
                  </div>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-1 text-[11px] font-semibold text-violet-300">
                      Pomodoro
                    </span>
                    <span className="text-[11px] text-slate-500">{timerPhase === 'focus' ? 'Focus' : 'Break'}</span>
                  </div>
                  <div className="mt-3 text-center text-[2rem] font-mono text-white">{formatTime(secondsLeft)}</div>
                  <div className="mt-3 flex gap-2">
                    <Button className="flex-1 bg-violet-600 text-white hover:bg-violet-500" size="sm" onClick={() => setIsTimerRunning(true)}>
                      Start
                    </Button>
                    <Button
                      variant="outline"
                      className="flex-1 border-white/10 bg-white/5 text-slate-300 hover:bg-white/10"
                      size="sm"
                      onClick={() => setIsTimerRunning(false)}
                    >
                      Pause
                    </Button>
                  </div>
                </motion.section>

                <motion.section
                  whileHover={{ y: -2 }}
                  className="relative flex-shrink-0 rounded-2xl border border-white/10 bg-white/5 p-3.5"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Active Quests</p>
                    <button onClick={() => navigate('/dashboard?focus=quests')} className="text-xs font-semibold text-blue-300 transition hover:text-blue-200">
                      View all
                    </button>
                  </div>
                  <div className="space-y-2">
                    {tasks.length === 0 ? (
                      <p className="text-sm text-slate-500">No active quests</p>
                    ) : (
                      tasks.map((task) => (
                        <button
                          key={task._id}
                          onClick={() => handleTaskToggle(task)}
                          className="flex w-full items-center gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-left transition hover:bg-white/5"
                        >
                          <Circle className="h-4 w-4 text-amber-300" />
                          <span className="truncate text-sm text-slate-200">{task.title}</span>
                        </button>
                      ))
                    )}
                  </div>
                </motion.section>

                {selectedGroup && (
                  <motion.section
                    whileHover={{ y: -2 }}
                    className="relative flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-white/5 p-3.5"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <Target className="h-4 w-4 text-amber-300" />
                      <p className="text-xs font-semibold uppercase tracking-[0.35em] text-slate-400">Group Goals</p>
                    </div>
                    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto blend-scrollbar-nebula pr-1">
                      {goals.map((goal) => (
                        <button
                          key={goal.id}
                          onClick={() =>
                            setGoals((current) =>
                              current.map((item) => (item.id === goal.id ? { ...item, done: !item.done } : item))
                            )
                          }
                          className="flex w-full items-start gap-2 rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-2 text-left"
                        >
                          {goal.done ? (
                            <CheckCircle2 className="mt-0.5 h-4 w-4 text-green-400" />
                          ) : (
                            <Circle className="mt-0.5 h-4 w-4 text-slate-500" />
                          )}
                          <span className={`text-sm ${goal.done ? 'text-slate-500 line-through' : 'text-slate-200'}`}>{goal.text}</span>
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input
                        value={goalInput}
                        onChange={(event) => setGoalInput(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault();
                            handleAddGoal();
                          }
                        }}
                        placeholder="Add a shared goal"
                        className="flex-1 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
                      />
                      <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400" size="sm" onClick={handleAddGoal}>
                        Add
                      </Button>
                    </div>
                  </motion.section>
                )}
              </motion.aside>
            </div>
          </div>

          <InfoPanel
            isOpen={infoOpen}
            group={selectedGroup}
            members={members}
            files={groupFiles}
            loading={membersLoading}
            filesLoading={groupFilesLoading}
            currentUserId={user?._id}
            onClose={() => setInfoOpen(false)}
            onCopyCode={() => {
              if (!selectedGroup) return;
              navigator.clipboard.writeText(selectedGroup.joinCode);
              toast({ description: `Copied ${selectedGroup.joinCode}` });
            }}
            onSharePlaceholder={() => toast({ description: 'File share panel is still a placeholder for now.' })}
            onAction={setConfirmAction}
          />
        </div>
      </SidebarLayout>

      <AnimatePresence>
        {modal === 'create' && (
          <CreateGroupModal
            onClose={() => setModal(null)}
            onCreated={(group) => {
              setGroups((current) => [group, ...current]);
              setSelectedGroup(group);
            }}
          />
        )}
        {modal === 'join' && (
          <JoinGroupModal
            onClose={() => setModal(null)}
            onJoined={(group) => {
              setGroups((current) => (current.some((item) => item._id === group._id) ? current : [group, ...current]));
              setSelectedGroup(group);
            }}
          />
        )}
        {confirmAction && (
          <ConfirmModal
            title={
              confirmAction.type === 'kick'
                ? 'Remove Member'
                : confirmAction.type === 'promote'
                ? 'Promote Member'
                : confirmAction.type === 'delete'
                ? 'Delete Group'
                : 'Leave Group'
            }
            message={
              confirmAction.type === 'kick'
                ? `Remove ${confirmAction.username} from this study group?`
                : confirmAction.type === 'promote'
                ? `Promote ${confirmAction.username} to leader?`
                : confirmAction.type === 'delete'
                ? 'Delete this group from your workspace?'
                : 'Leave this study group?'
            }
            confirmLabel={
              confirmAction.type === 'kick'
                ? 'Remove'
                : confirmAction.type === 'promote'
                ? 'Promote'
                : confirmAction.type === 'delete'
                ? 'Delete'
                : 'Leave'
            }
            confirmVariant={confirmAction.type === 'promote' ? 'yellow' : 'red'}
            onConfirm={handleConfirm}
            onCancel={() => setConfirmAction(null)}
            loading={actionLoading}
          />
        )}
      </AnimatePresence>
    </>
  );
}

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Users, Hash, Edit, Trash2, Crown, LogOut } from 'lucide-react';
import groupService, { Group } from '@/services/groupService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';

interface GroupCardProps {
  group: Group;
  onSelect?: (group: Group) => void;
  className?: string;
}

const GroupCard: React.FC<GroupCardProps> = ({ group, onSelect, className }) => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const isLeader = group.role === 'leader';
  const memberCount = group.memberCount || 1;

  const copyCode = () => {
    navigator.clipboard.writeText(group.joinCode);
    toast({ description: 'Join code copied!' });
  };

  const leaveGroup = async () => {
    setLoading(true);
    try {
      // API call to leave group
      await groupService.kickMember(group._id, user!._id);
      toast({ description: 'Left group successfully' });
    } catch (error) {
      toast({ description: 'Failed to leave group', variant: 'destructive' });
    }
    setLoading(false);
  };

  return (
    <div className={cn(
      'group relative bg-slate-900/50 border border-white/10 rounded-2xl p-6 hover:border-white/20 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 overflow-hidden cursor-pointer',
      className
    )} onClick={() => onSelect?.(group)}>sideb
      
      {/* Leader Crown Badge */}
      {isLeader && (
        <div className="absolute top-4 right-4 bg-yellow-500/20 border border-yellow-500/50 p-2 rounded-full">
          <Crown className="w-4 h-4 text-yellow-400" />
        </div>
      )}

      {/* Role Badge */}
      <div className="flex items-center gap-2 mb-4">
        <div className={`px-3 py-1 rounded-full text-xs font-semibold ${
          isLeader 
            ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 text-yellow-400 border border-yellow-500/30' 
            : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
        }`}>
          {isLeader ? 'Leader' : 'Member'}
        </div>
        <div className="text-xs text-slate-500 ml-auto">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </div>
      </div>

      <div className="mb-4">
        <h3 className="text-xl font-bold text-white mb-1 truncate">{group.name}</h3>
        {group.description && (
          <p className="text-slate-400 text-sm mb-4 line-clamp-2">{group.description}</p>
        )}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <Hash className="w-4 h-4" />
          <code className="font-mono bg-slate-800 px-2 py-1 rounded-md">
            {group.joinCode}
          </code>
        </div>
        <Users className="w-5 h-5 text-slate-400" />
      </div>

      {/* Leader Actions Overlay */}
      {isLeader && (
        <div className="absolute inset-0 bg-black/20 backdrop-blur-sm opacity-0 hover:opacity-100 transition-all flex items-end p-4 gap-2 pointer-events-none group-hover:pointer-events-auto">
          <Button variant="ghost" size="sm" className="flex-1 pointer-events-auto">
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" className="flex-1 pointer-events-auto">
            <Trash2 className="w-4 h-4 mr-1" />
            Delete
          </Button>
        </div>
      )}

      {/* Leave Button for Members */}
      {!isLeader && (
        <Button 
          variant="outline" 
          size="sm" 
          className="w-full mt-4 pointer-events-auto"
          onClick={(e) => {
            e.stopPropagation();
            leaveGroup();
          }}
          disabled={loading}
        >
          <LogOut className="w-4 h-4 mr-1" />
          Leave Group
        </Button>
      )}
    </div>
  );
};

export default GroupCard;


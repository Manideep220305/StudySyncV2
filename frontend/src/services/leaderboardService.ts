import { apiClient, unwrapApiData } from '@/services/apiClient';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  totalPoints: number;
}

const getGlobalLeaderboard = async (limit = 20): Promise<LeaderboardEntry[]> => {
  const response = await apiClient.get(`/leaderboard/global?limit=${limit}`);
  return unwrapApiData<LeaderboardEntry[]>(response.data);
};

const getGroupLeaderboard = async (groupId: string, limit = 20): Promise<LeaderboardEntry[]> => {
  const response = await apiClient.get(`/leaderboard/group/${groupId}?limit=${limit}`);
  return unwrapApiData<LeaderboardEntry[]>(response.data);
};

const leaderboardService = {
  getGlobalLeaderboard,
  getGroupLeaderboard,
};

export default leaderboardService;

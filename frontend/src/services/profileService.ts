import { apiClient, unwrapApiData } from '@/services/apiClient';

export interface ProfileEvent {
  _id: string;
  points: number;
  reason: 'task_resolved' | 'pomodoro' | 'quiz_win';
  groupId?: string;
  createdAt: string;
}

export interface ProfileResponse {
  user: {
    _id: string;
    username: string;
    email: string;
    avatar?: string;
    bio?: string;
    totalPoints: number;
    createdAt: string;
  };
  globalRank: number;
  groupsCount: number;
  reasonBreakdown: {
    task_resolved: { points: number; count: number };
    pomodoro: { points: number; count: number };
    quiz_win: { points: number; count: number };
  };
  recentEvents: ProfileEvent[];
}

export interface AccuracyTopic {
  topic: string;
  currentAttempts: number;
  currentCorrect: number;
  currentAccuracy: number;
  previousAttempts: number;
  previousCorrect: number;
  previousAccuracy: number;
  delta: number;
}

export interface AccuracyResponse {
  windowDays: number;
  generatedAt: string;
  topics: AccuracyTopic[];
}

const getMyProfile = async (): Promise<ProfileResponse> => {
  const response = await apiClient.get(`/profile/me`);
  return unwrapApiData<ProfileResponse>(response.data);
};

const getMyAccuracy = async (): Promise<AccuracyResponse> => {
  const response = await apiClient.get(`/profile/accuracy`);
  return unwrapApiData<AccuracyResponse>(response.data);
};

const profileService = {
  getMyProfile,
  getMyAccuracy,
};

export default profileService;

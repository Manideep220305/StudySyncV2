import { apiClient, unwrapApiData } from '@/services/apiClient';

/**
 * Writes a pomodoro completion PointEvent.
 * This keeps timer XP on the same backend scoring pipeline as tasks/quizzes.
 */
const logPomodoroCompletion = async (points: number, groupId?: string) => {
  const response = await apiClient.post(
    `/points/pomodoro`,
    { points, groupId }
  );
  return unwrapApiData(response.data);
};

/**
 * Ready for quiz flow integration.
 * Call this after backend verifies a correct answer.
 */
const logQuizCorrect = async (groupId: string, points = 50) => {
  const response = await apiClient.post(
    `/points/quiz-correct`,
    { groupId, points }
  );
  return unwrapApiData(response.data);
};

/**
 * Records a quiz attempt with topic + correctness for true accuracy analytics.
 * If isCorrect=true, backend can optionally award points in the same call.
 */
const logQuizAttempt = async (payload: {
  topic: string;
  isCorrect: boolean;
  groupId?: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  points?: number;
}) => {
  const response = await apiClient.post(`/points/quiz-attempt`, payload);
  return unwrapApiData(response.data);
};

const pointsService = {
  logPomodoroCompletion,
  logQuizCorrect,
  logQuizAttempt,
};

export default pointsService;

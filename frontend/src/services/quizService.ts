import { apiClient, unwrapApiData } from '@/services/apiClient';

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
}

export interface ActiveQuiz {
  quizId: string;
  groupId: string;
  joinCode: string;
  startedAt: string;
  topic: string;
  questions: QuizQuestion[];
  answeredCount: number;
  totalQuestions: number;
  finished: boolean;
}

export interface QuizAnswerResult {
  quizId: string;
  questionId: string;
  isCorrect: boolean;
  isFirstCorrect: boolean;
  correctIndex: number;
  answeredCount: number;
  totalQuestions: number;
  finished: boolean;
  summary?: QuizSummary | null;
}

export interface QuizSummaryRow {
  rank: number;
  userId: string;
  username: string;
  avatar?: string;
  score: number;
}

export interface QuizSummary {
  quizId: string;
  groupId: string;
  totalQuestions: number;
  winner: QuizSummaryRow | null;
  topPlayers: QuizSummaryRow[];
  ranking: QuizSummaryRow[];
}

const startQuiz = async (groupId: string, payload: { topic?: string; count?: number }) => {
  const response = await apiClient.post(
    `/groups/${groupId}/quiz/start`,
    payload
  );
  return unwrapApiData<ActiveQuiz>(response.data);
};

const getCurrentQuiz = async (groupId: string) => {
  const response = await apiClient.get(`/groups/${groupId}/quiz/current`);
  return unwrapApiData<ActiveQuiz>(response.data);
};

const submitAnswer = async (
  groupId: string,
  payload: { questionId: string; answerIndex: number }
) => {
  const response = await apiClient.post(
    `/groups/${groupId}/quiz/answer`,
    payload
  );
  return unwrapApiData<QuizAnswerResult>(response.data);
};

const endQuiz = async (groupId: string) => {
  const response = await apiClient.post(`/groups/${groupId}/quiz/end`);
  return unwrapApiData<{ message: string; summary?: QuizSummary | null }>(response.data);
};

const quizService = {
  startQuiz,
  getCurrentQuiz,
  submitAnswer,
  endQuiz,
};

export default quizService;

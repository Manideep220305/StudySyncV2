import { apiClient, unwrapApiData } from '@/services/apiClient';
import type { ActiveQuiz } from '@/services/quizService';

export interface UploadPdfResponse {
  group_id: string;
  filename: string;
  pages_with_text: number;
  chunks_stored: number;
  collection_name: string;
}

export interface QuizQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

export interface GenerateQuizResponse {
  group_id: string;
  num_questions?: number;
  model: string;
  quiz: {
    quiz_title?: string;
    questions: QuizQuestion[];
  };
  session?: ActiveQuiz;
}

export interface AskResponse {
  group_id: string;
  model: string;
  question: string;
  answer: string;
  sources: Array<{
    source: string;
    page: number | string;
    preview: string;
  }>;
}

export interface AiHealthResponse {
  available: boolean;
  status: 'online' | 'offline' | 'degraded' | 'unknown' | string;
  service: string;
  url: string;
  message: string;
  checkedAt: string | null;
  responseTimeMs: number | null;
  upstreamStatus: number | null;
  details?: unknown;
}

const uploadPdf = async (groupId: string, file: File, options?: { replaceContext?: boolean }) => {
  const formData = new FormData();
  formData.append('groupId', groupId);
  formData.append('replaceContext', options?.replaceContext ? 'true' : 'false');
  formData.append('file', file);

  const response = await apiClient.post('/ai/upload-pdf', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

  return unwrapApiData<UploadPdfResponse>(response.data);
};

const generateQuiz = async (groupId: string, numQuestions: number = 5) => {
  const response = await apiClient.post('/ai/generate-quiz', { groupId, numQuestions });
  return unwrapApiData<GenerateQuizResponse>(response.data);
};

const ask = async (groupId: string, question: string) => {
  const response = await apiClient.post('/ai/ask', { groupId, question });
  return unwrapApiData<AskResponse>(response.data);
};

const getAiHealth = async () => {
  const response = await apiClient.get('/ai/health');
  return unwrapApiData<AiHealthResponse>(response.data);
};

const aiService = {
  uploadPdf,
  generateQuiz,
  ask,
  getAiHealth,
};

export default aiService;

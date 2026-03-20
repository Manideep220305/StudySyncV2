import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Sparkles, Trophy, Upload, X } from 'lucide-react';
import type { Socket } from 'socket.io-client';

import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { getApiErrorMessage } from '@/services/apiClient';
import aiService from '@/services/aiService';
import quizService, { ActiveQuiz, QuizSummary } from '@/services/quizService';

interface QuizPanelProps {
  groupId: string;
  canStartQuiz: boolean;
  socket: Socket | null;
  isConnected: boolean;
}

/**
 * QuizPanel:
 * - Leader can start a quiz.
 * - Members can answer each question.
 * - Receives realtime quiz events from socket.
 */
export default function QuizPanel({
  groupId,
  canStartQuiz,
  socket,
  isConnected,
}: QuizPanelProps) {
  const { toast } = useToast();
  const [activeQuiz, setActiveQuiz] = useState<ActiveQuiz | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [answeredQuestionIds, setAnsweredQuestionIds] = useState<Set<string>>(new Set());
  const [answering, setAnswering] = useState(false);
  const [lastResult, setLastResult] = useState<string>('');
  const [quizSummary, setQuizSummary] = useState<QuizSummary | null>(null);
  const [showAiGenerator, setShowAiGenerator] = useState(false);
  const [aiQuestionCount, setAiQuestionCount] = useState(5);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiUploadFiles, setAiUploadFiles] = useState<File[]>([]);
  const [aiUploading, setAiUploading] = useState(false);
  const [aiUploadStatus, setAiUploadStatus] = useState('');
  const [aiReplaceContext, setAiReplaceContext] = useState(false);
  const [showCompletionCard, setShowCompletionCard] = useState(false);
  const [endingQuiz, setEndingQuiz] = useState(false);

  const currentQuestion = useMemo(() => {
    if (!activeQuiz) return null;
    return activeQuiz.questions[currentQuestionIndex] || null;
  }, [activeQuiz, currentQuestionIndex]);

  const loadCurrentQuiz = async () => {
    if (!groupId) return;
    try {
      const quiz = await quizService.getCurrentQuiz(groupId);
      setActiveQuiz(quiz);
      setCurrentQuestionIndex(0);
      setSelectedIndex(null);
      setAnsweredQuestionIds(new Set());
    } catch {
      // 404 is expected when no active quiz exists, so we stay silent.
      setActiveQuiz(null);
    }
  };

  useEffect(() => {
    if (!groupId) return;
    setQuizSummary(null);
    loadCurrentQuiz();
  }, [groupId]);

  useEffect(() => {
    if (!socket) return;

    const onStarted = (quiz: ActiveQuiz) => {
      if (String(quiz.groupId) !== String(groupId)) return;
      setActiveQuiz(quiz);
      setCurrentQuestionIndex(0);
      setSelectedIndex(null);
      setAnsweredQuestionIds(new Set());
      setLastResult('Quiz started. Good luck!');
      setQuizSummary(null);
      setShowCompletionCard(false);
    };

    const onAnswerResult = (payload: {
      questionId: string;
      username: string;
      isFirstCorrect: boolean;
      answeredCount: number;
      totalQuestions: number;
    }) => {
      if (payload.isFirstCorrect) {
        setLastResult(`${payload.username} got first correct on one question.`);
      }
    };

    const onFinished = (payload: { summary?: QuizSummary | null }) => {
      setLastResult('Quiz is done for this room.');
      setQuizSummary(payload?.summary || null);
      setShowCompletionCard(true);
      loadCurrentQuiz();
    };

    socket.on('quiz-started', onStarted);
    socket.on('quiz-answer-result', onAnswerResult);
    socket.on('quiz-finished', onFinished);

    return () => {
      socket.off('quiz-started', onStarted);
      socket.off('quiz-answer-result', onAnswerResult);
      socket.off('quiz-finished', onFinished);
    };
  }, [groupId, socket]);

  const renderFinishedCard = () => (
    <div className="rounded-2xl border border-emerald-400/25 bg-emerald-500/10 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-emerald-200" />
        <h4 className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-100">Quiz Completed</h4>
      </div>
      <p className="text-sm text-emerald-50">Quiz is done for this room. Great run.</p>
      {quizSummary ? (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-3">
          <p className="text-xs text-slate-400">Winner</p>
          <p className="text-base font-semibold text-white">{quizSummary.winner?.username || 'No winner'}</p>
          <div className="mt-3 space-y-2">
            {quizSummary.ranking.length > 0 ? (
              quizSummary.ranking.map((player) => (
                <div
                  key={player.userId}
                  className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs"
                >
                  <span className="text-slate-100">
                    #{player.rank} {player.username}
                  </span>
                  <span className="font-semibold text-emerald-200">{player.score} pts</span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400">No scoring data available for this quiz.</p>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          Final scorecard is not available yet.
        </div>
      )}
    </div>
  );

  const handleSubmitAnswer = async () => {
    if (!activeQuiz || !currentQuestion || selectedIndex === null) return;
    if (answeredQuestionIds.has(currentQuestion.id)) return;

    try {
      setAnswering(true);
      const result = await quizService.submitAnswer(groupId, {
        questionId: currentQuestion.id,
        answerIndex: selectedIndex,
      });

      setAnsweredQuestionIds((previous) => new Set(previous).add(currentQuestion.id));

      if (result.isCorrect) {
        setLastResult(result.isFirstCorrect ? 'Correct! You were first (+50 XP).' : 'Correct, but not first.');
      } else {
        setLastResult(`Incorrect. Correct option: ${result.correctIndex + 1}`);
      }

      if (result.finished && result.summary) {
        setQuizSummary(result.summary);
      }

      if (currentQuestionIndex < activeQuiz.questions.length - 1) {
        setCurrentQuestionIndex((previous) => previous + 1);
        setSelectedIndex(null);
      }
    } catch (error: any) {
      toast({
        description: error?.response?.data?.message || 'Failed to submit answer',
        variant: 'destructive',
      });
    } finally {
      setAnswering(false);
    }
  };

  const handleGenerateAiQuiz = async () => {
    if (!groupId || !canStartQuiz) return;
    try {
      setAiGenerating(true);
      const numQuestions = Math.max(3, Math.min(aiQuestionCount || 5, 10));
      const response = await aiService.generateQuiz(groupId, numQuestions);
      const session = response.session;

      if (session) {
        setActiveQuiz(session);
        setCurrentQuestionIndex(0);
        setSelectedIndex(null);
        setAnsweredQuestionIds(new Set());
        setLastResult('AI quiz started for everyone in the room.');
        setQuizSummary(null);
        setShowCompletionCard(false);
      } else {
        await loadCurrentQuiz();
      }

      setShowAiGenerator(false);
      toast({ description: 'AI quiz generated from uploaded PDF' });
    } catch (error: any) {
      const message = getApiErrorMessage(error, 'Failed to generate AI quiz');
      const lower = message.toLowerCase();
      const friendlyMessage =
        lower.includes('no documents found') ||
        lower.includes('upload pdf first') ||
        lower.includes('upload a pdf first')
          ? 'Upload a PDF first to generate an AI quiz'
          : message;

      toast({
        description: friendlyMessage,
        variant: 'destructive',
      });
    } finally {
      setAiGenerating(false);
    }
  };

  const handleEndQuiz = async () => {
    if (!groupId || !canStartQuiz) return;
    try {
      setEndingQuiz(true);
      const result = await quizService.endQuiz(groupId);
      setActiveQuiz(null);
      setCurrentQuestionIndex(0);
      setSelectedIndex(null);
      setAnsweredQuestionIds(new Set());
      setLastResult('Quiz is done for this room.');
      setQuizSummary(result.summary || null);
      setShowCompletionCard(true);
      toast({ description: 'Ended current quiz. You can start a new one now.' });
    } catch (error: any) {
      toast({
        description: error?.response?.data?.message || 'Failed to end quiz',
        variant: 'destructive',
      });
    } finally {
      setEndingQuiz(false);
    }
  };

  const handleAiFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(event.target.files || []).filter(
      (file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
    );
    setAiUploadFiles(selected);
    if (selected.length !== Array.from(event.target.files || []).length) {
      setAiUploadStatus('Only PDF files are accepted for AI quiz context.');
    } else {
      setAiUploadStatus('');
    }
    event.target.value = '';
  };

  const handleAiPdfUpload = async () => {
    if (!groupId || !aiUploadFiles.length) {
      setAiUploadStatus('Select at least one PDF first.');
      return;
    }

    try {
      setAiUploading(true);
      let failed = 0;
      for (let index = 0; index < aiUploadFiles.length; index += 1) {
        const file = aiUploadFiles[index];
        setAiUploadStatus(`Indexing PDF ${index + 1}/${aiUploadFiles.length}: ${file.name}`);
        try {
          await aiService.uploadPdf(groupId, file, {
            replaceContext: aiReplaceContext && index === 0,
          });
        } catch {
          failed += 1;
        }
      }

      if (failed > 0) {
        setAiUploadStatus(`${failed} file(s) failed to index. Try again.`);
      } else {
        setAiUploadStatus(
          aiReplaceContext
            ? 'PDF context replaced and indexed successfully.'
            : 'PDFs indexed successfully.'
        );
        setAiUploadFiles([]);
      }
    } finally {
      setAiUploading(false);
    }
  };

  if (!activeQuiz) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <div className="mb-3 flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-300" />
          <h3 className="text-sm font-semibold text-white">Quiz Arena</h3>
        </div>

        {canStartQuiz ? (
          <div className="space-y-3">
            <p className="text-xs text-slate-400">Generate quiz from uploaded group PDFs.</p>

            <Button
              onClick={() => setShowAiGenerator(true)}
              disabled={aiGenerating || !isConnected}
              className="w-full bg-cyan-600 text-white hover:bg-cyan-500"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate AI Quiz from PDF
            </Button>

            {showAiGenerator && (
              <div className="rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">AI Quiz Setup</p>
                  <button
                    type="button"
                    onClick={() => setShowAiGenerator(false)}
                    className="rounded-full p-1 text-cyan-200/80 transition hover:bg-white/10 hover:text-white"
                    aria-label="Close AI quiz setup"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <label className="mb-2 block text-xs text-cyan-100">How many questions?</label>
                <input
                  type="number"
                  min={3}
                  max={10}
                  value={aiQuestionCount}
                  onChange={(event) => setAiQuestionCount(Math.max(3, Math.min(Number(event.target.value) || 5, 10)))}
                  className="mb-3 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
                />
                <Button
                  onClick={handleGenerateAiQuiz}
                  disabled={aiGenerating || !isConnected || aiUploading}
                  className="w-full bg-cyan-600 text-white hover:bg-cyan-500"
                >
                  {aiGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Generate Quiz
                </Button>

                <div className="mt-3 rounded-xl border border-white/10 bg-slate-900/40 p-3">
                  <p className="mb-2 text-[11px] uppercase tracking-[0.25em] text-slate-300">Upload PDF Here</p>
                  <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-2 py-1.5">
                    <span className="text-[11px] text-slate-300">Context mode</span>
                    <button
                      type="button"
                      onClick={() => setAiReplaceContext((current) => !current)}
                      className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                        aiReplaceContext
                          ? 'border border-orange-400/40 bg-orange-500/20 text-orange-200'
                          : 'border border-cyan-400/30 bg-cyan-500/15 text-cyan-200'
                      }`}
                    >
                      {aiReplaceContext ? 'Replace old context' : 'Keep old context'}
                    </button>
                  </div>

                  <input
                    type="file"
                    accept=".pdf,application/pdf"
                    multiple
                    onChange={handleAiFilesSelected}
                    className="mb-2 w-full rounded-xl border border-white/10 bg-slate-900 px-3 py-2 text-xs text-slate-200 file:mr-3 file:rounded-md file:border-0 file:bg-cyan-600 file:px-2 file:py-1 file:text-xs file:font-semibold file:text-white"
                  />
                  {aiUploadFiles.length > 0 && (
                    <p className="mb-2 text-[11px] text-cyan-200">
                      Selected: {aiUploadFiles.map((file) => file.name).join(', ')}
                    </p>
                  )}
                  {aiUploadStatus && (
                    <p className="mb-2 text-[11px] text-cyan-100">{aiUploadStatus}</p>
                  )}
                  <Button
                    onClick={handleAiPdfUpload}
                    disabled={aiUploading || !isConnected}
                    className="w-full bg-slate-700 text-white hover:bg-slate-600"
                  >
                    {aiUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                    Upload PDF to Quiz Context
                  </Button>
                </div>
              </div>
            )}

          </div>
        ) : (
          <p className="text-xs text-slate-400">Waiting for group leader to start a quiz.</p>
        )}

        {showCompletionCard && <div className="mt-4">{renderFinishedCard()}</div>}
      </div>
    );
  }

  if (activeQuiz.finished) {
    return (
      <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-300" />
            <h3 className="text-sm font-semibold text-white">Quiz Live</h3>
          </div>
          <div className="flex items-center gap-2">
            {canStartQuiz && (
              <Button
                onClick={handleEndQuiz}
                disabled={endingQuiz}
                className="h-8 bg-red-600 px-3 text-xs text-white hover:bg-red-500"
              >
                {endingQuiz ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                Clear
              </Button>
            )}
            <button
              onClick={loadCurrentQuiz}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:bg-white/10"
              title="Refresh quiz state"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        {renderFinishedCard()}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-300" />
          <h3 className="text-sm font-semibold text-white">Quiz Live</h3>
        </div>
        <div className="flex items-center gap-2">
          {canStartQuiz && (
            <Button
              onClick={handleEndQuiz}
              disabled={endingQuiz}
              className="h-8 bg-red-600 px-3 text-xs text-white hover:bg-red-500"
            >
              {endingQuiz ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
              End Quiz
            </Button>
          )}
          <button
            onClick={loadCurrentQuiz}
            className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-300 hover:bg-white/10"
            title="Refresh quiz state"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {currentQuestion ? (
        <>
          <p className="mb-2 text-xs uppercase tracking-[0.25em] text-slate-500">
            Question {currentQuestionIndex + 1}/{activeQuiz.questions.length}
          </p>
          <p className="mb-3 text-sm font-semibold text-white">{currentQuestion.question}</p>
          <div className="space-y-2">
            {currentQuestion.options.map((option, index) => (
              <button
                key={`${currentQuestion.id}-${index}`}
                onClick={() => setSelectedIndex(index)}
                disabled={answeredQuestionIds.has(currentQuestion.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selectedIndex === index
                    ? 'border-blue-500/40 bg-blue-500/15 text-blue-100'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                } ${answeredQuestionIds.has(currentQuestion.id) ? 'opacity-60' : ''}`}
              >
                {index + 1}. {option}
              </button>
            ))}
          </div>
          <Button
            onClick={handleSubmitAnswer}
            disabled={selectedIndex === null || answering || answeredQuestionIds.has(currentQuestion.id)}
            className="mt-3 w-full bg-emerald-600 text-white hover:bg-emerald-500"
          >
            {answering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-2 h-4 w-4" />}
            Submit Answer
          </Button>
        </>
      ) : (
        <p className="text-xs text-slate-400">No question available.</p>
      )}

      {showCompletionCard && <div className="mt-4">{renderFinishedCard()}</div>}

      {lastResult && (
        <div className="mt-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-300">
          {lastResult}
        </div>
      )}
    </div>
  );
}

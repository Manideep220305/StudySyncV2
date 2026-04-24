import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Sparkles, Trophy, Upload, X } from 'lucide-react';
import type { Socket } from 'socket.io-client';

import { Button } from '@/components/ui/button';
import { useAiStatus } from '@/context/AiStatusContext';
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
 * - Any group member can start a quiz.
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
  const { aiReady, aiChecking, aiMessage } = useAiStatus();
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
  const aiUnavailableMessage = aiChecking ? 'Checking AI service...' : aiMessage;

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

  useEffect(() => {
    if (aiReady) return;
    setShowAiGenerator(false);
  }, [aiReady]);

  const renderFinishedCard = () => (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-950/10 p-5 mt-2">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10">
          <Trophy className="h-4 w-4 text-emerald-400" />
        </div>
        <h4 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Operation Concluded</h4>
      </div>
      <p className="text-[13px] font-medium text-slate-300 mb-6 leading-relaxed">Neural Assessment complete. Sync logs successfully generated.</p>

      {quizSummary ? (
        <div className="rounded-xl border border-white/[0.05] bg-black/20 p-4">
          <div className="mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Top Operator</p>
            <div className="flex items-center gap-2">
              <span className="text-xl font-black text-emerald-400">
                {quizSummary.winner?.username || 'No consensus'}
              </span>
              {quizSummary.winner && <Sparkles className="h-4 w-4 text-emerald-400" />}
            </div>
          </div>

          <div className="space-y-2">
            {quizSummary.ranking.length > 0 ? (
              quizSummary.ranking.map((player, index) => (
                <div
                  key={player.userId}
                  className={`flex items-center justify-between rounded-lg border px-4 py-2.5 transition-colors ${
                    index === 0
                      ? 'bg-emerald-500/10 border-emerald-500/30'
                      : 'bg-white/[0.02] border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className={`flex h-6 w-6 items-center justify-center rounded bg-black/20 text-[11px] font-bold ${
                      index === 0 ? 'text-emerald-400' : 'text-slate-400'
                    }`}>
                      {player.rank}
                    </span>
                    <span className={`text-sm font-semibold ${index === 0 ? 'text-emerald-200' : 'text-slate-200'}`}>
                      {player.username}
                    </span>
                  </div>
                  <span className={`font-bold text-sm ${index === 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                    {player.score} pts
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[11px] font-medium uppercase tracking-widest text-slate-500 text-center py-4">No tactical data retrieved</p>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 text-xs font-medium text-slate-400 flex items-center justify-center gap-2">
          Synchronizing scorecard...
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
    if (!aiReady) {
      toast({
        description: aiUnavailableMessage,
        variant: 'destructive',
      });
      return;
    }
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

    if (!aiReady) {
      setAiUploadStatus(aiUnavailableMessage);
      return;
    }

    try {
      setAiUploading(true);
      let failed = 0;
      let firstFailureMessage = '';
      for (let index = 0; index < aiUploadFiles.length; index += 1) {
        const file = aiUploadFiles[index];
        setAiUploadStatus(`Indexing PDF ${index + 1}/${aiUploadFiles.length}: ${file.name}`);
        try {
          await aiService.uploadPdf(groupId, file, {
            replaceContext: aiReplaceContext && index === 0,
          });
        } catch (error) {
          failed += 1;
          if (!firstFailureMessage) {
            firstFailureMessage = getApiErrorMessage(error, 'indexing failed');
          }
        }
      }

      if (failed > 0) {
        setAiUploadStatus(
          `${failed} file(s) failed to index.${firstFailureMessage ? ` ${firstFailureMessage}` : ''}`
        );
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
      <div className="rounded-2xl border border-white/[0.05] bg-[#0F172A] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
            <Trophy className="h-4 w-4 text-amber-400" />
          </div>
          <h3 className="text-base font-bold tracking-tight text-white">Quiz Arena</h3>
        </div>

        {canStartQuiz ? (
          <div className="space-y-4">
            <p className="text-xs font-medium text-slate-400">Generate AI-powered challenges from synced group knowledge.</p>

            {!aiReady && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm font-medium text-amber-200">
                {aiUnavailableMessage}
              </div>
            )}

            <Button
              onClick={() => setShowAiGenerator(true)}
              disabled={aiGenerating || !isConnected || !aiReady}
              className="w-full h-10 bg-cyan-600 text-white font-semibold transition-colors hover:bg-cyan-500"
            >
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Neural Assessment
            </Button>

            {showAiGenerator && (
              <div className="rounded-xl border border-cyan-500/20 bg-cyan-900/10 p-4 mt-4 relative overflow-hidden group animate-in fade-in slide-in-from-top-2">
                
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">Parameter Setup</p>
                  <button
                    type="button"
                    onClick={() => setShowAiGenerator(false)}
                    className="rounded text-cyan-400/60 transition hover:text-cyan-300"
                    aria-label="Close AI quiz setup"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                
                <div className="space-y-4 relative z-10">
                  <div>
                    <label className="mb-2 block text-xs font-semibold text-cyan-200">Question count</label>
                    <input
                      type="number"
                      min={3}
                      max={10}
                      value={aiQuestionCount}
                      onChange={(event) => setAiQuestionCount(Math.max(3, Math.min(Number(event.target.value) || 5, 10)))}
                      className="w-full rounded-lg border border-cyan-500/20 bg-black/20 px-3 py-2 text-sm font-medium text-white focus:border-cyan-500/50 focus:outline-none transition-colors"
                    />
                  </div>

                  <Button
                    onClick={handleGenerateAiQuiz}
                    disabled={aiGenerating || !isConnected || aiUploading || !aiReady}
                    className="w-full h-10 bg-cyan-600 text-white hover:bg-cyan-500 transition-colors"
                  >
                    {aiGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                    Initialize Generation
                  </Button>

                  <div className="rounded-lg border border-white/[0.05] bg-white/[0.02] p-4 mt-4">
                    <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-slate-400">Context Augmentation</p>
                    <div className="mb-3 flex items-center justify-between rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2">
                      <span className="text-[11px] font-medium text-slate-300">Knowledge Mode</span>
                      <button
                        type="button"
                        onClick={() => setAiReplaceContext((current) => !current)}
                        className={`rounded px-2 py-1 text-[10px] font-bold ${
                          aiReplaceContext
                            ? 'bg-orange-500/10 text-orange-400'
                            : 'bg-cyan-500/10 text-cyan-400'
                        }`}
                      >
                        {aiReplaceContext ? 'Override Context' : 'Append Context'}
                      </button>
                    </div>

                    <input
                      type="file"
                      accept=".pdf,application/pdf"
                      multiple
                      onChange={handleAiFilesSelected}
                      className="mb-3 w-full rounded-lg border border-white/[0.05] bg-black/20 px-3 py-2 text-xs text-slate-300 file:mr-3 file:rounded file:border-0 file:bg-slate-700 file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-white hover:file:bg-slate-600"
                    />

                    {aiUploadFiles.length > 0 && (
                      <div className="mb-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 px-3 py-2">
                        <p className="text-[11px] text-cyan-300 truncate">
                          <span className="font-semibold">Target:</span> {aiUploadFiles.map((file) => file.name).join(', ')}
                        </p>
                      </div>
                    )}

                    {aiUploadStatus && (
                      <div className="mb-3 flex items-center gap-2 rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2">
                        <Loader2 className="h-3 w-3 animate-spin text-blue-400" />
                        <p className="text-[11px] font-medium text-blue-300">{aiUploadStatus}</p>
                      </div>
                    )}

                    <Button
                      onClick={handleAiPdfUpload}
                      disabled={aiUploading || !isConnected || !aiReady}
                      className="w-full h-9 bg-slate-800 text-white hover:bg-slate-700 transition-colors"
                    >
                      {aiUploading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                      Sync Knowledge Base
                    </Button>
                  </div>
                </div>
              </div>
            )}

          </div>
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center border border-white/[0.05] rounded-xl bg-white/[0.02]">
            <Loader2 className="mb-3 h-8 w-8 animate-spin text-slate-500 opacity-50" />
            <p className="text-sm font-medium text-slate-400">Waiting for someone in the room to start a quiz.</p>
          </div>
        )}

        {showCompletionCard && <div className="mt-5">{renderFinishedCard()}</div>}
      </div>
    );
  }

  if (activeQuiz.finished) {
    return (
      <div className="rounded-2xl border border-white/[0.05] bg-[#0F172A] p-5">
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
              <Trophy className="h-4 w-4 text-amber-400" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-white">Assessment Complete</h3>
          </div>
          <div className="flex items-center gap-2">
            {canStartQuiz && (
              <Button
                onClick={handleEndQuiz}
                disabled={endingQuiz}
                className="h-8 bg-red-500/10 border border-red-500/20 px-3 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition-colors rounded-lg"
              >
                {endingQuiz ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                Reset Grid
              </Button>
            )}
            <button
              onClick={loadCurrentQuiz}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] bg-white/[0.02] text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
              title="Refresh quiz state"
            >
              <RefreshCw className="h-3 w-3" />
            </button>
          </div>
        </div>
        {renderFinishedCard()}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/[0.05] bg-[#0F172A] p-5">
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
            <Sparkles className="h-4 w-4 text-blue-400" />
          </div>
          <h3 className="text-base font-bold tracking-tight text-white">Active Simulation</h3>
        </div>
        <div className="flex items-center gap-2">
          {canStartQuiz && (
            <Button
              onClick={handleEndQuiz}
              disabled={endingQuiz}
              className="h-8 bg-red-500/10 border border-red-500/20 px-3 text-xs font-semibold text-red-500 hover:bg-red-500/20 transition-colors rounded-lg"
            >
              {endingQuiz ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              Abort
            </Button>
          )}
          <button
            onClick={loadCurrentQuiz}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/[0.05] bg-white/[0.02] text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-white"
            title="Refresh state"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
      </div>

      {currentQuestion ? (
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-400">
              Query {currentQuestionIndex + 1} <span className="opacity-40 text-white">/</span> {activeQuiz.questions.length}
            </p>
            <div className="h-1.5 w-24 bg-white/5 rounded-full overflow-hidden">
               <div 
                 className="h-full bg-blue-500 transition-all duration-500 ease-out" 
                 style={{ width: `${((currentQuestionIndex + 1) / activeQuiz.questions.length) * 100}%` }} 
               />
            </div>
          </div>
          
          <div className="rounded-xl border border-white/[0.05] bg-white/[0.02] p-4 mb-4">
            <p className="text-[14px] font-medium text-white leading-relaxed">{currentQuestion.question}</p>
          </div>
          
          <div className="space-y-2">
            {currentQuestion.options.map((option, index) => {
              const isSelected = selectedIndex === index;
              const isAnswered = answeredQuestionIds.has(currentQuestion.id);
              return (
                <button
                  key={`${currentQuestion.id}-${index}`}
                  onClick={() => setSelectedIndex(index)}
                  disabled={isAnswered}
                  className={`w-full flex items-center justify-start overflow-hidden rounded-xl border px-4 py-3 text-left text-sm font-medium transition-colors ${
                    isSelected
                      ? 'border-blue-500/30 bg-blue-500/10 text-blue-200'
                      : 'border-transparent bg-white/[0.02] text-slate-300 hover:bg-white/[0.04]'
                  } ${isAnswered ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded bg-black/20 text-[11px] font-bold ${
                      isSelected ? 'text-blue-400' : 'text-slate-500'
                    }`}>
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span>{option}</span>
                  </div>
                </button>
              );
            })}
          </div>
          
          <Button
            onClick={handleSubmitAnswer}
            disabled={selectedIndex === null || answering || answeredQuestionIds.has(currentQuestion.id)}
            className={`mt-4 w-full h-10 text-sm font-semibold transition-colors rounded-xl flex items-center justify-center gap-2 ${
              selectedIndex !== null && !answeredQuestionIds.has(currentQuestion.id)
               ? 'bg-emerald-600 text-white hover:bg-emerald-500'
               : 'bg-white/[0.02] text-slate-500'
            }`}
          >
            {answering ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>Confirm Answer</span>
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center border border-white/[0.05] rounded-xl bg-white/[0.02]">
           <Loader2 className="mb-3 h-8 w-8 animate-spin text-slate-600" />
           <p className="text-sm font-medium text-slate-400">Loading next module...</p>
        </div>
      )}

      {showCompletionCard && <div className="mt-6">{renderFinishedCard()}</div>}

      {lastResult && (
        <div className="mt-5 rounded-xl border border-blue-500/20 bg-blue-500/10 px-4 py-3 text-sm font-medium text-blue-200">
          {lastResult}
        </div>
      )}
    </div>
  );
}

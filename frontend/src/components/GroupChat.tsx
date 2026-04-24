import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Info, Loader2, Menu, MessageSquare, Paperclip, Send, Sparkles, Trophy, Users, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import QuizPanel from '@/components/QuizPanel';
import { useAiStatus } from '@/context/AiStatusContext';
import { useSocket } from '@/context/SocketContext';
import aiService, { AskResponse } from '@/services/aiService';
import { getApiErrorMessage } from '@/services/apiClient';
import groupService, { Message } from '@/services/groupService';

interface GroupChatProps {
  groupId?: string;
  groupCode: string;
  userId: string;
  groupName?: string;
  userRole?: 'leader' | 'member';
  onOpenInfo?: () => void;
  onToggleGroups?: () => void;
  onFilesUpdated?: () => void;
}

type PendingFile = {
  id: string;
  file: File;
};

export default function GroupChat({
  groupId,
  groupCode,
  userId,
  groupName,
  userRole,
  onOpenInfo,
  onToggleGroups,
  onFilesUpdated,
}: GroupChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [isAiMode, setIsAiMode] = useState(false);
  const [replaceAiContext, setReplaceAiContext] = useState(false);
  const [isAsking, setIsAsking] = useState(false);
  const [askError, setAskError] = useState('');
  const [askResult, setAskResult] = useState<AskResponse | null>(null);
  const [activeView, setActiveView] = useState<'chat' | 'quiz'>('chat');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const { socket, isConnected } = useSocket();
  const { aiReady, aiChecking, aiMessage } = useAiStatus();
  const canUploadContext = Boolean(groupId);
  const aiUnavailableMessage = aiChecking ? 'Checking AI service...' : aiMessage;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, typingUsers, pendingFiles]);

  useEffect(() => {
    if (!socket || !groupCode) return;

    socket.emit('join-group', { joinCode: groupCode });

    const handleNewMessage = (message: Message) => {
      setMessages((current) => [...current, message]);
    };

    const handleHistory = (history: Message[]) => {
      setMessages(history);
    };

    const handleTyping = (payload: { username: string; isTyping: boolean }) => {
      setTypingUsers((current) => {
        if (payload.isTyping) {
          return [...current.filter((name) => name !== payload.username), payload.username];
        }
        return current.filter((name) => name !== payload.username);
      });
    };

    const handleError = (error: string) => {
      console.error('Chat error:', error);
    };

    socket.on('new-message', handleNewMessage);
    socket.on('message-history', handleHistory);
    socket.on('typing', handleTyping);
    socket.on('chat-error', handleError);

    return () => {
      socket.off('new-message', handleNewMessage);
      socket.off('message-history', handleHistory);
      socket.off('typing', handleTyping);
      socket.off('chat-error', handleError);
    };
  }, [groupCode, socket]);

  useEffect(() => {
    // Reset to chat when user switches room/group
    setActiveView('chat');
    setIsAiMode(false);
    setReplaceAiContext(false);
    setAskError('');
    setAskResult(null);
  }, [groupCode]);

  useEffect(() => {
    if (aiReady) return;
    setIsAiMode(false);
  }, [aiReady]);

  const isPdfFile = (file: File) =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const handleAskNotes = async (question: string) => {
    if (!aiReady) {
      setAskResult(null);
      setAskError(aiUnavailableMessage);
      return;
    }

    if (!groupId) {
      setAskError('Select a group first.');
      return;
    }

    const cleanedQuestion = question.trim();
    if (!cleanedQuestion) return;

    setIsAsking(true);
    setAskError('');
    try {
      const response = await aiService.ask(groupId, cleanedQuestion);
      setAskResult(response);
    } catch (error) {
      setAskResult(null);
      setAskError(getApiErrorMessage(error, 'Could not get an answer right now.'));
    } finally {
      setIsAsking(false);
    }
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!groupId || (!newMessage.trim() && pendingFiles.length === 0)) return;
    if (!socket && !isAiMode && !newMessage.trim().toLowerCase().startsWith('/ai ')) return;

    const originalMessage = newMessage.trim();
    const isSlashAi = originalMessage.toLowerCase().startsWith('/ai ');
    const shouldAskAi = isAiMode || isSlashAi;
    const aiQuestion = isSlashAi ? originalMessage.slice(4).trim() : originalMessage;
    let fileMessageSuffix = '';

    if ((shouldAskAi || pendingFiles.length > 0) && !aiReady) {
      const message = aiUnavailableMessage;
      setAskResult(null);
      setAskError(shouldAskAi ? message : '');
      setUploadStatus(pendingFiles.length > 0 ? message : '');
      return;
    }

    if (pendingFiles.length > 0) {
      const fileNames = pendingFiles.map((item) => item.file.name);
      const pdfFiles = pendingFiles.filter((item) => isPdfFile(item.file));
      const skippedFiles = pendingFiles.filter((item) => !isPdfFile(item.file));
        const ingestFailures: string[] = [];

      setIsUploadingFiles(true);
      setUploadStatus(`Saving file names: ${fileNames.join(', ')}`);
      try {
        await groupService.addGroupFiles(groupId, fileNames);

        for (let index = 0; index < pdfFiles.length; index += 1) {
          const currentPdf = pdfFiles[index];
          setUploadStatus(`Indexing PDF ${index + 1}/${pdfFiles.length}: ${currentPdf.file.name}`);
          try {
            await aiService.uploadPdf(groupId, currentPdf.file, {
              replaceContext: replaceAiContext && index === 0,
            });
          } catch (error) {
            ingestFailures.push(
              `${currentPdf.file.name} (${getApiErrorMessage(error, 'indexing failed')})`
            );
          }
        }

        if (ingestFailures.length > 0) {
          setUploadStatus(`Saved names. Failed to index: ${ingestFailures.join(', ')}`);
        } else if (pdfFiles.length > 0) {
          setUploadStatus(
            replaceAiContext
              ? `Replaced old AI context + indexed ${pdfFiles.length} PDF file(s).`
              : `Saved names + indexed ${pdfFiles.length} PDF file(s).`
          );
        } else if (skippedFiles.length > 0) {
          setUploadStatus('Saved names. Only PDF files are indexed for Ask Notes.');
        } else {
          setUploadStatus('Saved file names.');
        }

        fileMessageSuffix = `\n[Files uploaded]: ${fileNames.join(', ')}`;
        onFilesUpdated?.();
      } catch (error) {
        setUploadStatus('Failed to save file names');
      } finally {
        setIsUploadingFiles(false);
      }
    }

    if (shouldAskAi && aiQuestion) {
      await handleAskNotes(aiQuestion);
      setNewMessage('');
      setPendingFiles([]);
      setTimeout(() => setUploadStatus(''), 1500);
      return;
    }

    const finalText = `${originalMessage}${fileMessageSuffix}`.trim();
    if (!finalText) {
      return;
    }

    socket.emit('send-message', {
      text: finalText,
      files: [],
      // TODO: upload pendingFiles to Cloudinary before sending real file metadata
    });

    socket.emit('typing', { isTyping: false });
    setNewMessage('');
    setPendingFiles([]);
    setTimeout(() => setUploadStatus(''), 1500);
  };

  const handleTypingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setNewMessage(value);
    if (socket) {
      socket.emit('typing', { isTyping: value.trim().length > 0 });
    }
  };

  const handleChooseFiles = () => {
    fileInputRef.current?.click();
  };

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files || []);
    if (!selectedFiles.length) return;

    setPendingFiles((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        file,
      })),
    ]);

    event.target.value = '';
  };

  const removePendingFile = (id: string) => {
    setPendingFiles((current) => current.filter((file) => file.id !== id));
  };

  return (
    <div className="flex h-full flex-col overflow-hidden border-r border-slate-700/50 bg-[#0a0f18] shadow-sm relative">
      <div className="flex items-center gap-4 border-b border-white/5 bg-[#0f172a] px-6 py-5 z-10">
        {onToggleGroups && (
          <button
            type="button"
            onClick={onToggleGroups}
            className="flex items-center justify-center rounded-xl bg-white/[0.03] p-2.5 text-slate-300 ring-1 ring-white/10 transition-all hover:bg-white/[0.08] hover:text-white"
            aria-label="Toggle groups list"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1 pl-1">
          <div className="flex items-center gap-2.5">
            <h2 className="truncate text-xl font-bold tracking-tight text-white drop-shadow-md">
              {groupName || 'Select a Group'}
            </h2>
            {userRole === 'leader' && (
              <div className="flex items-center justify-center rounded-lg bg-amber-500/10 p-1 ring-1 ring-amber-500/20">
                <Trophy className="h-3.5 w-3.5 text-amber-400 drop-shadow-sm" />
              </div>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
            {groupCode ? (
              <span className="flex items-center gap-1.5 rounded-full bg-blue-500/10 px-2.5 py-1 text-blue-300 ring-1 ring-blue-500/20">
                <Users className="h-3 w-3" /> Code: {groupCode}
              </span>
            ) : (
              <span>No room selected</span>
            )}
            <span className="flex items-center gap-1.5 ml-2">
              <span className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.5)]' : 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.5)]'}`} />
              {isConnected ? 'Online' : 'Reconnecting...'}
            </span>
          </div>
        </div>
        {onOpenInfo && (
          <button
            type="button"
            onClick={onOpenInfo}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/[0.03] text-slate-300 ring-1 ring-white/10 transition-all hover:bg-white/[0.08] hover:text-white"
            title="Room info"
          >
            <Info className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="flex shrink-0 gap-3 border-b border-white/5 bg-black/10 p-4 z-10">
        <button
          onClick={() => setActiveView('chat')}
          className={`flex-1 rounded-xl py-3 text-sm font-bold tracking-wide transition-all ${
            activeView === 'chat'
              ? 'bg-blue-600/20 text-blue-300 shadow-sm ring-1 ring-blue-500/30 '
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <MessageSquare className="h-4 w-4" /> Team Comms
          </div>
        </button>
        <button
          onClick={() => setActiveView('quiz')}
          className={`flex-1 rounded-xl py-3 text-sm font-bold tracking-wide transition-all ${
            activeView === 'quiz'
              ? 'bg-violet-600/20 text-violet-300 shadow-sm ring-1 ring-violet-500/30 '
              : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <Sparkles className="h-4 w-4" /> AI Quiz Battle
          </div>
        </button>
      </div>

      {activeView === 'quiz' && groupId ? (
        <div className="flex-1 overflow-y-auto p-4 blend-scrollbar-nebula">
          <QuizPanel
            groupId={groupId}
            canStartQuiz={Boolean(groupId)}
            socket={socket}
            isConnected={isConnected}
          />
        </div>
      ) : (
        <>

      <div className="flex-1 overflow-y-auto px-5 py-4 blend-scrollbar-nebula">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center text-slate-500">
            <Users className="mb-4 h-12 w-12 opacity-30 drop-shadow-md" />
            <p className="text-sm font-medium tracking-wide">No comms yet. Start the synchronization.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {messages.map((message) => {
              const isOwnMessage = message.senderId?._id === userId;
              return (
                <div key={message._id} className={`flex gap-3 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  {!isOwnMessage && (
                    <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-[#0f172a] text-[10px] font-bold text-slate-300 ring-1 ring-white/10">
                      {(message.senderId?.username?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-3 ${
                      isOwnMessage
                        ? 'rounded-br-sm bg-blue-600/20 text-blue-100 ring-1 ring-blue-500/30'
                        : 'rounded-bl-sm border border-white/[0.05] bg-[#0f172a] text-slate-200'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-[11px] font-bold">
                        {isOwnMessage ? 'You' : message.senderId?.username || 'Unknown'}
                      </span>
                      <span className="text-[10px] font-medium text-slate-500">{format(new Date(message.createdAt), 'HH:mm')}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed">{message.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {typingUsers.length > 0 && (
          <div className="mt-4 flex items-center gap-2 px-2 text-[11px] font-medium text-slate-500">
            <div className="flex gap-1">
              <div className="h-1 w-1 animate-bounce rounded-full bg-slate-500" />
              <div className="h-1 w-1 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '0.15s' }} />
              <div className="h-1 w-1 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '0.3s' }} />
            </div>
            <span>
              <span className="text-slate-400">{typingUsers.join(', ')}</span> {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        {askResult && (
          <div className="mt-8 rounded-xl border border-violet-500/20 bg-violet-500/5 p-5 relative overflow-hidden group">
            <div className="mb-3 flex items-center justify-between relative z-10">
              <div className="flex items-center gap-2 text-violet-400">
                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-violet-500/10">
                  <Sparkles className="h-3.5 w-3.5" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-widest">AI Result</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAskResult(null);
                  setAskError('');
                }}
                className="rounded-full p-1.5 text-violet-400/60 transition hover:bg-violet-500/10 hover:text-violet-300"
                aria-label="Close AI answer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-slate-300 relative z-10">{askResult.answer}</p>

            {askResult.sources?.length > 0 && (
              <div className="mt-4 space-y-2 border-t border-violet-500/20 pt-4 relative z-10">
                <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-violet-400/60">Sources</div>
                <div className="flex flex-wrap gap-2">
                  {askResult.sources.map((source, index) => (
                    <div key={`${source.source}-${source.page}-${index}`} className="rounded-md bg-violet-500/10 px-2 py-1 text-[11px] font-medium text-violet-300 flex items-center gap-1.5">
                      <Paperclip className="h-3 w-3 opacity-60" /> {source.source} <span className="opacity-50">| p{source.page}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {askError && !askResult && (
          <div className="mt-6 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-medium text-red-300">
            {askError}
          </div>
        )}

        {!aiReady && (
          <div className="mt-6 rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-sm font-medium text-amber-200">
            {aiUnavailableMessage}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="relative border-t border-white/5 bg-[#0f172a]/95 px-5 py-4 ">
        {pendingFiles.length > 0 && (
          <div className="mb-4 space-y-2.5">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/[0.02] px-4 py-2.5  shadow-sm ring-1 ring-white/5">
              <span className="text-xs font-medium text-slate-300">New Data Indexing:</span>
              <button
                type="button"
                onClick={() => setReplaceAiContext((current) => !current)}
                className={`rounded-lg px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all ${
                  replaceAiContext
                    ? 'border-orange-500/40 bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/50'
                    : 'border-blue-500/30 bg-blue-500/15 text-blue-300 ring-1 ring-blue-500/30'
                }`}
              >
                {replaceAiContext ? 'Override Context' : 'Append Context'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
            {pendingFiles.map((pendingFile) => (
              <div
                key={pendingFile.id}
                className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-200 shadow-sm"
              >
                <span className="max-w-[200px] truncate">{pendingFile.file.name}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(pendingFile.id)}
                  className="rounded-md p-0.5 text-amber-300/70 transition hover:bg-amber-500/20 hover:text-amber-100"
                  aria-label={`Remove ${pendingFile.file.name}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            </div>
          </div>
        )}
        
        {uploadStatus && (
          <div className="absolute -top-8 left-5 right-5 text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-900/60 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-blue-200 shadow-lg ">
              <Loader2 className="h-3 w-3 animate-spin" />
              {uploadStatus}
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,application/pdf"
            className="hidden"
            onChange={handleFilesSelected}
          />
          <button
            type="button"
            onClick={handleChooseFiles}
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-white/[0.02] text-slate-400 transition-colors hover:bg-white/[0.05] hover:text-slate-300 disabled:opacity-50"
            disabled={!isConnected || isUploadingFiles || isAsking || !canUploadContext || !aiReady}
            aria-label="Attach files"
            title={aiReady ? 'Attach files' : aiUnavailableMessage}
          >
            <Paperclip className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={() => setIsAiMode((current) => !current)}
            className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg transition-colors ${
              isAiMode
                ? 'bg-violet-500/10 text-violet-400'
                : 'bg-white/[0.02] text-slate-400 hover:bg-white/[0.05] hover:text-slate-300'
            } disabled:opacity-50`}
            disabled={!isConnected || isUploadingFiles || isAsking || !aiReady}
            aria-label="Toggle AI mode"
            title={aiReady ? 'Toggle AI mode' : aiUnavailableMessage}
          >
            {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>

          <input
            type="text"
            value={newMessage}
            onChange={handleTypingChange}
            placeholder={
              isAiMode
                ? 'Query documents context... (or /ai ...)'
                : 'Message group...'
            }
            className={`flex-1 rounded-lg bg-[#0F172A] px-4 py-2.5 text-[13px] text-white outline-none transition-colors border border-transparent placeholder:text-slate-500 disabled:opacity-50 ${
              isAiMode ? 'focus:border-violet-500/30' : 'focus:border-blue-500/30'
            }`}
            disabled={!isConnected || isUploadingFiles || isAsking || (isAiMode && !aiReady)}
            maxLength={4000}
          />

          <Button
            type="submit"
            size="icon"
            disabled={
              !isConnected ||
              isUploadingFiles ||
              isAsking ||
              (!newMessage.trim() && pendingFiles.length === 0) ||
              ((!aiReady && pendingFiles.length > 0) || (!aiReady && (isAiMode || newMessage.trim().toLowerCase().startsWith('/ai '))))
            }
            className="h-10 w-10 rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-500 disabled:pointer-events-none disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2.5 flex items-center justify-between px-1 text-[10px] font-semibold text-slate-500">
          <span>
            {isAiMode
              ? aiReady
                ? 'AI Assistant Focus'
                : aiUnavailableMessage
              : aiReady
                ? 'Tip: Start with /ai for AI responses'
                : 'AI features are temporarily unavailable'}
          </span>
          {isAiMode && (
            <button
              type="button"
              onClick={() => setIsAiMode(false)}
              className="text-violet-400 transition hover:text-violet-300 flex items-center gap-1 font-medium"
            >
              <X className="h-3 w-3" /> Disengage AI
            </button>
          )}
        </div>
      </form>
        </>
      )}
    </div>
  );
}

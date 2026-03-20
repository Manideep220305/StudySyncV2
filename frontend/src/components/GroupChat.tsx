import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import { Info, Loader2, Menu, MessageSquare, Paperclip, Send, Sparkles, Trophy, Users, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import QuizPanel from '@/components/QuizPanel';
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

  const isPdfFile = (file: File) =>
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const handleAskNotes = async (question: string) => {
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
          } catch {
            ingestFailures.push(currentPdf.file.name);
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
    <div className="flex h-full flex-col overflow-hidden border-r border-white/10 bg-slate-900/30 rooms-glass-pulse">
      <div className="flex items-center gap-3 border-b border-white/10 bg-slate-900/70 px-5 py-4">
        {onToggleGroups && (
          <button
            type="button"
            onClick={onToggleGroups}
            className="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-2.5 text-cyan-100 transition hover:bg-cyan-300/20"
            aria-label="Toggle groups list"
          >
            <Menu className="h-4 w-4" />
          </button>
        )}
        <div className={`h-2.5 w-2.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`} />
        <button
          type="button"
          onClick={onOpenInfo}
          className="min-w-0 text-left"
          aria-label="Open group details"
        >
          <div className="truncate text-xl font-extrabold tracking-tight text-white">{groupName || 'Select a group'}</div>
          <div className="font-mono text-[11px] uppercase tracking-[0.3em] text-slate-500">
            #{groupCode || '------'}
          </div>
        </button>
        <div className="ml-auto text-xs text-slate-400">{isConnected ? 'Connected' : 'Disconnected'}</div>
        {onOpenInfo && (
          <button
            type="button"
            onClick={onOpenInfo}
            className="rounded-full border border-white/10 bg-white/5 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white"
            aria-label="Open group info"
          >
            <Info className="h-4 w-4" />
          </button>
        )}
      </div>

      {groupId && (
        <div className="flex items-center gap-2 border-b border-white/10 bg-slate-900/60 px-5 py-2">
          <button
            onClick={() => setActiveView('chat')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeView === 'chat'
                ? 'border border-blue-500/30 bg-blue-500/15 text-blue-100'
                : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Chat
          </button>
          <button
            onClick={() => setActiveView('quiz')}
            className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activeView === 'quiz'
                ? 'border border-amber-500/30 bg-amber-500/15 text-amber-100'
                : 'border border-transparent text-slate-400 hover:bg-white/5 hover:text-white'
            }`}
          >
            <Trophy className="h-3.5 w-3.5" />
            Quiz
          </button>
        </div>
      )}

      {activeView === 'quiz' && groupId ? (
        <div className="flex-1 overflow-y-auto p-4 blend-scrollbar-nebula">
          <QuizPanel
            groupId={groupId}
            canStartQuiz={userRole === 'leader'}
            socket={socket}
            isConnected={isConnected}
          />
        </div>
      ) : (
        <>

      <div className="flex-1 overflow-y-auto px-5 py-4 blend-scrollbar-nebula">
        {messages.length === 0 ? (
          <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center text-slate-500">
            <Users className="mb-3 h-10 w-10 opacity-40" />
            <p className="text-sm">No messages yet. Start the room.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => {
              const isOwnMessage = message.senderId?._id === userId;
              return (
                <div key={message._id} className={`flex gap-3 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
                  {!isOwnMessage && (
                    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold text-white">
                      {(message.senderId?.username?.[0] || '?').toUpperCase()}
                    </div>
                  )}
                  <div
                    className={`max-w-[72%] rounded-2xl px-4 py-3 shadow-lg ${
                      isOwnMessage
                        ? 'rounded-br-md bg-blue-600 text-white'
                        : 'rounded-bl-md border border-white/15 bg-white/10 text-white'
                    }`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="text-sm font-semibold">
                        {isOwnMessage ? 'You' : message.senderId?.username || 'Unknown'}
                      </span>
                      <span className="text-[11px] opacity-70">{format(new Date(message.createdAt), 'HH:mm')}</span>
                    </div>
                    <p className="text-sm leading-relaxed">{message.text}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {typingUsers.length > 0 && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-slate-800/40 px-3 py-2 text-sm text-slate-400">
            <div className="flex gap-1">
              <div className="h-2 w-2 animate-bounce rounded-full bg-slate-500" />
              <div className="h-2 w-2 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '0.1s' }} />
              <div className="h-2 w-2 animate-bounce rounded-full bg-slate-500" style={{ animationDelay: '0.2s' }} />
            </div>
            <span>
              {typingUsers.join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing...
            </span>
          </div>
        )}

        {askResult && (
          <div className="mt-4 rounded-2xl border border-cyan-400/25 bg-cyan-500/10 p-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2 text-cyan-200">
                <Sparkles className="h-4 w-4" />
                <span className="text-xs font-semibold uppercase tracking-[0.25em]">AI Answer</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setAskResult(null);
                  setAskError('');
                }}
                className="rounded-full p-1 text-cyan-200/80 transition hover:bg-white/10 hover:text-white"
                aria-label="Close AI answer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-cyan-50">{askResult.answer}</p>
            {askResult.sources?.length > 0 && (
              <div className="mt-3 space-y-1 border-t border-white/10 pt-3">
                <div className="text-[11px] uppercase tracking-[0.3em] text-cyan-200/80">Sources</div>
                {askResult.sources.map((source, index) => (
                  <div key={`${source.source}-${source.page}-${index}`} className="text-xs text-cyan-100/85">
                    {source.source} (page {source.page})
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {askError && !askResult && (
          <div className="mt-4 rounded-xl border border-red-400/20 bg-red-500/10 px-3 py-2 text-xs text-red-200">
            {askError}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t border-white/10 bg-slate-900/70 px-5 py-4">
        {pendingFiles.length > 0 && (
          <div className="mb-3 space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-white/10 bg-slate-800/50 px-3 py-2">
              <span className="text-xs text-slate-300">When indexing new PDFs:</span>
              <button
                type="button"
                onClick={() => setReplaceAiContext((current) => !current)}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  replaceAiContext
                    ? 'border border-orange-400/40 bg-orange-500/20 text-orange-200'
                    : 'border border-cyan-400/30 bg-cyan-500/15 text-cyan-200'
                }`}
              >
                {replaceAiContext ? 'Replace old context' : 'Keep old context'}
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
            {pendingFiles.map((pendingFile) => (
              <div
                key={pendingFile.id}
                className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/15 px-3 py-1.5 text-xs text-amber-300"
              >
                <span className="max-w-[180px] truncate">{pendingFile.file.name}</span>
                <button
                  type="button"
                  onClick={() => removePendingFile(pendingFile.id)}
                  className="text-amber-200 transition hover:text-white"
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
          <div className="mb-2 text-xs text-cyan-300">
            {uploadStatus}
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
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-white/10 hover:text-white"
            disabled={!isConnected || isUploadingFiles || isAsking}
            aria-label="Attach files"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setIsAiMode((current) => !current)}
            className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border transition ${
              isAiMode
                ? 'border-cyan-400/40 bg-cyan-500/20 text-cyan-100'
                : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white'
            }`}
            disabled={!isConnected || isUploadingFiles || isAsking}
            aria-label="Toggle AI mode"
            title="Toggle AI mode"
          >
            {isAsking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={handleTypingChange}
            placeholder={
              isAiMode
                ? 'Ask from uploaded PDFs... (or use /ai in normal mode)'
                : 'Drop an update, ask a doubt, share progress...'
            }
            className="flex-1 rounded-xl border border-white/10 bg-slate-800/70 px-4 py-3 text-sm text-white placeholder:text-slate-500 focus:border-blue-500 focus:outline-none"
            disabled={!isConnected || isUploadingFiles || isAsking}
            maxLength={4000}
          />
          <Button
            type="submit"
            size="icon"
            disabled={!isConnected || isUploadingFiles || isAsking || (!newMessage.trim() && pendingFiles.length === 0)}
            className="h-11 w-11 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
          <span>{isAiMode ? 'AI mode is ON' : 'Tip: type /ai your question to ask notes instantly'}</span>
          {isAiMode && (
            <button
              type="button"
              onClick={() => setIsAiMode(false)}
              className="text-cyan-300 transition hover:text-cyan-200"
            >
              Exit AI mode
            </button>
          )}
        </div>
      </form>
        </>
      )}
    </div>
  );
}

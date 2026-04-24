import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import aiService, { AiHealthResponse } from '@/services/aiService';
import { getApiErrorMessage } from '@/services/apiClient';

interface AiStatusContextType {
  aiHealth: AiHealthResponse | null;
  aiReady: boolean;
  aiChecking: boolean;
  aiMessage: string;
  refreshAiHealth: () => Promise<void>;
}

const fallbackHealth: AiHealthResponse = {
  available: false,
  status: 'offline',
  service: 'fastapi-rag',
  url: '',
  message: 'AI service is unavailable right now',
  checkedAt: null,
  responseTimeMs: null,
  upstreamStatus: null,
};

const AiStatusContext = createContext<AiStatusContextType>({
  aiHealth: null,
  aiReady: false,
  aiChecking: true,
  aiMessage: fallbackHealth.message,
  refreshAiHealth: async () => {},
});

const POLL_INTERVAL_MS = 30_000;

export function AiStatusProvider({ children }: { children: ReactNode }) {
  const [aiHealth, setAiHealth] = useState<AiHealthResponse | null>(null);
  const [aiChecking, setAiChecking] = useState(true);
  const mountedRef = useRef(true);

  const refreshAiHealth = async () => {
    try {
      const health = await aiService.getAiHealth();
      if (!mountedRef.current) return;
      setAiHealth(health);
    } catch (error) {
      if (!mountedRef.current) return;
      setAiHealth({
        ...fallbackHealth,
        message: getApiErrorMessage(error, fallbackHealth.message),
        checkedAt: new Date().toISOString(),
      });
    } finally {
      if (mountedRef.current) {
        setAiChecking(false);
      }
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    refreshAiHealth();

    const interval = window.setInterval(() => {
      refreshAiHealth();
    }, POLL_INTERVAL_MS);

    return () => {
      mountedRef.current = false;
      window.clearInterval(interval);
    };
  }, []);

  const effectiveHealth = aiHealth || fallbackHealth;

  return (
    <AiStatusContext.Provider
      value={{
        aiHealth,
        aiReady: effectiveHealth.available,
        aiChecking,
        aiMessage: effectiveHealth.message,
        refreshAiHealth,
      }}
    >
      {children}
    </AiStatusContext.Provider>
  );
}

export function useAiStatus() {
  return useContext(AiStatusContext);
}

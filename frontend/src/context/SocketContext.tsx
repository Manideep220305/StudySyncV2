import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_ORIGIN } from '@/config/env';

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  isConnected: false,
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to Socket.io with cookie auth
    const newSocket = io(`${SOCKET_ORIGIN}/study`, {
      withCredentials: true, // Send httpOnly JWT cookie
      autoConnect: false,    // Manual connect for auth readiness
    });

    newSocket.on('connect', () => {
      console.log('Socket connected:', newSocket.id);
      setIsConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    newSocket.on('connect_error', (error) => {
      console.error('Socket connect error:', error.message);
      setIsConnected(false);
    });

    newSocket.io.on('reconnect_failed', () => {
      console.error('Socket reconnect failed');
      setIsConnected(false);
    });

    setSocket(newSocket);
    newSocket.connect();

    return () => {
      newSocket.disconnect();
      newSocket.close();
    };
  }, []);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}


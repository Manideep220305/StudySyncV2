import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SocketProvider, useSocket } from '@/context/SocketContext';

const handlers: Record<string, ((...args: any[]) => void)[]> = {};
const reconnectHandlers: Record<string, ((...args: any[]) => void)[]> = {};

const fakeSocket = {
  id: 's1',
  on: vi.fn((event: string, cb: (...args: any[]) => void) => {
    handlers[event] = handlers[event] || [];
    handlers[event].push(cb);
  }),
  connect: vi.fn(),
  disconnect: vi.fn(),
  close: vi.fn(),
  io: {
    on: vi.fn((event: string, cb: (...args: any[]) => void) => {
      reconnectHandlers[event] = reconnectHandlers[event] || [];
      reconnectHandlers[event].push(cb);
    }),
  },
};

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => fakeSocket),
}));

function Probe() {
  const { isConnected } = useSocket();
  return <div>{isConnected ? 'connected' : 'disconnected'}</div>;
}

describe('SocketContext smoke', () => {
  it('toggles connection state when socket events fire', () => {
    render(
      <SocketProvider>
        <Probe />
      </SocketProvider>
    );

    expect(screen.getByText('disconnected')).toBeInTheDocument();

    act(() => {
      handlers.connect?.forEach((fn) => fn());
    });
    expect(screen.getByText('connected')).toBeInTheDocument();

    act(() => {
      handlers.disconnect?.forEach((fn) => fn());
    });
    expect(screen.getByText('disconnected')).toBeInTheDocument();
  });
});

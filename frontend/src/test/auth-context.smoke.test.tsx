import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from '@/context/AuthContext';

const apiMock = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('@/services/apiClient', () => ({
  apiClient: apiMock,
  unwrapApiData: (payload: any) => (payload?.success ? payload.data : payload),
  getApiErrorMessage: () => 'error',
}));

function Probe() {
  const { loading, isAuthenticated, user } = useAuth();
  if (loading) return <div>loading</div>;
  return (
    <div>
      <span>{isAuthenticated ? 'yes' : 'no'}</span>
      <span>{user?.username || 'none'}</span>
    </div>
  );
}

describe('AuthContext smoke', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
  });

  it('hydrates authenticated session from /auth/me', async () => {
    apiMock.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { _id: 'u1', username: 'kat', email: 'k@test.dev' },
      },
    });

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText('yes')).toBeInTheDocument());
    expect(screen.getByText('kat')).toBeInTheDocument();
  });
});

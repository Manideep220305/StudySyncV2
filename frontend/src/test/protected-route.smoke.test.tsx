import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import ProtectedRoute from '@/components/ProtectedRoute';

const authMock = vi.hoisted(() => ({
  useAuth: vi.fn(),
}));

vi.mock('@/context/AuthContext', () => authMock);

describe('ProtectedRoute smoke', () => {
  it('redirects unauthenticated users to landing route', async () => {
    authMock.useAuth.mockReturnValue({ loading: false, isAuthenticated: false });

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route path="/" element={<div>Landing</div>} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <div>Dashboard</div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Landing')).toBeInTheDocument();
  });
});

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

const defaultApiOrigin = 'http://localhost:5000';

export const API_ORIGIN = trimTrailingSlash(
  String(import.meta.env.VITE_API_URL || defaultApiOrigin)
);
export const API_BASE_URL = `${API_ORIGIN}/api`;

export const SOCKET_ORIGIN = trimTrailingSlash(
  String(import.meta.env.VITE_SOCKET_URL || API_ORIGIN)
);

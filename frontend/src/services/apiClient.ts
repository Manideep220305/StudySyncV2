import axios from 'axios';
import { API_BASE_URL } from '@/config/env';

export interface ApiSuccess<T> {
  success: true;
  data: T;
}

export interface ApiFailure {
  success: false;
  error: {
    code?: string;
    message: string;
    details?: unknown;
  };
}

export type ApiEnvelope<T> = ApiSuccess<T> | ApiFailure;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

export const unwrapApiData = <T>(payload: T | ApiEnvelope<T>): T => {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    (payload as ApiEnvelope<T>).success === true
  ) {
    return (payload as ApiSuccess<T>).data;
  }
  return payload as T;
};

export const getApiErrorMessage = (error: any, fallback: string): string => {
  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    fallback
  );
};

const mongoose = require('mongoose');
const Group = require('../models/Group');
const Membership = require('../models/Membership');
const logger = require('../utils/logger');
const { createHttpError } = require('../middleware/errorMiddleware');
const { startQuizWithQuestions } = require('../services/quizSessionService');
const { getStudyNamespace } = require('../socket');
const { refreshAiServiceStatus } = require('../services/aiHealthService');

const FASTAPI_BASE_URL = (process.env.FASTAPI_URL || 'http://localhost:8000').replace(/\/+$/, '');

const fetchWithTimeout = async (url, options = {}, timeoutMs = 120000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

const normalizeProxyError = (error, fallbackMessage) => {
  if (error?.status) {
    return error;
  }

  if (error?.name === 'AbortError') {
    return createHttpError(504, 'AI_SERVICE_TIMEOUT', 'AI service timed out');
  }

  const message = error?.cause?.message || error?.message || fallbackMessage;
  return createHttpError(502, 'AI_PROXY_ERROR', message);
};

const parseJsonSafe = async (response) => {
  try {
    return await response.json();
  } catch (error) {
    return null;
  }
};

const mapFastApiError = async (response, fallback) => {
  const payload = await parseJsonSafe(response);
  const detail = payload?.detail || fallback;
  const message = typeof detail === 'string' ? detail : fallback;
  const status = response.status >= 500 ? 502 : response.status;
  return createHttpError(status, 'AI_SERVICE_ERROR', message, { fastapi: payload });
};

const ensureGroupMember = async (userId, groupId) => {
  if (!mongoose.Types.ObjectId.isValid(groupId)) {
    throw createHttpError(400, 'INVALID_GROUP_ID', 'groupId must be a valid id');
  }

  const membership = await Membership.findOne({ userId, groupId }).lean();
  if (!membership) {
    throw createHttpError(403, 'FORBIDDEN', 'Not a member of this group');
  }

  return membership;
};

const uploadPdfToAi = async (req, res, next) => {
  try {
    const { groupId, replaceContext } = req.body;
    await ensureGroupMember(req.user._id, groupId);

    if (!req.file) {
      throw createHttpError(400, 'FILE_REQUIRED', 'PDF file is required');
    }

    if (req.file.mimetype !== 'application/pdf' && !String(req.file.originalname || '').toLowerCase().endsWith('.pdf')) {
      throw createHttpError(400, 'INVALID_FILE_TYPE', 'Only PDF files are allowed');
    }

    const formData = new FormData();
    const blob = new Blob([req.file.buffer], { type: req.file.mimetype || 'application/pdf' });
    formData.append('file', blob, req.file.originalname || 'upload.pdf');
    formData.append('group_id', groupId);
    const shouldReplaceContext = replaceContext === true || replaceContext === 'true';
    formData.append('replace_context', shouldReplaceContext ? 'true' : 'false');

    const response = await fetchWithTimeout(`${FASTAPI_BASE_URL}/upload-pdf`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw await mapFastApiError(response, 'Failed to upload PDF to AI service');
    }

    const payload = await parseJsonSafe(response);
    return res.status(201).json({
      message: 'PDF processed successfully',
      ...payload,
    });
  } catch (error) {
    logger.error('ai_upload_failed', {
      message: error.message,
      code: error.code,
      status: error.status,
      cause: error?.cause?.message,
    });
    return next(normalizeProxyError(error, 'Failed to upload PDF to AI service'));
  }
};

const generateQuizFromAi = async (req, res, next) => {
  try {
    const { groupId } = req.body;
    const requestedCount = Number(req.body.numQuestions ?? req.body.num_questions ?? 5);
    const numQuestions = Math.max(1, Math.min(Number.isFinite(requestedCount) ? requestedCount : 5, 10));
    await ensureGroupMember(req.user._id, groupId);

    const response = await fetchWithTimeout(`${FASTAPI_BASE_URL}/generate-quiz`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, num_questions: numQuestions }),
    });

    if (!response.ok) {
      throw await mapFastApiError(response, 'Failed to generate quiz from AI service');
    }

    const payload = await parseJsonSafe(response);
    const fastApiQuestions = payload?.quiz?.questions;
    if (!Array.isArray(fastApiQuestions) || fastApiQuestions.length === 0) {
      throw createHttpError(502, 'AI_SERVICE_ERROR', 'AI service returned invalid quiz questions');
    }

    const group = await Group.findById(groupId).select('joinCode').lean();
    if (!group) {
      throw createHttpError(404, 'GROUP_NOT_FOUND', 'Group not found');
    }

    const mappedQuestions = fastApiQuestions.map((question, index) => ({
      id: `ai-${index + 1}`,
      question: String(question?.question || '').trim(),
      options: Array.isArray(question?.options) ? question.options.map((option) => String(option || '').trim()) : [],
      correctIndex: Number(question?.correct_index),
      explanation: String(question?.explanation || '').trim(),
    }));

    const session = startQuizWithQuestions({
      groupId,
      joinCode: group.joinCode,
      startedBy: req.user._id,
      topic: 'ai_rag',
      questions: mappedQuestions,
    });

    if (!session) {
      throw createHttpError(502, 'AI_SERVICE_ERROR', 'AI quiz mapping failed');
    }

    const studyNamespace = getStudyNamespace();
    if (studyNamespace) {
      studyNamespace.to(group.joinCode).emit('quiz-started', session);
    }

    return res.status(200).json({
      ...payload,
      session,
    });
  } catch (error) {
    logger.error('ai_generate_quiz_failed', {
      message: error.message,
      code: error.code,
      status: error.status,
      cause: error?.cause?.message,
    });
    return next(normalizeProxyError(error, 'Failed to generate quiz from AI service'));
  }
};

const askAi = async (req, res, next) => {
  try {
    const { groupId, question } = req.body;

    await ensureGroupMember(req.user._id, groupId);

    const response = await fetchWithTimeout(`${FASTAPI_BASE_URL}/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ group_id: groupId, question }),
    });

    if (!response.ok) {
      throw await mapFastApiError(response, 'Failed to fetch answer from AI service');
    }

    const payload = await parseJsonSafe(response);
    return res.status(200).json(payload);
  } catch (error) {
    logger.error('ai_ask_failed', {
      message: error.message,
      code: error.code,
      status: error.status,
      cause: error?.cause?.message,
    });
    return next(normalizeProxyError(error, 'Failed to fetch answer from AI service'));
  }
};

const aiHealth = async (req, res, next) => {
  try {
    const status = await refreshAiServiceStatus({ timeoutMs: 10000 });
    return res.status(200).json(status);
  } catch (error) {
    return next(normalizeProxyError(error, 'AI health check failed'));
  }
};

module.exports = {
  uploadPdfToAi,
  generateQuizFromAi,
  askAi,
  aiHealth,
};

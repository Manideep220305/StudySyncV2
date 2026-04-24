// server.js — Entry Point
// This file's ONLY job is: connect to MongoDB, then start the Express server.
// All Express configuration (middleware, routes) lives in app.js — we keep them
// separate so server.js stays clean and focused.

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = require('./app');
const logger = require('./utils/logger');
const { validateRequiredEnv } = require('./utils/startupValidation');
const {
    refreshAiServiceStatus,
    getAiHealthCheckIntervalMs,
} = require('./services/aiHealthService');

// Load environment variables from .env file (MONGO_URI, JWT_SECRET, PORT, etc.)
dotenv.config();

const validation = validateRequiredEnv();
if (!validation.ok) {
    logger.error('startup_validation_failed', {
        missingEnv: validation.missing,
    });
    process.exit(1);
}

// Async DB connection function — we use async/await for cleaner error handling.
const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI);
        logger.info('mongo_connected', { host: conn.connection.host });

        // Compatibility migration: remove stale legacy unique index if present.
        // Older schema used `inviteCode`; current schema uses `joinCode`.
        try {
            const groupsCollection = mongoose.connection.db.collection('groups');
            const indexes = await groupsCollection.indexes();
            const hasLegacyInviteCodeIndex = indexes.some((idx) => idx.name === 'inviteCode_1');
            if (hasLegacyInviteCodeIndex) {
                await groupsCollection.dropIndex('inviteCode_1');
                logger.info('mongo_index_dropped', { index: 'groups.inviteCode_1' });
            }
        } catch (indexError) {
            logger.warn('mongo_index_check_skipped', { message: indexError.message });
        }
    } catch (error) {
        logger.error('mongo_connection_failed', { message: error.message });
        // Exit the process with failure code. Don't start the server if DB fails.
        process.exit(1);
    }
};

// Pattern: Connect to DB first, THEN start listening for requests.
// This ensures the app never handles requests before the database is ready.
connectDB().then(() => {
    const httpServer = require('http').createServer(app);
    const { initSocket } = require('./socket');
    initSocket(httpServer);
    app.locals.socketInitialized = true;
    app.locals.startedAt = new Date().toISOString();

    refreshAiServiceStatus()
        .then((status) => {
            const logLevel = status.available ? 'info' : 'warn';
            logger[logLevel]('ai_service_probe', {
                status: status.status,
                message: status.message,
                checkedAt: status.checkedAt,
                responseTimeMs: status.responseTimeMs,
                url: status.url,
            });
        })
        .catch((error) => {
            logger.warn('ai_service_probe_failed', { message: error.message });
        });

    setInterval(() => {
        refreshAiServiceStatus().catch((error) => {
            logger.warn('ai_service_probe_failed', { message: error.message });
        });
    }, getAiHealthCheckIntervalMs()).unref();
    
    const PORT = process.env.PORT || 5000;
    httpServer.listen(PORT, () => {
        logger.info('server_started', { port: PORT, nodeEnv: process.env.NODE_ENV || 'development' });
    });
});

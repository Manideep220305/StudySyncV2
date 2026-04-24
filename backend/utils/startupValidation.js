const REQUIRED_ENV_VARS = ['MONGO_URI', 'JWT_SECRET'];

const validateRequiredEnv = () => {
  const missing = REQUIRED_ENV_VARS.filter((key) => !String(process.env[key] || '').trim());

  return {
    ok: missing.length === 0,
    missing,
  };
};

module.exports = {
  validateRequiredEnv,
};

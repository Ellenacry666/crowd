export function validateEnv(config: Record<string, unknown>) {
  const required = ['DATABASE_URL', 'JWT_SECRET', 'QR_SECRET'];
  const missing = required.filter((key) => !config[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  for (const key of ['JWT_SECRET', 'QR_SECRET']) {
    if (String(config[key]).length < 32) {
      throw new Error(`${key} must be at least 32 characters long`);
    }
  }
  return config;
}

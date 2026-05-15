export default () => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: parseInt(process.env.PORT ?? '3000', 10),
  apiPrefix: process.env.API_PREFIX ?? 'api',
  databaseUrl: process.env.DATABASE_URL,
  redis: {
    host: process.env.REDIS_HOST ?? 'localhost',
    port: parseInt(process.env.REDIS_PORT ?? '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-only-secret',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
  },
  corsOrigins: (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL ?? 'info',
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME ?? '',
    apiKey: process.env.CLOUDINARY_API_KEY ?? '',
    apiSecret: process.env.CLOUDINARY_API_SECRET ?? '',
  },
  smslenz: {
    userId: process.env.SMSLENZ_USER_ID ?? '',
    apiKey: process.env.SMSLENZ_API_KEY ?? '',
    senderId: process.env.SMSLENZ_SENDER_ID ?? 'SMSlenzDEMO',
  },
});

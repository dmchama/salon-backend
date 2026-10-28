import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_PREFIX: Joi.string().default('api'),
  DATABASE_URL: Joi.string().required(),
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().default(6379),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('15m'),
  LOG_LEVEL: Joi.string().default('info'),
  CORS_ORIGINS: Joi.string().allow('').optional(),
  CLOUDINARY_CLOUD_NAME: Joi.string().required(),
  CLOUDINARY_API_KEY: Joi.string().required(),
  CLOUDINARY_API_SECRET: Joi.string().required(),
  REGISTRATION_RECEIPT_REQUIRED: Joi.string().valid('true', 'false').optional(),
  SMSLENZ_USER_ID: Joi.string().allow('').optional(),
  SMSLENZ_API_KEY: Joi.string().allow('').optional(),
  SMSLENZ_SENDER_ID: Joi.string().allow('').optional(),
});

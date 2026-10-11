const path = require('path');
const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(5000),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters long.'),
  DB_PATH: z.string().min(1).default('urbanpulse.db'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  GEOCODER_USER_AGENT: z.string().trim().min(10).max(200)
    .default('UrbanPulse/1.0 (civic public-space mapping)'),
  AI_PROVIDER: z.enum(['rules', 'gemini']).default('rules'),
  GEMINI_API_KEY: z.string().default(''),
  DEMO_CITIZEN_PASSWORD: z.string().min(6),
  DEMO_NGO_PASSWORD: z.string().min(6),
  DEMO_AUTHORITY_PASSWORD: z.string().min(6),
  ADMIN_EMAIL: z.string().trim().email().default('admin@urbanpulse.com'),
  DEMO_ADMIN_PASSWORD: z.string().default('').refine(
    (value) => value.length === 0 || value.length >= 6,
    'DEMO_ADMIN_PASSWORD must be empty or at least 6 characters long.',
  ),
  SEED_DEMO_DATA: z.preprocess(
    (value) => value === undefined ? true : !['false', '0', 'no'].includes(String(value).toLowerCase()),
    z.boolean(),
  ),
  SEED_DEMO_ACCOUNTS: z.preprocess(
    (value) => value === undefined ? true : !['false', '0', 'no'].includes(String(value).toLowerCase()),
    z.boolean(),
  ),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('Invalid environment configuration:', result.error.issues);
  throw new Error('Please correct the environment configuration before starting UrbanPulse.');
}

const env = result.data;
const projectRoot = path.resolve(__dirname, '..');

module.exports = {
  port: env.PORT,
  jwtSecret: env.JWT_SECRET,
  databasePath: path.isAbsolute(env.DB_PATH)
    ? env.DB_PATH
    : path.resolve(projectRoot, env.DB_PATH),
  frontendUrl: env.FRONTEND_URL,
  geocoderUserAgent: env.GEOCODER_USER_AGENT,
  aiProvider: env.AI_PROVIDER,
  geminiApiKey: env.GEMINI_API_KEY,
  demoPasswords: {
    citizen: env.DEMO_CITIZEN_PASSWORD,
    ngo: env.DEMO_NGO_PASSWORD,
    authority: env.DEMO_AUTHORITY_PASSWORD,
    admin: env.DEMO_ADMIN_PASSWORD,
  },
  adminEmail: env.ADMIN_EMAIL.toLowerCase(),
  seedDemoData: env.SEED_DEMO_DATA,
  seedDemoAccounts: env.SEED_DEMO_ACCOUNTS,
};

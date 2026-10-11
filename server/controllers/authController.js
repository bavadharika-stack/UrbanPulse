const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const config = require('../config');
const userRepository = require('../db');
const { getLoginRoleMismatchMessage } = require('../services/trustRules');

const registrationSchema = z.object({
  role: z.enum(['citizen', 'ngo']).default('citizen'),
  fullName: z.string().trim().min(2).max(120).optional(),
  organizationName: z.string().trim().min(2).max(160).optional(),
  email: z.string().trim().email().max(254),
  password: z.string().min(6).max(128),
  ngoType: z.string().trim().max(100).optional(),
}).superRefine((data, context) => {
  if (data.role === 'citizen' && !data.fullName) {
    context.addIssue({
      code: 'custom',
      path: ['fullName'],
      message: 'Full name is required for citizen accounts.',
    });
  }
  if (data.role === 'ngo') {
    if (!data.organizationName) {
      context.addIssue({
        code: 'custom',
        path: ['organizationName'],
        message: 'Organization name is required for NGO accounts.',
      });
    }
    if (!data.ngoType) {
      context.addIssue({
        code: 'custom',
        path: ['ngoType'],
        message: 'NGO type is required for NGO accounts.',
      });
    }
  }
});

const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(1).max(128),
  role: z.enum(['citizen', 'ngo', 'authority', 'admin']).optional(),
});

const validationMessage = (error) =>
  error.issues.map((issue) => issue.message).join(' ');

const createToken = (user) => jwt.sign(
  { sub: String(user.id), role: user.role },
  config.jwtSecret,
  { expiresIn: '8h' },
);

exports.register = async (req, res) => {
  const parsed = registrationSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: validationMessage(parsed.error),
    });
  }

  const data = parsed.data;
  const email = data.email.toLowerCase();
  try {
    const existingUser = await userRepository.findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address is already registered.',
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);
    const user = await userRepository.createUser({
      fullName: data.role === 'ngo' ? data.organizationName : data.fullName,
      organizationName: data.role === 'ngo' ? data.organizationName : '',
      email,
      passwordHash,
      role: data.role,
      ngoType: data.role === 'ngo' ? data.ngoType : '',
      status: data.role === 'ngo' ? 'pending' : 'active',
    });

    return res.status(201).json({
      success: true,
      message: 'Registration successful! You can now proceed to login.',
      user,
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing registration. Please try again.',
    });
  }
};

exports.login = async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: validationMessage(parsed.error),
    });
  }

  try {
    const userRecord = await userRepository.findUserByEmail(parsed.data.email.toLowerCase());
    if (!userRecord && parsed.data.role === 'admin' && parsed.data.email.toLowerCase() === config.adminEmail) {
      return res.status(503).json({
        success: false,
        message: 'Admin sign-in is not configured. Set DEMO_ADMIN_PASSWORD and SEED_DEMO_DATA=true in the server .env, then restart the server.',
      });
    }
    if (!userRecord && parsed.data.role === 'authority'
      && parsed.data.email.toLowerCase() === 'authority@urbanpulse.com'
      && !config.seedDemoAccounts) {
      return res.status(503).json({
        success: false,
        message: 'The demo Authority account is disabled. Set SEED_DEMO_ACCOUNTS=true in the server .env, then restart the server.',
      });
    }
    const passwordMatches = userRecord
      ? await bcrypt.compare(parsed.data.password, userRecord.password_hash)
      : false;

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    const user = await userRepository.findUserById(userRecord.id);
    const roleMismatchMessage = getLoginRoleMismatchMessage(user.role, parsed.data.role);
    if (roleMismatchMessage) {
      return res.status(403).json({
        success: false,
        message: roleMismatchMessage,
      });
    }
    if (user.status === 'deactivated' || user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: user.status === 'rejected'
          ? 'This NGO application was rejected. Contact an administrator for details.'
          : 'This account is deactivated. Contact an administrator for assistance.',
      });
    }
    return res.json({
      success: true,
      message: 'Login successful.',
      token: createToken(user),
      user,
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing login. Please try again.',
    });
  }
};

exports.me = (req, res) => res.json({
  success: true,
  user: req.user,
});

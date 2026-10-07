const bcrypt = require('bcryptjs');
const userRepository = require('../db');

// Basic email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Citizen Registration Controller (US-01)
 */
exports.register = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // 1. Required-field validation
    if (!fullName || typeof fullName !== 'string' || !fullName.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Full name is required.',
      });
    }

    if (!email || typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Email address is required.',
      });
    }

    if (!password || typeof password !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Password is required.',
      });
    }

    const trimmedName = fullName.trim();
    const trimmedEmail = email.trim().toLowerCase();

    // 2. Email format validation
    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.',
      });
    }

    // 3. Password validation
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long.',
      });
    }

    // 4. Duplicate account check
    const existingUser = await userRepository.findUserByEmail(trimmedEmail);
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'An account with this email address is already registered.',
      });
    }

    // 5. Secure password hashing (Salt rounds: 10)
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // 6. Save new citizen user to SQLite
    const newUser = await userRepository.createCitizenUser({
      fullName: trimmedName,
      email: trimmedEmail,
      passwordHash,
    });

    return res.status(201).json({
      success: true,
      message: 'Citizen registration successful! You can now proceed to login.',
      user: newUser,
    });
  } catch (error) {
    console.error('Registration Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error while processing registration. Please try again.',
    });
  }
};

const jwt = require('jsonwebtoken');
const config = require('../config');
const userRepository = require('../db');
const { hasRolePermission, canPerformReportAction } = require('../services/trustRules');

const authenticateToken = async (req, res, next) => {
  const authorization = req.get('authorization') || '';
  const [scheme, token] = authorization.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return res.status(401).json({
      success: false,
      message: 'Authentication token is required.',
    });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (!payload || typeof payload === 'string' || typeof payload.sub !== 'string') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.',
      });
    }

    const user = await userRepository.findUserById(payload.sub);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'The account for this token no longer exists.',
      });
    }
    if (user.status === 'deactivated' || user.status === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'This account is not active. Contact an administrator for assistance.',
      });
    }
    req.user = user;
    return next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired authentication token.',
      });
    }
    return next(error);
  }
};

const authorizeRoles = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication is required.',
    });
  }
  if (!hasRolePermission(req.user, roles)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to access this resource.',
    });
  }
  return next();
};

const requireApprovedNgo = (req, res, next) => {
  if (req.user?.role === 'ngo' && !canPerformReportAction(req.user, 'accept')) {
    return res.status(403).json({
      success: false,
      message: 'Your NGO account is pending administrator approval. You can sign in, but report actions are unavailable until approved.',
    });
  }
  return next();
};

module.exports = { authenticateToken, authorizeRoles, requireApprovedNgo };

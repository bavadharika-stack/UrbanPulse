const { z } = require('zod');
const userRepository = require('../db');

const availabilitySchema = z.object({
  status: z.enum(['available', 'unavailable']),
});

exports.getAvailability = async (req, res, next) => {
  try {
    const status = await userRepository.getNgoAvailability(req.user.id);
    return res.json({ success: true, status });
  } catch (error) {
    return next(error);
  }
};

exports.setAvailability = async (req, res, next) => {
  const parsed = availabilitySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Status must be available or unavailable.',
    });
  }

  try {
    const status = await userRepository.setNgoAvailability({
      ngoId: req.user.id,
      status: parsed.data.status,
    });
    return res.json({ success: true, status });
  } catch (error) {
    return next(error);
  }
};

const { z } = require('zod');
const locationsRepository = require('../db/locations');
const { createPlaceSchema } = require('../services/placeRules');

const locationIdSchema = z.coerce.number().int().positive();
const ratingSchema = z.object({
  locationId: z.number().int().positive(),
  cleanliness: z.number().int().min(1).max(5),
  safety: z.number().int().min(1).max(5),
  lighting: z.number().int().min(1).max(5),
  accessibility: z.number().int().min(1).max(5),
  seating: z.number().int().min(1).max(5),
  shade: z.number().int().min(1).max(5).nullable().optional(),
  waterAvailability: z.number().int().min(1).max(5).nullable().optional(),
  comment: z.string().trim().max(1000).optional(),
});

exports.list = async (req, res, next) => {
  try {
    const locations = await locationsRepository.getLocations();
    return res.json({ success: true, locations });
  } catch (error) {
    return next(error);
  }
};

exports.listForModeration = async (req, res, next) => {
  try {
    const locations = await locationsRepository.getUserAddedLocations();
    return res.json({ success: true, locations });
  } catch (error) {
    return next(error);
  }
};

exports.createPlace = async (req, res, next) => {
  const parsed = createPlaceSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues.map((issue) => issue.message).join(' '),
    });
  }
  try {
    const result = await locationsRepository.createPlace({
      ...parsed.data,
      citizenId: req.user.id,
    });
    if (result.limitReached) {
      return res.status(429).json({
        success: false,
        message: 'You can add up to 5 new places per day. Please try again tomorrow.',
      });
    }
    return res.status(result.created ? 201 : 200).json({
      success: true,
      created: result.created,
      message: result.created ? 'Place added.' : 'An existing nearby place was selected.',
      location: result.location,
    });
  } catch (error) {
    return next(error);
  }
};

exports.updatePlaceStatus = async (req, res, next) => {
  const parsedId = locationIdSchema.safeParse(req.params.id);
  const parsedBody = z.object({ status: z.enum(['active', 'hidden']) }).safeParse(req.body);
  if (!parsedId.success || !parsedBody.success) {
    return res.status(400).json({
      success: false,
      message: parsedId.success
        ? parsedBody.error.issues.map((issue) => issue.message).join(' ')
        : 'Location ID must be a positive integer.',
    });
  }
  try {
    const location = await locationsRepository.updatePlaceStatus({
      locationId: parsedId.data,
      status: parsedBody.data.status,
      actorId: req.user.id,
      allowSeeded: req.user.role === 'admin',
    });
    if (!location) {
      return res.status(404).json({
        success: false,
        message: 'Location not found.',
      });
    }
    return res.json({ success: true, location });
  } catch (error) {
    return next(error);
  }
};

exports.getScores = async (req, res, next) => {
  try {
    const scores = await locationsRepository.getScores();
    return res.json({ success: true, scores });
  } catch (error) {
    return next(error);
  }
};

exports.getLocationScores = async (req, res, next) => {
  const parsedId = locationIdSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    return res.status(400).json({ success: false, message: 'Location ID must be a positive integer.' });
  }
  try {
    const score = await locationsRepository.getScoreByLocation(parsedId.data);
    if (!score) return res.status(404).json({ success: false, message: 'Location not found.' });
    return res.json({ success: true, score });
  } catch (error) {
    return next(error);
  }
};

exports.createRating = async (req, res, next) => {
  const parsed = ratingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: parsed.error.issues.map((issue) => issue.message).join(' '),
    });
  }
  try {
    const locations = await locationsRepository.getLocations();
    if (!locations.some((location) => location.id === parsed.data.locationId)) {
      return res.status(404).json({ success: false, message: 'Location not found.' });
    }
    const rating = await locationsRepository.createRating({
      ...parsed.data,
      citizenId: req.user.id,
    });
    return res.status(201).json({ success: true, message: 'Place rating submitted.', rating });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({
        success: false,
        message: 'You have already rated this place today. Please try again tomorrow.',
      });
    }
    if (error.code === 'RATING_DAILY_LIMIT') {
      return res.status(429).json({
        success: false,
        message: 'You have reached the daily limit of 20 ratings. Please try again tomorrow.',
      });
    }
    return next(error);
  }
};

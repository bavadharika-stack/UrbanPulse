const { z } = require('zod');
const { GeocoderError, searchPlaces } = require('../services/geocoder');

const querySchema = z.string().trim().min(3).max(120);

exports.search = async (req, res) => {
  const parsedQuery = querySchema.safeParse(req.query.q);
  if (!parsedQuery.success) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be between 3 and 120 characters.',
    });
  }
  try {
    const results = await searchPlaces({ query: parsedQuery.data, userId: req.user.id });
    return res.json({ success: true, results });
  } catch (error) {
    if (error instanceof GeocoderError) {
      return res.status(error.status).json({ success: false, message: error.message });
    }
    console.error('Place search failed:', error);
    return res.status(502).json({
      success: false,
      message: 'Place search failed unexpectedly. Please try again shortly.',
    });
  }
};

const CONFIRMATION_ESCALATION_THRESHOLDS = [3, 10];

const getConfirmationEscalationLevel = (confirmationCount) =>
  CONFIRMATION_ESCALATION_THRESHOLDS.filter((threshold) => confirmationCount >= threshold).length;

const getConfirmationError = ({ reportCitizenId, citizenId, alreadyConfirmed }) => {
  if (reportCitizenId === citizenId) return 'OWN_REPORT';
  if (alreadyConfirmed) return 'ALREADY_CONFIRMED';
  return null;
};

const requiresAfterPhoto = ({ status }) => status === 'resolved';

module.exports = {
  getConfirmationEscalationLevel,
  getConfirmationError,
  requiresAfterPhoto,
};

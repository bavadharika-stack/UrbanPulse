const notificationForReportEvent = ({ eventType, reportTitle }) => {
  const title = reportTitle || 'your report';
  const messages = {
    accepted: { title: 'Report accepted', message: `An NGO accepted “${title}”.` },
    verified: { title: 'Report verified', message: `An NGO verified “${title}”.` },
    status_changed: { title: 'Report updated', message: `The status of “${title}” has changed.` },
    authority_response: { title: 'Authority response', message: `The authority responded to “${title}”.` },
    resolved: { title: 'Report resolved', message: `“${title}” has been marked resolved.` },
    report_confirmed: { title: 'Your report has support', message: `Another citizen confirmed “${title}”.` },
    after_photo_added: { title: 'Resolution photo added', message: `An after photo was added to “${title}”.` },
    ngo_approved: { title: 'NGO application approved', message: 'Your NGO account is approved. You can now accept and verify reports.' },
    ngo_rejected: { title: 'NGO application rejected', message: 'Your NGO application was rejected. Contact an administrator for details.' },
    account_activated: { title: 'Account reactivated', message: 'Your account has been reactivated. You can sign in again.' },
  };
  return messages[eventType] || null;
};

module.exports = { notificationForReportEvent };

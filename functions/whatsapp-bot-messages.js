/**
 * AutoHireBot - WhatsApp Interactive Message Builders
 * Constructs payloads for WhatsApp Cloud API interactive messages (buttons, lists, text)
 */

/**
 * Build a text message payload
 */
function buildTextMessage(to, text) {
  return {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text }
  };
}

/**
 * Build an interactive button message (max 3 buttons)
 * @param {string} to - recipient phone
 * @param {string} bodyText - message body
 * @param {Array<{id: string, title: string}>} buttons - max 3 buttons, title max 20 chars
 * @param {string} [headerText] - optional header
 * @param {string} [footerText] - optional footer
 */
function buildButtonMessage(to, bodyText, buttons, headerText, footerText) {
  const interactive = {
    type: 'button',
    body: { text: bodyText },
    action: {
      buttons: buttons.slice(0, 3).map(btn => ({
        type: 'reply',
        reply: { id: btn.id, title: btn.title.substring(0, 20) }
      }))
    }
  };

  if (headerText) {
    interactive.header = { type: 'text', text: headerText };
  }
  if (footerText) {
    interactive.footer = { text: footerText };
  }

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive
  };
}

/**
 * Build an interactive list message (max 10 rows total across sections)
 * @param {string} to - recipient phone
 * @param {string} bodyText - message body
 * @param {string} buttonText - text on the list button (max 20 chars)
 * @param {Array<{title: string, rows: Array<{id: string, title: string, description?: string}>}>} sections
 * @param {string} [headerText] - optional header
 * @param {string} [footerText] - optional footer
 */
function buildListMessage(to, bodyText, buttonText, sections, headerText, footerText) {
  const interactive = {
    type: 'list',
    body: { text: bodyText },
    action: {
      button: buttonText.substring(0, 20),
      sections: sections.map(section => ({
        title: section.title.substring(0, 24),
        rows: section.rows.slice(0, 10).map(row => ({
          id: row.id.substring(0, 200),
          title: row.title.substring(0, 24),
          ...(row.description ? { description: row.description.substring(0, 72) } : {})
        }))
      }))
    }
  };

  if (headerText) {
    interactive.header = { type: 'text', text: headerText };
  }
  if (footerText) {
    interactive.footer = { text: footerText };
  }

  return {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive
  };
}

// ==================== PRE-BUILT MESSAGE TEMPLATES ====================

/**
 * Main menu greeting with 3 primary action buttons
 */
function buildMainMenu(to, name) {
  const greeting = name
    ? `Namaste ${name}! I'm AutoHireBot, helping nurses find hospital jobs across India.`
    : `Namaste! I'm AutoHireBot, helping nurses find hospital jobs across India.`;

  return buildButtonMessage(
    to,
    `${greeting}\n\nHow can I help you today?`,
    [
      { id: 'search_jobs', title: 'Find Jobs' },
      { id: 'register', title: 'Register Free' },
      { id: 'status_check', title: 'My Applications' }
    ],
    'AutoHireBot',
    'Free for all job seekers'
  );
}

/**
 * Extended menu as a list for more options
 */
function buildMoreMenu(to) {
  return buildListMessage(
    to,
    'Here are more options to help you:',
    'See Options',
    [
      {
        title: 'Job Services',
        rows: [
          { id: 'search_jobs', title: 'Find Jobs', description: 'Search nursing jobs across India' },
          { id: 'recommendations', title: 'AI Recommendations', description: 'Get AI-matched jobs for you' },
          { id: 'search_location', title: 'Jobs by Location', description: 'Search jobs in your city' },
          { id: 'search_department', title: 'Jobs by Department', description: 'ICU, OT, Emergency & more' }
        ]
      },
      {
        title: 'My Account',
        rows: [
          { id: 'status_check', title: 'Application Status', description: 'Track your job applications' },
          { id: 'update_profile', title: 'Update Profile', description: 'Update your details' }
        ]
      },
      {
        title: 'Help',
        rows: [
          { id: 'help', title: 'Contact Support', description: 'Get help from our team' },
          { id: 'menu', title: 'Main Menu', description: 'Go back to main menu' }
        ]
      }
    ],
    'AutoHireBot'
  );
}

/**
 * Registration prompt for unregistered users trying protected features
 */
function buildRegistrationPrompt(to) {
  return buildButtonMessage(
    to,
    'You need to register first to use this feature. Registration is completely FREE and takes just 2 minutes!',
    [
      { id: 'register', title: 'Register Now' },
      { id: 'menu', title: 'Main Menu' }
    ],
    'Registration Required'
  );
}

/**
 * Already registered message
 */
function buildAlreadyRegistered(to, name) {
  return buildButtonMessage(
    to,
    `You're already registered as ${name}. What would you like to do?`,
    [
      { id: 'search_jobs', title: 'Find Jobs' },
      { id: 'recommendations', title: 'AI Matches' },
      { id: 'status_check', title: 'My Applications' }
    ],
    'Already Registered'
  );
}

/**
 * Qualification selection list
 */
function buildQualificationList(to) {
  return buildListMessage(
    to,
    'What is your nursing qualification?',
    'Select Qualification',
    [{
      title: 'Qualifications',
      rows: [
        { id: 'qual_gnm', title: 'GNM', description: 'General Nursing & Midwifery' },
        { id: 'qual_bsc', title: 'BSc Nursing', description: 'Bachelor of Science in Nursing' },
        { id: 'qual_msc', title: 'MSc Nursing', description: 'Master of Science in Nursing' },
        { id: 'qual_pbbsc', title: 'Post Basic BSc', description: 'Post Basic BSc Nursing' },
        { id: 'qual_anm', title: 'ANM', description: 'Auxiliary Nurse Midwife' }
      ]
    }],
    'Step 2 of 7'
  );
}

/**
 * Experience selection buttons
 */
function buildExperienceButtons(to) {
  return buildListMessage(
    to,
    'How many years of nursing experience do you have?',
    'Select Experience',
    [{
      title: 'Experience Level',
      rows: [
        { id: 'exp_fresher', title: 'Fresher', description: 'No experience yet' },
        { id: 'exp_1_2', title: '1-2 Years', description: 'Junior level' },
        { id: 'exp_3_5', title: '3-5 Years', description: 'Mid level' },
        { id: 'exp_5_10', title: '5-10 Years', description: 'Senior level' },
        { id: 'exp_10plus', title: '10+ Years', description: 'Expert level' }
      ]
    }],
    'Step 3 of 7'
  );
}

/**
 * Skills selection list
 */
function buildSkillsList(to) {
  return buildListMessage(
    to,
    'Select your nursing specialties/skills. You can select one now and add more after.',
    'Select Skills',
    [{
      title: 'Nursing Specialties',
      rows: [
        { id: 'skill_icu', title: 'ICU / Critical Care', description: 'Intensive Care Unit' },
        { id: 'skill_ot', title: 'Operation Theatre', description: 'Surgical / OT Nursing' },
        { id: 'skill_emergency', title: 'Emergency / Trauma', description: 'Emergency Department' },
        { id: 'skill_pediatric', title: 'Pediatrics', description: 'Child Healthcare' },
        { id: 'skill_cardiac', title: 'Cardiology', description: 'Heart Care' },
        { id: 'skill_oncology', title: 'Oncology', description: 'Cancer Care' },
        { id: 'skill_general', title: 'General Ward', description: 'General Patient Care' },
        { id: 'skill_dialysis', title: 'Dialysis', description: 'Renal / Dialysis' },
        { id: 'skill_labour', title: 'Labour & Delivery', description: 'Maternity / L&D' },
        { id: 'skill_geriatric', title: 'Geriatrics', description: 'Elderly Care' }
      ]
    }],
    'Step 4 of 7'
  );
}

/**
 * Ask for more skills or done
 */
function buildMoreSkillsPrompt(to, selectedSkills) {
  return buildButtonMessage(
    to,
    `Selected skills: ${selectedSkills.join(', ')}\n\nWant to add more skills?`,
    [
      { id: 'skills_more', title: 'Add More Skills' },
      { id: 'skills_done', title: 'Done' }
    ],
    'Step 4 of 7'
  );
}

/**
 * Salary expectation list
 */
function buildSalaryList(to) {
  return buildListMessage(
    to,
    'What is your expected monthly salary?',
    'Select Salary Range',
    [{
      title: 'Salary Range (Monthly)',
      rows: [
        { id: 'sal_below15', title: 'Below Rs.15,000', description: 'Entry level' },
        { id: 'sal_15_25', title: 'Rs.15,000 - 25,000', description: 'Junior level' },
        { id: 'sal_25_40', title: 'Rs.25,000 - 40,000', description: 'Mid level' },
        { id: 'sal_40_60', title: 'Rs.40,000 - 60,000', description: 'Senior level' },
        { id: 'sal_above60', title: 'Above Rs.60,000', description: 'Expert level' }
      ]
    }],
    'Step 6 of 7'
  );
}

/**
 * Registration confirmation summary
 */
function buildRegistrationConfirm(to, data) {
  const summary = [
    `Name: ${data.name}`,
    `Qualification: ${data.qualification}`,
    `Experience: ${data.experienceLabel}`,
    `Skills: ${data.skills.join(', ')}`,
    `Preferred Location: ${data.preferredLocations.join(', ')}`,
    `Expected Salary: ${data.salaryLabel}`
  ].join('\n');

  return buildButtonMessage(
    to,
    `Please confirm your details:\n\n${summary}`,
    [
      { id: 'reg_confirm', title: 'Confirm & Register' },
      { id: 'reg_restart', title: 'Start Over' }
    ],
    'Step 7 of 7 - Confirm'
  );
}

/**
 * Registration success message
 */
function buildRegistrationSuccess(to, name, matchCount) {
  const matchText = matchCount > 0
    ? `We found ${matchCount} job${matchCount > 1 ? 's' : ''} matching your profile!`
    : `We'll notify you as soon as matching jobs are posted.`;

  return buildButtonMessage(
    to,
    `Registration successful! Welcome to AutoHireBot, ${name}!\n\n${matchText}`,
    [
      { id: 'search_jobs', title: 'Find Jobs' },
      { id: 'recommendations', title: 'View Matches' },
      { id: 'menu', title: 'Main Menu' }
    ],
    'Registration Complete'
  );
}

/**
 * Job search filter type selection
 */
function buildSearchFilterType(to) {
  return buildButtonMessage(
    to,
    'How would you like to search for jobs?',
    [
      { id: 'filter_location', title: 'By Location' },
      { id: 'filter_department', title: 'By Department' },
      { id: 'filter_all', title: 'Show All Jobs' }
    ],
    'Job Search'
  );
}

/**
 * Department selection list for search
 */
function buildDepartmentList(to) {
  return buildListMessage(
    to,
    'Select a department to search jobs:',
    'Select Department',
    [{
      title: 'Departments',
      rows: [
        { id: 'dept_icu', title: 'ICU / Critical Care' },
        { id: 'dept_ot', title: 'Operation Theatre' },
        { id: 'dept_emergency', title: 'Emergency' },
        { id: 'dept_pediatrics', title: 'Pediatrics' },
        { id: 'dept_cardiology', title: 'Cardiology' },
        { id: 'dept_oncology', title: 'Oncology' },
        { id: 'dept_general', title: 'General Ward' },
        { id: 'dept_dialysis', title: 'Dialysis' },
        { id: 'dept_maternity', title: 'Maternity / L&D' },
        { id: 'dept_geriatrics', title: 'Geriatrics' }
      ]
    }],
    'Search by Department'
  );
}

/**
 * Job search results as a list
 */
function buildJobResultsList(to, jobs, totalCount, offset) {
  const showing = Math.min(jobs.length, 10);
  const bodyText = totalCount > 0
    ? `Found ${totalCount} nursing job${totalCount > 1 ? 's' : ''}. Showing ${offset + 1}-${offset + showing}:`
    : 'No jobs found matching your search.';

  if (jobs.length === 0) {
    return buildButtonMessage(
      to,
      'No jobs found matching your search. Try a different filter or check back later.',
      [
        { id: 'search_jobs', title: 'New Search' },
        { id: 'recommendations', title: 'AI Matches' },
        { id: 'menu', title: 'Main Menu' }
      ],
      'No Results'
    );
  }

  return buildListMessage(
    to,
    bodyText,
    'View Jobs',
    [{
      title: 'Available Jobs',
      rows: jobs.slice(0, 10).map(job => ({
        id: `view_${job.id}`,
        title: (job.jobTitle || 'Nurse').substring(0, 24),
        description: `${job.facilityName || job.recruiterName || 'Hospital'} | ${job.location || 'India'}`.substring(0, 72)
      }))
    }],
    'Job Results',
    totalCount > offset + showing ? 'Send "more" to see next results' : undefined
  );
}

/**
 * Job detail card with apply button
 */
function buildJobDetail(to, job, hasApplied) {
  const salaryText = job.salaryRange
    ? `Rs.${job.salaryRange.min?.toLocaleString() || '?'} - ${job.salaryRange.max?.toLocaleString() || '?'}/month`
    : 'Not specified';

  const expText = job.requiredExperience
    ? `${job.requiredExperience.min || 0}-${job.requiredExperience.max || '10+'} years`
    : 'Not specified';

  const detail = [
    `Hospital: ${job.facilityName || job.recruiterName || 'Hospital'}`,
    `Location: ${job.location || 'India'}`,
    `Department: ${job.department || 'General'}`,
    `Salary: ${salaryText}`,
    `Experience: ${expText}`,
    `Qualification: ${job.requiredQualification || 'Any'}`,
    `Skills: ${(job.requiredSkills || job.skills || []).join(', ') || 'General Nursing'}`,
    `Shift: ${job.shiftType || 'Not specified'}`,
    `Type: ${job.jobType || 'Full-time'}`
  ].join('\n');

  const buttons = hasApplied
    ? [
        { id: 'search_jobs', title: 'More Jobs' },
        { id: 'menu', title: 'Main Menu' }
      ]
    : [
        { id: `apply_${job.id}`, title: 'Apply Now' },
        { id: 'search_jobs', title: 'More Jobs' },
        { id: 'menu', title: 'Main Menu' }
      ];

  const header = (job.jobTitle || 'Nursing Position').substring(0, 60);

  return buildButtonMessage(
    to,
    detail,
    buttons,
    header,
    hasApplied ? 'You have already applied' : 'Tap Apply Now to apply'
  );
}

/**
 * Application confirmation prompt
 */
function buildApplyConfirm(to, job) {
  return buildButtonMessage(
    to,
    `You're applying to:\n\n${job.jobTitle} at ${job.facilityName || job.recruiterName || 'Hospital'}, ${job.location || 'India'}\n\nYour profile will be shared with the hospital.`,
    [
      { id: `confirm_apply_${job.id}`, title: 'Confirm Application' },
      { id: 'menu', title: 'Cancel' }
    ],
    'Confirm Application'
  );
}

/**
 * Application success message
 */
function buildApplySuccess(to, jobTitle, hospitalName) {
  return buildButtonMessage(
    to,
    `Your application has been submitted!\n\nPosition: ${jobTitle}\nHospital: ${hospitalName}\n\nThe hospital will review your profile. We'll notify you of any updates.`,
    [
      { id: 'search_jobs', title: 'Find More Jobs' },
      { id: 'status_check', title: 'My Applications' },
      { id: 'menu', title: 'Main Menu' }
    ],
    'Application Submitted'
  );
}

/**
 * Application status summary
 */
function buildStatusSummary(to, statusGroups, totalCount) {
  if (totalCount === 0) {
    return buildButtonMessage(
      to,
      "You haven't applied to any jobs yet. Let's find some great opportunities for you!",
      [
        { id: 'search_jobs', title: 'Find Jobs' },
        { id: 'recommendations', title: 'AI Matches' },
        { id: 'menu', title: 'Main Menu' }
      ],
      'No Applications'
    );
  }

  let summary = `You have ${totalCount} application${totalCount > 1 ? 's' : ''}:\n`;

  const statusLabels = {
    pending: 'Pending Review',
    viewed: 'Viewed by Hospital',
    shortlisted: 'Shortlisted',
    applied: 'Applied',
    hired: 'Hired',
    rejected: 'Not Selected'
  };

  for (const [status, matches] of Object.entries(statusGroups)) {
    const label = statusLabels[status] || status;
    summary += `\n${label} (${matches.length}):\n`;
    matches.slice(0, 3).forEach((m, i) => {
      const score = m.matchScore ? ` (${m.matchScore}% match)` : '';
      summary += `  ${i + 1}. ${m.jobTitle || 'Position'}${score}\n`;
    });
    if (matches.length > 3) {
      summary += `  ... and ${matches.length - 3} more\n`;
    }
  }

  return buildButtonMessage(
    to,
    summary.trim(),
    [
      { id: 'search_jobs', title: 'Find More Jobs' },
      { id: 'recommendations', title: 'AI Matches' },
      { id: 'menu', title: 'Main Menu' }
    ],
    'Application Status'
  );
}

/**
 * AI recommendations results
 */
function buildRecommendations(to, matches) {
  if (matches.length === 0) {
    return buildButtonMessage(
      to,
      "We couldn't find strong matches right now. This could be because:\n- Your profile needs more details\n- New jobs haven't been posted in your area yet\n\nWe'll notify you as soon as matching jobs are posted!",
      [
        { id: 'search_jobs', title: 'Search All Jobs' },
        { id: 'update_profile', title: 'Update Profile' },
        { id: 'menu', title: 'Main Menu' }
      ],
      'No Matches Found'
    );
  }

  return buildListMessage(
    to,
    `Based on your profile, here are your top ${matches.length} AI-matched jobs:`,
    'View Matches',
    [{
      title: 'Top AI Matches',
      rows: matches.slice(0, 10).map(m => ({
        id: `view_${m.jobId}`,
        title: (m.jobTitle || 'Position').substring(0, 24),
        description: `${m.matchScore}% match | ${m.jobLocation || 'India'}`.substring(0, 72)
      }))
    }],
    'AI Recommendations',
    'Tap a job to see details and apply'
  );
}

/**
 * Proactive job match alert with interactive buttons
 */
function buildJobMatchAlert(to, seekerName, job, matchScore) {
  const salaryText = job.salaryRange
    ? `Rs.${job.salaryRange.min?.toLocaleString() || '?'} - ${job.salaryRange.max?.toLocaleString() || '?'}/month`
    : '';

  const body = [
    `Hi ${seekerName}! We found a new job matching your profile:`,
    '',
    `${job.jobTitle || 'Nursing Position'} at ${job.facilityName || job.recruiterName || 'Hospital'}`,
    `Location: ${job.location || 'India'}`,
    `Match Score: ${matchScore}%`,
    salaryText ? `Salary: ${salaryText}` : ''
  ].filter(Boolean).join('\n');

  return buildButtonMessage(
    to,
    body,
    [
      { id: `view_${job.id}`, title: 'View Details' },
      { id: `apply_${job.id}`, title: 'Apply Now' },
      { id: 'menu', title: 'Not Interested' }
    ],
    'New Job Match!'
  );
}

/**
 * Help / contact support message
 */
function buildHelpMessage(to) {
  return buildButtonMessage(
    to,
    'Need help? Here are your options:\n\nEmail: admin@autohirebot.com\nWebsite: https://autohirebot.com\n\nOur AI chatbot Carebot can also answer your questions on the website.',
    [
      { id: 'menu', title: 'Main Menu' },
      { id: 'search_jobs', title: 'Find Jobs' }
    ],
    'Help & Support'
  );
}

/**
 * Flow interruption - ask user what to do
 */
function buildFlowInterrupt(to, flowName) {
  const flowLabels = {
    registration: 'registration',
    jobSearch: 'job search',
    applyJob: 'job application'
  };
  const label = flowLabels[flowName] || flowName;

  return buildButtonMessage(
    to,
    `You're in the middle of ${label}. Would you like to:`,
    [
      { id: 'flow_continue', title: 'Continue' },
      { id: 'flow_cancel', title: 'Cancel & Menu' }
    ]
  );
}

module.exports = {
  buildTextMessage,
  buildButtonMessage,
  buildListMessage,
  buildMainMenu,
  buildMoreMenu,
  buildRegistrationPrompt,
  buildAlreadyRegistered,
  buildQualificationList,
  buildExperienceButtons,
  buildSkillsList,
  buildMoreSkillsPrompt,
  buildSalaryList,
  buildRegistrationConfirm,
  buildRegistrationSuccess,
  buildSearchFilterType,
  buildDepartmentList,
  buildJobResultsList,
  buildJobDetail,
  buildApplyConfirm,
  buildApplySuccess,
  buildStatusSummary,
  buildRecommendations,
  buildJobMatchAlert,
  buildHelpMessage,
  buildFlowInterrupt
};

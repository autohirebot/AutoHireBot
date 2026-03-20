/**
 * AutoHireBot - WhatsApp Conversational Bot
 * Handles registration, job search, applications, status checks, and AI recommendations
 * via WhatsApp interactive messages.
 */

const admin = require('firebase-admin');
const msg = require('./whatsapp-bot-messages');

const db = admin.firestore();

// Session expiry: 30 minutes
const SESSION_EXPIRY_MS = 30 * 60 * 1000;

// Qualification mappings
const QUALIFICATION_MAP = {
  qual_gnm: { value: 'GNM', label: 'GNM' },
  qual_bsc: { value: 'BSc Nursing', label: 'BSc Nursing' },
  qual_msc: { value: 'MSc Nursing', label: 'MSc Nursing' },
  qual_pbbsc: { value: 'Post Basic BSc', label: 'Post Basic BSc Nursing' },
  qual_anm: { value: 'ANM', label: 'ANM' }
};

// Experience mappings
const EXPERIENCE_MAP = {
  exp_fresher: { years: 0, label: 'Fresher' },
  exp_1_2: { years: 1.5, label: '1-2 Years' },
  exp_3_5: { years: 4, label: '3-5 Years' },
  exp_5_10: { years: 7.5, label: '5-10 Years' },
  exp_10plus: { years: 12, label: '10+ Years' }
};

// Skill mappings
const SKILL_MAP = {
  skill_icu: 'ICU',
  skill_ot: 'Operation Theatre',
  skill_emergency: 'Emergency',
  skill_pediatric: 'Pediatrics',
  skill_cardiac: 'Cardiology',
  skill_oncology: 'Oncology',
  skill_general: 'General Ward',
  skill_dialysis: 'Dialysis',
  skill_labour: 'Labour & Delivery',
  skill_geriatric: 'Geriatrics'
};

// Salary mappings
const SALARY_MAP = {
  sal_below15: { min: 0, max: 15000, label: 'Below Rs.15,000' },
  sal_15_25: { min: 15000, max: 25000, label: 'Rs.15,000 - 25,000' },
  sal_25_40: { min: 25000, max: 40000, label: 'Rs.25,000 - 40,000' },
  sal_40_60: { min: 40000, max: 60000, label: 'Rs.40,000 - 60,000' },
  sal_above60: { min: 60000, max: 150000, label: 'Above Rs.60,000' }
};

// Department mappings for search
const DEPARTMENT_MAP = {
  dept_icu: 'ICU',
  dept_ot: 'Operation Theatre',
  dept_emergency: 'Emergency',
  dept_pediatrics: 'Pediatrics',
  dept_cardiology: 'Cardiology',
  dept_oncology: 'Oncology',
  dept_general: 'General Ward',
  dept_dialysis: 'Dialysis',
  dept_maternity: 'Maternity',
  dept_geriatrics: 'Geriatrics'
};

// ==================== SESSION MANAGEMENT ====================

async function getOrCreateSession(phone) {
  const sessionRef = db.collection('whatsappSessions').doc(phone);
  const doc = await sessionRef.get();

  if (doc.exists) {
    return { ref: sessionRef, ...doc.data() };
  }

  // Check if user is already registered
  const seekerQuery = await db.collection('jobSeekers')
    .where('phone', '==', phone)
    .limit(1)
    .get();

  let seekerId = null;
  let seekerName = null;
  if (!seekerQuery.empty) {
    seekerId = seekerQuery.docs[0].id;
    seekerName = seekerQuery.docs[0].data().name || null;
  }

  // Also check with 10-digit phone (without country code)
  if (!seekerId && phone.startsWith('91') && phone.length === 12) {
    const shortPhone = phone.substring(2);
    const seekerQuery2 = await db.collection('jobSeekers')
      .where('phone', '==', shortPhone)
      .limit(1)
      .get();
    if (!seekerQuery2.empty) {
      seekerId = seekerQuery2.docs[0].id;
      seekerName = seekerQuery2.docs[0].data().name || null;
    }
  }

  const session = {
    phone,
    seekerId,
    seekerName,
    currentFlow: null,
    flowStep: null,
    flowData: {},
    lastMessageId: null,
    lastActivity: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  await sessionRef.set(session);
  return { ref: sessionRef, ...session };
}

async function updateSession(sessionRef, updates) {
  updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
  updates.lastActivity = admin.firestore.FieldValue.serverTimestamp();
  await sessionRef.update(updates);
}

function isSessionExpired(session) {
  if (!session.lastActivity) return true;
  const lastActivity = session.lastActivity.toDate ? session.lastActivity.toDate() : new Date(session.lastActivity);
  return (Date.now() - lastActivity.getTime()) > SESSION_EXPIRY_MS;
}

// ==================== SEND HELPER ====================

async function sendMessage(phoneNumberId, accessToken, payload) {
  const whatsapp = require('./whatsapp-integration');
  if (payload.type === 'text') {
    return await whatsapp._sendWhatsAppText(phoneNumberId, accessToken, payload.to, payload.text.body);
  }
  return await whatsapp._sendWhatsAppInteractive(phoneNumberId, accessToken, payload);
}

// ==================== MAIN ENTRY POINT ====================

/**
 * Handle an incoming WhatsApp message
 * Called from the webhook handler in whatsapp-integration.js
 */
async function handleIncomingMessage(from, message, phoneNumberId, accessToken) {
  try {
    // Load or create session
    const session = await getOrCreateSession(from);
    const sessionRef = session.ref;

    // Idempotency check
    if (message.id && session.lastMessageId === message.id) {
      console.log('Duplicate message, skipping:', message.id);
      return;
    }

    // Reset flow if session expired
    if (session.currentFlow && isSessionExpired(session)) {
      console.log('Session expired, resetting flow for:', from);
      await updateSession(sessionRef, {
        currentFlow: null,
        flowStep: null,
        flowData: {},
        lastMessageId: message.id
      });
      session.currentFlow = null;
      session.flowStep = null;
      session.flowData = {};
    } else {
      await updateSession(sessionRef, { lastMessageId: message.id });
    }

    // Extract message content
    const msgText = message.text?.body?.trim() || '';
    const msgLower = msgText.toLowerCase();

    // Extract interactive reply
    let interactiveId = null;
    if (message.type === 'interactive') {
      interactiveId = message.interactive?.button_reply?.id ||
                      message.interactive?.list_reply?.id || null;
    }

    // Global flow interruptions
    if (session.currentFlow && (msgLower === 'menu' || msgLower === 'cancel' || msgLower === 'stop' || interactiveId === 'menu' || interactiveId === 'flow_cancel')) {
      await updateSession(sessionRef, { currentFlow: null, flowStep: null, flowData: {} });
      await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));
      return;
    }

    // Continue flow if user taps "Continue"
    if (interactiveId === 'flow_continue' && session.currentFlow) {
      // Re-send current step prompt
      await resendFlowStep(session, from, phoneNumberId, accessToken);
      return;
    }

    // Route to active flow handler if in a flow
    if (session.currentFlow) {
      switch (session.currentFlow) {
        case 'registration':
          await handleRegistrationFlow(session, sessionRef, msgText, interactiveId, from, phoneNumberId, accessToken);
          return;
        case 'jobSearch':
          await handleJobSearchFlow(session, sessionRef, msgText, interactiveId, from, phoneNumberId, accessToken);
          return;
      }
    }

    // Route by interactive reply ID
    if (interactiveId) {
      await routeInteractiveReply(session, sessionRef, interactiveId, from, phoneNumberId, accessToken);
      return;
    }

    // Route by text keywords
    if (msgText) {
      await routeTextMessage(session, sessionRef, msgLower, from, phoneNumberId, accessToken);
      return;
    }

    // Default: show main menu
    await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));

  } catch (error) {
    console.error('Bot handler error:', error);
    // Always try to respond even on error
    try {
      const whatsapp = require('./whatsapp-integration');
      await whatsapp._sendWhatsAppText(phoneNumberId, accessToken, from,
        'Sorry, something went wrong. Please try again or type "menu" to start over.');
    } catch (e) {
      console.error('Failed to send error message:', e);
    }
  }
}

// ==================== MESSAGE ROUTING ====================

async function routeInteractiveReply(session, sessionRef, replyId, from, phoneNumberId, accessToken) {
  // Registration
  if (replyId === 'register') {
    await startRegistration(session, sessionRef, from, phoneNumberId, accessToken);
    return;
  }

  // Job search
  if (replyId === 'search_jobs' || replyId === 'search_location' || replyId === 'search_department') {
    if (replyId === 'search_location') {
      await updateSession(sessionRef, { currentFlow: 'jobSearch', flowStep: 'ask_location', flowData: { filterType: 'location' } });
      await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
        'Type a city name to search for nursing jobs (e.g., Mumbai, Delhi, Bangalore):'));
    } else if (replyId === 'search_department') {
      await updateSession(sessionRef, { currentFlow: 'jobSearch', flowStep: 'ask_department', flowData: { filterType: 'department' } });
      await sendMessage(phoneNumberId, accessToken, msg.buildDepartmentList(from));
    } else {
      await updateSession(sessionRef, { currentFlow: 'jobSearch', flowStep: 'ask_filter', flowData: {} });
      await sendMessage(phoneNumberId, accessToken, msg.buildSearchFilterType(from));
    }
    return;
  }

  // View job detail
  if (replyId.startsWith('view_')) {
    const jobId = replyId.substring(5);
    await handleViewJob(session, sessionRef, jobId, from, phoneNumberId, accessToken);
    return;
  }

  // Apply for job
  if (replyId.startsWith('apply_')) {
    const jobId = replyId.substring(6);
    await handleApplyJob(session, sessionRef, jobId, from, phoneNumberId, accessToken);
    return;
  }

  // Confirm application
  if (replyId.startsWith('confirm_apply_')) {
    const jobId = replyId.substring(14);
    await handleConfirmApply(session, sessionRef, jobId, from, phoneNumberId, accessToken);
    return;
  }

  // Status check
  if (replyId === 'status_check') {
    await handleStatusCheck(session, from, phoneNumberId, accessToken);
    return;
  }

  // AI recommendations
  if (replyId === 'recommendations') {
    await handleRecommendations(session, from, phoneNumberId, accessToken);
    return;
  }

  // More menu
  if (replyId === 'more') {
    await sendMessage(phoneNumberId, accessToken, msg.buildMoreMenu(from));
    return;
  }

  // Help
  if (replyId === 'help') {
    await sendMessage(phoneNumberId, accessToken, msg.buildHelpMessage(from));
    return;
  }

  // Update profile - redirect to registration for now
  if (replyId === 'update_profile') {
    if (session.seekerId) {
      await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
        'To update your profile, please visit https://autohirebot.com or contact admin@autohirebot.com'));
    } else {
      await startRegistration(session, sessionRef, from, phoneNumberId, accessToken);
    }
    return;
  }

  // Default: main menu
  await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));
}

async function routeTextMessage(session, sessionRef, msgLower, from, phoneNumberId, accessToken) {
  // Greetings
  if (/^(hi|hello|hey|namaste|hii+)\b/.test(msgLower)) {
    await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));
    return;
  }

  // Menu / more
  if (msgLower === 'menu' || msgLower === 'home') {
    await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));
    return;
  }

  if (msgLower === 'more' || msgLower === 'options') {
    await sendMessage(phoneNumberId, accessToken, msg.buildMoreMenu(from));
    return;
  }

  // Registration keywords
  if (/\b(register|sign\s*up|join)\b/.test(msgLower)) {
    await startRegistration(session, sessionRef, from, phoneNumberId, accessToken);
    return;
  }

  // Job search keywords
  if (/\b(job|vacancy|opening|nurse|hiring|work)\b/.test(msgLower)) {
    await updateSession(sessionRef, { currentFlow: 'jobSearch', flowStep: 'ask_filter', flowData: {} });
    await sendMessage(phoneNumberId, accessToken, msg.buildSearchFilterType(from));
    return;
  }

  // Status keywords
  if (/\b(status|application|applied|track)\b/.test(msgLower)) {
    await handleStatusCheck(session, from, phoneNumberId, accessToken);
    return;
  }

  // Recommendation keywords
  if (/\b(recommend|match|suggest|best)\b/.test(msgLower)) {
    await handleRecommendations(session, from, phoneNumberId, accessToken);
    return;
  }

  // Salary keywords
  if (/\b(salary|pay|package|ctc)\b/.test(msgLower)) {
    await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
      'Nursing salaries range from Rs.15,000 to Rs.60,000/month depending on experience and specialization. Search for jobs to see specific salary details.'));
    await sendMessage(phoneNumberId, accessToken, msg.buildSearchFilterType(from));
    return;
  }

  // Help keywords
  if (/\b(help|support|contact|problem)\b/.test(msgLower)) {
    await sendMessage(phoneNumberId, accessToken, msg.buildHelpMessage(from));
    return;
  }

  // Unrecognized - show main menu
  await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));
}

// ==================== REGISTRATION FLOW ====================

async function startRegistration(session, sessionRef, from, phoneNumberId, accessToken) {
  // Check if already registered
  if (session.seekerId) {
    await sendMessage(phoneNumberId, accessToken, msg.buildAlreadyRegistered(from, session.seekerName || 'there'));
    return;
  }

  // Start registration flow
  await updateSession(sessionRef, {
    currentFlow: 'registration',
    flowStep: 'ask_name',
    flowData: {}
  });

  await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
    "Let's get you registered! It's FREE and takes just 2 minutes.\n\nStep 1 of 7: What is your full name?"));
}

async function handleRegistrationFlow(session, sessionRef, msgText, interactiveId, from, phoneNumberId, accessToken) {
  const step = session.flowStep;
  const data = session.flowData || {};

  switch (step) {
    case 'ask_name': {
      if (!msgText || msgText.length < 2 || msgText.length > 100) {
        await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
          'Please enter your full name (2-100 characters):'));
        return;
      }
      data.name = msgText;
      await updateSession(sessionRef, { flowStep: 'ask_qualification', flowData: data });
      await sendMessage(phoneNumberId, accessToken, msg.buildQualificationList(from));
      return;
    }

    case 'ask_qualification': {
      const qualId = interactiveId || msgText;
      const qual = QUALIFICATION_MAP[qualId];
      if (!qual) {
        await sendMessage(phoneNumberId, accessToken, msg.buildQualificationList(from));
        return;
      }
      data.qualification = qual.value;
      data.qualificationLabel = qual.label;
      await updateSession(sessionRef, { flowStep: 'ask_experience', flowData: data });
      await sendMessage(phoneNumberId, accessToken, msg.buildExperienceButtons(from));
      return;
    }

    case 'ask_experience': {
      const expId = interactiveId || msgText;
      const exp = EXPERIENCE_MAP[expId];
      if (!exp) {
        await sendMessage(phoneNumberId, accessToken, msg.buildExperienceButtons(from));
        return;
      }
      data.experienceYears = exp.years;
      data.experienceLabel = exp.label;
      data.skills = [];
      await updateSession(sessionRef, { flowStep: 'ask_skills', flowData: data });
      await sendMessage(phoneNumberId, accessToken, msg.buildSkillsList(from));
      return;
    }

    case 'ask_skills': {
      const skillId = interactiveId;
      if (skillId === 'skills_done') {
        if (data.skills.length === 0) {
          data.skills = ['General Nursing'];
        }
        await updateSession(sessionRef, { flowStep: 'ask_location', flowData: data });
        await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
          'Step 5 of 7: Which city/cities do you prefer for work?\n\nYou can type multiple cities separated by commas (e.g., Mumbai, Delhi, Bangalore):'));
        return;
      }

      if (skillId === 'skills_more') {
        await sendMessage(phoneNumberId, accessToken, msg.buildSkillsList(from));
        return;
      }

      // Add selected skill
      const skill = SKILL_MAP[skillId];
      if (skill && !data.skills.includes(skill)) {
        data.skills.push(skill);
      } else if (msgText && !interactiveId) {
        // User typed custom skills
        const customSkills = msgText.split(',').map(s => s.trim()).filter(s => s.length > 0);
        for (const cs of customSkills) {
          if (!data.skills.includes(cs)) {
            data.skills.push(cs);
          }
        }
      }

      await updateSession(sessionRef, { flowData: data });
      await sendMessage(phoneNumberId, accessToken, msg.buildMoreSkillsPrompt(from, data.skills));
      return;
    }

    case 'ask_location': {
      if (!msgText || msgText.length < 2) {
        await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
          'Please enter at least one city name:'));
        return;
      }
      data.preferredLocations = msgText.split(',').map(s => s.trim()).filter(s => s.length > 0);
      await updateSession(sessionRef, { flowStep: 'ask_salary', flowData: data });
      await sendMessage(phoneNumberId, accessToken, msg.buildSalaryList(from));
      return;
    }

    case 'ask_salary': {
      const salId = interactiveId || msgText;
      const sal = SALARY_MAP[salId];
      if (!sal) {
        await sendMessage(phoneNumberId, accessToken, msg.buildSalaryList(from));
        return;
      }
      data.salaryMin = sal.min;
      data.salaryMax = sal.max;
      data.salaryLabel = sal.label;
      await updateSession(sessionRef, { flowStep: 'confirm', flowData: data });
      await sendMessage(phoneNumberId, accessToken, msg.buildRegistrationConfirm(from, data));
      return;
    }

    case 'confirm': {
      if (interactiveId === 'reg_restart') {
        await updateSession(sessionRef, { flowStep: 'ask_name', flowData: {} });
        await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
          "Let's start over!\n\nStep 1 of 7: What is your full name?"));
        return;
      }

      if (interactiveId === 'reg_confirm') {
        await completeRegistration(session, sessionRef, data, from, phoneNumberId, accessToken);
        return;
      }

      // Re-show confirm
      await sendMessage(phoneNumberId, accessToken, msg.buildRegistrationConfirm(from, data));
      return;
    }

    default:
      // Unknown step, restart
      await updateSession(sessionRef, { currentFlow: null, flowStep: null, flowData: {} });
      await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));
  }
}

async function completeRegistration(session, sessionRef, data, from, phoneNumberId, accessToken) {
  try {
    // Create job seeker document
    const seekerData = {
      name: data.name,
      phone: from,
      qualification: data.qualification,
      experienceYears: data.experienceYears,
      skills: data.skills,
      specialties: data.skills,
      preferredLocations: data.preferredLocations,
      location: data.preferredLocations[0] || '',
      expectedSalary: { min: data.salaryMin, max: data.salaryMax },
      verified: true,
      registeredVia: 'whatsapp',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const seekerRef = await db.collection('jobSeekers').add(seekerData);
    const seekerId = seekerRef.id;

    // Update session
    await updateSession(sessionRef, {
      seekerId,
      seekerName: data.name,
      currentFlow: null,
      flowStep: null,
      flowData: {}
    });

    // Run matching
    let matchCount = 0;
    try {
      const indexModule = require('./index');
      if (indexModule._matchSeekerWithJobs) {
        const result = await indexModule._matchSeekerWithJobs(seekerId);
        matchCount = result?.matchCount || 0;
      }
    } catch (matchError) {
      console.error('Matching after registration failed:', matchError);
      // Non-critical, continue
    }

    // Send success message
    await sendMessage(phoneNumberId, accessToken, msg.buildRegistrationSuccess(from, data.name, matchCount));

    console.log(`Registration complete via WhatsApp: ${data.name} (${from}), seekerId: ${seekerId}`);

  } catch (error) {
    console.error('Registration error:', error);
    await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
      'Sorry, registration failed. Please try again or visit https://autohirebot.com to register online.'));
    await updateSession(sessionRef, { currentFlow: null, flowStep: null, flowData: {} });
  }
}

// ==================== JOB SEARCH FLOW ====================

async function handleJobSearchFlow(session, sessionRef, msgText, interactiveId, from, phoneNumberId, accessToken) {
  const step = session.flowStep;
  const data = session.flowData || {};

  switch (step) {
    case 'ask_filter': {
      if (interactiveId === 'filter_location') {
        data.filterType = 'location';
        await updateSession(sessionRef, { flowStep: 'ask_location', flowData: data });
        await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
          'Type a city name to search for nursing jobs (e.g., Mumbai, Delhi, Bangalore):'));
      } else if (interactiveId === 'filter_department') {
        data.filterType = 'department';
        await updateSession(sessionRef, { flowStep: 'ask_department', flowData: data });
        await sendMessage(phoneNumberId, accessToken, msg.buildDepartmentList(from));
      } else if (interactiveId === 'filter_all') {
        data.filterType = 'all';
        data.offset = 0;
        await updateSession(sessionRef, { flowStep: 'show_results', flowData: data });
        await showJobResults(session, sessionRef, data, from, phoneNumberId, accessToken);
      } else {
        await sendMessage(phoneNumberId, accessToken, msg.buildSearchFilterType(from));
      }
      return;
    }

    case 'ask_location': {
      if (!msgText || msgText.length < 2) {
        await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
          'Please type a city name:'));
        return;
      }
      data.searchValue = msgText;
      data.offset = 0;
      await updateSession(sessionRef, { flowStep: 'show_results', flowData: data });
      await showJobResults(session, sessionRef, data, from, phoneNumberId, accessToken);
      return;
    }

    case 'ask_department': {
      const deptId = interactiveId;
      const dept = DEPARTMENT_MAP[deptId];
      if (!dept) {
        await sendMessage(phoneNumberId, accessToken, msg.buildDepartmentList(from));
        return;
      }
      data.searchValue = dept;
      data.offset = 0;
      await updateSession(sessionRef, { flowStep: 'show_results', flowData: data });
      await showJobResults(session, sessionRef, data, from, phoneNumberId, accessToken);
      return;
    }

    case 'show_results': {
      // Handle "more" for pagination
      if (msgText?.toLowerCase() === 'more' || interactiveId === 'more_jobs') {
        data.offset = (data.offset || 0) + 10;
        await updateSession(sessionRef, { flowData: data });
        await showJobResults(session, sessionRef, data, from, phoneNumberId, accessToken);
        return;
      }

      // View job from results
      if (interactiveId?.startsWith('view_')) {
        const jobId = interactiveId.substring(5);
        await handleViewJob(session, sessionRef, jobId, from, phoneNumberId, accessToken);
        return;
      }

      // New search
      if (interactiveId === 'search_jobs') {
        await updateSession(sessionRef, { flowStep: 'ask_filter', flowData: {} });
        await sendMessage(phoneNumberId, accessToken, msg.buildSearchFilterType(from));
        return;
      }

      // Exit search flow for other actions
      await updateSession(sessionRef, { currentFlow: null, flowStep: null, flowData: {} });
      if (interactiveId) {
        await routeInteractiveReply(session, sessionRef, interactiveId, from, phoneNumberId, accessToken);
      } else {
        await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));
      }
      return;
    }

    default:
      await updateSession(sessionRef, { currentFlow: null, flowStep: null, flowData: {} });
      await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));
  }
}

async function showJobResults(session, sessionRef, data, from, phoneNumberId, accessToken) {
  try {
    let query = db.collection('jobs').where('status', '==', 'active');
    const offset = data.offset || 0;

    if (data.filterType === 'location' && data.searchValue) {
      // Case-insensitive location search by fetching all and filtering
      const searchLower = data.searchValue.toLowerCase();
      const allJobsSnap = await query.orderBy('createdAt', 'desc').limit(100).get();
      const allJobs = allJobsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(job => {
          const loc = (job.location || '').toLowerCase();
          const city = (job.city || '').toLowerCase();
          const state = (job.state || '').toLowerCase();
          return loc.includes(searchLower) || city.includes(searchLower) || state.includes(searchLower);
        });

      const pageJobs = allJobs.slice(offset, offset + 10);
      await sendMessage(phoneNumberId, accessToken, msg.buildJobResultsList(from, pageJobs, allJobs.length, offset));

    } else if (data.filterType === 'department' && data.searchValue) {
      const deptLower = data.searchValue.toLowerCase();
      const allJobsSnap = await query.orderBy('createdAt', 'desc').limit(100).get();
      const allJobs = allJobsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(job => {
          const dept = (job.department || '').toLowerCase();
          return dept.includes(deptLower);
        });

      const pageJobs = allJobs.slice(offset, offset + 10);
      await sendMessage(phoneNumberId, accessToken, msg.buildJobResultsList(from, pageJobs, allJobs.length, offset));

    } else {
      // Show all
      const countSnap = await query.get();
      const totalCount = countSnap.size;
      const jobsSnap = await query.orderBy('createdAt', 'desc').limit(10 + offset).get();
      const allDocs = jobsSnap.docs.slice(offset);
      const jobs = allDocs.map(doc => ({ id: doc.id, ...doc.data() }));

      await sendMessage(phoneNumberId, accessToken, msg.buildJobResultsList(from, jobs, totalCount, offset));
    }

    // Keep in search flow for pagination
    await updateSession(sessionRef, { flowStep: 'show_results', flowData: data });

  } catch (error) {
    console.error('Job search error:', error);
    await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
      'Sorry, there was an error searching for jobs. Please try again.'));
    await updateSession(sessionRef, { currentFlow: null, flowStep: null, flowData: {} });
  }
}

// ==================== VIEW JOB DETAIL ====================

async function handleViewJob(session, sessionRef, jobId, from, phoneNumberId, accessToken) {
  try {
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
        'Sorry, this job is no longer available.'));
      return;
    }

    const job = { id: jobDoc.id, ...jobDoc.data() };

    // Check if user already applied
    let hasApplied = false;
    if (session.seekerId) {
      const matchQuery = await db.collection('matches')
        .where('seekerId', '==', session.seekerId)
        .where('jobId', '==', jobId)
        .where('status', '==', 'applied')
        .limit(1)
        .get();
      hasApplied = !matchQuery.empty;
    }

    await sendMessage(phoneNumberId, accessToken, msg.buildJobDetail(from, job, hasApplied));

  } catch (error) {
    console.error('View job error:', error);
    await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
      'Sorry, could not load job details. Please try again.'));
  }
}

// ==================== JOB APPLICATION ====================

async function handleApplyJob(session, sessionRef, jobId, from, phoneNumberId, accessToken) {
  // Must be registered
  if (!session.seekerId) {
    await sendMessage(phoneNumberId, accessToken, msg.buildRegistrationPrompt(from));
    return;
  }

  try {
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
        'Sorry, this job is no longer available.'));
      return;
    }

    const job = { id: jobDoc.id, ...jobDoc.data() };

    // Check if already applied
    const existingMatch = await db.collection('matches')
      .where('seekerId', '==', session.seekerId)
      .where('jobId', '==', jobId)
      .limit(1)
      .get();

    if (!existingMatch.empty && existingMatch.docs[0].data().status === 'applied') {
      await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
        `You have already applied to ${job.jobTitle} at ${job.facilityName || job.recruiterName || 'this hospital'}.`));
      await sendMessage(phoneNumberId, accessToken, msg.buildButtonMessage(from,
        'What would you like to do?',
        [
          { id: 'search_jobs', title: 'Find More Jobs' },
          { id: 'status_check', title: 'My Applications' },
          { id: 'menu', title: 'Main Menu' }
        ]
      ));
      return;
    }

    // Show confirmation
    await sendMessage(phoneNumberId, accessToken, msg.buildApplyConfirm(from, job));

  } catch (error) {
    console.error('Apply job error:', error);
    await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
      'Sorry, could not process your application. Please try again.'));
  }
}

async function handleConfirmApply(session, sessionRef, jobId, from, phoneNumberId, accessToken) {
  if (!session.seekerId) {
    await sendMessage(phoneNumberId, accessToken, msg.buildRegistrationPrompt(from));
    return;
  }

  try {
    const jobDoc = await db.collection('jobs').doc(jobId).get();
    if (!jobDoc.exists) {
      await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
        'Sorry, this job is no longer available.'));
      return;
    }

    const job = { id: jobDoc.id, ...jobDoc.data() };
    const seekerDoc = await db.collection('jobSeekers').doc(session.seekerId).get();
    const seeker = seekerDoc.exists ? { id: seekerDoc.id, ...seekerDoc.data() } : null;

    if (!seeker) {
      await sendMessage(phoneNumberId, accessToken, msg.buildRegistrationPrompt(from));
      return;
    }

    // Check for existing match
    const existingMatch = await db.collection('matches')
      .where('seekerId', '==', session.seekerId)
      .where('jobId', '==', jobId)
      .limit(1)
      .get();

    if (!existingMatch.empty) {
      // Update existing match to applied
      await existingMatch.docs[0].ref.update({
        status: 'applied',
        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        appliedVia: 'whatsapp',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      // Create new match with applied status
      await db.collection('matches').add({
        seekerId: seeker.id,
        seekerName: seeker.name,
        seekerEmail: seeker.email || null,
        seekerPhone: seeker.phone,
        seekerExperience: seeker.experienceYears,
        seekerLocation: seeker.location,
        jobId: job.id,
        jobTitle: job.jobTitle,
        jobDepartment: job.department,
        jobLocation: job.location,
        recruiterId: job.recruiterId,
        recruiterName: job.facilityName || job.recruiterName,
        recruiterEmail: job.recruiterEmail,
        matchScore: 0, // Will be updated by matching engine
        status: 'applied',
        appliedAt: admin.firestore.FieldValue.serverTimestamp(),
        appliedVia: 'whatsapp',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Send success message
    await sendMessage(phoneNumberId, accessToken, msg.buildApplySuccess(
      from, job.jobTitle, job.facilityName || job.recruiterName || 'Hospital'));

    // Notify recruiter (fire-and-forget)
    try {
      if (job.recruiterId) {
        const recruiterDoc = await db.collection('recruiters').doc(job.recruiterId).get();
        if (recruiterDoc.exists) {
          const recruiter = { id: recruiterDoc.id, ...recruiterDoc.data() };
          const whatsapp = require('./whatsapp-integration');
          await whatsapp.sendCandidateAlertToRecruiter(recruiter, seeker, job, 0);
        }
      }
    } catch (notifyError) {
      console.error('Recruiter notification failed:', notifyError);
      // Non-critical
    }

    console.log(`Job application via WhatsApp: seeker=${seeker.name}, job=${job.jobTitle}`);

  } catch (error) {
    console.error('Confirm apply error:', error);
    await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
      'Sorry, could not submit your application. Please try again.'));
  }
}

// ==================== STATUS CHECK ====================

async function handleStatusCheck(session, from, phoneNumberId, accessToken) {
  if (!session.seekerId) {
    await sendMessage(phoneNumberId, accessToken, msg.buildRegistrationPrompt(from));
    return;
  }

  try {
    const matchesSnap = await db.collection('matches')
      .where('seekerId', '==', session.seekerId)
      .orderBy('updatedAt', 'desc')
      .limit(20)
      .get();

    const statusGroups = {};
    let totalCount = 0;

    matchesSnap.docs.forEach(doc => {
      const match = doc.data();
      const status = match.status || 'pending';
      if (!statusGroups[status]) statusGroups[status] = [];
      statusGroups[status].push(match);
      totalCount++;
    });

    await sendMessage(phoneNumberId, accessToken, msg.buildStatusSummary(from, statusGroups, totalCount));

  } catch (error) {
    console.error('Status check error:', error);
    await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
      'Sorry, could not load your application status. Please try again.'));
  }
}

// ==================== AI RECOMMENDATIONS ====================

async function handleRecommendations(session, from, phoneNumberId, accessToken) {
  if (!session.seekerId) {
    await sendMessage(phoneNumberId, accessToken, msg.buildRegistrationPrompt(from));
    return;
  }

  try {
    // Query pre-computed matches sorted by score
    const matchesSnap = await db.collection('matches')
      .where('seekerId', '==', session.seekerId)
      .where('status', '==', 'pending')
      .orderBy('matchScore', 'desc')
      .limit(10)
      .get();

    const matches = matchesSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    await sendMessage(phoneNumberId, accessToken, msg.buildRecommendations(from, matches));

  } catch (error) {
    console.error('Recommendations error:', error);
    await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
      'Sorry, could not load recommendations. Please try again.'));
  }
}

// ==================== RE-SEND FLOW STEP ====================

async function resendFlowStep(session, from, phoneNumberId, accessToken) {
  const { currentFlow, flowStep, flowData } = session;

  if (currentFlow === 'registration') {
    switch (flowStep) {
      case 'ask_name':
        await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from, 'What is your full name?'));
        return;
      case 'ask_qualification':
        await sendMessage(phoneNumberId, accessToken, msg.buildQualificationList(from));
        return;
      case 'ask_experience':
        await sendMessage(phoneNumberId, accessToken, msg.buildExperienceButtons(from));
        return;
      case 'ask_skills':
        await sendMessage(phoneNumberId, accessToken, msg.buildSkillsList(from));
        return;
      case 'ask_location':
        await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from,
          'Which city/cities do you prefer for work? (comma-separated):'));
        return;
      case 'ask_salary':
        await sendMessage(phoneNumberId, accessToken, msg.buildSalaryList(from));
        return;
      case 'confirm':
        await sendMessage(phoneNumberId, accessToken, msg.buildRegistrationConfirm(from, flowData));
        return;
    }
  }

  if (currentFlow === 'jobSearch') {
    switch (flowStep) {
      case 'ask_filter':
        await sendMessage(phoneNumberId, accessToken, msg.buildSearchFilterType(from));
        return;
      case 'ask_location':
        await sendMessage(phoneNumberId, accessToken, msg.buildTextMessage(from, 'Type a city name:'));
        return;
      case 'ask_department':
        await sendMessage(phoneNumberId, accessToken, msg.buildDepartmentList(from));
        return;
    }
  }

  // Fallback
  await sendMessage(phoneNumberId, accessToken, msg.buildMainMenu(from, session.seekerName));
}

// ==================== PROACTIVE ALERT HELPER ====================

/**
 * Send a proactive job match alert via WhatsApp interactive message
 * Called from index.js when a new high-score match is created
 */
async function sendJobMatchAlert(phone, seekerName, job, matchScore, phoneNumberId, accessToken) {
  try {
    // Check if user has an active session (within 24h)
    const sessionDoc = await db.collection('whatsappSessions').doc(phone).get();
    let useInteractive = false;

    if (sessionDoc.exists) {
      const lastActivity = sessionDoc.data().lastActivity;
      if (lastActivity) {
        const lastTime = lastActivity.toDate ? lastActivity.toDate() : new Date(lastActivity);
        useInteractive = (Date.now() - lastTime.getTime()) < 24 * 60 * 60 * 1000;
      }
    }

    if (useInteractive) {
      const payload = msg.buildJobMatchAlert(phone, seekerName, job, matchScore);
      const whatsapp = require('./whatsapp-integration');
      return await whatsapp._sendWhatsAppInteractive(phoneNumberId, accessToken, payload);
    }

    // Outside 24h window - use template message (handled by existing notification functions)
    return { success: false, reason: 'outside_24h_window' };

  } catch (error) {
    console.error('Job match alert error:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  handleIncomingMessage,
  sendJobMatchAlert
};

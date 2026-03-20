/**
 * ╔═══════════════════════════════════════════════════════════════════════════╗
 * ║  AUTOHIREBOT - AI FEATURES INTEGRATION                                    ║
 * ║  Version: 5.0.0 (AI Enhanced)                                             ║
 * ║                                                                           ║
 * ║  New Features:                                                            ║
 * ║  - Resume Parser (PDF to structured data)                                 ║
 * ║  - Carebot with Personalized Memory                                       ║
 * ║  - AI Recruitment Agent Team                                              ║
 * ║  - Voice Support Agent                                                    ║
 * ╚═══════════════════════════════════════════════════════════════════════════╝
 * 
 * HOW TO INTEGRATE:
 * 
 * 1. Add these new dependencies to package.json:
 *    - pdf-parse: ^1.1.1
 *    
 * 2. Add new secret (if using OpenAI TTS for voice):
 *    firebase functions:secrets:set OPENAI_API_KEY
 *    
 * 3. Add these exports to your existing index.js:
 *    const aiFeatures = require('./ai-features-integration');
 *    exports.parseResume = aiFeatures.parseResume;
 *    exports.autoFillFromResume = aiFeatures.autoFillFromResume;
 *    exports.carebotWithMemory = aiFeatures.carebotWithMemory;
 *    exports.clearCarebotMemory = aiFeatures.clearCarebotMemory;
 *    exports.runRecruitmentWorkflow = aiFeatures.runRecruitmentWorkflow;
 *    exports.autoMatchOnRegistration = aiFeatures.autoMatchOnRegistration;
 *    exports.generateVoiceResponse = aiFeatures.generateVoiceResponse;
 *    exports.getVoiceWidgetConfig = aiFeatures.getVoiceWidgetConfig;
 * 
 * 4. Deploy:
 *    firebase deploy --only functions
 */

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { defineSecret } = require("firebase-functions/params");

// NOTE: Firebase Admin is already initialized in index.js
// Do NOT call admin.initializeApp() here

// Secrets
const GROQ_API_KEY = defineSecret("GROQ_API_KEY");
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

// ============================================================================
// RESUME PARSER
// ============================================================================

/**
 * Parse Resume PDF and Extract Nurse Information
 */
exports.parseResume = functions
  .runWith({ 
    secrets: [GROQ_API_KEY],
    memory: "512MB",
    timeoutSeconds: 120
  })
  .https.onCall(async (data, context) => {
    const pdf = require("pdf-parse");
    
    try {
      const { pdfBase64 } = data;
      
      if (!pdfBase64) {
        throw new functions.https.HttpsError("invalid-argument", "PDF data is required");
      }

      const pdfBuffer = Buffer.from(pdfBase64, "base64");
      const pdfData = await pdf(pdfBuffer);
      const resumeText = pdfData.text;

      if (!resumeText || resumeText.trim().length < 50) {
        throw new functions.https.HttpsError("invalid-argument", "Could not extract text from PDF");
      }

      const parsedData = await parseResumeWithAI(resumeText, GROQ_API_KEY.value());

      return {
        success: true,
        data: parsedData,
        pageCount: pdfData.numpages
      };

    } catch (error) {
      console.error("Resume parsing error:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

async function parseResumeWithAI(resumeText, apiKey) {
  const systemPrompt = `You are an expert HR assistant specializing in nursing recruitment in India. 
Extract structured information from nurse resumes. Return ONLY valid JSON.

{
  "personalInfo": {
    "fullName": "string or null",
    "email": "string or null",
    "phone": "string or null",
    "city": "string or null"
  },
  "qualification": {
    "highest": "GNM/BSc Nursing/MSc Nursing/ANM/Other",
    "college": "string or null",
    "yearOfPassing": "number or null",
    "registrationNumber": "string or null"
  },
  "experience": {
    "totalYears": "number",
    "currentHospital": "string or null"
  },
  "specializations": ["array of specialties"],
  "skills": ["array of skills"],
  "preferredLocations": ["array of cities"],
  "expectedSalary": "number or null",
  "summary": "Brief 2-line summary"
}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Extract info from this resume:\n\n${resumeText}` }
      ],
      temperature: 0.1,
      max_tokens: 1500
    })
  });

  const result = await response.json();
  const content = result.choices[0]?.message?.content;

  try {
    return JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
  } catch {
    throw new Error("Failed to parse AI response");
  }
}

/**
 * Auto-fill registration form from parsed resume
 */
exports.autoFillFromResume = functions
  .https.onCall(async (data, context) => {
    const { parsedResume } = data;

    if (!parsedResume) {
      throw new functions.https.HttpsError("invalid-argument", "Parsed resume data required");
    }

    return {
      success: true,
      formData: {
        fullName: parsedResume.personalInfo?.fullName || "",
        email: parsedResume.personalInfo?.email || "",
        phone: parsedResume.personalInfo?.phone || "",
        city: parsedResume.personalInfo?.city || "",
        qualification: parsedResume.qualification?.highest || "",
        experience: mapExperience(parsedResume.experience?.totalYears),
        specializations: parsedResume.specializations || [],
        skills: parsedResume.skills || [],
        expectedSalary: parsedResume.expectedSalary || ""
      }
    };
  });

function mapExperience(years) {
  if (!years || years === 0) return "Fresher";
  if (years < 1) return "Fresher";
  if (years <= 2) return "1-2 years";
  if (years <= 5) return "3-5 years";
  if (years <= 10) return "5-10 years";
  return "10+ years";
}

// ============================================================================
// CAREBOT WITH MEMORY
// ============================================================================

/**
 * Enhanced Chatbot with Personalized Memory
 */
exports.carebotWithMemory = functions
  .runWith({ 
    secrets: [GROQ_API_KEY],
    memory: "256MB",
    timeoutSeconds: 60
  })
  .https.onCall(async (data, context) => {
    try {
      const { message, sessionId, userId } = data;

      if (!message) {
        throw new functions.https.HttpsError("invalid-argument", "Message is required");
      }

      const db = admin.firestore();
      const memoryKey = userId || sessionId || `anon_${Date.now()}`;
      
      // Get memory and history
      const memDoc = await db.collection("carebotMemory").doc(memoryKey).get();
      const memData = memDoc.exists ? memDoc.data() : {};
      const userMemory = memData.preferences || {};
      const history = memData.history || [];
      
      // Build personalized prompt
      const systemPrompt = buildCarebotPrompt(userMemory);
      
      // Build messages
      const messages = [
        { role: "system", content: systemPrompt },
        ...history.slice(-10).map(m => ({ role: m.role, content: m.content })),
        { role: "user", content: message }
      ];
      
      // Call API
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${GROQ_API_KEY.value()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages,
          temperature: 0.7,
          max_tokens: 500
        })
      });

      const result = await response.json();
      const botResponse = result.choices[0]?.message?.content || "Sorry, I couldn't process that.";
      
      // Save conversation
      const newHistory = [...history, 
        { role: "user", content: message, ts: Date.now() },
        { role: "assistant", content: botResponse, ts: Date.now() }
      ].slice(-50);
      
      await db.collection("carebotMemory").doc(memoryKey).set({
        history: newHistory,
        lastActive: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
      
      // Extract and save preferences (async, don't wait)
      extractAndSavePreferences(message, botResponse, memoryKey, GROQ_API_KEY.value());
      
      return {
        success: true,
        response: botResponse,
        hasMemory: Object.keys(userMemory).length > 0
      };

    } catch (error) {
      console.error("Carebot error:", error);
      throw new functions.https.HttpsError("internal", error.message);
    }
  });

function buildCarebotPrompt(memory) {
  let prompt = `You are Carebot, the friendly AI assistant for AutoHireBot - India's #1 nursing job platform.

ROLE: Help nurses find jobs, answer career questions, guide registration.
TONE: Warm, professional, helpful. Keep responses concise (2-4 sentences).

FACTS:
- Registration: FREE for job seekers, ₹999 for recruiters
- Cities: Hyderabad, Mumbai, Delhi, Bangalore, Chennai, Pune, Kolkata
- Specialties: ICU, Emergency, OT, General Ward, NICU, Dialysis, Oncology
- Salary range: ₹15,000 - ₹60,000/month based on experience`;

  if (Object.keys(memory).length > 0) {
    prompt += `\n\n🧠 USER INFO (personalize responses):`;
    if (memory.name) prompt += `\n- Name: ${memory.name}`;
    if (memory.qualification) prompt += `\n- Qualification: ${memory.qualification}`;
    if (memory.preferredCity) prompt += `\n- Preferred city: ${memory.preferredCity}`;
    if (memory.experience) prompt += `\n- Experience: ${memory.experience}`;
  }

  return prompt;
}

async function extractAndSavePreferences(userMsg, botResp, memoryKey, apiKey) {
  try {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{
          role: "user",
          content: `Extract user preferences from this conversation. Return JSON with null for unmentioned items:
{"name":null,"qualification":null,"experience":null,"preferredCity":null,"lastTopic":null}

USER: "${userMsg}"
BOT: "${botResp}"`
        }],
        temperature: 0,
        max_tokens: 200
      })
    });

    const result = await response.json();
    const content = result.choices[0]?.message?.content;
    const prefs = JSON.parse(content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
    
    // Filter nulls
    const validPrefs = {};
    for (const [k, v] of Object.entries(prefs)) {
      if (v && v !== "null") validPrefs[k] = v;
    }
    
    if (Object.keys(validPrefs).length > 0) {
      const db = admin.firestore();
      await db.collection("carebotMemory").doc(memoryKey).set({
        preferences: validPrefs
      }, { merge: true });
    }
  } catch (e) {
    console.error("Preference extraction failed:", e);
  }
}

/**
 * Clear user memory
 */
exports.clearCarebotMemory = functions
  .https.onCall(async (data, context) => {
    const { sessionId, userId } = data;
    const key = userId || sessionId;
    
    if (!key) {
      throw new functions.https.HttpsError("invalid-argument", "Session/User ID required");
    }
    
    await admin.firestore().collection("carebotMemory").doc(key).delete();
    return { success: true };
  });

// ============================================================================
// AI RECRUITMENT WORKFLOW
// ============================================================================

/**
 * Run AI recruitment workflow (analyze, match, communicate)
 */
exports.runRecruitmentWorkflow = functions
  .runWith({ 
    secrets: [GROQ_API_KEY],
    memory: "512MB",
    timeoutSeconds: 180
  })
  .https.onCall(async (data, context) => {
    const { workflowType, payload } = data;
    const apiKey = GROQ_API_KEY.value();
    const db = admin.firestore();

    let result = {};

    switch (workflowType) {
      case "ANALYZE_RESUME":
        result = await analyzeResume(payload.resumeData, payload.jobRequirements, apiKey);
        break;

      case "FIND_MATCHES":
        const jobs = await getAvailableJobs(db);
        result = await findMatches(payload.candidateProfile, jobs, apiKey);
        break;

      case "DRAFT_EMAIL":
        result = await draftEmail(payload.emailType, payload.context, apiKey);
        break;

      default:
        throw new Error(`Unknown workflow: ${workflowType}`);
    }

    return { success: true, result };
  });

async function analyzeResume(resume, requirements, apiKey) {
  const prompt = `Analyze this nursing candidate against job requirements. Return JSON:
{
  "overallScore": 0-100,
  "recommendation": "STRONGLY_RECOMMEND/RECOMMEND/CONSIDER/NOT_SUITABLE",
  "strengths": ["list"],
  "concerns": ["list"],
  "interviewFocus": ["areas to probe"]
}

CANDIDATE: ${JSON.stringify(resume)}
REQUIREMENTS: ${JSON.stringify(requirements)}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
      max_tokens: 800
    })
  });

  const result = await response.json();
  return JSON.parse(result.choices[0]?.message?.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
}

async function getAvailableJobs(db) {
  const snapshot = await db.collection("recruiters")
    .where("verified", "==", true)
    .where("paymentStatus", "==", "completed")
    .limit(50)
    .get();

  const jobs = [];
  snapshot.forEach(doc => {
    const d = doc.data();
    if (d.jobDetails) {
      jobs.push({ jobId: doc.id, ...d.jobDetails, hospital: d.facilityName, location: d.city });
    }
  });
  return jobs;
}

async function findMatches(candidate, jobs, apiKey) {
  const prompt = `Match this nursing candidate with jobs. Return JSON array sorted by score:
[{"jobId":"","matchScore":0-100,"matchReasons":[""],"recommendation":"APPLY_NOW/CONSIDER/NOT_RECOMMENDED"}]

CANDIDATE: ${JSON.stringify(candidate)}
JOBS: ${JSON.stringify(jobs)}

Return only jobs with score > 50, max 10.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 1500
    })
  });

  const result = await response.json();
  return JSON.parse(result.choices[0]?.message?.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
}

async function draftEmail(emailType, context, apiKey) {
  const prompt = `Draft a professional recruitment email for: ${emailType}
Context: ${JSON.stringify(context)}

Return JSON: {"subject":"","body":""}`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
      max_tokens: 600
    })
  });

  const result = await response.json();
  return JSON.parse(result.choices[0]?.message?.content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim());
}

/**
 * Auto-match new job seekers (Firestore trigger)
 */
exports.autoMatchOnRegistration = functions
  .runWith({ secrets: [GROQ_API_KEY] })
  .firestore.document("jobSeekers/{userId}")
  .onCreate(async (snap, context) => {
    try {
      const data = snap.data();
      const db = admin.firestore();
      const jobs = await getAvailableJobs(db);
      
      if (jobs.length === 0) return;

      const matches = await findMatches({
        qualification: data.qualification,
        experience: data.experience,
        specializations: data.specializations || [],
        preferredCity: data.preferredCity
      }, jobs, GROQ_API_KEY.value());

      if (matches.length > 0) {
        await db.collection("jobSeekers").doc(context.params.userId).update({
          aiMatches: matches.slice(0, 10),
          matchedAt: admin.firestore.FieldValue.serverTimestamp()
        });
      }
    } catch (e) {
      console.error("Auto-match error:", e);
    }
  });

// ============================================================================
// VOICE SUPPORT
// ============================================================================

/**
 * Generate voice response (text + audio)
 */
exports.generateVoiceResponse = functions
  .runWith({ 
    secrets: [GROQ_API_KEY, OPENAI_API_KEY],
    memory: "512MB",
    timeoutSeconds: 60
  })
  .https.onCall(async (data, context) => {
    const { query, language = "en", voice = "nova" } = data;

    if (!query) {
      throw new functions.https.HttpsError("invalid-argument", "Query required");
    }

    // Generate text response
    const textResp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY.value()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "llama-3.1-8b-instant",
        messages: [{
          role: "system",
          content: "You are a friendly voice assistant for AutoHireBot nursing jobs. Keep responses SHORT (under 50 words). Be warm and helpful."
        }, {
          role: "user",
          content: query
        }],
        temperature: 0.7,
        max_tokens: 150
      })
    });

    const textResult = await textResp.json();
    const text = textResult.choices[0]?.message?.content || "Sorry, I couldn't understand that.";

    // Generate audio (optional - depends on OPENAI_API_KEY)
    let audioBase64 = "";
    try {
      const audioResp = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY.value()}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "tts-1",
          input: text,
          voice: voice,
          response_format: "mp3"
        })
      });

      if (audioResp.ok) {
        const arrayBuffer = await audioResp.arrayBuffer();
        audioBase64 = Buffer.from(arrayBuffer).toString("base64");
      }
    } catch (e) {
      console.error("TTS error:", e);
    }

    return {
      success: true,
      text,
      audioBase64,
      hasAudio: audioBase64.length > 0
    };
  });

/**
 * Voice widget configuration
 */
exports.getVoiceWidgetConfig = functions.https.onCall(async (data, context) => {
  return {
    enabled: true,
    greeting: "Hi! I'm your AutoHireBot voice assistant. How can I help?",
    voices: ["nova", "alloy", "echo", "shimmer"],
    defaultVoice: "nova",
    suggestedQueries: [
      "How do I register?",
      "What jobs are available?",
      "What's the salary for nurses?",
      "Tell me about interview tips"
    ]
  };
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

exports.aiHealthCheck = functions.https.onRequest((req, res) => {
  res.json({
    status: "ok",
    version: "5.0.0",
    features: [
      "Resume Parser",
      "Carebot with Memory",
      "AI Recruitment Workflow",
      "Voice Support"
    ],
    timestamp: new Date().toISOString()
  });
});

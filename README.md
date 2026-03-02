<p align="center">
  <h1 align="center">🏥 AutoHireBot</h1>
  <p align="center"><strong>India's #1 AI-Powered Healthcare Recruitment Platform</strong></p>
  <p align="center">Free job matching for nursing professionals | Powered by AI</p>
</p>

<p align="center">
  <a href="https://autohirebot.com">🌐 Live Website</a> •
  <a href="#features">✨ Features</a> •
  <a href="#tech-stack">🛠 Tech Stack</a> •
  <a href="#screenshots">📸 Screenshots</a> •
  <a href="#contact">📞 Contact</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-5.0-blue?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/AI-Powered-green?style=for-the-badge" alt="AI Powered">
  <img src="https://img.shields.io/badge/Cost-FREE-brightgreen?style=for-the-badge" alt="Free">
  <img src="https://img.shields.io/badge/Made_in-India_🇮🇳-orange?style=for-the-badge" alt="Made in India">
  <img src="https://img.shields.io/badge/Healthcare-Nursing-red?style=for-the-badge" alt="Healthcare">
</p>

---

## 🎯 What is AutoHireBot?

**AutoHireBot** is an AI-powered healthcare recruitment platform that connects nursing professionals with hospitals across India. It uses advanced AI for resume parsing, intelligent job matching, and streamlined recruitment workflows — all completely **FREE** for job seekers.

### 🩺 Built specifically for:
- **GNM** (General Nursing & Midwifery)
- **BSc Nursing** graduates
- **ANM** (Auxiliary Nurse Midwife)
- **Post Basic BSc Nursing**
- **MSc Nursing** professionals
- Specialized: ICU, Emergency, OT, NICU, Pediatrics, Oncology, Cardiology

---

## ✨ Features {#features}

### 🤖 AI-Powered Features (v5.0)
| Feature | Description | Technology |
|---------|-------------|------------|
| **AI Resume Parser** | Upload resume → AI extracts all details automatically | Groq LLM |
| **Smart Job Matching** | AI matches candidates to perfect hospital jobs | Groq AI + Cosine Similarity |
| **Carebot with Memory** | AI chatbot that remembers conversation context | Groq + Firestore |
| **AI Recruitment Workflow** | Automated end-to-end hiring pipeline | Groq AI |
| **Auto-Fill from Resume** | One-click profile completion from resume | AI Extraction |

### 💼 Core Features
| Feature | Description |
|---------|-------------|
| **Job Seeker Registration** | Quick profile creation with OTP verification |
| **Recruiter Dashboard** | Hospital recruiters post jobs and manage applications |
| **Real-Time Job Alerts** | Email & WhatsApp notifications for new jobs |
| **Blog & Career Resources** | Interview tips, salary guides, career advice |
| **WhatsApp Support** | Direct support via WhatsApp |
| **Admin Dashboard** | Complete platform management |
| **Visitor Analytics** | Real-time visitor tracking |

---

## 🛠 Tech Stack {#tech-stack}

### Frontend
| Technology | Purpose |
|-----------|---------|
| HTML5 / CSS3 / JavaScript | Core web technologies |
| Responsive Design | Mobile-first approach |
| Firebase Hosting | Fast, secure, global CDN |

### Backend
| Technology | Purpose |
|-----------|---------|
| Firebase Cloud Functions | 23 serverless functions |
| Firestore Database | NoSQL real-time database |
| Firebase Authentication | Secure user auth |
| Groq AI (LLaMA) | AI resume parsing & matching |
| ZeptoMail | Transactional emails & OTP |

### AI/ML Stack
| Component | Technology |
|-----------|------------|
| Resume Parsing | Groq LLM (LLaMA 3) |
| Job Matching | AI Semantic Matching |
| Chatbot | Groq AI with Memory |
| Auto-Fill | NLP Entity Extraction |

---

## 📊 Architecture

```
┌─────────────────────────────────────────────────────┐
│                    FRONTEND                          │
│           HTML/CSS/JS (Firebase Hosted)              │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │ Job      │  │ Recruiter│  │ AI Resume         │  │
│  │ Seeker   │  │ Dashboard│  │ Parser            │  │
│  │ Portal   │  │          │  │                   │  │
│  └────┬─────┘  └────┬─────┘  └────────┬──────────┘  │
│       │              │                 │              │
├───────┼──────────────┼─────────────────┼─────────────┤
│       │         FIREBASE               │              │
│       ▼              ▼                 ▼              │
│  ┌──────────────────────────────────────────────┐    │
│  │        23 Cloud Functions (Node.js)           │    │
│  │                                               │    │
│  │  OTP │ Matching │ AI Parse │ Carebot │ Email  │    │
│  └──────────────────────────────────────────────┘    │
│       │              │                 │              │
│       ▼              ▼                 ▼              │
│  ┌──────────┐  ┌──────────┐  ┌───────────────────┐  │
│  │Firestore │  │ Firebase │  │   Groq AI API     │  │
│  │ Database │  │   Auth   │  │   (FREE Tier)     │  │
│  └──────────┘  └──────────┘  └───────────────────┘  │
└─────────────────────────────────────────────────────┘
```

---

## 📊 Cloud Functions (23 Total)

```
OTP System:        sendOTP, verifyOTP, resendOTP
Job Matching:      triggerMatching, getMatchAnalytics, submitMatchFeedback
Admin:             approveRecruiter
Triggers:          onSeekerVerified, onNewJobPosted, onJobUpdated
Scheduled:         dailyCleanup, dailyMatchRefresh
HTTP:              healthCheck, testEmail, chatbot, collectLead
AI v5.0:           parseResume, autoFillFromResume, carebotWithMemory,
                   clearCarebotMemory, runRecruitmentWorkflow,
                   autoMatchOnRegistration, aiHealthCheck
```

---

## 💰 Cost Structure

| Service | Cost |
|---------|------|
| Firebase Hosting | FREE |
| Firestore Database | FREE |
| Cloud Functions | FREE (125K/month) |
| Firebase Auth | FREE (10K/month) |
| Groq AI API | FREE (30 req/min) |
| ZeptoMail | FREE (100 emails/day) |
| **Total Monthly Cost** | **$0** |

---

## 🩺 Supported Specializations

| Category | Specializations |
|----------|----------------|
| **Courses** | GNM, BSc Nursing, ANM, Post Basic BSc, MSc Nursing |
| **Departments** | ICU, Emergency, OT, NICU, Pediatrics |
| **Specialties** | Medical-Surgical, Oncology, Cardiology, Geriatrics |
| **Settings** | Hospitals, Clinics, Home Care, Government, Private |

---

## 🚀 Deployment

### Prerequisites
- Node.js 18+
- Firebase CLI
- Groq API Key (free)
- ZeptoMail Account (free)

### Quick Start
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/AutoHireBot.git
cd AutoHireBot

# Install dependencies
cd functions
npm install

# Set environment variables
firebase functions:config:set groq.api_key="YOUR_GROQ_KEY"
firebase functions:config:set zeptomail.api_key="YOUR_ZEPTO_KEY"

# Deploy
firebase deploy
```

---

## 📈 SEO & Performance

- ✅ Google Search Console verified
- ✅ Bing Webmaster Tools verified
- ✅ Sitemap.xml with 7 pages
- ✅ Mobile responsive
- ✅ Fast loading (Firebase CDN)
- ✅ Blog with nursing career content

---

## 🤝 Partnership

We partner with nursing colleges across India for FREE campus placements.

**Interested?** Contact us:
- 📧 Email: admin@autohirebot.com
- 📱 WhatsApp: +91 93471 43100
- 🌐 Website: [autohirebot.com](https://autohirebot.com)

---

## 🗺 Roadmap

- [x] AI Resume Parser (v5.0)
- [x] Carebot with Memory
- [x] AI Job Matching
- [x] Recruiter Dashboard
- [x] Blog & SEO
- [ ] Mobile App (React Native)
- [ ] Video Interview Integration
- [ ] Multi-language Support (Hindi, Telugu, Tamil)
- [ ] Advanced Analytics Dashboard

---

## 📄 License

This project is proprietary software owned by **Smart Kids India Innovations Pvt. Ltd.**

---

## 👨‍💻 About

Built with ❤️ by **Smart Kids India Innovations Pvt. Ltd.**

**AutoHireBot** - Connecting Healthcare Professionals with Hospitals Across India 🇮🇳

---

<p align="center">
  <strong>⭐ Star this repo if you find it useful! ⭐</strong>
</p>

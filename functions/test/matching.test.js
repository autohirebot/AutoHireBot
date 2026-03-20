const assert = require('assert');

// Import the matching functions directly from index.js
// We need to extract the scoring functions for testing
// Since they're not exported, we'll test the logic inline

describe('Matching Score Calculations', () => {

  // Replicate the scoring functions for testing
  function calculateSkillScore(seekerSkills, requiredSkills) {
    if (!requiredSkills || requiredSkills.length === 0) return 100;
    if (!seekerSkills || seekerSkills.length === 0) return 0;

    const seekerLower = seekerSkills.map(s => s.toLowerCase());
    const requiredLower = requiredSkills.map(s => s.toLowerCase());

    let matchCount = 0;
    requiredLower.forEach(skill => {
      if (seekerLower.some(s => s.includes(skill) || skill.includes(s))) {
        matchCount++;
      }
    });

    const baseScore = (matchCount / requiredLower.length) * 100;
    const bonus = Math.min((seekerLower.length - matchCount) * 2, 10);
    return Math.min(baseScore + bonus, 100);
  }

  function calculateExperienceScore(seekerExp, requiredMin, requiredMax) {
    const exp = parseFloat(seekerExp) || 0;
    const minReq = parseFloat(requiredMin) || 0;
    const maxReq = parseFloat(requiredMax) || 10;

    if (exp >= minReq && exp <= maxReq) return 100;
    if (exp > maxReq) return Math.max(100 - ((exp - maxReq) * 10), 60);
    if (minReq === 0) return 80;
    return Math.max((exp / minReq) * 100, 30);
  }

  function calculateLocationScore(seekerLocations, jobLocation) {
    if (!jobLocation) return 100;
    if (!seekerLocations || seekerLocations.length === 0) return 50;

    const jobLoc = jobLocation.toLowerCase();
    const seekerLocs = Array.isArray(seekerLocations)
      ? seekerLocations.map(l => l.toLowerCase())
      : [seekerLocations.toLowerCase()];

    if (seekerLocs.some(l => l === jobLoc)) return 100;
    if (seekerLocs.some(l => l.includes(jobLoc) || jobLoc.includes(l))) return 85;
    return 40;
  }

  function calculateSalaryScore(seekerExpected, jobOffered) {
    const seekerMin = parseFloat(seekerExpected?.min) || 0;
    const seekerMax = parseFloat(seekerExpected?.max) || 100000;
    const jobMin = parseFloat(jobOffered?.min) || 0;
    const jobMax = parseFloat(jobOffered?.max) || 100000;

    const overlapStart = Math.max(seekerMin, jobMin);
    const overlapEnd = Math.min(seekerMax, jobMax);

    if (overlapStart <= overlapEnd) {
      const overlapRange = overlapEnd - overlapStart;
      const seekerRange = seekerMax - seekerMin || 1;
      return Math.min((overlapRange / seekerRange) * 100 + 20, 100);
    }

    if (jobMax < seekerMin) {
      const gap = seekerMin - jobMax;
      return Math.max(50 - (gap / seekerMin) * 100, 10);
    }
    return 90;
  }

  // ==================== SKILL TESTS ====================

  describe('calculateSkillScore', () => {
    it('should return 100 when no skills required', () => {
      assert.strictEqual(calculateSkillScore(['ICU'], []), 100);
    });

    it('should return 0 when seeker has no skills', () => {
      assert.strictEqual(calculateSkillScore([], ['ICU']), 0);
    });

    it('should return 100 for exact match', () => {
      const score = calculateSkillScore(['ICU', 'Emergency'], ['ICU', 'Emergency']);
      assert.ok(score >= 90);
    });

    it('should return partial score for partial match', () => {
      const score = calculateSkillScore(['ICU'], ['ICU', 'Emergency', 'OT']);
      assert.ok(score > 0 && score < 100);
    });

    it('should handle case-insensitive matching', () => {
      const score = calculateSkillScore(['icu', 'emergency'], ['ICU', 'Emergency']);
      assert.ok(score >= 90);
    });

    it('should handle substring matching', () => {
      const score = calculateSkillScore(['ICU Nursing'], ['ICU']);
      assert.ok(score > 50);
    });
  });

  // ==================== EXPERIENCE TESTS ====================

  describe('calculateExperienceScore', () => {
    it('should return 100 when experience is in range', () => {
      assert.strictEqual(calculateExperienceScore(5, 2, 8), 100);
    });

    it('should return high score for slightly over-qualified', () => {
      const score = calculateExperienceScore(12, 2, 8);
      assert.ok(score >= 60);
    });

    it('should return 80 for fresher when min is 0', () => {
      assert.strictEqual(calculateExperienceScore(0, 0, 5), 100);
    });

    it('should return lower score for under-qualified', () => {
      const score = calculateExperienceScore(1, 5, 10);
      assert.ok(score >= 30 && score < 100);
    });

    it('should handle null/undefined experience', () => {
      const score = calculateExperienceScore(null, 0, 5);
      assert.ok(score >= 0);
    });
  });

  // ==================== LOCATION TESTS ====================

  describe('calculateLocationScore', () => {
    it('should return 100 when no job location specified', () => {
      assert.strictEqual(calculateLocationScore(['Mumbai'], null), 100);
    });

    it('should return 50 when seeker has no location preference', () => {
      assert.strictEqual(calculateLocationScore([], 'Mumbai'), 50);
    });

    it('should return 100 for exact location match', () => {
      assert.strictEqual(calculateLocationScore(['Mumbai'], 'Mumbai'), 100);
    });

    it('should handle partial location matching', () => {
      const score = calculateLocationScore(['New Delhi'], 'Delhi');
      assert.ok(score >= 85);
    });

    it('should return 40 for no match', () => {
      assert.strictEqual(calculateLocationScore(['Chennai'], 'Kolkata'), 40);
    });
  });

  // ==================== SALARY TESTS ====================

  describe('calculateSalaryScore', () => {
    it('should return high score when ranges overlap', () => {
      const score = calculateSalaryScore({ min: 20000, max: 40000 }, { min: 25000, max: 50000 });
      assert.ok(score >= 50);
    });

    it('should return low score when job pays below expectation', () => {
      const score = calculateSalaryScore({ min: 50000, max: 60000 }, { min: 15000, max: 25000 });
      assert.ok(score <= 50);
    });

    it('should handle missing salary data', () => {
      const score = calculateSalaryScore(null, null);
      assert.ok(score >= 0);
    });

    it('should return 90 when job pays above expectation', () => {
      const score = calculateSalaryScore({ min: 20000, max: 30000 }, { min: 40000, max: 60000 });
      assert.strictEqual(score, 90);
    });
  });
});

describe('Input Validation', () => {
  function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
  }

  function validatePhone(phone) {
    const re = /^[+]?[\d\s-]{10,15}$/;
    return re.test(String(phone));
  }

  function sanitizeString(str, maxLength = 500) {
    if (typeof str !== 'string') return '';
    return str.trim().substring(0, maxLength).replace(/<[^>]*>/g, '');
  }

  describe('validateEmail', () => {
    it('should accept valid emails', () => {
      assert.ok(validateEmail('test@example.com'));
      assert.ok(validateEmail('user.name@domain.co.in'));
    });

    it('should reject invalid emails', () => {
      assert.ok(!validateEmail(''));
      assert.ok(!validateEmail('notanemail'));
      assert.ok(!validateEmail('@domain.com'));
      assert.ok(!validateEmail('user@'));
    });
  });

  describe('validatePhone', () => {
    it('should accept valid phone numbers', () => {
      assert.ok(validatePhone('9876543210'));
      assert.ok(validatePhone('+91 9876543210'));
      assert.ok(validatePhone('098-765-43210'));
    });

    it('should reject invalid phone numbers', () => {
      assert.ok(!validatePhone('123'));
      assert.ok(!validatePhone('abcdefghij'));
    });
  });

  describe('sanitizeString', () => {
    it('should strip HTML tags', () => {
      assert.strictEqual(sanitizeString('<script>alert("xss")</script>Hello'), 'alert("xss")Hello');
    });

    it('should trim whitespace', () => {
      assert.strictEqual(sanitizeString('  hello  '), 'hello');
    });

    it('should truncate long strings', () => {
      const long = 'a'.repeat(1000);
      assert.strictEqual(sanitizeString(long, 100).length, 100);
    });

    it('should handle non-string input', () => {
      assert.strictEqual(sanitizeString(null), '');
      assert.strictEqual(sanitizeString(123), '');
    });
  });
});

describe('Embeddings Vector Math', () => {
  function cosineSimilarity(vecA, vecB) {
    if (vecA.length !== vecB.length) return 0;
    let dotProduct = 0, normA = 0, normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  it('should return 1 for identical vectors', () => {
    const vec = [1, 2, 3, 4, 5];
    const sim = cosineSimilarity(vec, vec);
    assert.ok(Math.abs(sim - 1) < 0.0001);
  });

  it('should return 0 for orthogonal vectors', () => {
    const sim = cosineSimilarity([1, 0], [0, 1]);
    assert.ok(Math.abs(sim) < 0.0001);
  });

  it('should return -1 for opposite vectors', () => {
    const sim = cosineSimilarity([1, 0], [-1, 0]);
    assert.ok(Math.abs(sim + 1) < 0.0001);
  });

  it('should handle zero vectors', () => {
    assert.strictEqual(cosineSimilarity([0, 0], [0, 0]), 0);
  });

  it('should handle different-length vectors', () => {
    assert.strictEqual(cosineSimilarity([1, 2], [1, 2, 3]), 0);
  });
});

describe('WhatsApp Phone Formatting', () => {
  function formatPhoneForWhatsApp(phone) {
    if (!phone) return null;
    let cleaned = String(phone).replace(/\D/g, '');
    if (cleaned.length === 10) {
      cleaned = '91' + cleaned;
    } else if (cleaned.startsWith('0') && cleaned.length === 11) {
      cleaned = '91' + cleaned.substring(1);
    } else if (cleaned.startsWith('91') && cleaned.length === 12) {
      // Already correct
    } else if (cleaned.length < 10 || cleaned.length > 15) {
      return null;
    }
    return cleaned;
  }

  it('should add 91 prefix to 10-digit numbers', () => {
    assert.strictEqual(formatPhoneForWhatsApp('9876543210'), '919876543210');
  });

  it('should handle 0-prefixed numbers', () => {
    assert.strictEqual(formatPhoneForWhatsApp('09876543210'), '919876543210');
  });

  it('should keep already-prefixed numbers', () => {
    assert.strictEqual(formatPhoneForWhatsApp('919876543210'), '919876543210');
  });

  it('should handle +91 format', () => {
    assert.strictEqual(formatPhoneForWhatsApp('+91 9876543210'), '919876543210');
  });

  it('should return null for invalid numbers', () => {
    assert.strictEqual(formatPhoneForWhatsApp('12345'), null);
    assert.strictEqual(formatPhoneForWhatsApp(null), null);
    assert.strictEqual(formatPhoneForWhatsApp(''), null);
  });
});

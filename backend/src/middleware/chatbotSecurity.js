// ============================================================
//  middleware/chatbotSecurity.js — CCA Assistant security layer
//
//  Everything the chatbot route (routes/chatbot.js) needs to defend
//  itself against common AI/LLM risks, kept in one reusable module
//  so it can't accidentally drift from the rest of the app's auth
//  model (see the header comment in middleware/rbac.js — a chatbot
//  bug that let a coach/admin token be read as a "parent" would be
//  an authorization bug, not just a chatbot bug).
//
//  Exports:
//   - chatbotBaseLimiter, chatMessageLimiter   (rate limiting)
//   - optionalParentAuth                       (fixed, type-checked)
//   - validateChatMessageBody                  (size / shape guard)
//   - validateRecommendBody, validateBmiBody   (input validation)
//   - injectionGuard                            (prompt-injection gate)
//   - sanitizeAssistantReply                    (output filtering)
//   - logSecurityEvent                          (safe, non-sensitive logging)
//   - genericError                              (no stack/internal leaks)
// ============================================================
const mongoose  = require('mongoose');
const rateLimit = require('express-rate-limit');
const { verifyAccessToken } = require('../utils/tokenService');

// ── 1. Rate limiting ───────────────────────────────────────────
// Chatbot-specific limits, separate from the app-wide limiter in
// server.js. The LLM-backed endpoint gets the tightest budget since
// each call costs real money and is the main abuse/flooding vector.
const chatbotBaseLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many chatbot requests. Please slow down and try again shortly.' },
  handler: (req, res, next, options) => {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', req, { scope: 'chatbot-base' });
    res.status(429).json(options.message);
  },
});

const chatMessageLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many messages sent to the assistant. Please wait a moment before trying again.' },
  handler: (req, res, next, options) => {
    logSecurityEvent('RATE_LIMIT_EXCEEDED', req, { scope: 'chatbot-message' });
    res.status(429).json(options.message);
  },
});

// ── 2. Authentication ──────────────────────────────────────────
// Fixed version of the old inline optionalParentAuth: uses the shared
// tokenService (so it honors JWT_ACCESS_SECRET if that's ever split
// out from JWT_SECRET) AND enforces the `type: 'parent'` claim, so an
// admin or coach access token can never be misread as a parent's here.
// The chatbot stays usable for guests — an invalid/missing/wrong-type
// token just means req.parent is left unset, not a hard failure.
function optionalParentAuth(req, res, next) {
  const header = req.headers.authorization;
  const token = header && header.startsWith('Bearer') ? header.split(' ')[1] : null;
  if (!token) return next();

  try {
    const decoded = verifyAccessToken(token);
    if (decoded && decoded.type === 'parent' && decoded.id) {
      req.parent = decoded;
    } else if (decoded && decoded.type !== 'parent') {
      // Someone sent a non-parent (admin/coach) token to a public
      // chatbot endpoint — not inherently an attack (could just be a
      // stale header from a shared client), but worth a quiet log.
      logSecurityEvent('CHATBOT_AUTH_TYPE_MISMATCH', req, { tokenType: decoded.type });
    }
  } catch {
    // Invalid/expired token — treat as guest rather than failing the request.
  }
  next();
}

// ── 3. Prompt-size / conversation-shape validation ─────────────
const MAX_MESSAGES        = 20;    // longest history accepted per request
const MAX_MESSAGE_CHARS   = 2000;  // longest single message
const MAX_TOTAL_CHARS     = 8000;  // longest combined history (context overflow guard)

function validateChatMessageBody(req, res, next) {
  const { messages } = req.body || {};

  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ success: false, message: 'messages[] is required.' });
  }
  if (messages.length > MAX_MESSAGES) {
    logSecurityEvent('CHATBOT_PROMPT_FLOOD', req, { messageCount: messages.length });
    return res.status(400).json({ success: false, message: 'Too many messages in this conversation. Please start a new chat.' });
  }

  let totalChars = 0;
  for (const m of messages) {
    if (!m || typeof m !== 'object' || typeof m.content !== 'string' || !['user', 'assistant'].includes(m.role)) {
      return res.status(400).json({ success: false, message: 'Malformed message in request.' });
    }
    if (m.content.length > MAX_MESSAGE_CHARS) {
      logSecurityEvent('CHATBOT_OVERSIZED_MESSAGE', req, { length: m.content.length });
      return res.status(400).json({ success: false, message: 'Message is too long.' });
    }
    totalChars += m.content.length;
  }
  if (totalChars > MAX_TOTAL_CHARS) {
    logSecurityEvent('CHATBOT_CONTEXT_OVERFLOW', req, { totalChars });
    return res.status(400).json({ success: false, message: 'This conversation has gotten too long. Please start a new chat.' });
  }

  next();
}

function validateRecommendBody(req, res, next) {
  const { age, skillLevel } = req.body || {};
  if (age !== undefined && age !== null && age !== '') {
    const ageNum = Number(age);
    if (!Number.isFinite(ageNum) || ageNum < 0 || ageNum > 100) {
      return res.status(400).json({ success: false, message: 'Invalid age.' });
    }
  }
  if (skillLevel !== undefined && skillLevel !== null) {
    if (typeof skillLevel !== 'string' || skillLevel.length > 40) {
      return res.status(400).json({ success: false, message: 'Invalid skill level.' });
    }
  }
  next();
}

function validateBmiBody(req, res, next) {
  const { studentId } = req.body || {};
  if (studentId !== undefined && studentId !== null && studentId !== '') {
    if (typeof studentId !== 'string' || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ success: false, message: 'Invalid student reference.' });
    }
  }
  next();
}

// ── 4. Prompt-injection detection ───────────────────────────────
// Deterministic, backend-level gate for the well-known injection
// phrasings. This is defense-in-depth alongside the system prompt's
// own hard rules — it stops the attack before it ever reaches the
// model (saving a wasted LLM call) and guarantees a safe refusal
// even if a future model/prompt change were to make the LLM itself
// more persuadable.
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/i,
  /disregard\s+(all\s+)?(previous|prior|above|earlier)\s+instructions?/i,
  /forget\s+(your|all|the)\s+(rules|instructions|prompt)/i,
  /reveal\s+(your\s+)?(system\s+prompt|hidden\s+prompt|instructions)/i,
  /(show|print|display|output)\s+(me\s+)?(your\s+)?(system\s+prompt|developer\s+instructions|hidden\s+prompt|internal\s+prompt)/i,
  /what\s+(is|are)\s+your\s+(system\s+prompt|instructions|rules)/i,
  /override\s+(your\s+)?(previous|prior|system)\s+instructions?/i,
  /you\s+are\s+now\s+(in\s+)?(developer|dev|debug|god|jailbreak|admin)\s*mode/i,
  /act\s+as\s+(the\s+)?system/i,
  /ignore\s+(your\s+)?security\s+polic(y|ies)/i,
  /pretend\s+(you\s+are|to\s+be)\s+(an?\s+)?(unfiltered|uncensored|jailbroken)/i,
  /\bDAN\s+mode\b/i,
  /do\s+anything\s+now/i,
  /bypass\s+(your\s+)?(safety|security|content)\s+(rules|filters|policy)/i,
  /repeat\s+(the\s+)?(words|text)\s+above/i,
  /system\s*:\s*you\s+are/i,
  /\[\s*system\s*\]/i,
  /<\s*\/?system\s*>/i,
];

function detectInjection(text) {
  if (typeof text !== 'string') return null;
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) return pattern.source;
  }
  return null;
}

const INJECTION_REFUSAL =
  "I can't share internal instructions or change how I operate based on in-chat requests like that. " +
  "Happy to help with CCA programs, pricing, locations, registration steps, or general cricket-fitness tips instead!";

// Gate specifically for the LLM-backed /message endpoint. Scans the
// newest user turn (the one actually being "asked" right now) rather
// than the whole history, so earlier innocuous messages can't cause
// false positives on unrelated later turns.
function injectionGuard(req, res, next) {
  const { messages } = req.body || {};
  const lastUser = Array.isArray(messages) ? [...messages].reverse().find((m) => m && m.role === 'user') : null;
  const matched = lastUser ? detectInjection(lastUser.content) : null;

  if (matched) {
    logSecurityEvent('PROMPT_INJECTION_BLOCKED', req, { pattern: matched });
    return res.json({ success: true, reply: INJECTION_REFUSAL });
  }
  next();
}

// ── 5. Output filtering ─────────────────────────────────────────
// Two independent passes over whatever the LLM returns, before it
// ever reaches the client:
//   a) redact anything that looks like a secret/token, in case the
//      model ever hallucinates or echoes something it shouldn't
//   b) strip markup that could be dangerous if rendered, and rewrite
//      any accidental "action confirmed" language into a safe,
//      accurate statement (only the real backend confirms those).
const SECRET_PATTERNS = [
  /eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}/g,     // JWT-shaped
  /sk-[a-zA-Z0-9]{20,}/g,                                                // OpenAI-style key
  /gsk_[a-zA-Z0-9]{20,}/g,                                               // Groq key
  /AIza[a-zA-Z0-9_-]{20,}/g,                                             // Google/Gemini key
  /sk-ant-[a-zA-Z0-9_-]{10,}/g,                                          // Anthropic key
  /mongodb(\+srv)?:\/\/[^\s"']+/gi,                                      // Mongo connection string
  /(?:[A-Za-z]:\\|\/)(?:[\w.\-]+\/)*[\w.\-]+\.(js|json|env|log)\b/g,     // internal file paths
  /\b[A-Z0-9_]*(SECRET|API_KEY|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|REFRESH_TOKEN)[A-Z0-9_]*\s*[:=]\s*\S+/gi, // env-style assignments
];

function redactSecrets(text) {
  let out = text;
  for (const pattern of SECRET_PATTERNS) {
    out = out.replace(pattern, '[redacted]');
  }
  return out;
}

function stripUnsafeMarkup(text) {
  return text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')          // strip any raw HTML tags
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, ''); // inline event handlers, if any slipped through as text
}

// Phrases that would falsely imply a deterministic backend action
// happened. Rewritten rather than deleted so the reply still reads
// naturally and stays honest about what actually needs to happen.
const FALSE_CONFIRMATION_PATTERNS = [
  /payment\s+(is|was)\s+(successful|complete[d]?|confirmed|approved)/gi,
  /registration\s+(is|was)?\s*(approved|confirmed|complete[d]?)/gi,
  /(your\s+)?seat\s+(is|has\s+been)\s+reserved/gi,
  /booking\s+(is|was)?\s*confirmed/gi,
  /attendance\s+(is|was|has\s+been)\s+updated/gi,
  /certificate\s+(is|was|has\s+been)\s+generated/gi,
  /admin\s+access\s+(is|was|has\s+been)\s+granted/gi,
  /refund\s+(is|was|has\s+been)\s+approved/gi,
  /coupon\s+(is|was|has\s+been)\s+applied/gi,
  /invoice\s+(is|was|has\s+been)\s+created/gi,
];

function rewriteFalseConfirmations(text) {
  let flagged = false;
  let out = text;
  for (const pattern of FALSE_CONFIRMATION_PATTERNS) {
    if (pattern.test(out)) {
      flagged = true;
      out = out.replace(pattern, 'still needs to be completed through the official checkout/registration flow');
    }
  }
  return { text: out, flagged };
}

function sanitizeAssistantReply(rawText, req) {
  if (typeof rawText !== 'string') return "Sorry, I couldn't generate a response. Please try again.";

  let text = redactSecrets(rawText);
  text = stripUnsafeMarkup(text);

  const { text: rewritten, flagged } = rewriteFalseConfirmations(text);
  if (flagged) {
    logSecurityEvent('UNSAFE_CONFIRMATION_REWRITTEN', req, {});
  }

  return rewritten.trim();
}

// ── 6. Safe logging ──────────────────────────────────────────────
// Logs security-relevant events only — never the full prompt, tokens,
// or personal data. `details` should be small, non-sensitive metadata
// (pattern names, counts) chosen by the caller above.
function logSecurityEvent(type, req, details = {}) {
  try {
    const safeDetails = { ...details };
    // Never let a caller accidentally pass something sensitive through.
    delete safeDetails.token;
    delete safeDetails.password;
    delete safeDetails.content;
    delete safeDetails.messages;

    console.warn(JSON.stringify({
      level: 'SECURITY',
      type,
      time: new Date().toISOString(),
      ip: req?.ip,
      path: req?.originalUrl,
      ...safeDetails,
    }));
  } catch {
    // Logging must never throw or break the request.
  }
}

// ── 7. Generic error responses ────────────────────────────────────
// Logs the real error server-side, returns nothing that could leak
// stack traces, internal paths, DB errors, or model config to the client.
function genericError(err, req, res, fallbackMessage = 'The assistant had trouble responding. Please try again.') {
  console.error('Chatbot error:', err?.message);
  const status = (err && err.status && err.status >= 400 && err.status < 500) ? err.status : 500;
  res.status(status).json({ success: false, message: status < 500 ? (err.message || fallbackMessage) : fallbackMessage });
}

module.exports = {
  chatbotBaseLimiter,
  chatMessageLimiter,
  optionalParentAuth,
  validateChatMessageBody,
  validateRecommendBody,
  validateBmiBody,
  injectionGuard,
  detectInjection,
  sanitizeAssistantReply,
  logSecurityEvent,
  genericError,
};

// ============================================================
//  services/groqService.js — Groq chat-completions client
//  Mirrors the plain-https style of paypalService.js rather than
//  pulling in the groq-sdk package, so the project's dependency
//  footprint doesn't grow for a single API call.
//
//  Docs: https://console.groq.com/docs/api-reference#chat-create
// ============================================================
const https = require('https');

const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * Sends a chat-completions request to Groq and returns the assistant's
 * reply text. `messages` follows the OpenAI-style chat format:
 *   [{ role: 'system' | 'user' | 'assistant', content: string }, ...]
 */
async function chatCompletion(messages, { temperature = 0.5, maxTokens = 700 } = {}) {
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(new Error('GROQ_API_KEY is not set on the server.'), { status: 500 });
  }

  const body = JSON.stringify({
    model: GROQ_MODEL,
    messages,
    temperature,
    max_tokens: maxTokens,
  });

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.groq.com',
      path: '/openai/v1/chat/completions',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) {
            return reject(Object.assign(new Error(parsed.error.message || 'Groq API error'), { status: res.statusCode }));
          }
          const text = parsed.choices?.[0]?.message?.content;
          if (typeof text !== 'string') {
            return reject(new Error('Groq returned an unexpected response shape.'));
          }
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

module.exports = { chatCompletion };

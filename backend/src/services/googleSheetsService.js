const { google } = require('googleapis');
const crypto = require('crypto');
const { HEADERS } = require('./registrationSheetMapper');

function parseJsonCredential(value) {
  if (!value) return null;
  let candidate = String(value).trim();
  if (!candidate.startsWith('{')) {
    try {
      const decoded = Buffer.from(candidate, 'base64').toString('utf8').trim();
      if (decoded.startsWith('{')) candidate = decoded;
    } catch { return null; }
  }
  if (!candidate.startsWith('{')) return null;
  try {
    return JSON.parse(candidate);
  } catch {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON contains invalid JSON.');
  }
}

function normalizePrivateKey(value) {
  if (!value) return '';
  let key = String(value).trim();

  // Render values should normally be unquoted, but tolerate values copied
  // directly from a .env file with their surrounding quotes.
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    if (key.startsWith('"')) {
      try { key = JSON.parse(key); }
      catch { key = key.slice(1, -1); }
    } else {
      key = key.slice(1, -1);
    }
  }
  key = key.replace(/\\n/g, '\n').replace(/\r\n/g, '\n').trim();

  // Also accept a base64-encoded PEM value for secret managers that make
  // multiline values awkward.
  if (!key.includes('BEGIN PRIVATE KEY')) {
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8').trim();
      if (decoded.includes('BEGIN PRIVATE KEY')) key = decoded;
    } catch { /* validation below provides the useful error */ }
  }

  try {
    crypto.createPrivateKey(key);
  } catch {
    throw new Error(
      'GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY is not a valid PEM private key. '
      + 'Paste only the JSON key file\'s private_key value, without surrounding quotes, '
      + 'or set GOOGLE_SERVICE_ACCOUNT_JSON to the complete JSON key.'
    );
  }
  return key;
}

function config() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME || 'Registrations';
  const jsonCredential = parseJsonCredential(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  // A complete JSON credential is authoritative when supplied. This avoids a
  // stale/malformed legacy key variable overriding the valid JSON secret.
  const email = jsonCredential?.client_email || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = normalizePrivateKey(
    jsonCredential?.private_key || process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );
  if (!spreadsheetId || !email || !privateKey) {
    throw new Error('Google Sheets credentials are incomplete. Check spreadsheet ID, service-account email, and private key.');
  }
  return { spreadsheetId, tabName, email, privateKey };
}

function quotedTab(tabName) {
  return `'${String(tabName).replace(/'/g, "''")}'`;
}

async function client() {
  const settings = config();
  const auth = new google.auth.JWT({
    email: settings.email,
    key: settings.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
  return { sheets: google.sheets({ version: 'v4', auth }), ...settings };
}

async function ensureSheets(api, tabNames) {
  const response = await api.sheets.spreadsheets.get({
    spreadsheetId: api.spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const existing = new Set((response.data.sheets || []).map(sheet => sheet.properties?.title));
  const missing = [...new Set(tabNames)].filter(tabName => !existing.has(tabName));
  if (!missing.length) return;
  await api.sheets.spreadsheets.batchUpdate({
    spreadsheetId: api.spreadsheetId,
    requestBody: { requests: missing.map(title => ({ addSheet: { properties: { title } } })) },
  });
}

async function ensureHeaders(api, tabName) {
  const range = `${quotedTab(tabName)}!A1:AB1`;
  const response = await api.sheets.spreadsheets.values.get({ spreadsheetId: api.spreadsheetId, range });
  const existing = response.data.values?.[0] || [];
  if (HEADERS.every((header, index) => existing[index] === header)) return;
  await api.sheets.spreadsheets.values.update({
    spreadsheetId: api.spreadsheetId,
    range,
    valueInputOption: 'RAW',
    requestBody: { values: [HEADERS] },
  });
}

async function syncRows(rows, previousKeys = []) {
  const api = await client();
  const rowsByTab = new Map();
  rows.forEach(row => {
    if (!rowsByTab.has(row.sheetName)) rowsByTab.set(row.sheetName, []);
    rowsByTab.get(row.sheetName).push(row);
  });
  const previous = previousKeys.map(identifier => {
    const separator = identifier.indexOf('::');
    return separator === -1
      ? { tabName: api.tabName, key: identifier }
      : { tabName: identifier.slice(0, separator), key: identifier.slice(separator + 2) };
  });
  const tabNames = [...new Set([...rowsByTab.keys(), ...previous.map(item => item.tabName)])];
  await ensureSheets(api, tabNames);

  const currentIdentifiers = new Set(rows.map(row => `${row.sheetName}::${row.key}`));
  const staleRanges = [];
  for (const tabName of tabNames) {
    await ensureHeaders(api, tabName);
    const keyResponse = await api.sheets.spreadsheets.values.get({
      spreadsheetId: api.spreadsheetId,
      range: `${quotedTab(tabName)}!A2:A`,
    });
    const rowByKey = new Map();
    (keyResponse.data.values || []).forEach((row, index) => {
      if (row[0]) rowByKey.set(String(row[0]), index + 2);
    });

    const tabRows = rowsByTab.get(tabName) || [];
    const updates = [];
    const appends = [];
    tabRows.forEach(row => {
      const rowNumber = rowByKey.get(row.key);
      if (rowNumber) updates.push({ range: `${quotedTab(tabName)}!A${rowNumber}:AB${rowNumber}`, values: [row.values] });
      else appends.push(row.values);
    });
    if (updates.length) {
      await api.sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: api.spreadsheetId,
        requestBody: { valueInputOption: 'RAW', data: updates },
      });
    }
    if (appends.length) {
      await api.sheets.spreadsheets.values.append({
        spreadsheetId: api.spreadsheetId,
        range: `${quotedTab(tabName)}!A:AB`,
        valueInputOption: 'RAW',
        insertDataOption: 'INSERT_ROWS',
        requestBody: { values: appends },
      });
    }
    previous
      .filter(item => item.tabName === tabName && !currentIdentifiers.has(`${item.tabName}::${item.key}`) && rowByKey.has(item.key))
      .forEach(item => {
        const rowNumber = rowByKey.get(item.key);
        staleRanges.push(`${quotedTab(tabName)}!A${rowNumber}:AB${rowNumber}`);
      });
  }

  if (staleRanges.length) {
    await api.sheets.spreadsheets.values.batchClear({
      spreadsheetId: api.spreadsheetId,
      requestBody: { ranges: staleRanges },
    });
  }
}

async function verifyConnection() {
  const api = await client();
  await ensureSheets(api, [api.tabName]);
  await ensureHeaders(api, api.tabName);
  return { spreadsheetId: api.spreadsheetId, tabName: api.tabName };
}

module.exports = { normalizePrivateKey, syncRows, verifyConnection };

const { google } = require('googleapis');
const { HEADERS } = require('./registrationSheetMapper');

function config() {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME || 'Registrations';
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n');
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

async function ensureHeaders(api) {
  const range = `${quotedTab(api.tabName)}!A1:AB1`;
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
  await ensureHeaders(api);
  const keyRange = `${quotedTab(api.tabName)}!A2:A`;
  const keyResponse = await api.sheets.spreadsheets.values.get({ spreadsheetId: api.spreadsheetId, range: keyRange });
  const keyRows = keyResponse.data.values || [];
  const rowByKey = new Map();
  keyRows.forEach((row, index) => {
    if (row[0]) rowByKey.set(String(row[0]), index + 2);
  });

  const updates = [];
  const appends = [];
  rows.forEach(row => {
    const rowNumber = rowByKey.get(row.key);
    if (rowNumber) {
      updates.push({ range: `${quotedTab(api.tabName)}!A${rowNumber}:AB${rowNumber}`, values: [row.values] });
    } else {
      appends.push(row.values);
    }
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
      range: `${quotedTab(api.tabName)}!A:AB`,
      valueInputOption: 'RAW',
      insertDataOption: 'INSERT_ROWS',
      requestBody: { values: appends },
    });
  }

  const currentKeys = new Set(rows.map(row => row.key));
  const staleRanges = previousKeys
    .filter(key => !currentKeys.has(key) && rowByKey.has(key))
    .map(key => {
      const rowNumber = rowByKey.get(key);
      return `${quotedTab(api.tabName)}!A${rowNumber}:AB${rowNumber}`;
    });
  if (staleRanges.length) {
    await api.sheets.spreadsheets.values.batchClear({
      spreadsheetId: api.spreadsheetId,
      requestBody: { ranges: staleRanges },
    });
  }
}

async function verifyConnection() {
  const api = await client();
  await ensureHeaders(api);
  return { spreadsheetId: api.spreadsheetId, tabName: api.tabName };
}

module.exports = { syncRows, verifyConnection };

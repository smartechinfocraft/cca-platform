const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { verifyConnection } = require('../services/googleSheetsService');

verifyConnection()
  .then(({ spreadsheetId, tabName }) => {
    console.log(`Google Sheets connection verified. Spreadsheet: ${spreadsheetId}; tab: ${tabName}`);
  })
  .catch(error => {
    console.error(`Google Sheets verification failed: ${error.message}`);
    process.exitCode = 1;
  });

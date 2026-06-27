// ============================================================
//  emailService.js — Send emails via Resend API
// ============================================================
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_ADDRESS = process.env.EMAIL_FROM || 'noreply@calcricket.org';

async function sendRegistrationEmail({ to, registrationNumber, studentName, programName,
  batchInfo, parentName, paymentMethod, totalAmount, transactionId }) {
  const subject = `CCA Registration Confirmed — ${registrationNumber}`;

  // Generate barcode SVG
  const bars = registrationNumber.split('').flatMap(ch => {
    const code = ch.charCodeAt(0);
    return [(code % 3) + 1, (code % 2) + 1, ((code >> 2) % 3) + 1];
  });
  const totalUnits = bars.reduce((a, b) => a + b, 0);
  const bw = 300 / totalUnits;
  let bx = 0;
  const barRects = bars.map((units, i) => {
    const rect = `<rect x="${bx.toFixed(1)}" y="0" width="${(units * bw).toFixed(1)}" height="50" fill="${i % 2 === 0 ? '#0F172A' : '#ffffff'}" />`;
    bx += units * bw;
    return rect;
  }).join('');
  const barcodeSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="60" viewBox="0 0 300 60"><rect width="300" height="60" fill="#ffffff"/>${barRects}<text x="150" y="58" font-family="monospace" font-size="9" text-anchor="middle" fill="#0F172A">${registrationNumber}</text></svg>`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;margin:30px auto;">
  <tr><td style="background:#0F172A;padding:28px 32px;border-radius:12px 12px 0 0;">
    <h1 style="color:#F97316;margin:0;font-size:22px;">CALIFORNIA CRICKET ACADEMY</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Official Registration Invoice</p>
  </td></tr>
  <tr><td style="background:#fff;padding:28px 32px;">
    <table width="100%"><tr>
      <td><p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;">Invoice To</p><p style="margin:4px 0 0;font-weight:bold;color:#0F172A;">${parentName}</p></td>
      <td style="text-align:right;"><p style="margin:0;font-size:12px;color:#64748b;text-transform:uppercase;">Invoice No</p><p style="margin:4px 0 0;font-weight:bold;color:#0F172A;">${registrationNumber}</p><p style="margin:4px 0 0;font-size:12px;color:#64748b;">${new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</p></td>
    </tr></table>
    <hr style="border:none;border-top:1px solid #e2e8f0;margin:20px 0;"/>
    <table width="100%" style="border-collapse:collapse;">
      <tr style="background:#f8fafc;"><th style="text-align:left;font-size:12px;color:#64748b;padding:10px 12px;border-bottom:1px solid #e2e8f0;">Description</th><th style="text-align:right;font-size:12px;color:#64748b;padding:10px 12px;border-bottom:1px solid #e2e8f0;">Amount</th></tr>
      <tr><td style="padding:12px;border-bottom:1px solid #f1f5f9;"><p style="margin:0;font-weight:bold;color:#0F172A;">${programName}</p><p style="margin:2px 0 0;font-size:12px;color:#64748b;">Student: ${studentName}</p>${batchInfo ? `<p style="margin:2px 0 0;font-size:12px;color:#64748b;">Batch: ${batchInfo}</p>` : ''}</td><td style="padding:12px;text-align:right;font-weight:bold;color:#0F172A;border-bottom:1px solid #f1f5f9;">$${totalAmount}</td></tr>
      <tr style="background:#FEF4E6;"><td style="padding:12px;font-weight:bold;color:#0F172A;">Total</td><td style="padding:12px;text-align:right;font-weight:bold;color:#F97316;font-size:18px;">$${totalAmount}</td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:13px;color:#64748b;">Payment: <strong>${paymentMethod}</strong>${transactionId ? ` — Txn: ${transactionId}` : ''}</p>
  </td></tr>
  <tr><td style="background:linear-gradient(135deg,#0F172A 0%,#1e3a5f 100%);padding:28px 32px;border-radius:0 0 12px 12px;">
    <p style="color:#F97316;margin:0 0 12px;font-size:12px;text-transform:uppercase;letter-spacing:2px;font-weight:bold;">Student ID Card</p>
    <p style="color:#F97316;margin:0;font-size:20px;font-weight:bold;">${studentName}</p>
    <p style="color:#94a3b8;margin:4px 0;font-size:12px;">${programName}${batchInfo ? ` | ${batchInfo}` : ''}</p>
    <p style="color:#64748b;margin:0;font-size:11px;">Guardian: ${parentName} | ID: ${registrationNumber}</p>
    <div style="margin-top:16px;background:#fff;border-radius:8px;padding:10px;display:inline-block;">${barcodeSVG}</div>
    <p style="color:#475569;margin:10px 0 0;font-size:11px;">Present at academy check-in</p>
  </td></tr>
  <tr><td style="text-align:center;padding:16px 0;"><p style="color:#94a3b8;font-size:11px;margin:0;">California Cricket Academy | support@calcricket.org</p></td></tr>
</table>
</body></html>`;

  await resend.emails.send({
    from: `California Cricket Academy <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });
}

// ============================================================
//  sendCoachWelcomeEmail — sent once, right after a coach is
//  created by the admin. Contains the auto-generated username
//  and password so the coach can log in to the Coach Portal.
// ============================================================
async function sendCoachWelcomeEmail({ to, firstName, lastName, username, password, coachUid, loginUrl }) {
  const subject = `Welcome to CCA — Your Coach Portal Login`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:30px auto;">
  <tr><td style="background:#0F172A;padding:28px 32px;border-radius:12px 12px 0 0;">
    <h1 style="color:#F97316;margin:0;font-size:22px;">CALIFORNIA CRICKET ACADEMY</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Coach Portal Access</p>
  </td></tr>
  <tr><td style="background:#fff;padding:28px 32px;">
    <p style="margin:0 0 12px;color:#0F172A;font-size:15px;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;color:#334155;font-size:14px;line-height:1.6;">
      An account has been created for you on the CCA Coach Portal. You can use it to
      view your assigned students and batches, check your dashboard, and mark attendance
      by scanning student ID cards.
    </p>
    <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
      <tr style="background:#f8fafc;">
        <td style="padding:12px;border:1px solid #e2e8f0;font-size:12px;color:#64748b;">Username</td>
        <td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;color:#0F172A;font-family:monospace;">${username}</td>
      </tr>
      <tr>
        <td style="padding:12px;border:1px solid #e2e8f0;font-size:12px;color:#64748b;">Password</td>
        <td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;color:#0F172A;font-family:monospace;">${password}</td>
      </tr>
      <tr style="background:#f8fafc;">
        <td style="padding:12px;border:1px solid #e2e8f0;font-size:12px;color:#64748b;">Coach ID</td>
        <td style="padding:12px;border:1px solid #e2e8f0;font-weight:bold;color:#0F172A;font-family:monospace;">${coachUid}</td>
      </tr>
    </table>
    <p style="text-align:center;margin:0 0 20px;">
      <a href="${loginUrl}" style="background:#F97316;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block;">
        Go to Coach Portal
      </a>
    </p>
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
      For security, please change your password after your first login if that option
      is available, and avoid sharing these credentials with anyone.
    </p>
  </td></tr>
  <tr><td style="text-align:center;padding:16px 0;"><p style="color:#94a3b8;font-size:11px;margin:0;">California Cricket Academy | support@calcricket.org</p></td></tr>
</table>
</body></html>`;

  await resend.emails.send({
    from: `California Cricket Academy <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });
}

// ============================================================
//  sendRegistrationUpdateEmail — sent automatically whenever a
//  super admin edits an existing registration (batch reassignment,
//  student info correction, status change, etc). Shows the parent
//  exactly what changed.
// ============================================================
async function sendRegistrationUpdateEmail({ to, parentName, registrationNumber, studentName, programName, changes }) {
  const subject = `CCA Registration Updated — ${registrationNumber}`;

  const changeRows = changes.map(c => `
    <tr>
      <td style="padding:12px;border-bottom:1px solid #ECE6D4;font-size:13px;color:#1F2E1E;font-weight:bold;">${c.field}</td>
      <td style="padding:12px;border-bottom:1px solid #ECE6D4;font-size:13px;color:#A33B2B;text-decoration:line-through;">${c.from || '—'}</td>
      <td style="padding:12px;border-bottom:1px solid #ECE6D4;font-size:13px;color:#3F7D4F;font-weight:bold;">${c.to || '—'}</td>
    </tr>`).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head><body style="margin:0;padding:0;background:#F3EFE2;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:30px auto;">
  <tr><td style="background:#1F2E1E;padding:28px 32px;border-radius:12px 12px 0 0;">
    <h1 style="color:#C9A227;margin:0;font-size:20px;">CALIFORNIA CRICKET ACADEMY</h1>
    <p style="color:#bdb89e;margin:4px 0 0;font-size:13px;">Registration Update Notice</p>
  </td></tr>
  <tr><td style="background:#fff;padding:28px 32px;">
    <p style="margin:0 0 8px;color:#1F2E1E;font-size:15px;">Hi ${parentName},</p>
    <p style="margin:0 0 20px;color:#52503e;font-size:14px;line-height:1.6;">
      A staff member has made changes to ${studentName}'s registration (<strong>${registrationNumber}</strong>)
      for <strong>${programName}</strong>. Here's exactly what changed:
    </p>
    <table width="100%" style="border-collapse:collapse;margin-bottom:20px;">
      <tr style="background:#F3EFE2;">
        <th style="text-align:left;font-size:11px;color:#6B6753;text-transform:uppercase;padding:10px 12px;">Field</th>
        <th style="text-align:left;font-size:11px;color:#6B6753;text-transform:uppercase;padding:10px 12px;">Previous</th>
        <th style="text-align:left;font-size:11px;color:#6B6753;text-transform:uppercase;padding:10px 12px;">Updated</th>
      </tr>
      ${changeRows}
    </table>
    <p style="margin:0;color:#6B6753;font-size:12px;line-height:1.6;">
      If anything here looks wrong or you weren't expecting this change, please contact us right away
      at cca@calcricket.org or (408) 777-9983.
    </p>
  </td></tr>
  <tr><td style="text-align:center;padding:16px 0;"><p style="color:#8A8470;font-size:11px;margin:0;">California Cricket Academy | cca@calcricket.org</p></td></tr>
</table>
</body></html>`;

  await resend.emails.send({
    from: `California Cricket Academy <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });
}


// ============================================================
//  sendForgotPasswordEmail — sends a temporary password to
//  the registered email of any user type (Admin, Coach, Parent)
// ============================================================
async function sendForgotPasswordEmail({ to, firstName, tempPassword, role, loginUrl }) {
  const subject = `CCA — Your Temporary Password`;

  const roleColor = role === 'Admin' ? '#9C5460' : role === 'Coach' ? '#D4AF37' : '#3F7D4F';
  const roleBg    = role === 'Admin' ? '#2D1B1B'  : role === 'Coach' ? '#0a2416'  : '#0F172A';

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f0f4f8;font-family:Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:30px auto;">
  <tr><td style="background:${roleBg};padding:28px 32px;border-radius:12px 12px 0 0;">
    <h1 style="color:${roleColor};margin:0;font-size:22px;">CALIFORNIA CRICKET ACADEMY</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">${role} Portal — Password Reset</p>
  </td></tr>
  <tr><td style="background:#ffffff;padding:28px 32px;">
    <p style="margin:0 0 16px;color:#1F2E1E;font-size:15px;">Hi ${firstName},</p>
    <p style="margin:0 0 20px;color:#52503e;font-size:14px;line-height:1.6;">
      We received a request to reset your password. Here is your temporary password — 
      please log in and change it as soon as possible.
    </p>
    <div style="background:#f8fafc;border:2px dashed ${roleColor};border-radius:10px;padding:20px;text-align:center;margin-bottom:24px;">
      <p style="margin:0 0 6px;font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
      <p style="margin:0;font-size:26px;font-weight:bold;font-family:monospace;color:#0F172A;letter-spacing:3px;">${tempPassword}</p>
    </div>
    <p style="text-align:center;margin:0 0 24px;">
      <a href="${loginUrl}" style="background:${roleColor};color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:bold;font-size:14px;display:inline-block;">
        Log In Now
      </a>
    </p>
    <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.6;">
      If you did not request a password reset, please contact the academy immediately at 
      <a href="mailto:support@calcricket.org" style="color:${roleColor};">support@calcricket.org</a>.
      This temporary password will work until you change it after logging in.
    </p>
  </td></tr>
  <tr><td style="text-align:center;padding:16px 0;">
    <p style="color:#94a3b8;font-size:11px;margin:0;">California Cricket Academy | support@calcricket.org</p>
  </td></tr>
</table>
</body></html>`;

  await resend.emails.send({
    from: `California Cricket Academy <${FROM_ADDRESS}>`,
    to,
    subject,
    html,
  });
}

module.exports = { sendRegistrationEmail, sendCoachWelcomeEmail, sendRegistrationUpdateEmail, sendForgotPasswordEmail };
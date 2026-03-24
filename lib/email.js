const { Resend } = require('resend');
const { getDigestTasks } = require('./supabase');

// Gracefully handle missing API key — app still starts, emails just skip
const resend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== 're_placeholder'
  ? new Resend(process.env.RESEND_API_KEY)
  : null;
const TO_EMAIL = process.env.DIGEST_EMAIL || 'dan@strategicglobalmissions.org';
const FROM_EMAIL = process.env.DIGEST_FROM || 'Voice Funnel <onboarding@resend.dev>';

// ──── 7:00 AM — MORNING COCKPIT ────
async function sendMorningDigest() {
  if (!resend) { console.log('[EMAIL] Skipping morning digest — no Resend API key'); return; }
  const { todayTasks, starred, activeTasks, inboxCount } = await getDigestTasks();

  const priorityEmoji = { 1: '🔴', 2: '🟡', 3: '🔵', 4: '⚪' };
  const domainEmoji = { meridian: '🏢', ministry: '⛪', personal: '🏃', admin: '📋' };

  let html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:500px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:24px;border-radius:12px;">
    <h1 style="font-size:20px;margin:0 0 4px;">☀️ Morning Cockpit</h1>
    <p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
  `;

  // THE ONE THING
  if (starred) {
    html += `
    <div style="background:linear-gradient(135deg,rgba(34,197,94,.15),rgba(34,197,94,.05));border:1px solid rgba(34,197,94,.3);border-radius:10px;padding:14px;margin-bottom:16px;">
      <div style="font-size:11px;font-weight:700;color:#22c55e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px;">⭐ THE ONE THING</div>
      <div style="font-size:16px;font-weight:600;">${starred.text}</div>
      <div style="font-size:12px;color:#94a3b8;margin-top:4px;">${domainEmoji[starred.domain] || ''} ${starred.domain}</div>
    </div>`;
  }

  // TODAY'S FOCUS
  html += `<h2 style="font-size:15px;color:#3b82f6;margin:16px 0 8px;">🎯 Today's Focus (${todayTasks.length})</h2>`;
  if (todayTasks.length === 0) {
    html += `<p style="color:#64748b;font-size:13px;">No tasks in Today's Focus. Time to triage from your inbox.</p>`;
  } else {
    todayTasks.forEach(t => {
      html += `<div style="padding:8px 0;border-bottom:1px solid #1e293b;font-size:14px;">
        ${priorityEmoji[t.priority_level] || '🔵'} ${t.text}
        <span style="color:#64748b;font-size:11px;margin-left:8px;">${domainEmoji[t.domain] || ''} ${t.domain}</span>
        ${t.deadline ? `<span style="color:#eab308;font-size:11px;margin-left:6px;">📅 ${t.deadline}</span>` : ''}
      </div>`;
    });
  }

  // COCKPIT REMINDER
  html += `
    <div style="background:#1e293b;border-radius:10px;padding:14px;margin-top:20px;">
      <div style="font-size:12px;font-weight:700;color:#a855f7;text-transform:uppercase;margin-bottom:8px;">Daily Cockpit — Morning Check</div>
      <div style="font-size:13px;color:#94a3b8;line-height:1.8;">
        ☐ What is my ONE First Fruits task?<br>
        ☐ Timer set for 30 minutes?<br>
        ☐ Daily List ready? (If no — pick 3-5 from Active now)
      </div>
    </div>`;

  // STATS
  html += `
    <div style="display:flex;gap:12px;margin-top:16px;">
      <div style="flex:1;background:#1e293b;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:700;">${todayTasks.length}</div>
        <div style="font-size:11px;color:#94a3b8;">Today</div>
      </div>
      <div style="flex:1;background:#1e293b;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:700;">${activeTasks.length}</div>
        <div style="font-size:11px;color:#94a3b8;">Active</div>
      </div>
      <div style="flex:1;background:#1e293b;border-radius:8px;padding:10px;text-align:center;">
        <div style="font-size:20px;font-weight:700;">${inboxCount}</div>
        <div style="font-size:11px;color:#94a3b8;">Inbox</div>
      </div>
    </div>
  </div>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: `☀️ Morning Cockpit — ${todayTasks.length} tasks in focus${starred ? ` | ⭐ ${starred.text.substring(0, 40)}` : ''}`,
    html
  });
}

// ──── 8:00 PM — EVENING RUNWAY ────
async function sendEveningRunway() {
  if (!resend) { console.log('[EMAIL] Skipping evening runway — no Resend API key'); return; }
  const { todayTasks, activeTasks, inboxCount, completedToday } = await getDigestTasks();

  const priorityEmoji = { 1: '🔴', 2: '🟡', 3: '🔵', 4: '⚪' };

  let html = `
  <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:500px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:24px;border-radius:12px;">
    <h1 style="font-size:20px;margin:0 0 4px;">🌙 Evening Runway</h1>
    <p style="color:#94a3b8;font-size:13px;margin:0 0 20px;">10 minutes. Set up tomorrow. Close the laptop.</p>
  `;

  // TODAY'S WINS
  if (completedToday.length > 0) {
    html += `<h2 style="font-size:15px;color:#22c55e;margin:0 0 8px;">✅ Today's Wins (${completedToday.length})</h2>`;
    completedToday.forEach(t => {
      html += `<div style="padding:6px 0;font-size:13px;color:#94a3b8;text-decoration:line-through;">${t.text}</div>`;
    });
  }

  // STILL OPEN
  const stillOpen = todayTasks.filter(t => t.status !== 'completed');
  if (stillOpen.length > 0) {
    html += `<h2 style="font-size:15px;color:#eab308;margin:16px 0 8px;">⏳ Still Open (${stillOpen.length})</h2>`;
    stillOpen.forEach(t => {
      html += `<div style="padding:6px 0;font-size:13px;">${priorityEmoji[t.priority_level]} ${t.text}</div>`;
    });
    html += `<p style="font-size:12px;color:#64748b;margin-top:4px;">Push back to Active, reschedule, or carry to tomorrow?</p>`;
  }

  // TRIAGE NUDGE
  if (inboxCount > 0) {
    html += `
    <div style="background:linear-gradient(135deg,rgba(168,85,247,.1),rgba(59,130,246,.1));border:1px solid rgba(168,85,247,.2);border-radius:10px;padding:14px;margin-top:16px;">
      <div style="font-size:12px;font-weight:700;color:#a855f7;text-transform:uppercase;margin-bottom:6px;">Inbox Alert</div>
      <p style="font-size:13px;color:#94a3b8;margin:0;">You have <strong style="color:#f1f5f9;">${inboxCount}</strong> items sitting in the inbox. Take 2 minutes to triage the top 3.</p>
    </div>`;
  }

  // TOP ACTIVE FOR TOMORROW
  const topActive = activeTasks.slice(0, 5);
  if (topActive.length > 0) {
    html += `<h2 style="font-size:15px;color:#3b82f6;margin:16px 0 8px;">📋 Candidates for Tomorrow</h2>`;
    topActive.forEach(t => {
      html += `<div style="padding:6px 0;font-size:13px;">${priorityEmoji[t.priority_level]} ${t.text}</div>`;
    });
  }

  // RUNWAY CHECKLIST
  html += `
    <div style="background:#1e293b;border-radius:10px;padding:14px;margin-top:20px;">
      <div style="font-size:12px;font-weight:700;color:#f97316;text-transform:uppercase;margin-bottom:8px;">Evening Runway — 10 Min Protocol</div>
      <div style="font-size:13px;color:#94a3b8;line-height:2;">
        ☐ Review tomorrow's calendar<br>
        ☐ Write Daily List: 3-5 items, star THE ONE<br>
        ☐ Write the first physical action for each item<br>
        ☐ Anything unresolved? Write it down and let it go.<br>
        ☐ Close the laptop.
      </div>
    </div>
  </div>`;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: TO_EMAIL,
    subject: `🌙 Evening Runway — ${completedToday.length} wins today | ${stillOpen.length} still open`,
    html
  });
}

module.exports = { sendMorningDigest, sendEveningRunway };

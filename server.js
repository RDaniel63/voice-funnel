require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const cron = require('node-cron');
const { transcribeAudio } = require('./lib/whisper');
const { parseTranscript } = require('./lib/parser');
const { supabase, initDatabase } = require('./lib/supabase');
const { sendMorningDigest, sendEveningRunway } = require('./lib/email');

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } }); // 25MB max

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ──── HEALTH CHECK ────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '2.0.0' });
});

// ──── VOICE → TEXT (Whisper) ────
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });
    const text = await transcribeAudio(req.file.buffer, req.file.mimetype);
    res.json({ text });
  } catch (err) {
    console.error('Transcribe error:', err.message);
    res.status(500).json({ error: 'Transcription failed: ' + err.message });
  }
});

// ──── TEXT → TASKS (GPT-4o) ────
app.post('/api/parse', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'No text provided' });
    const items = await parseTranscript(text);
    res.json({ items });
  } catch (err) {
    console.error('Parse error:', err.message);
    res.status(500).json({ error: 'Parsing failed: ' + err.message });
  }
});

// ──── FULL PIPELINE: Voice → Text → Tasks → Save ────
app.post('/api/capture', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No audio file' });

    // Step 1: Whisper transcription
    const transcript = await transcribeAudio(req.file.buffer, req.file.mimetype);

    // Step 2: GPT-4o parsing
    const items = await parseTranscript(transcript);

    // Step 3: Save to Supabase
    const saved = [];
    for (const item of items) {
      const { data, error } = await supabase.from('tasks').insert(item).select().single();
      if (error) console.error('DB insert error:', error.message);
      else saved.push(data);
    }

    res.json({ transcript, items: saved, count: saved.length });
  } catch (err) {
    console.error('Capture error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// ──── CRUD: Tasks ────
app.get('/api/tasks', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ tasks: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch('/api/tasks/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ ...req.body, updated_at: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ task: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('tasks').delete().eq('id', req.params.id);
    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── STARRED TASK (The ONE Thing) ────
app.post('/api/tasks/:id/star', async (req, res) => {
  try {
    // Unstar all others first
    await supabase.from('tasks').update({ is_starred: false }).eq('is_starred', true);
    // Star this one
    const { data, error } = await supabase
      .from('tasks')
      .update({ is_starred: true, funnel: 'today' })
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    res.json({ task: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── BULK FUNNEL MOVE ────
app.post('/api/tasks/bulk-move', async (req, res) => {
  try {
    const { ids, funnel } = req.body;
    const { data, error } = await supabase
      .from('tasks')
      .update({ funnel, updated_at: new Date().toISOString() })
      .in('id', ids)
      .select();
    if (error) throw error;
    res.json({ tasks: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── MANUAL DIGEST TRIGGER (for testing) ────
app.post('/api/digest/morning', async (req, res) => {
  try {
    await sendMorningDigest();
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/digest/evening', async (req, res) => {
  try {
    await sendEveningRunway();
    res.json({ sent: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ──── SPA FALLBACK ────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ──── CRON: Email Digests ────
// 7:00 AM Central Time (13:00 UTC during CDT)
cron.schedule('0 13 * * *', async () => {
  console.log('[CRON] Sending morning digest...');
  try { await sendMorningDigest(); console.log('[CRON] Morning digest sent'); }
  catch (err) { console.error('[CRON] Morning digest failed:', err.message); }
});

// 8:00 PM Central Time (02:00 UTC next day during CDT)
cron.schedule('0 2 * * *', async () => {
  console.log('[CRON] Sending evening runway...');
  try { await sendEveningRunway(); console.log('[CRON] Evening runway sent'); }
  catch (err) { console.error('[CRON] Evening runway failed:', err.message); }
});

// ──── START ────
const PORT = process.env.PORT || 3000;

async function start() {
  await initDatabase();
  app.listen(PORT, () => {
    console.log(`Voice Funnel v2 running on port ${PORT}`);
    console.log(`Cron: Morning digest at 7:00 AM CT, Evening runway at 8:00 PM CT`);
  });
}

start();

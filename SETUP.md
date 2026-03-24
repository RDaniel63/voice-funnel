# Voice Funnel v2 — Setup & Deploy Guide

**What you're deploying:** A voice-first task capture app with OpenAI Whisper transcription, GPT-4o task parsing, Supabase cloud database, and automated email digests tied to your Executive Performance System.

**Total setup time: ~30 minutes** (one-time, then it runs forever)

---

## Step 1: Get Your API Keys (10 min)

You need three services. All have free tiers.

### 1A. OpenAI API Key (you have this already)
- Go to: https://platform.openai.com/api-keys
- Copy your API key (starts with `sk-`)
- **Cost:** Whisper = ~$0.006/min of audio. GPT-4o parsing = ~$0.01 per voice note. A heavy day of 20 voice notes = ~$0.32.

### 1B. Supabase (free tier — database)
1. Go to https://supabase.com → Sign up (use Google/GitHub)
2. Click **New Project**
3. Name it `voice-funnel`, pick a strong password, choose the region closest to you (US East)
4. Wait ~2 minutes for it to provision
5. Go to **Settings → API** (left sidebar)
6. Copy these two values:
   - **Project URL** (looks like `https://abcdefg.supabase.co`)
   - **service_role key** (the longer one — NOT the anon key)

### 1C. Resend (free tier — email digest)
1. Go to https://resend.com → Sign up
2. Go to **API Keys** → Create a new key
3. Copy the key (starts with `re_`)
4. **Important:** On the free tier, you can only send FROM `onboarding@resend.dev` — that's fine for now. To use a custom domain later, add it in Resend settings.

---

## Step 2: Create the Database Table (3 min)

1. In Supabase, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Paste this entire block and click **Run**:

```sql
CREATE TABLE IF NOT EXISTS tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  text TEXT NOT NULL,
  original_transcript TEXT,
  status TEXT DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed')),
  priority_level INTEGER DEFAULT 3 CHECK (priority_level BETWEEN 1 AND 4),
  tags TEXT[] DEFAULT '{"task"}',
  funnel TEXT DEFAULT 'all' CHECK (funnel IN ('all', 'active', 'today')),
  deadline TEXT,
  domain TEXT DEFAULT 'meridian' CHECK (domain IN ('meridian', 'ministry', 'personal', 'admin')),
  is_starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tasks_funnel ON tasks(funnel);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_starred ON tasks(is_starred) WHERE is_starred = TRUE;

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations" ON tasks FOR ALL USING (true) WITH CHECK (true);
```

4. You should see "Success. No rows returned." — that means it worked.

---

## Step 3: Deploy to Railway (10 min)

Railway runs your server 24/7 for free (up to 500 hours/month on the free plan, which is plenty).

### 3A. Push to GitHub
1. Go to https://github.com/new
2. Name the repo `voice-funnel`
3. Upload the entire `voice-funnel-v2` folder contents (all files including the `lib/` and `public/` folders)

### 3B. Deploy on Railway
1. Go to https://railway.app → Sign up with GitHub
2. Click **New Project → Deploy from GitHub Repo**
3. Select your `voice-funnel` repo
4. Railway will auto-detect Node.js and start building

### 3C. Add Environment Variables
1. In Railway, click on your service → **Variables** tab
2. Add each of these (click **+ New Variable** for each):

```
OPENAI_API_KEY=sk-your-key-here
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-role-key
RESEND_API_KEY=re_your-key-here
DIGEST_EMAIL=dan@strategicglobalmissions.org
DIGEST_FROM=Voice Funnel <onboarding@resend.dev>
PORT=3000
NODE_ENV=production
```

3. Railway will auto-redeploy with the new variables

### 3D. Get Your URL
1. In Railway, go to **Settings → Networking → Generate Domain**
2. You'll get a URL like `voice-funnel-production.up.railway.app`
3. Open that URL on your phone — that's your app!

### 3E. Add to Home Screen
- **iPhone:** Open URL in Safari → tap Share → "Add to Home Screen"
- **Android:** Open URL in Chrome → tap menu → "Add to Home Screen"

---

## Step 4: Test It (5 min)

1. Open the app on your phone
2. Tap the blue mic button
3. Say: "I need to follow up with Andy Ramos about the retainer proposal by Friday. Also, I have an idea about creating a workshop on AI governance for nonprofits. And remind me to call Danny this weekend."
4. Tap "Save & Process"
5. Watch it: record → transcribe with Whisper → parse with GPT-4o → display 3 separate tasks with correct priorities, domains, and tags

If that works, you're live.

---

## Step 5: Test Email Digest (2 min)

The digests run automatically (7:00 AM and 8:00 PM Central), but you can trigger them manually:

1. Open a browser and go to: `https://your-railway-url.up.railway.app/api/digest/morning`
   - Method: POST (you can use the browser console or just type it in the Railway terminal)
2. Check your email at dan@strategicglobalmissions.org

Or from Railway's terminal:
```bash
curl -X POST https://your-app-url/api/digest/morning
curl -X POST https://your-app-url/api/digest/evening
```

---

## Architecture Overview

```
┌──────────────────────────────────────────┐
│  Your Phone (PWA)                         │
│  ┌────────────────────────────────────┐  │
│  │  MediaRecorder → audio blob         │  │
│  └──────────────┬─────────────────────┘  │
│                 │ POST /api/capture       │
└─────────────────┼────────────────────────┘
                  ▼
┌──────────────────────────────────────────┐
│  Railway Server (Node.js + Express)       │
│                                           │
│  /api/capture (full pipeline):            │
│    1. Audio blob → OpenAI Whisper → text  │
│    2. Text → GPT-4o → structured tasks    │
│    3. Tasks → Supabase → saved            │
│                                           │
│  /api/tasks (CRUD)                        │
│  /api/tasks/:id/star (EPS: THE ONE)       │
│                                           │
│  Cron Jobs:                               │
│    7:00 AM CT → Morning Cockpit email     │
│    8:00 PM CT → Evening Runway email      │
└──────────────┬───────────────────────────┘
               │
     ┌─────────┼─────────┐
     ▼         ▼         ▼
┌─────────┐ ┌────────┐ ┌────────┐
│ OpenAI  │ │Supabase│ │ Resend │
│ Whisper │ │Postgres│ │ Email  │
│ + GPT4o │ │  (DB)  │ │        │
└─────────┘ └────────┘ └────────┘
```

---

## Executive Performance System Integration

Voice Funnel v2 maps directly to your EPS:

| EPS Component | Voice Funnel Feature |
|--------------|---------------------|
| **Evening Runway** | 8:00 PM email with today's wins, still-open items, inbox triage nudge, and the Runway checklist |
| **Morning Cockpit** | 7:00 AM email with Today's Focus, THE ONE starred task, and the morning check protocol |
| **THE ONE Thing** | Star button on any task — only one can be starred at a time |
| **Daily List** | Today's Focus view = your 3-5 items for the day |
| **Capture Everything** | One-tap voice capture → automatic parsing → auto-tagged and prioritized |
| **Bridge Protocol 1-Sentence Start** | THE ONE banner at top of Today view = your declared task |
| **Domain separation** | Tasks auto-tagged as Meridian/Ministry/Personal/Admin with domain filter |

---

## Cost Estimate (Monthly)

| Service | Free Tier | Typical Usage | Est. Monthly Cost |
|---------|-----------|--------------|-------------------|
| Railway | 500 hrs free | Always-on server | $0 (free tier) or $5/mo (starter) |
| Supabase | 500 MB, 50K rows | Your tasks | $0 |
| OpenAI | Pay-as-you-go | ~20 voice notes/day | ~$6-10/mo |
| Resend | 100 emails/day | 2 emails/day | $0 |
| **Total** | | | **$0-15/mo** |

---

## Troubleshooting

**Mic not working on phone:**
- Make sure you're on HTTPS (Railway provides this automatically)
- Check browser permissions: Settings → Site Permissions → Microphone

**Tasks not saving:**
- Check Supabase: did you run the SQL from Step 2?
- Check Railway logs: Variables tab → make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set

**Email not arriving:**
- Check spam folder
- Verify RESEND_API_KEY is set in Railway variables
- Test manually: `curl -X POST your-app-url/api/digest/morning`

**"Transcription failed" error:**
- Check OPENAI_API_KEY in Railway variables
- Verify you have credits on your OpenAI account

---

## Future Upgrades

When you're ready for the next level:

1. **Authentication** — Add Supabase Auth so only you can access your data
2. **Multiple users** — If you want to offer this to Meridian clients
3. **Calendar integration** — Pull Google Calendar into morning digest
4. **Weekly Review automation** — Friday evening email with full-week summary
5. **Siri Shortcut** — iOS shortcut that opens directly to recording mode
6. **Apple Watch** — Voice capture from your wrist

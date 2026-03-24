const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_KEY || ''
);

// SQL to run in Supabase SQL Editor (one-time setup)
const SCHEMA_SQL = `
-- Run this in Supabase SQL Editor → New Query

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

-- Index for fast queries
CREATE INDEX IF NOT EXISTS idx_tasks_funnel ON tasks(funnel);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tasks_starred ON tasks(is_starred) WHERE is_starred = TRUE;

-- Enable Row Level Security (open for now — add auth later)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations" ON tasks FOR ALL USING (true) WITH CHECK (true);
`;

async function initDatabase() {
  // Test connection
  try {
    const { data, error } = await supabase.from('tasks').select('id').limit(1);
    if (error && error.code === '42P01') {
      console.log('⚠️  Tasks table not found. Please run the schema SQL in Supabase.');
      console.log('   See SETUP.md Step 3 for the SQL to copy/paste.');
    } else if (error) {
      console.error('Database connection error:', error.message);
    } else {
      console.log('✅ Database connected');
    }
  } catch (err) {
    console.error('Failed to connect to Supabase:', err.message);
    console.log('Voice Funnel will start but database operations will fail.');
    console.log('Check your SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
  }
}

// Helper: get tasks for digest emails
async function getDigestTasks() {
  const { data: todayTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('funnel', 'today')
    .neq('status', 'completed')
    .order('priority_level', { ascending: true });

  const { data: starred } = await supabase
    .from('tasks')
    .select('*')
    .eq('is_starred', true)
    .limit(1)
    .single();

  const { data: activeTasks } = await supabase
    .from('tasks')
    .select('*')
    .eq('funnel', 'active')
    .neq('status', 'completed')
    .order('priority_level', { ascending: true });

  const { data: inboxCount } = await supabase
    .from('tasks')
    .select('id', { count: 'exact' })
    .eq('funnel', 'all')
    .neq('status', 'completed');

  const { data: completedToday } = await supabase
    .from('tasks')
    .select('*')
    .eq('status', 'completed')
    .gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString())
    .order('updated_at', { ascending: false });

  return {
    todayTasks: todayTasks || [],
    starred: starred || null,
    activeTasks: activeTasks || [],
    inboxCount: inboxCount?.length || 0,
    completedToday: completedToday || []
  };
}

module.exports = { supabase, initDatabase, getDigestTasks, SCHEMA_SQL };

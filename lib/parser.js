const OpenAI = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are a task extraction engine for a productivity app. The user is Daniel Jones — a United Methodist pastor and founder of Meridian AI Partners (an AI consulting firm). He captures voice memos throughout the day that mix tasks, ideas, projects, and random thoughts.

Your job: take raw voice transcripts and extract structured, actionable items.

RULES:
1. Split multi-topic transcripts into SEPARATE items (one item per distinct task/idea)
2. Rewrite each item as a clear, concise action statement (imperative form: "Follow up with..." not "I need to follow up with...")
3. Preserve names, deadlines, and specific details — never generalize
4. Detect context domains:
   - "meridian" — consulting business tasks (BD, clients, proposals, marketing, LinkedIn)
   - "ministry" — church, sermons, Mission Hubs, pastoral care
   - "personal" — family, health, household, errands
   - "admin" — bills, legal, scheduling, paperwork
5. Assign priority_level:
   - 1 (urgent) — explicit urgency, tight deadline, client-facing
   - 2 (high) — important this week, revenue-generating, time-sensitive
   - 3 (normal) — standard tasks, no urgency
   - 4 (low/someday) — ideas, explorations, "when I get time"
6. Assign tags from: ["task", "idea", "project", "urgent", "someday", "meridian", "ministry", "personal", "admin"]
7. Assign funnel:
   - "today" — urgent or explicitly mentioned for today
   - "active" — this week, clearly actionable
   - "all" — everything else (ideas, someday, unscheduled)
8. Extract deadlines if mentioned (natural language is fine: "by Friday", "tomorrow", "end of month")
9. If something is clearly "THE ONE" most important task, mark is_starred: true (only one per batch)

RESPOND WITH VALID JSON ONLY. No markdown, no explanation. Return an array of objects:
[{
  "text": "Clear action statement",
  "original_transcript": "The exact words that generated this item",
  "status": "not_started",
  "priority_level": 1-4,
  "tags": ["tag1", "tag2"],
  "funnel": "all|active|today",
  "deadline": "natural language deadline or null",
  "domain": "meridian|ministry|personal|admin",
  "is_starred": false
}]`;

async function parseTranscript(text) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: text }
    ],
    temperature: 0.3,
    response_format: { type: 'json_object' }
  });

  const content = response.choices[0].message.content;
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    console.error('Failed to parse GPT response:', content);
    return [fallbackItem(text)];
  }

  // Handle both { items: [...] } and direct array formats
  const items = Array.isArray(parsed) ? parsed : (parsed.items || parsed.tasks || [parsed]);

  return items.map(item => ({
    text: item.text || text,
    original_transcript: item.original_transcript || text,
    status: item.status || 'not_started',
    priority_level: item.priority_level || 3,
    tags: item.tags || ['task'],
    funnel: item.funnel || 'all',
    deadline: item.deadline || null,
    domain: item.domain || 'meridian',
    is_starred: item.is_starred || false,
    created_at: new Date().toISOString()
  }));
}

function fallbackItem(text) {
  return {
    text: text.charAt(0).toUpperCase() + text.slice(1),
    original_transcript: text,
    status: 'not_started',
    priority_level: 3,
    tags: ['task'],
    funnel: 'all',
    deadline: null,
    domain: 'meridian',
    is_starred: false,
    created_at: new Date().toISOString()
  };
}

module.exports = { parseTranscript };

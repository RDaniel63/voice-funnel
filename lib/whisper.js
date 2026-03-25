const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');
const os = require('os');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeAudio(buffer, mimetype) {
  const ext = mimetype.includes('webm') ? 'webm'
    : mimetype.includes('mp4') ? 'mp4'
    : mimetype.includes('wav') ? 'wav'
    : mimetype.includes('ogg') ? 'ogg'
    : 'webm';

  // Write to temp file — most reliable method for Node.js 18
  const tmpPath = path.join(os.tmpdir(), `audio-${Date.now()}.${ext}`);
  fs.writeFileSync(tmpPath, Buffer.from(buffer));

  try {
    const response = await openai.audio.transcriptions.create({
      model: 'whisper-1',
      file: fs.createReadStream(tmpPath),
      language: 'en',
      response_format: 'text',
      prompt: 'This is a voice memo about tasks, ideas, and projects. Names that may appear: Meridian AI Partners, Andy Ramos, Urban Catalyst, Michael Wyrick, TEI Logistics, Kristen, Danny, Jessica, Jaci, Pence, Winnie, Mission Hubs.'
    });
    return response.trim();
  } finally {
    // Clean up temp file
    try { fs.unlinkSync(tmpPath); } catch (e) {}
  }
}

module.exports = { transcribeAudio };

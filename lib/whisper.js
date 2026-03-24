const OpenAI = require('openai');
const { Readable } = require('stream');
const { toFile } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function transcribeAudio(buffer, mimetype) {
  const ext = mimetype.includes('webm') ? 'webm'
    : mimetype.includes('mp4') ? 'mp4'
    : mimetype.includes('wav') ? 'wav'
    : mimetype.includes('ogg') ? 'ogg'
    : 'webm';

  const file = await toFile(Buffer.from(buffer), `audio.${ext}`);

  const response = await openai.audio.transcriptions.create({
    model: 'whisper-1',
    file: file,
    language: 'en',
    response_format: 'text',
    prompt: 'This is a voice memo about tasks, ideas, and projects. Names that may appear: Meridian AI Partners, Andy Ramos, Urban Catalyst, Michael Wyrick, TEI Logistics, Kristen, Danny, Jessica, Jaci, Pence, Winnie, Mission Hubs.'
  });

  return response.trim();
}

module.exports = { transcribeAudio };

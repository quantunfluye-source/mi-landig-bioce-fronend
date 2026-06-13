require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY || '';
const PROFILE_PATH = path.join(__dirname, 'angel_profile.json');
const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const VOICES = ['es-MX-Wavenet-B', 'es-MX-Standard-B'];
const corsOptions = {
  origin(origin, callback) {
    if (!origin || !ALLOWED_ORIGIN) {
      callback(null, true);
      return;
    }

    if (origin === ALLOWED_ORIGIN) {
      callback(null, true);
      return;
    }

    callback(null, false);
  },
  methods: ['GET', 'POST', 'OPTIONS']
};

app.use(express.json({ limit: '1mb' }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

async function readProfile() {
  const raw = await fs.readFile(PROFILE_PATH, 'utf8');
  return JSON.parse(raw);
}

async function synthesizeSpeech(text, voiceName) {
  if (!GOOGLE_TTS_API_KEY) {
    throw new Error('Missing GOOGLE_TTS_API_KEY');
  }

  const response = await fetch(`${TTS_ENDPOINT}?key=${encodeURIComponent(GOOGLE_TTS_API_KEY)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: 'es-MX',
        name: voiceName,
        ssmlGender: 'MALE'
      },
      audioConfig: {
        audioEncoding: 'MP3'
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload?.error?.message || `Text-to-Speech request failed with status ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  if (!payload.audioContent || typeof payload.audioContent !== 'string') {
    throw new Error('Missing audioContent in Text-to-Speech response');
  }

  return payload.audioContent;
}

app.post('/speak', async (req, res) => {
  try {
    const profile = await readProfile();
    const greeting = String(profile?.greeting || '').trim();

    if (!greeting) {
      return res.status(400).json({ error: 'angel_profile.json does not contain greeting text' });
    }

    let audio = '';
    let lastError = null;

    for (const voiceName of VOICES) {
      try {
        audio = await synthesizeSpeech(greeting, voiceName);
        break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!audio) {
      throw lastError || new Error('Unable to synthesize audio');
    }

    res.json({ audio });
  } catch (error) {
    res.status(500).json({
      error: 'Unable to generate voice audio',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Voice server running on port ${PORT}`);
});

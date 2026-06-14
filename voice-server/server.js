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
const VOICES = [
  'es-MX-Neural2-B', // Premium - Neural 2 (Masculina, principal)
  'es-MX-Neural2-C', // Premium - Neural 2 (Masculina, alternativa)
  'es-MX-Studio-B',  // Premium - Studio (Ultra calidad, si está disponible)
  'es-MX-Wavenet-B', // Premium - Wavenet (Masculina, clásica alta calidad)
  'es-MX-Wavenet-C', // Premium - Wavenet (Masculina, alternativa)
  'es-MX-Standard-B', // Estándar (Masculina, respaldo 1)
  'es-MX-Standard-A'  // Estándar (Respaldo final)
];

const corsOptions = {
  origin: function (origin, callback) {
    // Si no hay origen (como en curl o herramientas de test) o coincide con ALLOWED_ORIGIN, permitir
    if (!origin || origin === ALLOWED_ORIGIN || ALLOWED_ORIGIN === '*' || !ALLOWED_ORIGIN) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(express.json({ limit: '1mb' }));
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Servir archivos estáticos de la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => {
  res.json({ status: 'ok', config: { allowedOrigin: ALLOWED_ORIGIN ? 'Set' : 'Not Set', hasKey: !!GOOGLE_TTS_API_KEY } });
});

async function readProfile() {
  try {
    const raw = await fs.readFile(PROFILE_PATH, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    console.error('Error leyendo angel_profile.json:', error.message);
    throw new Error('Could not read profile data');
  }
}

async function synthesizeSpeech(text, voiceName) {
  if (!GOOGLE_TTS_API_KEY) {
    console.error('DIAGNOSTICO: GOOGLE_TTS_API_KEY no está definida en el entorno.');
    throw new Error('Missing GOOGLE_TTS_API_KEY');
  }

  console.log(`Intentando síntesis con voz: ${voiceName}...`);
  
  const response = await fetch(`${TTS_ENDPOINT}?key=${encodeURIComponent(GOOGLE_TTS_API_KEY)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: { text },
      voice: {
        languageCode: 'es-MX',
        name: voiceName
      },
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: -2.0, // Un poco más grave para que suene más serio/profesional
        speakingRate: 1.0
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    console.error('DIAGNOSTICO - Error detallado de Google:', JSON.stringify(payload, null, 2));
    const message = payload?.error?.message || `Google API error: ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.fullError = payload;
    throw error;
  }

  if (!payload.audioContent) {
    throw new Error('No audio content in Google response');
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
    console.error('ERROR EN /speak:', error.message);
    res.status(500).json({
      error: 'Unable to generate voice audio',
      details: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Voice server running on port ${PORT}`);
});

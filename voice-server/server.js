require('dotenv').config();

const express = require('express');
const cors = require('cors');
const fs = require('fs/promises');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY || '';
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
const PROFILE_PATH = path.join(__dirname, 'angel_profile.json');
const TTS_ENDPOINT = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const DEEPSEEK_ENDPOINT = 'https://api.deepseek.com/chat/completions';
const VOICES = [
  'es-US-Neural2-B',      // masculina neural, muy natural
  'es-US-Wavenet-B',      // masculina wavenet
  'es-US-Standard-B',     // masculina estándar (siempre disponible)
  'es-US-Standard-C'      // fallback final
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

async function synthesizeSpeech(text, voiceName = null) {
  if (!GOOGLE_TTS_API_KEY) {
    console.error('DIAGNOSTICO: GOOGLE_TTS_API_KEY no está definida.');
    throw new Error('Missing GOOGLE_TTS_API_KEY');
  }

  const label = voiceName || 'GENERICA (MALE)';
  console.log(`Intentando síntesis con: ${label}...`);
  
  const voiceConfig = {
    languageCode: 'es-US',
    ssmlGender: 'MALE'
  };

  if (voiceName) {
    voiceConfig.name = voiceName;
  }

  const response = await fetch(`${TTS_ENDPOINT}?key=${encodeURIComponent(GOOGLE_TTS_API_KEY)}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      input: { text },
      voice: voiceConfig,
      audioConfig: {
        audioEncoding: 'MP3',
        pitch: -2.0,
        speakingRate: 1.0
      }
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = payload?.error?.message || `Status ${response.status}`;
    console.warn(`FALLÓ ${label}: ${errorMsg}`);
    const error = new Error(errorMsg);
    error.status = response.status;
    error.details = payload;
    throw error;
  }

  if (!payload.audioContent) {
    throw new Error(`No audioContent para ${label}`);
  }

  console.log(`¡ÉXITO con ${label}!`);
  return payload.audioContent;
}

app.post('/speak', async (req, res) => {
  try {
    const profile = await readProfile();
    const greeting = String(profile?.greeting || '').trim();

    if (!greeting) {
      return res.status(400).json({ error: 'angel_profile.json sin texto' });
    }

    let audio = '';
    let lastError = null;

    // 1. Intentar con la lista de voces específicas
    for (const voiceName of VOICES) {
      try {
        audio = await synthesizeSpeech(greeting, voiceName);
        if (audio) break;
      } catch (error) {
        lastError = error;
      }
    }

    // 2. Si fallaron todas las específicas, intentar una genérica (dejar que Google elija)
    if (!audio) {
      try {
        audio = await synthesizeSpeech(greeting, null);
      } catch (error) {
        lastError = error;
      }
    }

    if (!audio) {
      console.error('DIAGNOSTICO FINAL - Todas las voces fallaron. Último error:', JSON.stringify(lastError?.details || lastError?.message, null, 2));
      throw lastError || new Error('Unable to synthesize audio after all attempts');
    }

    res.json({ audio });
  } catch (error) {
    res.status(500).json({
      error: 'Unable to generate voice audio',
      details: error.message
    });
  }
});

app.post('/ask', async (req, res) => {
  if (!DEEPSEEK_API_KEY) {
    return res.status(503).json({ error: 'DeepSeek API key is not configured' });
  }

  const { question } = req.body;
  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  try {
    const profile = await readProfile();
    const systemContent = `Eres Angel Leon, vendedor de Empleado Digital 24/7 en Guadalajara. Contexto: [${profile?.greeting}]. Responde SIEMPRE en español mexicano, tono directo y confiable, máximo 3 oraciones cortas, sin tecnicismos. Si preguntan por precio o contacto, menciona el WhatsApp 33 4898 4979.`;

    const dsResponse = await fetch(DEEPSEEK_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: "deepseek-chat",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: question }
        ],
        max_tokens: 150,
        temperature: 0.7
      })
    });

    const dsData = await dsResponse.json();
    if (!dsResponse.ok) {
      throw new Error(dsData.error?.message || 'DeepSeek API error');
    }

    const answer = dsData.choices[0].message.content;

    // Sintetizar respuesta a voz
    let audio = '';
    let lastError = null;

    for (const voiceName of VOICES) {
      try {
        audio = await synthesizeSpeech(answer, voiceName);
        if (audio) break;
      } catch (error) {
        lastError = error;
      }
    }

    if (!audio) {
      try {
        audio = await synthesizeSpeech(answer, null);
      } catch (error) {
        lastError = error;
      }
    }

    if (!audio) throw lastError || new Error('Unable to synthesize response audio');

    res.json({ answer, audio });
  } catch (error) {
    console.error('ERROR EN /ask:', error.message);
    res.status(500).json({ error: 'Error processing question', details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Voice server v1.1 (Fresh Deploy) running on port ${PORT}`);
});

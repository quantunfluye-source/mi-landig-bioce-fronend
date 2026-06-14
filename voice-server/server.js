require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const GOOGLE_TTS_API_KEY = process.env.GOOGLE_TTS_API_KEY;
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';

const VOICES = ['es-US-Neural2-B', 'es-US-Wavenet-B', 'es-US-Standard-B', 'es-US-Standard-C'];

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function synthesizeSpeech(text) {
  let lastError;

  for (const voice of VOICES) {
    try {
      console.log(`Intentando voz: ${voice}...`);

      const response = await fetch(
        `https://texttospeech.googleapis.com/v1/text:synthesize?key=${GOOGLE_TTS_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            input: { text },
            voice: {
              languageCode: 'es-US',
              name: voice,
              ssmlGender: 'MALE',
            },
            audioConfig: {
              audioEncoding: 'MP3',
            },
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || `HTTP ${response.status}`);
      }

      const data = await response.json();
      console.log(`✓ Éxito con: ${voice}`);
      return data.audioContent;
    } catch (error) {
      lastError = error;
      console.log(`✗ Falló: ${voice} - ${error.message}`);
    }
  }

  throw lastError;
}

async function readProfile() {
  const profilePath = path.join(__dirname, 'angel_profile.json');
  const data = await fs.readFile(profilePath, 'utf8');
  return JSON.parse(data);
}

app.get('/health', async (req, res) => {
  res.json({
    status: 'ok',
    voices: VOICES,
    hasGoogleKey: !!GOOGLE_TTS_API_KEY,
    hasDeepseekKey: !!DEEPSEEK_API_KEY,
  });
});

app.post('/speak', async (req, res) => {
  try {
    const profile = await readProfile();
    const audio = await synthesizeSpeech(profile.greeting);
    res.json({ audio });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/ask', async (req, res) => {
  try {
    const { question } = req.body;
    if (!question) {
      return res.status(400).json({ error: 'question requerido' });
    }

    const profile = await readProfile();

    // Si no hay DEEPSEEK_API_KEY, devolver respuesta genérica
    if (!DEEPSEEK_API_KEY) {
      const genericAnswer = `Hola, gracias por tu pregunta. Te recomiendo contactarme directamente por WhatsApp al 33 4898 4979 para hablar sobre tu negocio y cómo el Empleado Digital 24/7 puede ayudarte.`;
      try {
        const audio = await synthesizeSpeech(genericAnswer);
        return res.json({ answer: genericAnswer, audio });
      } catch (e) {
        return res.json({ answer: genericAnswer, audio: null });
      }
    }

    const systemPrompt = `Eres Angel Leon, vendedor de Empleado Digital 24/7. Trabajas para Clario-IA.com.
Datos: ${JSON.stringify(profile)}.
Reglas: responde SIEMPRE en español mexicano, máximo 3 oraciones, tono directo y confiable,
sin tecnicismos. Si preguntan precio o contacto, menciona WhatsApp 33 4898 4979.`;

    const deepseekResponse = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question },
        ],
        max_tokens: 150,
        temperature: 0.7,
      }),
    });

    if (!deepseekResponse.ok) {
      const error = await deepseekResponse.json();
      throw new Error(error.error?.message || `HTTP ${deepseekResponse.status}`);
    }

    const deepseekData = await deepseekResponse.json();
    const answer = deepseekData.choices[0].message.content;

    const audio = await synthesizeSpeech(answer);

    res.json({ answer, audio });
  } catch (error) {
    res.status(500).json({ error: error.message, details: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor v2 corriendo en puerto ${PORT}`);
});

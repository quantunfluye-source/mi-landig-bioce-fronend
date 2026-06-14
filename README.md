# 🚀 Empleado Digital 24/7

Landing page premium y sistema de voz inteligente para el servicio de Angel Leon: un asistente con IA que contesta, vende y cierra por WhatsApp 24/7.

## 🌐 Arquitectura del Proyecto

Este proyecto integra una interfaz web moderna con un servidor de voz y chat inteligente.

- **Frontend**: Localizado en `voice-server/public/index.html`. Es servido directamente por el backend de Express para evitar problemas de CORS y latencia.
- **Backend**: Servidor Node.js/Express en `voice-server/server.js` desplegado en **Render**.
- **Endpoints**:
  - `POST /speak`: Genera el audio del saludo inicial de Angel.
  - `POST /ask`: Recibe preguntas del usuario, consulta a **DeepSeek Chat** para generar una respuesta inteligente y la convierte a voz con **Google Cloud TTS**.

## 🛠️ Tecnologías y APIs

- **DeepSeek Chat API**: Cerebro de la conversación, configurado con el perfil de ventas de Angel Leon.
- **Google Cloud Text-to-Speech**: Conversión de texto a voz premium (voces Neural2 y Wavenet).
- **Web Speech API**: Captura de voz desde el micrófono del navegador.
- **Node.js / Express**: Servidor backend.
- **JavaScript Vanilla / CSS3**: Frontend de alto impacto visual sin dependencias pesadas.

## 📦 Estructura de archivos

```txt
.
├── voice-server/
│   ├── public/
│   │   └── index.html       # Interfaz de usuario y lógica de cliente
│   ├── server.js            # Servidor Express y lógica de APIs
│   ├── angel_profile.json   # Contexto y saludo de Angel Leon
│   └── package.json         # Dependencias del servidor
├── .gitignore
└── README.md
```

## ⚙️ Variables de Entorno (en Render)

Configura estas variables en tu panel de Render para que el sistema funcione correctamente:

| Variable | Descripción | Dónde obtenerla (link) |
| :--- | :--- | :--- |
| **GOOGLE_TTS_API_KEY** | API Key para síntesis de voz | [console.cloud.google.com](https://console.cloud.google.com) |
| **DEEPSEEK_API_KEY** | API Key para el chat inteligente | [platform.deepseek.com](https://platform.deepseek.com) |
| **PORT** | Puerto del servidor | Render lo asigna automáticamente |
| **ALLOWED_ORIGIN** | Dominio permitido (CORS) | Tu URL de Render o Netlify |

## 💻 Instalación y Uso Local

1. Entra a la carpeta del servidor: `cd voice-server`
2. Instala dependencias: `npm install`
3. Crea un archivo `.env` con tus llaves.
4. Inicia el servidor: `npm start`
5. Abre `http://localhost:3000` en tu navegador.

## 📞 Contacto

- WhatsApp: [33 4898 4979](https://wa.me/523348984979)
- Vendedor: Angel Leon

## ✅ Próximos pasos
- [ ] Subir la imagen real `og-image.jpg` (1200x630 px)
- [ ] Optimizar imágenes finales
- [ ] Agregar dominio personalizado
- [ ] Revisar SEO técnico y metadatos finales

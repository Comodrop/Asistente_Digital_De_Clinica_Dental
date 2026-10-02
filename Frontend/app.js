const BACKEND_URL = 'http://localhost:3000/api/chat';

const chatBox = document.getElementById('chat-box');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const micInstruction = document.getElementById('mic-instruction');
const statusText = document.getElementById('status-text');

let chatHistory = [];
let isListening = false;
let recognition = null;
let silenceTimer = null;

// Tiempo de silencio permitido en milisegundos (4 segundos)
const SILENCE_TIMEOUT_MS = 4000; 

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  alert('Tu navegador no soporta reconocimiento de voz. Te recomendamos usar Google Chrome o Brave.');
} else {
  recognition = new SpeechRecognition();
  recognition.lang = 'es-GT';
  
  // Permite detectar el sonido y texto en tiempo real
  recognition.interimResults = true; 

  // Evento Botón HABLAR
  startBtn.addEventListener('click', () => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    recognition.start();
  });

  // Evento Botón TERMINAR
  stopBtn.addEventListener('click', () => {
    stopAllInteraction();
    appendMessage('Conversación finalizada.', 'bot-message');
  });

  recognition.onstart = () => {
    isListening = true;
    startBtn.classList.add('listening');
    startBtn.disabled = true;
    stopBtn.disabled = false;
    micInstruction.textContent = 'Escuchando... Habla ahora';
    statusText.textContent = 'Escuchando';

    // Iniciar el conteo regresivo si el usuario activa el micrófono pero no habla
    resetSilenceTimer();
  };

  recognition.onresult = (event) => {
    // Reiniciar el conteo de silencio cada vez que se detecte voz o sonido
    resetSilenceTimer();

    const lastResultIndex = event.results.length - 1;
    const isFinal = event.results[lastResultIndex].isFinal;
    const transcript = event.results[lastResultIndex][0].transcript.trim();

    // Cuando el usuario termina la frase completa
    if (isFinal && transcript.length > 0) {
      clearTimeout(silenceTimer);
      appendMessage(transcript, 'user-message');
      sendToBackend(transcript);
    }
  };

  recognition.onend = () => {
    clearTimeout(silenceTimer);
    isListening = false;
    startBtn.classList.remove('listening');
    startBtn.disabled = false;
  };

  recognition.onerror = (event) => {
    console.warn('Error en el reconocimiento de voz:', event.error);
    clearTimeout(silenceTimer);
  };
}

// Función para controlar la cuenta regresiva de ausencia de voz
function resetSilenceTimer() {
  clearTimeout(silenceTimer);
  silenceTimer = setTimeout(() => {
    if (isListening && recognition) {
      console.log('Tiempo límite de silencio alcanzado. Deteniendo micrófono...');
      recognition.stop();
    }
  }, SILENCE_TIMEOUT_MS);
}

// Detiene tanto el micrófono como la reproducción de voz
function stopAllInteraction() {
  clearTimeout(silenceTimer);
  if (recognition && isListening) {
    recognition.stop();
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  isListening = false;
  startBtn.classList.remove('listening');
  startBtn.disabled = false;
  stopBtn.disabled = true;
  micInstruction.textContent = 'Presiona "Hablar" para iniciar';
  statusText.textContent = 'Listo';
}

// Enviar texto del usuario al servidor Node.js
async function sendToBackend(message) {
  try {
    statusText.textContent = 'Pensando...';
    
    const response = await fetch(BACKEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, history: chatHistory })
    });

    const data = await response.json();

    if (data.reply) {
      appendMessage(data.reply, 'bot-message');
      chatHistory = data.history;
      speakText(data.reply);
    } else {
      appendMessage('Ocurrió un error al procesar tu solicitud.', 'bot-message');
    }
  } catch (error) {
    console.error('Error enviando datos:', error);
    appendMessage('No se pudo conectar con el servidor.', 'bot-message');
  } finally {
    statusText.textContent = 'Listo';
  }
}

// Reproducción de voz (Síntesis de voz)
function speakText(text) {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'es-ES';
    utterance.rate = 1.0;

    utterance.onstart = () => {
      stopBtn.disabled = false;
      statusText.textContent = 'Hablando...';
    };

    utterance.onend = () => {
      statusText.textContent = 'Listo';
      micInstruction.textContent = 'Presiona "Hablar" para responder';
    };

    window.speechSynthesis.speak(utterance);
  }
}

// Mostrar mensajes en el chat
function appendMessage(text, className) {
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', className);
  msgDiv.textContent = text;
  chatBox.appendChild(msgDiv);
  chatBox.scrollTop = chatBox.scrollHeight;
}
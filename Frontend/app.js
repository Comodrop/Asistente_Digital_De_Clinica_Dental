const BACKEND_URL = 'http://localhost:3000/api/chat';

const chatBox = document.getElementById('chat-box');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const micInstruction = document.getElementById('mic-instruction');
const statusText = document.getElementById('status-text');

let chatHistory = [];
let isListening = false;
let recognition = null;

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (!SpeechRecognition) {
  alert('Tu navegador no soporta reconocimiento de voz. Te recomendamos usar Google Chrome o Brave.');
} else {
  recognition = new SpeechRecognition();
  recognition.lang = 'es-GT';
  recognition.interimResults = false;

  // Evento Botón HABLAR
  startBtn.addEventListener('click', () => {
    // Si la asistente está hablando, detener la voz para escuchar al usuario
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
  };

  recognition.onend = () => {
    isListening = false;
    startBtn.classList.remove('listening');
    startBtn.disabled = false;
  };

  recognition.onresult = async (event) => {
    const userText = event.results[0][0].transcript;
    appendMessage(userText, 'user-message');
    await sendToBackend(userText);
  };
}

// Detiene tanto el micrófono como la reproducción de voz
function stopAllInteraction() {
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
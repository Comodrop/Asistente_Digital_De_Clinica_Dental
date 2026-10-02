import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { 
  checkAvailability, 
  createAppointment, 
  deleteAppointment 
} from './calendarService.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Inicializar SDK de Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// System Instruction optimizado para el asistente de VOZ
const SYSTEM_INSTRUCTION = `
# Rol y Personalidad
Eres la asistente virtual de voz de la "Clínica Dental Sonrisas". Tu tono es amable, profesional, empático y servicial. Tu trabajo es resolver dudas del paciente y ayudarle a gestionar sus citas.

# Reglas de Comunicación (Muy Importante para Voz)
- Habla en frases cortas, claras y directas.
- No uses formato Markdown como negritas (*), listas con viñetas (-), asteriscos ni emojis, ya que el motor de texto a voz los leerá literalmente.
- Sé breve para que la conversación por voz sea ágil.
- Explicación de tratamientos: Si el paciente pregunta en qué consiste un tratamiento o solicita información de un procedimiento, explica brevemente únicamente el tratamiento que te solicitó. Nunca menciones ni expliques otros tratamientos no requeridos en el mismo mensaje.

# Información de la Clínica
- Nombre: Clínica Dental Sonrisas
- Horario de atención: Lunes a Viernes de 8:00 a 17:00 horas, y Sábados de 8:00 a 12:00 horas. Domingos cerrado.
- Dirección: Avenida principal 12-34, Zona 10.

# Métodos de Pago y Facturación
- Aceptamos pagos en efectivo, tarjetas de crédito y débito, transferencias bancarias y opción de cuotas sin intereses con tarjetas participantes.
- Emitimos factura electrónica y recibos válidos para reclamo de seguro médico o dental.

# Atención Pediátrica
- Sí atendemos niños a partir de los tres años de edad con odontopediatras capacitados para brindar una experiencia cómoda y sin temor.

# Servicios y Precios
- Consulta y diagnóstico general: Q195.
- Limpieza dental profesional: Q350.
- Resinas o calzas dentales: Desde Q260 hasta Q460 dependiendo del tamaño.
- Extracción dental simple: Q305.
- Blanqueamiento dental: Q915.

# Descripción de Tratamientos
- Consulta y diagnóstico general: Consiste en una revisión completa de la boca para detectar caries, evaluar encías y elaborar un plan de tratamiento.
- Limpieza dental profesional: Es un procedimiento que elimina la placa bacteriana y el sarro acumulado sobre los dientes para prevenir enfermedades de las encías.
- Resinas o calzas dentales: Consiste en remover la caries y rellenar la cavidad con un material del mismo color del diente para devolverle su función y estética.
- Extracción dental simple: Es la remoción de un diente dañado o no restaurable mediante anestesia local y técnicas no quirúrgicas.
- Blanqueamiento dental: Es un tratamiento estético que aplica un gel especial aclarante para reducir tonalidades amarillas o manchas en el esmalte dental.

# Protocolo de Agendamiento
- Para agendar una cita, debes solicitar siempre: Nombre completo del paciente, servicio requerido, fecha y hora deseada.
- Regla de Cita Única: Solo está permitido agendar una cita por persona por día. Si el usuario intenta agendar una segunda cita el mismo día, infórmale amablemente que ya cuenta con un espacio reservado.
- Antes de confirmar cualquier cita, verifica la disponibilidad usando las herramientas del sistema.
- Si la hora solicitada no está disponible o está fuera del horario de atención, ofrece amablemente opciones dentro del horario permitido.

# Políticas de Cancelación
- Las citas se pueden reprogramar o cancelar con al menos 2 horas de anticipación sin ningún costo.

# Manejo de Situaciones Críticas
- En caso de dolor severo, sangrado incontrolable o trauma dental grave por un accidente, indica al paciente que acuda de inmediato a emergencias médicas o a la clínica dentro del horario laboral.
`;

// Definición de las herramientas (Tools / Function Calling) para Gemini
const calendarTools = [{
  functionDeclarations: [
    {
      name: 'checkAvailability',
      description: 'Verifica la disponibilidad de horarios en Google Calendar dentro del horario de la clínica.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          startDateTime: {
            type: Type.STRING,
            description: 'Fecha y hora de inicio de la cita en formato ISO 8601 (ej. 2026-09-10T10:00:00)'
          },
          endDateTime: {
            type: Type.STRING,
            description: 'Fecha y hora de fin de la cita en formato ISO 8601 (ej. 2026-09-10T11:00:00)'
          }
        },
        required: ['startDateTime', 'endDateTime']
      }
    },
    {
      name: 'createAppointment',
      description: 'Crea y agenda una nueva cita dental en Google Calendar tras validar disponibilidad y reglas.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          patientName: {
            type: Type.STRING,
            description: 'Nombre completo del paciente'
          },
          service: {
            type: Type.STRING,
            description: 'Nombre del servicio dental solicitado'
          },
          startDateTime: {
            type: Type.STRING,
            description: 'Fecha y hora de inicio en formato ISO 8601 (ej. 2026-09-10T10:00:00)'
          },
          durationMinutes: {
            type: Type.NUMBER,
            description: 'Duración estimada en minutos (por defecto 60)'
          }
        },
        required: ['patientName', 'service', 'startDateTime']
      }
    },
    {
      name: 'deleteAppointment',
      description: 'Elimina o cancela una cita existente de Google Calendar por el ID del evento.',
      parameters: {
        type: Type.OBJECT,
        properties: {
          eventId: {
            type: Type.STRING,
            description: 'El ID único de la cita en Google Calendar'
          }
        },
        required: ['eventId']
      }
    }
  ]
}];

// Mapeo local de funciones ejecutables
const functionsMap = {
  checkAvailability: async (args) => await checkAvailability(args.startDateTime, args.endDateTime),
  createAppointment: async (args) => await createAppointment(args),
  deleteAppointment: async (args) => await deleteAppointment(args.eventId)
};

// Endpoint principal para el Chat de Voz / Texto
app.post('/api/chat', async (req, res) => {
  try {
    const { message, history = [] } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'El mensaje del usuario es requerido' });
    }

    // Adaptar historial al formato esperado por el SDK
    const contents = [...history, { role: 'user', parts: [{ text: message }] }];

    // Llamada inicial con el SDK oficial @google/genai
    let response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: contents,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: calendarTools
      }
    });

    // Procesar Function Calling si Gemini solicita ejecutar alguna herramienta
    while (response.functionCalls && response.functionCalls.length > 0) {
      const calls = response.functionCalls;
      const functionResponses = [];

      for (const call of calls) {
        const { name, args } = call;
        console.log(`[Function Call] Ejecutando función: ${name}`, args);

        if (functionsMap[name]) {
          try {
            const result = await functionsMap[name](args);
            functionResponses.push({
              functionResponse: { name, response: { output: result } }
            });
          } catch (fnError) {
            functionResponses.push({
              functionResponse: { name, response: { error: fnError.message } }
            });
          }
        }
      }

      // 1. Guardar la llamada a la función hecha por Gemini en contents
      contents.push(response.candidates[0].content);
      
      // 2. Guardar la respuesta devuelta por el servidor a Gemini con el rol explícito 'user'
      contents.push({ role: 'user', parts: functionResponses });

      // 3. Volver a consultar a Gemini con los resultados
      response = await ai.models.generateContent({
        model: 'gemini-3.6-flash',
        contents: contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          tools: calendarTools
        }
      });
    }

    // 4. Guardar la respuesta de texto final de Gemini en contents antes de devolver el historial
    if (response.candidates && response.candidates[0]?.content) {
      contents.push(response.candidates[0].content);
    }

    res.json({
      reply: response.text,
      history: contents
    });

  } catch (error) {
    console.error('Error en /api/chat:', error);
    res.status(500).json({ error: 'Ocurrió un error al procesar tu solicitud.' });
  }
});

// Endpoint de verificación de estado
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Servidor backend en ejecución' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Servidor de la Clínica Dental iniciado en http://localhost:${PORT}`);
});
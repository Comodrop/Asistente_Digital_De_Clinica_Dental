import { google } from 'googleapis';
import dotenv from 'dotenv';

dotenv.config();

// Autenticación con la Cuenta de Servicio de Google Cloud
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_CALENDAR_CREDENTIALS,
  scopes: ['https://www.googleapis.com/auth/calendar'],
});

const calendar = google.calendar({ version: 'v3', auth });
const CALENDAR_ID = process.env.CALENDAR_ID || 'primary';

/** Valida si la cita está dentro del horario laboral de la clínica
    Lunes a Viernes: 8:00 a 17:00 | Sábados: 8:00 a 12:00 | Domingos: Cerrado*/
function isWorkingHours(startTime, endTime) {
  const day = startTime.getDay(); // 0: Domingo, 1: Lunes, ..., 6: Sábado
  const startHour = startTime.getHours() + startTime.getMinutes() / 60;
  const endHour = endTime.getHours() + endTime.getMinutes() / 60;

  // Domingo no hay atención
  if (day === 0) return false;

  // Sábado: 8:00 AM a 12:00 PM
  if (day === 6) {
    return startHour >= 8 && endHour <= 12;
  }

  // Lunes a Viernes: 8:00 AM a 17:00 PM (5:00 PM)
  return startHour >= 8 && endHour <= 17;
}

// Verificar eventos en un rango de fechas/horas
export async function checkAvailability(startDateTime, endDateTime) {
  try {
    const startTime = new Date(startDateTime);
    const endTime = new Date(endDateTime);

    if (!isWorkingHours(startTime, endTime)) {
      return {
        isAvailable: false,
        reason: 'Fuera de horario laboral (L-V 8:00-17:00, Sáb 8:00-12:00, Dom cerrado).'
      };
    }

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startTime.toISOString(),
      timeMax: endTime.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const events = response.data.items || [];
    return {
      isAvailable: events.length === 0,
      conflictingEventsCount: events.length
    };
  } catch (error) {
    console.error('Error al verificar disponibilidad:', error);
    throw error;
  }
}

/*  Crear una nueva cita en Google Calendar validando horario laboral,
    traslapes de horario y duplicidad por paciente el mismo día.*/
export async function createAppointment({ patientName, service, startDateTime, durationMinutes = 60 }) {
  try {
    const startTime = new Date(startDateTime);
    const endTime = new Date(startTime.getTime() + durationMinutes * 60000);

    // 1. Validar horario laboral de la clínica
    if (!isWorkingHours(startTime, endTime)) {
      return {
        success: false,
        message: 'La fecha u hora seleccionada está fuera del horario de atención de la clínica.'
      };
    }

    // 2. Definir rango del día completo para verificar citas previas del mismo paciente
    const startOfDay = new Date(startTime);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(startTime);
    endOfDay.setHours(23, 59, 59, 999);

    const response = await calendar.events.list({
      calendarId: CALENDAR_ID,
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
    });

    const dayEvents = response.data.items || [];

    // 3. Validar si el paciente ya tiene una cita el mismo día
    const normalizedPatientName = patientName.trim().toLowerCase();
    const existingPatientAppointment = dayEvents.find(event => {
      const summary = (event.summary || '').toLowerCase();
      const description = (event.description || '').toLowerCase();
      return summary.includes(normalizedPatientName) || description.includes(normalizedPatientName);
    });

    if (existingPatientAppointment) {
      return { 
        success: false, 
        message: `El paciente ${patientName} ya tiene una cita agendada para este día.` 
      };
    }

    // 4. Validar traslapes de horario con otras citas
    const hasOverlap = dayEvents.some(event => {
      const eventStart = new Date(event.start.dateTime || event.start.date);
      const eventEnd = new Date(event.end.dateTime || event.end.date);
      return startTime < eventEnd && endTime > eventStart;
    });

    if (hasOverlap) {
      return { 
        success: false, 
        message: 'El horario seleccionado ya está ocupado por otra cita.' 
      };
    }

    // 5. Crear la cita en Google Calendar
    const event = {
      summary: `Cita Dental: ${patientName} - ${service}`,
      description: `Paciente: ${patientName}\nServicio: ${service}`,
      start: { dateTime: startTime.toISOString() },
      end: { dateTime: endTime.toISOString() },
    };

    const createdEvent = await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: event,
    });

    return {
      success: true,
      eventId: createdEvent.data.id,
      summary: createdEvent.data.summary,
      start: createdEvent.data.start.dateTime
    };
  } catch (error) {
    console.error('Error al agendar la cita:', error);
    throw error;
  }
}

// Cancelar una cita en Google Calendar por su ID de evento
export async function deleteAppointment(eventId) {
  try {
    await calendar.events.delete({
      calendarId: CALENDAR_ID,
      eventId: eventId,
    });
    return { success: true, message: 'Cita cancelada exitosamente.' };
  } catch (error) {
    console.error('Error al cancelar la cita:', error);
    throw error;
  }
}
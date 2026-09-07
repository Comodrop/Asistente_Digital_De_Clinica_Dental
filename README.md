# Asistente_Digital_De_Clinica_Dental
Software diseñado para automatizar la atención a pacientes de Clínicas Dentales. Este asistente trabaja las 24 horas del día para garantizar una comunicación fluida y reducir la carga administrativa del personal.

__¿Que puede hacer este proyecto?__ 
* Brindar Información de la Clínica
* Ofrecer Servicios y Precios
* Agendar Citas (Al correo personal seleccionado)
* Cancelar Citas (En correo personal seleccionado)
* Manejar de Situaciones Críticas (Dar una recomendación)

Todos los datos brindados anteriormente pueden ser modificados según las necesidades.

# Configurar dependencias e inicializar el servidor
Abre la terminal en la raíz del proyecto, navega a la carpeta Backend y ejecuta los siguientes comandos para instalar los paquetes necesarios (@google/genai para Gemini, googleapis para Calendar, express, dotenv y cors):
* cd Backend
* npm init -y
* npm install express dotenv cors googleapis @google/genai

Abre el archivo Backend/package.json en tu editor.
Cambia la línea "type": "commonjs" por: 

* "type": "module"

Guarda el archivo.

# Crear una variable de entorno .env
En la raíz de la carpeta Backend crear un archivo con el nombre: **.env** Luego ubicarse en Backend/.env y escribir:
* PORT=3000
* GEMINI_API_KEY=Aquí_colocar_tu_api_key_de_gemini
* GOOGLE_CALENDAR_CREDENTIALS=credentials.json
* CALENDAR_ID=primary

# APIs necesarias (Google Cloud / Calendar y Gemini)
Paso 1: Obtener la API Key gratuita de Gemini
* Entra a [Google AI Studio](https://aistudio.google.com/)
* Inicia sesión con tu cuenta de Google.
* Haz clic en Get API key y luego en Create API key.
* Copia la clave generada y pégala en tu archivo Backend/.env:
* GEMINI_API_KEY=Aquí_colocar_tu_api_key_de_gemini

Paso 2: Crear el proyecto y habilitar Google Calendar en Google Cloud
* Ve a la [Consola de Google Cloud](https://console.cloud.google.com/).
* Abre el selector de Proyectos "Ctrl+o" (por ejemplo: Clinica-Dental-Voicebot).
* En el menú lateral, ve a APIs y servicios > Biblioteca.
* Busca Google Calendar API y haz clic en Habilitar.

Paso 3: Crear la Cuenta de Servicio (Service Account) y descargar credenciales
* En la consola de Google Cloud, ve a APIs y servicios > Credenciales.
* Haz clic en Crear credenciales y selecciona Cuenta de servicio.
* Ponle un nombre (ej. calendar-bot) y presiona Crear y continuar > Listo.
* Haz clic sobre la cuenta de servicio recién creada, ve a la pestaña Claves (Keys).
* Haz clic en Agregar clave > Crear clave nueva > Selecciona JSON y descarga el archivo.
* Renombra ese archivo descargado como "credentials.json" y muévelo dentro de tu carpeta Backend/.

Paso 4: Compartir tu calendario de Google con la cuenta de servicio
* Abre el archivo "credentials.json" y copia la dirección que está en el campo "client_email" (tiene un formato parecido a calendar-bot@tu-proyecto.iam.gserviceaccount.com).
* Ve a [Google Calendar](https://calendar.google.com/).
* En la columna izquierda, busca el calendario que usarás (o usa tu calendario principal), pasa el cursor sobre él, haz clic en los 3 puntos y selecciona Configuración y privacidad.
* Ve a la sección Compartir con determinadas personas o grupos y haz clic en Añadir personas.
* Pega el correo de la cuenta de servicio que copiaste y asígnale el permiso Realizar cambios y gestionar el uso compartido.
* Copia el ID del calendario (se encuentra más abajo en esa misma página de configuración; si es tu calendario principal, la ID suele ser tu correo personal o primary).
* Actualiza tu archivo Backend/.env:
* CALENDAR_ID=Aquí_tu_id_de_calendario@group.calendar.google.com 

# Ejecutar el Servidor
Para que la interfaz ejecute las instrucciones se debe de inicializar el servidor. En el cmd ubicarse en la ruta __Backend/server.js__ y ejecutar el comando:
>node server.js

Opcional podemos verificar que el Backend responde correctamente con este comando:
>curl -X POST http://localhost:3000/api/chat -H "Content-Type: application/json" -d "{\"message\": \"¿Qué servicios ofrecen y cuáles son sus precios?\"}"


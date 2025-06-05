const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const app = express();
const port = 3001; // API de Tareas escucha en el puerto 3001

app.use(bodyParser.json());

// Configuración de AWS SDK
AWS.config.update({ region: 'us-east-1' }); // Asegúrate de que esta región coincida con la de tu cola SQS
const sqs = new AWS.SQS();

// Datos de ejemplo para tareas
let tareas = [
  { id: 1, titulo: 'Planificación de Módulos', descripcion: 'Definir el alcance de los módulos del e-learning.', idProyecto: 1, completada: false },
  { id: 2, titulo: 'Desarrollo Frontend Login', descripcion: 'Implementar la interfaz de usuario para el inicio de sesión.', idProyecto: 1, completada: false },
  { id: 3, titulo: 'Investigación de APIs de Pago', descripcion: 'Evaluar opciones de pasarelas de pago (Stripe, PayPal).', idProyecto: 2, completada: true }
];

// ID inicial para nuevas tareas, comienza después del ID más alto de los datos de ejemplo
let tareaId = 4;

// Ruta GET /tareas: Devuelve todas las tareas (incluyendo las de ejemplo)
app.get('/tareas', (req, res) => {
  res.json(tareas);
});

// Ruta POST /tareas: Crea una nueva tarea (puede ser usada directamente o por SQS)
app.post('/tareas', (req, res) => {
  const nueva = { id: tareaId++, ...req.body };
  tareas.push(nueva);
  res.status(201).json(nueva);
});

// Ruta PUT /tareas/:id: Actualiza una tarea existente
app.put('/tareas/:id', (req, res) => {
  const idx = tareas.findIndex(t => t.id == req.params.id);
  if (idx === -1) return res.sendStatus(404);
  tareas[idx] = { ...tareas[idx], ...req.body };
  res.json(tareas[idx]);
});

// Ruta DELETE /tareas/:id: Elimina una tarea
app.delete('/tareas/:id', (req, res) => {
  tareas = tareas.filter(t => t.id != req.params.id);
  res.sendStatus(204);
});

// MQ Receiver: Leer mensajes de la cola SQS cada 10 segundos
setInterval(async () => {
  const params = {
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/472513086006/tareas-queue', // URL de tu cola SQS
    MaxNumberOfMessages: 1, // Leer un mensaje a la vez
    WaitTimeSeconds: 5 // Esperar hasta 5 segundos si no hay mensajes (Long Polling)
  };

  try {
    const data = await sqs.receiveMessage(params).promise();

    if (data.Messages && data.Messages.length > 0) {
      const msg = JSON.parse(data.Messages[0].Body);
      console.log('Mensaje recibido de SQS:', msg);

      if (msg.action === 'create') {
        const nueva = { id: tareaId++, ...msg.payload };
        tareas.push(nueva);
        console.log('Tarea creada desde SQS:', nueva);
      }
      // Aquí podrías añadir más lógica para otras acciones (ej. 'update', 'delete')

      // Eliminar el mensaje de la cola una vez procesado
      await sqs.deleteMessage({
        QueueUrl: params.QueueUrl,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      }).promise();
      console.log('Mensaje de SQS eliminado de la cola.');
    }
  } catch (error) {
    console.error('Error al recibir o procesar mensaje de SQS:', error);
  }
}, 10000); // Intervalo de 10 segundos

// Inicia el servidor
app.listen(port, () => console.log(`API Tareas escuchando en puerto ${port}`));
const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const app = express();
const port = 3001; 

app.use(bodyParser.json());

AWS.config.update({ region: 'us-east-1' }); 
const sqs = new AWS.SQS();


let tareas = [
  { id: 1, titulo: 'Planificación de Módulos', descripcion: 'Definir el alcance de los módulos del e-learning.', idProyecto: 1, completada: false },
  { id: 2, titulo: 'Desarrollo Frontend Login', descripcion: 'Implementar la interfaz de usuario para el inicio de sesión.', idProyecto: 1, completada: false },
  { id: 3, titulo: 'Investigación de APIs de Pago', descripcion: 'Evaluar opciones de pasarelas de pago (Stripe, PayPal).', idProyecto: 2, completada: true }
];

let tareaId = 4;


app.get('/tareas', (req, res) => {
  res.json(tareas);
});

app.post('/tareas', (req, res) => {
  const nueva = { id: tareaId++, ...req.body };
  tareas.push(nueva);
  res.status(201).json(nueva);
});

app.put('/tareas/:id', (req, res) => {
  const idx = tareas.findIndex(t => t.id == req.params.id);
  if (idx === -1) return res.sendStatus(404);
  tareas[idx] = { ...tareas[idx], ...req.body };
  res.json(tareas[idx]);
});

app.delete('/tareas/:id', (req, res) => {
  tareas = tareas.filter(t => t.id != req.params.id);
  res.sendStatus(204);
});

setInterval(async () => {
  const params = {
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/472513086006/tareas-queue', 
    MaxNumberOfMessages: 1, 
    WaitTimeSeconds: 5 
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

      await sqs.deleteMessage({
        QueueUrl: params.QueueUrl,
        ReceiptHandle: data.Messages[0].ReceiptHandle
      }).promise();
      console.log('Mensaje de SQS eliminado de la cola.');
    }
  } catch (error) {
    console.error('Error al recibir o procesar mensaje de SQS:', error);
  }
}, 10000); 

app.listen(port, () => console.log(`API Tareas escuchando en puerto ${port}`));
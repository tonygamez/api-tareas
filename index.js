const express = require('express');
const AWS = require('aws-sdk');
const bodyParser = require('body-parser');
const app = express();
const port = 3001;

app.use(bodyParser.json());

AWS.config.update({ region: 'us-east-1' });
const sqs = new AWS.SQS();

let tareas = [];
let tareaId = 1;

app.get('/tareas', (req, res) => res.json(tareas));

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

// MQ Receiver - leer SQS cada 10 segundos
setInterval(async () => {
  const params = {
    QueueUrl: 'https://sqs.us-east-1.amazonaws.com/472513086006/tareas-queue',
    MaxNumberOfMessages: 1
  };

  const data = await sqs.receiveMessage(params).promise();

  if (data.Messages && data.Messages.length > 0) {
    const msg = JSON.parse(data.Messages[0].Body);
    if (msg.action === 'create') {
      const nueva = { id: tareaId++, ...msg.payload };
      tareas.push(nueva);
    }

    // Eliminar mensaje de la cola
    await sqs.deleteMessage({
      QueueUrl: params.QueueUrl,
      ReceiptHandle: data.Messages[0].ReceiptHandle
    }).promise();
  }
}, 10000);

app.listen(port, () => console.log(`API Tareas escuchando en puerto ${port}`));

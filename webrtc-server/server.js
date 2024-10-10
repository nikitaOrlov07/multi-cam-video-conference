const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let latestFrame = null;

app.post('/stream', express.raw({ type: 'image/jpeg', limit: '10mb' }), (req, res) => {
    latestFrame = req.body;
    res.sendStatus(200);
});

wss.on('connection', (ws) => {
    console.log('WebRTC client connected');

    const sendFrame = () => {
        if (latestFrame) {
            ws.send(latestFrame);
        }
        setTimeout(sendFrame, 1000 / 30);  // 30 FPS
    };

    sendFrame();
});

server.listen(8080, () => {
    console.log('WebRTC server running on http://localhost:8080');
});
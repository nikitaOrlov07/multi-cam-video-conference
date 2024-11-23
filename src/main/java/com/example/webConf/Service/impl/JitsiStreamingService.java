package com.example.webConf.Service.impl;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.Base64;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class JitsiStreamingService extends TextWebSocketHandler {
    private static final Logger logger = LoggerFactory.getLogger(JitsiStreamingService.class);

    private final List<WebSocketSession> sessions = new CopyOnWriteArrayList<>();

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        sessions.add(session);
        logger.info("New WebSocket connection established: {}", session.getId());
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, org.springframework.web.socket.CloseStatus status) throws Exception {
        sessions.remove(session);
        logger.info("WebSocket connection closed: {}", session.getId());
    }

    public void sendVideoStream(byte[] frameBytes) {
        if (frameBytes == null || frameBytes.length == 0) {
            logger.warn("Attempt to send empty frame");
            return;
        }

        String base64Frame = Base64.getEncoder().encodeToString(frameBytes);
        TextMessage message = new TextMessage(base64Frame);

        sessions.forEach(session -> {
            try {
                if (session.isOpen()) {
                    session.sendMessage(message);
                }
            } catch (IOException e) {
                logger.error("Error sending video frame to session {}: {}", session.getId(), e.getMessage());
            }
        });
    }

    public void broadcastMessage(String message) {
        TextMessage textMessage = new TextMessage(message);
        sessions.forEach(session -> {
            try {
                if (session.isOpen()) {
                    session.sendMessage(textMessage);
                }
            } catch (IOException e) {
                logger.error("Error broadcasting message to session {}: {}", session.getId(), e.getMessage());
            }
        });
    }

    public int getConnectedClientsCount() {
        return sessions.size();
    }
}
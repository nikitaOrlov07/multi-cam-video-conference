package com.example.webConf.config.message;

import com.example.webConf.model.chat.Message;
import com.example.webConf.service.UserEntityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageSendingOperations;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

@Component
@Slf4j
@RequiredArgsConstructor
public class WebSocketEventListener {

    private final SimpMessageSendingOperations messagingTemplate;

    @Autowired
    private final UserEntityService userEntityService;

    @EventListener
    public void handleWebSocketDisconnectListener(SessionDisconnectEvent event) {
        StompHeaderAccessor headerAccessor = StompHeaderAccessor.wrap(event.getMessage());
        String email = (String) headerAccessor.getSessionAttributes().get("email");
        if (email != null && !email.isEmpty()) {
            userEntityService.findByEmail(email).ifPresent(user -> {
                log.info("user disconnected: {}", email);
                var message = Message.builder()
                        .type(MessageType.LEAVE)
                        .author(user.getName() + " " + user.getSurname())
                        .build();
                messagingTemplate.convertAndSend("/topic/public", message);
            });
        }
    }
}
package com.example.webConf.controller;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.config.exception.ChatException;
import com.example.webConf.config.message.DeleteMessageRequest;
import com.example.webConf.config.message.MessageType;
import com.example.webConf.dto.message.MessageView;
import com.example.webConf.mappers.ConferenceMapper;
import com.example.webConf.mappers.MessageMapper;
import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.chat.Message;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.ChatRepository;
import com.example.webConf.repository.UserEntityRepository;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.ChatService;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.MessageService;
import com.example.webConf.service.UserEntityService;
import com.example.webConf.service.impl.EncoderService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.handler.annotation.DestinationVariable;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.handler.annotation.SendTo;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;

import java.security.Principal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Controller
public class ChatController {
    private final ConferenceService conferenceService;
    private final UserEntityService userService;
    private final MessageService messageService;
    private final ChatService chatService;
    private final ObjectMapper objectMapper;
    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);
    private final SimpMessagingTemplate messagingTemplate;
    private final ChatRepository chatRepository;

    @Autowired
    public ChatController(ConferenceService conferenceService, UserEntityService userService, MessageService messageService, ChatService chatService, ObjectMapper objectMapper, SimpMessagingTemplate messagingTemplate, ChatRepository chatRepository) {
        this.conferenceService = conferenceService;
        this.userService = userService;
        this.messageService = messageService;
        this.chatService = chatService;
        this.objectMapper = objectMapper;
        this.messagingTemplate = messagingTemplate;
        this.chatRepository = chatRepository;
    }

    // find existing chat or create new beetween two people for "home-page"
    @GetMapping("/chat/findOrCreate/{secondId}")
    public String findOrCreateChat(@PathVariable("secondId") Long secondId) {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("User not found"));
        UserEntity secondUser = userService.findById(secondId).orElseThrow(() -> new AuthException("User not found"));

        Chat chat = chatService.findOrCreateChat(currentUser, secondUser);
        return "redirect:/chat/" + chat.getId();
    }


    @GetMapping("/chat/{chatId}")
    public String getChat(@PathVariable("chatId") Long chatId, Model model) throws JsonProcessingException {
        Chat chat = chatService.findById(chatId).orElseThrow(() -> new ChatException("Chat not found"));
        List<Message> messages = messageService.findAllChatMessage(chatId);
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("User not found"));
        if (SecurityUtil.getSessionUserEmail() == null || SecurityUtil.getSessionUserEmail().isEmpty() || (!chat.getParticipants().contains(currentUser))) {
            return "redirect:/home";
        }

        model.addAttribute("messages", messages);
        model.addAttribute("messagesJson", objectMapper.writeValueAsString(messages));
        model.addAttribute("user", currentUser);
        model.addAttribute("participants", chat.getParticipants().remove(currentUser));
        model.addAttribute("chat", chat);
        return "chat";
    }

    @MessageMapping("/chat/{chatId}/sendMessage")
    @SendTo("/topic/chat/{chatId}")
    public Message sendMessage(@DestinationVariable Long chatId, @Payload Message message,
                               SimpMessageHeaderAccessor headerAccessor) {
        String email = SecurityUtil.getSessionUserEmail(headerAccessor.getUser());
        UserEntity user = null;
        if (email == null || email.isEmpty()) {
            // It`s temporary user (from conference chat)
            user = userService.findUserByUsername(message.getAuthor()).orElse(null);
        } else {
            // it`s Permanent user
            user = userService.findByEmail(email).orElse(null);
        }
        if (user == null) {
            throw new AuthException("User not found");
        }

        logger.info("Sending message" + headerAccessor.getUser());

        message.setUser(user);
        message.setPubDate(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        messageService.saveMessage(message, chatId, user);

        return message;
    }

    @MessageMapping("/chat/{chatId}/addUser")
    @SendTo("/topic/chat/{chatId}")
    @Transactional
    public MessageView addUser(@DestinationVariable Long chatId,
                               @Payload MessageView messageView,
                               SimpMessageHeaderAccessor headerAccessor) {

        Chat chat = chatService.findById(chatId).orElseThrow(() -> new ChatException("Chat not found"));
        UserEntity currentUser = null;
        Message message = MessageMapper.getMessageFromMessageView(messageView);

        if (chat.getConference() != null) { // if it is conference chat -> look user by userName
            currentUser = userService.findUserByUsername(message.getAuthor()).orElse(null);
        } else {
            currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail(headerAccessor.getUser())).orElse(null);
        }
        if (currentUser == null) {
            throw new AuthException("User not found");
        }

        String author = message.getAuthor();

        Conference conference = conferenceService.findConferenceByChat(chat);

        // Check if the user is already in the chat
        if (conference == null && !chat.getParticipants().contains(currentUser)) {
            if (!messageView.isInvitation()) {
                Optional<UserEntity> otherUser = userService.findById(
                        chat.getParticipants().stream()
                                .filter(u -> !u.getEmail().equals(author) && !u.getUserName().equals(author))
                                .findFirst()
                                .orElseThrow()
                                .getId()
                );

                chat = chatService.findOrCreateChat(currentUser, otherUser.get());

                // if a new chat was created -> update id
                if (!chat.getId().equals(chatId)) {
                    message.setChat(chat);
                }

                return MessageMapper.getMessageViewFromMessage(message);
            } else {
                // User want to join to chat by invitation
                chat.addParticipant(currentUser);
                chat.addMessage(message);
                chatRepository.save(chat);
                return MessageMapper.getMessageViewFromMessage(message);
            }
        }

        return null;
    }

    @MessageMapping("/chat/{chatId}/delete")
    @SendTo("/topic/chat/{chatId}")
    public MessageView deleteChat(@DestinationVariable Long chatId, Principal principal) {
        String email = SecurityUtil.getSessionUserEmail(principal);
        UserEntity user = userService.findByEmail(email).orElseThrow(() -> new AuthException("User not found"));
        Chat chat = chatService.findById(chatId).orElseThrow();
        logger.info("Delete chat controller method is working");

        // implement "List.contains()" logic -> if i use regular contains method -> won`t working
        boolean userInChat = chat.getParticipants().stream()
                .anyMatch(participant -> participant.getId().equals(user.getId()));

        boolean chatInUserChats = user.getChats().stream()
                .anyMatch(userChat -> userChat.getId().equals(chat.getId()));

        if (chat != null && userInChat && chatInUserChats) {
            chatService.delete(chat);
            logger.info("Chat was deleted successfully");
            return MessageView.builder()
                    .type(MessageType.CHAT_DELETED)
                    .author(email)
                    .text("Chat deleted")
                    .build();
        } else {
            logger.warn("Error deleting chat. User in chat: {}, Chat in user chats: {}", userInChat, chatInUserChats);
            return null;
        }
    }

    @MessageMapping("/chat/{chatId}/deleteMessage")
    @SendTo("/topic/chat/{chatId}")
    @Transactional
    public MessageView deleteMessage(@DestinationVariable Long chatId, @Payload DeleteMessageRequest request, SimpMessageHeaderAccessor headerAccessor) {
        UserEntity user = userService.findByEmail(SecurityUtil.getSessionUserEmail(headerAccessor.getUser())).orElseThrow(() -> new AuthException("User not found"));
        Message message = messageService.findById(request.getMessageId()).orElseThrow(() -> new ChatException("Message not found"));
        Chat chat = chatService.findById(chatId).orElseThrow(() -> new ChatException("Chat not found"));
        if (message != null && chat != null && message.getUser().equals(user)) {
            messageService.deleteMessage(message, chat);
            logger.info("Message deleted successfully");
            if (user.getEmail() != null && !user.getEmail().isEmpty()) {
                return MessageView.builder() // for permanent users
                        .type(MessageType.DELETE)
                        .author(user.getEmail())
                        .id(request.getMessageId())
                        .text(request.getMessageId().toString())
                        .build();
            } else {
                return MessageView.builder() // for temporary users
                        .type(MessageType.DELETE)
                        .author(user.getSurname())
                        .id(request.getMessageId())
                        .text(request.getMessageId().toString())
                        .build();
            }

        } else {
            logger.warn("Could not delete message. User mismatch or message/chat not found.");
            return null;
        }
    }


    @MessageMapping("/chat/{chatId}/clear")
    @SendTo("/topic/chat/{chatId}")
    public MessageView clearChat(@DestinationVariable Long chatId,
                                 SimpMessageHeaderAccessor headerAccessor) {
        String email = SecurityUtil.getSessionUserEmail(headerAccessor.getUser());
        UserEntity currentUser = userService.findByEmail(email).orElseThrow(() -> new AuthException("User not found"));
        Chat chat = chatService.findById(chatId).orElseThrow();
        Conference conference = conferenceService.findConferenceByChat(chat);

        // implement "List.contains()" logic -> if i use regular contains method -> won`t working
        boolean userInChat = chat.getParticipants().stream()
                .anyMatch(participant -> participant.getId().equals(currentUser.getId()));

        boolean chatInUserChats = currentUser.getChats().stream()
                .anyMatch(userChat -> userChat.getId().equals(chat.getId()));

        boolean userInProject = false;
        if (conference != null) {
            userInProject = conference.getUsers().stream()
                    .anyMatch(user -> user.getId().equals(currentUser.getId()));

        }

        logger.info("Chat clearing controller method is working");

        if (chat != null && ((chatInUserChats && userInChat) || (conference != null && userInProject))) {
            chatService.clearMessages(chat);
            return MessageView.builder()
                    .type(MessageType.CLEAR)
                    .author("")
                    .text("Chat was cleared")
                    .build();
        }


        logger.warn("Chat clearing failed");
        return null;
    }

    /// Invitations
    @PostMapping("/chat/invitation/{type}/{userId}/{id}")
    public ResponseEntity<?> sendInvitation(@PathVariable Long userId,
                                            @PathVariable String id,
                                            @PathVariable String type) {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail())
                .orElseThrow(() -> new AuthException("User not found"));
        UserEntity sendToUser = userService.findById(userId)
                .orElseThrow(() -> new AuthException("User not found"));

        logger.info("Sending invitation to user {} from user {} with {}: {}", sendToUser.getId(), currentUser.getId(), type, id);

        Chat chat = chatService.findOrCreateChat(currentUser, sendToUser);
        MessageType messageType = type.equals("conference") ? MessageType.CONFERENCE_INVITATION : MessageType.CHAT_INVITATION;
        Message message = Message.builder()
                .text(id)
                .author(currentUser.getName() + " " + currentUser.getSurname())
                .user(currentUser)
                .type(messageType)
                .pubDate(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")))
                .chat(chat)
                .build();

        messageService.saveMessage(message, chat.getId(), currentUser);

        // Send the message through WebSocket
        messagingTemplate.convertAndSendToUser(
                sendToUser.getEmail(),
                "/topic/chat/" + chat.getId(),
                message);

        return ResponseEntity.ok("Successfully sent invitation");
    }

    /// Getting User Chats for refreshing "Chat section" on initial page
    @GetMapping("/chat/getUserChats")
    public ResponseEntity<List<Chat>> getChats() {
        Optional<UserEntity> user = userService.findByEmail(SecurityUtil.getSessionUserEmail());
        return user.map(userEntity -> ResponseEntity.ok(chatService.findAllByParticipant(userEntity))).orElseGet(() -> ResponseEntity.ok(Collections.emptyList()));

    }

    /// Create new chat
    @PostMapping("/chat/create")
    public ResponseEntity<?> createChat() {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("User not found"));
        // User can have only one single chat (for saving resources)
        List<Chat> singleChats = currentUser.getChats().stream().filter(chat -> chat.getType().equals(Chat.ChatType.SINGLE)).toList();
        if (singleChats.size() >= 2) {
            throw new ChatException("You can have only one single chat");
        }
        Chat chat = new Chat();
        chat.setParticipants(Collections.singletonList(currentUser));
        chat = chatRepository.save(chat);
        return ResponseEntity.ok(chat.getId());
    }
}
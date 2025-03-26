package com.example.webConf.controller;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.config.exception.ChatException;
import com.example.webConf.config.exception.ConferenceException;
import com.example.webConf.config.message.DeleteMessageRequest;
import com.example.webConf.config.message.MessageType;
import com.example.webConf.model.Chat.Chat;
import com.example.webConf.model.Chat.Message;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.ChatService;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.MessageService;
import com.example.webConf.service.UserEntityService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import jakarta.transaction.Transactional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
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

import java.security.Principal;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

@Controller
public class ChatController {
    private final ConferenceService conferenceService;
    private final UserEntityService userService;
    private final MessageService messageService;
    private final ChatService chatService;
    private final ObjectMapper objectMapper;
    private static final Logger logger = LoggerFactory.getLogger(ChatController.class);

    @Autowired
    public ChatController(ConferenceService conferenceService, UserEntityService userService, MessageService messageService, ChatService chatService , ObjectMapper objectMapper) {
        this.conferenceService = conferenceService;
        this.userService = userService;
        this.messageService = messageService;
        this.chatService = chatService;
        this.objectMapper = objectMapper;
    }

    // find existing chat or create new beetween two people for "home-page"
    @GetMapping("/chat/findOrCreate/{secondId}")
    public String findOrCreateChat(@PathVariable("secondId") Long secondId) {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).get();
        UserEntity secondUser = userService.findById(secondId).get();

        Chat chat = chatService.findOrCreateChat(currentUser, secondUser);
        return "redirect:/chat/" + chat.getId();
    }

    @GetMapping("/conference/{conferenceId}/chat/{chatId}")
    public String getChat(@PathVariable("chatId") Long chatId,
                          Model model,
                          @PathVariable("conferenceId") String conferenceId) throws JsonProcessingException {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).get();
        Conference conference = conferenceService.findById(conferenceId).orElseThrow(() -> new ConferenceException("Conference not found"));
        List<Message> messages = conference.getChat().getMessages();

        if (SecurityUtil.getSessionUserEmail() == null || SecurityUtil.getSessionUserEmail().isEmpty() || (!conference.getUsers().contains(currentUser))) {
            return "redirect:/home";
        }

        model.addAttribute("messages", messages);
        model.addAttribute("messagesJson", new ObjectMapper().writeValueAsString(messages));
        model.addAttribute("chat",conference.getChat());
        model.addAttribute("user", currentUser);
        return "chat";
    }

    @GetMapping("/chat/{chatId}")
    public String getChat(@PathVariable("chatId") Long chatId, Model model) throws JsonProcessingException {
        Chat chat = chatService.findById(chatId).get();
        List<Message> messages = messageService.findAllChatMessage(chatId);
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).get();
        if (SecurityUtil.getSessionUserEmail() == null || SecurityUtil.getSessionUserEmail().isEmpty() || (!chat.getParticipants().contains(currentUser))) {
            return "redirect:/home";
        }

        model.addAttribute("messages", messages);
        model.addAttribute("messagesJson", objectMapper.writeValueAsString(messages));
        model.addAttribute("user", currentUser);
        model.addAttribute("participants", chat.getParticipants().remove(currentUser));
        model.addAttribute("chat",chat);
        return "chat";
    }

    @MessageMapping("/chat/{chatId}/sendMessage")
    @SendTo("/topic/chat/{chatId}")
    public Message sendMessage(@DestinationVariable Long chatId, @Payload Message message,
                               SimpMessageHeaderAccessor headerAccessor) {
        String email = SecurityUtil.getSessionUserEmail(headerAccessor.getUser());
        if (email == null) {
            throw new IllegalStateException("User not authenticated");
        }

        logger.info("Sending message" + headerAccessor.getUser());
        UserEntity user = userService.findByEmail(email).orElseThrow(() -> new AuthException("User not found"));

        message.setUser(user);
        message.setPubDate(LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));

        messageService.saveMessage(message, chatId, user);

        return message;
    }

    @MessageMapping("/chat/{chatId}/addUser")
    @SendTo("/topic/chat/{chatId}")
    public Message addUser(@DestinationVariable Long chatId, @Payload Message message ,
                           SimpMessageHeaderAccessor headerAccessor) {
        String email = message.getAuthor(); // * message.getAuthor will contain email of author
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail(headerAccessor.getUser())).orElseThrow(() -> new AuthException("User not found"));
        Chat chat = chatService.findById(chatId).orElseThrow();

        Conference project = conferenceService.findConferenceByChat(chat);

        // Check if the user is already in the chat
        if (!chat.getParticipants().contains(currentUser) && project == null) {
            Optional<UserEntity> otherUser = userService.findById(
                    chat.getParticipants().stream()
                            .filter(u -> !u.getEmail().equals(email))
                            .findFirst()
                            .orElseThrow()
                            .getId()
            );

            chat = chatService.findOrCreateChat(currentUser, otherUser.get());

            // if a new chat was created -> update id
            if (!chat.getId().equals(chatId)) {
                message.setChat(chat);
            }

            return message;
        } else {
            // user is already a member of the chat
            return null;
        }
    }

    @MessageMapping("/chat/{chatId}/delete")
    @SendTo("/topic/chat/{chatId}") // TODO -> fix
    public Message deleteChat(@DestinationVariable Long chatId, Principal principal) {
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
            return Message.builder()
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
    public Message deleteMessage(@DestinationVariable Long chatId, @Payload DeleteMessageRequest request,SimpMessageHeaderAccessor headerAccessor) {
        UserEntity user = userService.findByEmail(SecurityUtil.getSessionUserEmail(headerAccessor.getUser())).orElseThrow(() -> new AuthException("User not found"));
        Message message = messageService.findById(request.getMessageId()).orElseThrow(() -> new ChatException("Message not found"));
        Chat chat = chatService.findById(chatId).orElseThrow(() -> new ChatException("Chat not found"));
        if (message != null && chat != null && message.getUser().equals(user)) {
            messageService.deleteMessage(message, user, chat);
            logger.info("Message deleted successfully");
            if(user.getEmail() != null && !user.getEmail().isEmpty()){
                return Message.builder() // for permanent users
                        .type(MessageType.DELETE)
                        .author(user.getEmail())
                        .id(request.getMessageId())
                        .text(request.getMessageId().toString())
                        .build();
            }
            else {
                return Message.builder() // for temporary users
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
    public Message clearChat(@DestinationVariable Long chatId,
                             SimpMessageHeaderAccessor headerAccessor) {
        String email = (String) headerAccessor.getSessionAttributes().get("email");
        UserEntity currentUser = userService.findByEmail(email).get();
        Chat chat = chatService.findById(chatId).orElseThrow();
        Conference conference  = conferenceService.findConferenceByChat(chat);

        // implement "List.contains()" logic -> if i use regular contains method -> won`t working
        boolean userInChat = chat.getParticipants().stream()
                .anyMatch(participant -> participant.getId().equals(currentUser.getId()));

        boolean chatInUserChats = currentUser.getChats().stream()
                .anyMatch(userChat -> userChat.getId().equals(chat.getId()));

        boolean userInProject = false;
        if(conference != null) {
            userInProject = conference.getUsers().stream()
                    .anyMatch(user -> user.getId().equals(currentUser.getId()));

        }

        logger.info("Chat clearing controller method is working");

        if (chat != null && ((chatInUserChats && userInChat) || (conference != null && userInProject))) {
            chatService.clearMessages(chat);
            return Message.builder()
                    .type(MessageType.CLEAR)
                    .author("")
                    .text("Chat was cleared")
                    .build();
        }


        logger.warn("Chat clearing failed");
        return null;
    }
}
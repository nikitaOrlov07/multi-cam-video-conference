package com.example.webConf.service.impl;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.model.Chat.Chat;
import com.example.webConf.model.Chat.Message;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.MessageRepository;
import com.example.webConf.service.ChatService;
import com.example.webConf.service.MessageService;
import com.example.webConf.service.UserEntityService;
import jakarta.transaction.Transactional;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class MessageServiceImpl implements MessageService {

    @Autowired
    private MessageRepository messageRepository;
    @Autowired
    private UserEntityService userService;
    @Autowired
    private ChatService chatService;

    @Override
    public List<Message> findAllChatMessage(Long chaId) {
        return messageRepository.findAllByChatId(chaId);
    }

    @Override
    public Message saveMessage(Message message, Long chatId, UserEntity user) {

        Chat chat = chatService.findById(chatId).get();

        message.setChat(chat);

        if (user.getEmail() != null && !user.getEmail().isEmpty()) {
            message.setAuthor(user.getEmail());  // for permanent accounts
        } else {
            message.setAuthor(user.getSurname()); // for temporary accounts
        }

        chatService.updateChat(chat);
        return messageRepository.save(message);
    }

    @Override
    public Optional<Message> findById(Long message) {
        return messageRepository.findById(message);
    }

    @Transactional
    @Override
    public void deleteMessage(Message message, UserEntity user, Chat chat) {
        log.info("Deleting message with id {} , user {} , chat {}", message.getId(), user.getId(), chat.getId());
        user.getMessages().remove(message);
        chat.getMessages().remove(message);
        messageRepository.delete(message);
    }

    @Override
    public List<Message> findAllBySender_id(Long id) {
        UserEntity user = userService.findById(id).orElseThrow(() -> new AuthException("User not found"));
        return messageRepository.findAllByUser(user);
    }

}

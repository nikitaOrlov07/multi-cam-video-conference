package com.example.webConf.service.impl;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.chat.Message;
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
import java.util.stream.Collectors;

@Service
@Slf4j
public class MessageServiceImpl implements MessageService {

    @Autowired
    private MessageRepository messageRepository;
    @Autowired
    private UserEntityService userService;
    @Autowired
    private ChatService chatService;
    @Autowired
    private EncoderService encoderService;
    private MessageService messageService;

    @Override
    public List<Message> findAllChatMessage(Long chatId) {
        return messageRepository.findAllByChatId(chatId).stream()
                .peek(message -> message.setText(encoderService.decryptText(message.getText())))
                .collect(Collectors.toList());
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

        // Encode message
        String originalText = message.getText();
        String encodedText = encoderService.encryptText(message.getText());
        message.setText(encodedText);

        chatService.updateChat(chat);
        messageRepository.save(message);

        message.setText(originalText); // replace for displaying on page
        return message;
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

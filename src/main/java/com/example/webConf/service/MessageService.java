package com.example.webConf.service;

import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.chat.Message;
import com.example.webConf.model.user.UserEntity;
import jakarta.transaction.Transactional;

import java.util.List;
import java.util.Optional;

public interface MessageService {
    List<Message> findAllChatMessage(Long chatId);

    Message saveMessage(Message message, Long chatId, UserEntity user);

    Optional<Message> findById(Long message);

    @Transactional
    void deleteMessage(Message message, UserEntity user, Chat chat);

    List<Message> findAllBySender_id(Long id);
}

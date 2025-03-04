package com.example.webConf.service;

import com.example.webConf.model.Chat.Chat;
import com.example.webConf.model.user.UserEntity;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

public interface ChatService {
    @Transactional
    Optional<Chat> findById(Long chatId);

    void updateChat(Chat chat);

    @Transactional
    Chat findOrCreateChat(UserEntity currentUser, UserEntity secondUser);

    @Transactional
    void save(Chat chat);

    @Transactional
    void delete(Chat chat);

    List<Chat> findAllByParticipants(UserEntity deletedUser);

    @Transactional // In a @Transactional method, Hibernate automatically tracks changes to managed entities and persists them at the end of the transaction.
    void clearMessages(Chat chat);
}

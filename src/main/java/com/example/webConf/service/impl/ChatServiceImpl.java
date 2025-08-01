package com.example.webConf.service.impl;

import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.chat.Message;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.ChatRepository;
import com.example.webConf.repository.ConferenceRepository;
import com.example.webConf.service.ChatService;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.MessageService;
import com.example.webConf.service.UserEntityService;
import jakarta.persistence.EntityNotFoundException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

@Service
@Slf4j
public class ChatServiceImpl implements ChatService {
    @Autowired
    private ChatRepository chatRepository;
    @Lazy // Create a bean only when program will need it.
    @Autowired
    private UserEntityService userService;
    @Lazy
    @Autowired
    private ConferenceService courseService;
    @Lazy
    @Autowired
    private MessageService messageService;
    @Autowired
    private ConferenceService conferenceService;
    @Autowired
    private ConferenceRepository conferenceRepository;

    @Transactional
    @Override
    public Optional<Chat> findById(Long chatId) {
        return chatRepository.findById(chatId);
    }

    @Override
    public void updateChat(Chat chat) {
        chatRepository.save(chat);
    }

    @Transactional
    @Override
    public Chat findOrCreateChat(UserEntity currentUser, UserEntity secondUser) {
        // Reboot users to make sure they are in the "managed" state (not detached)
        currentUser = userService.findById(currentUser.getId()).get();
        secondUser = userService.findById(secondUser.getId()).get();

        List<Chat> existingChats = chatRepository.findByParticipantsContains(currentUser);

        for (Chat chat : existingChats) {
            if (chat.getParticipants().contains(secondUser)) {
                log.info("was returned existing chat");
                return chat;
            }
        }

        Chat newChat = new Chat();
        newChat.addParticipant(currentUser);
        newChat.addParticipant(secondUser);

        // create new chat
        chatRepository.save(newChat);
        if((currentUser.getChats().contains(newChat) && secondUser.getChats().contains(newChat)) &&  (newChat.getParticipants().contains(currentUser) && (newChat.getParticipants().contains(secondUser))))
        {
            log.info("users were added to chat participants");
        }
        else
            log.error("users were not added to chat participants");

        log.info("was returned new chat");
        return newChat;
    }

    @Transactional
    @Override
    public void save(Chat chat) {
        chatRepository.save(chat);
    }

    @Transactional
    @Override
    public void delete(Chat chat) {
        if (chat.getParticipants() != null) {
            List<UserEntity> participants = new ArrayList<>(chat.getParticipants());
            for (UserEntity user : participants) {
                if (user.getChats() != null) {
                    user.getChats().remove(chat);
                }
                chat.getParticipants().remove(user);
            }
        }

        if (chat.getMessages() != null) {
            List<Message> messagesToDelete = new ArrayList<>(chat.getMessages());
            for (Message message : messagesToDelete) {
                messageService.deleteMessage(message, message.getUser(), chat);
            }
            chat.getMessages().clear();
        }

        chatRepository.delete(chat);
    }
    @Override
    public List<Chat> findAllByParticipant(UserEntity participant) {
        return chatRepository.findByParticipantsContains(participant);
    }

    @Transactional
    @Override
    public void clearMessages(Chat chat) {
        Chat managedChat = chatRepository.findById(chat.getId())
                .orElseThrow(() -> new EntityNotFoundException("Chat not found"));

        List<Message> messages = new ArrayList<>(managedChat.getMessages());
        for (Message message : messages) {
            managedChat.getMessages().remove(message);
            messageService.deleteMessage(message,message.getUser(),chat);
        }

        managedChat.getMessages().clear();

        Conference conference = managedChat.getConference();
        if (conference != null) {
            conference.setChat(managedChat);
            conferenceRepository.save(conference);
        }
    }
}

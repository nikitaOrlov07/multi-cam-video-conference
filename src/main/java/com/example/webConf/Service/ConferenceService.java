package com.example.webConf.service;

import com.example.webConf.dto.conference.ConferenceDto;
import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.settings.SettingsEntity;
import com.example.webConf.model.user.UserEntity;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Optional;

public interface ConferenceService {
    ConferenceDto findConferenceById(String identifier);

    Optional<Conference> findById(String identifier);

    String createConference(UserEntity userEntity, String userName) throws Exception;

    List<Conference> findConferencesByUser(Long id);

    void deleteUnusedConferences();

    List<Conference> findUserActiveConferences(Long id);

    List<Conference> findAllConferences();

    Conference findConferenceByChat(Chat chat);

    Optional<SettingsEntity> findByType(String type);

    List<Conference> searchConferencesById(String id);

    ResponseEntity<Void> changePassword(String conferenceId, String password , String userName);

    void removeUserConference(String conferenceId, String userName);

    void addUser(String userName, String identifier);

    List<Conference> findUserConferences(UserEntity userEntity);
}

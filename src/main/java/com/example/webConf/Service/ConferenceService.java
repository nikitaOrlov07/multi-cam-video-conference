package com.example.webConf.service;

import com.example.webConf.dto.Conference.ConferenceDto;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;

import java.util.List;

public interface ConferenceService {
    ConferenceDto findConferenceById(String identifier);

    Conference findById(String identifier);

    String createConference(UserEntity userEntity, String userName) throws Exception;

    List<Conference> findConferencesByUser(Long id);

    void deleteUnusedConferences();

    List<Conference> findUserActiveConferences(Long id);
}

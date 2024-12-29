package com.example.webConf.Service;

import com.example.webConf.Dto.Conference.ConferenceDto;
import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.User.UserEntity;

import java.util.List;

public interface ConferenceService {
    ConferenceDto findConferenceById(String identifier);

    Conference findById(String identifier);

    String createConference(UserEntity userEntity, String userName) throws Exception;

    List<Conference> findConferencesByUser(Long id);

    void deleteUnusedConferences();
}

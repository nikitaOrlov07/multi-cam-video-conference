package com.example.webConf.Service;

import com.example.webConf.Dto.Conference.ConferenceDto;
import com.example.webConf.Model.User.UserEntity;

public interface ConferenceService {
    ConferenceDto findConferenceById(String identifier);

    String createConference(UserEntity userEntity, String userName) throws Exception;
}

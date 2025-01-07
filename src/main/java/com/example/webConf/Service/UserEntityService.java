package com.example.webConf.service;

import com.example.webConf.dto.Registration.RegistrationDto;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;

import java.util.Optional;

public interface UserEntityService {
    Boolean createUser(RegistrationDto user);

    UserEntity findByEmail(String email);

    void save(UserEntity userEntity);

    Optional<UserEntity> findUserByUsername(String userName);

    Integer countUserConferenceJoinByUserAndConference(UserEntity userEntity, Conference conference);

    void removeUserConferenceJoin(UserEntity userEntity, Conference conference);

    Optional<UserConferenceJoin> findUserConferenceJoin(UserEntity userEntity, Conference conference);

    Optional<UserEntity> findById(Long id);

    void deleteUserConferenceJoin(UserConferenceJoin userConferenceJoin);
}

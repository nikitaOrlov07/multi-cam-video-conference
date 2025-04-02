package com.example.webConf.service;

import com.example.webConf.dto.Registration.RegistrationDto;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.settings.SettingsEntity;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;

import java.util.*;

public interface UserEntityService {
    Boolean createUser(RegistrationDto user);

    Optional<UserEntity> findByEmail(String email);

    void save(UserEntity userEntity);

    Optional<UserEntity> findUserByUsername(String userName);

    Optional<UserEntity> findUserByNameAndSurname(String name, String surname);

    Integer countUserConferenceJoinByUserAndConference(UserEntity userEntity, Conference conference);

    void removeUserConferenceJoin(UserEntity userEntity, Conference conference);

    Optional<UserConferenceJoin> findUserConferenceJoin(UserEntity userEntity, Conference conference);

    Optional<UserEntity> findById(Long id);

    void deleteUserConferenceJoin(UserConferenceJoin userConferenceJoin);

    void deleteUnusedTemporaryAccounts();

    List<UserEntity> findAllUsers();

    void deleteUser(Long uuid);

    void editUser(Long uuid,RegistrationDto registrationDto);

    List<UserEntity> findUsersByUsername(String search);

    void editSettings(Map<String, String> settings);

    List<SettingsEntity> getSettings();

    List<UserConferenceJoin> findAllUserConferenceJoins(UserEntity userEntity);
}

package com.example.webConf.service.impl;

import com.example.webConf.dto.Registration.RegistrationDto;
import com.example.webConf.mappers.UserEntityMapper;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;
import com.example.webConf.repository.UserConferenceJoinRepository;
import com.example.webConf.repository.UserEntityRepository;
import com.example.webConf.service.UserEntityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

@Service
@Slf4j
public class UserEntityServiceImpl implements UserEntityService {
    private final UserEntityRepository userEntityRepository;
    private final UserEntityMapper userEntityMapper;
    private final UserConferenceJoinRepository userConderenceJoinRepository;

    @Autowired
    public UserEntityServiceImpl(UserEntityRepository userEntityRepository,
                                 UserEntityMapper userEntityMapper, UserConferenceJoinRepository userConderenceJoinRepository) {
        this.userEntityRepository = userEntityRepository;
        this.userEntityMapper = userEntityMapper;
        this.userConderenceJoinRepository = userConderenceJoinRepository;
    }

    @Override
    public Boolean createUser(RegistrationDto user) {
        log.info("Saving user service method is called");
        log.info("Name: " + user.getName());
        UserEntity savedUser = userEntityRepository.save(userEntityMapper.registrationDtoToUserEntity(user));
        return savedUser != null;
    }

    @Override
    public UserEntity findByEmail(String email) {
        if (email == null || email.isEmpty())
            return null;
        return userEntityRepository.findByEmail(email);
    }


    @Override
    public void save(UserEntity userEntity) {
        log.info("Saving user");
        userEntityRepository.save(userEntity);
    }

    @Override
    public Optional<UserEntity> findUserByUsername(String userName) {
        Optional<UserEntity> userEntity = Optional.empty();
        String decodedUsername = URLDecoder.decode(userName, StandardCharsets.UTF_8);
        String[] parts = decodedUsername.split(" "); // parts[0] = name , parts[1] = username
        if (parts.length == 1) { // for temporary user
            userEntityRepository.findByNameAndSurname(parts[0], null);
        } else { // for permanent user
            userEntity = userEntityRepository.findByNameAndSurname(parts[0], parts[1]);
        }
        return userEntity;
    }


    @Override
    public void removeUserConferenceJoin(UserEntity userEntity, Conference conference) {
        Optional<UserConferenceJoin> userConferenceJoin = userConderenceJoinRepository.findFirstByUserAndConference(userEntity, conference);
        if (userConferenceJoin.isEmpty()) {
            log.error("User-Conference Join not found, can't remove it.");
            return;
        }
        userConderenceJoinRepository.delete(userConferenceJoin.get());
    }

    @Override
    public Optional<UserConferenceJoin> findUserConferenceJoin(UserEntity userEntity, Conference conference) {
        return userConderenceJoinRepository.findFirstByUserAndConference(userEntity, conference);
    }

    @Override
    public Optional<UserEntity> findById(Long id) {
        return userEntityRepository.findById(id);
    }

    @Override
    public void deleteUserConferenceJoin(UserConferenceJoin userConferenceJoin) {
        userConderenceJoinRepository.delete(userConferenceJoin);
    }


    @Override
    public Integer countUserConferenceJoinByUserAndConference(UserEntity userEntity, Conference conference) {
        return userConderenceJoinRepository.countByUserAndConference(userEntity, conference);
    }
}

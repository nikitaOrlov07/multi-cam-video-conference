package com.example.webConf.service.impl;

import com.example.webConf.dto.registration.RegistrationDto;
import com.example.webConf.mappers.UserEntityMapper;
import com.example.webConf.model.chat.Message;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.settings.SettingsEntity;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;
import com.example.webConf.repository.ConferenceRepository;
import com.example.webConf.repository.SettingsEntityRepository;
import com.example.webConf.repository.UserConferenceJoinRepository;
import com.example.webConf.repository.UserEntityRepository;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.MessageService;
import com.example.webConf.service.UserEntityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Lazy;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
@Slf4j
public class UserEntityServiceImpl implements UserEntityService {
    private final UserEntityRepository userEntityRepository;
    private final UserEntityMapper userEntityMapper;
    private final UserConferenceJoinRepository userConderenceJoinRepository;
    private final ConferenceRepository conferenceRepository;
    private final SettingsEntityRepository settingsEntityRepository;
    private final PasswordEncoder passwordEncoder;
    private final MessageService messageService;

    @Autowired
    public UserEntityServiceImpl(UserEntityRepository userEntityRepository,
                                 UserEntityMapper userEntityMapper, UserConferenceJoinRepository userConderenceJoinRepository, ConferenceRepository conferenceRepository, SettingsEntityRepository settingsEntityRepository, PasswordEncoder passwordEncoder,
                                 @Lazy MessageService messageService) {
        this.userEntityRepository = userEntityRepository;
        this.userEntityMapper = userEntityMapper;
        this.userConderenceJoinRepository = userConderenceJoinRepository;
        this.conferenceRepository = conferenceRepository;
        this.settingsEntityRepository = settingsEntityRepository;
        this.passwordEncoder = passwordEncoder;
        this.messageService = messageService;
    }

    @Override
    public Boolean createUser(RegistrationDto user) {
        UserEntity savedUser = userEntityRepository.save(userEntityMapper.registrationDtoToUserEntity(user));
        return savedUser != null;
    }

    @Override
    public Optional<UserEntity> findByEmail(String email) {
        if (email == null || email.isEmpty())
            return Optional.empty();
        return userEntityRepository.findFirstByEmail(email);
    }


    @Override
    public void save(UserEntity userEntity) {
        log.info("Saving user");
        userEntityRepository.save(userEntity);
    }

    @Override
    public Optional<UserEntity> findUserByUsername(String userName) {
        String decodedUsername = URLDecoder.decode(userName, StandardCharsets.UTF_8);
        return userEntityRepository.findFirstByUserNameIgnoreCase(decodedUsername);
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
    @Transactional
    public void deleteUnusedTemporaryAccounts() {
        Set<UserEntity> temporaryUsers = userEntityRepository.findAllByAccountTypeAndCreatedAtOlderThan60Minutes(
                UserEntity.AccountType.TEMPORARY.toString(), LocalDateTime.now());
        if (!temporaryUsers.isEmpty()) {
            log.info("DELETE UNUSED TEMPORARY ACCOUNTS: {}", temporaryUsers.size());
        }
        for (UserEntity temporaryUser : temporaryUsers) {
            for (Conference conference : temporaryUser.getConferences()) {
                if (findUserConferenceJoin(temporaryUser, conference).isPresent()) {
                    removeUserConferenceJoin(temporaryUser, conference);
                }
                conference.getUsers().remove(temporaryUser);
            }
            userEntityRepository.delete(temporaryUser);
        }
    }

    @Override
    public List<UserEntity> findAllUsers() {
        return userEntityRepository.findAll();
    }

    @Override
    @Transactional
    public void deleteUser(Long uuid) {
        UserEntity userEntity = userEntityRepository.findById(uuid).get();
        ///  Find user conferences
        List<Conference> conferences = conferenceRepository.findAllByUsersContains(userEntity);
        for (Conference conference : conferences) {
            if (findUserConferenceJoin(userEntity, conference).isPresent()) {
                removeUserConferenceJoin(userEntity, conference);
            }
            conference.getUsers().remove(userEntity);
        }
        ///  Find user messages
        List<Message> messages = messageService.findAllBySender_id(userEntity.getId());
        for (Message message : messages) {
            messageService.deleteMessage(message, message.getChat());
        }
        userEntityRepository.delete(userEntity);
    }

    @Override
    @Transactional
    public void editUser(Long uuid, RegistrationDto registrationDto) {
        UserEntity user = userEntityRepository.findById(uuid).get();
        if (registrationDto.getSurname() != null)
            user.setSurname(registrationDto.getSurname());

        if (registrationDto.getName() != null)
            user.setName(registrationDto.getName());

        if (registrationDto.getCountry() != null)
            user.setCountry(registrationDto.getCountry());

        if(registrationDto.getCity() != null)
            user.setCity(registrationDto.getCity());

        if(registrationDto.getAddress() != null)
            user.setAddress(registrationDto.getAddress());

        if(registrationDto.getEmail() != null)
            user.setEmail(registrationDto.getEmail());

        user.setUserName(user.getName() + " " + user.getSurname());

        if (registrationDto.getPassword() != null  && !registrationDto.getPassword().trim().isEmpty())
            user.setPassword(passwordEncoder.encode(registrationDto.getPassword()));

    }

    @Override
    public List<UserEntity> findUsersByUsername(String search) {
        List<UserEntity> users = new ArrayList<>();
        String decodedUsername = URLDecoder.decode(search, StandardCharsets.UTF_8).toLowerCase();
        log.info("Searching users by search: {}", decodedUsername);
        String[] words = decodedUsername.split("\\s+");
        for (String word : words) {
            users.addAll(userEntityRepository.searchByNameOrSurname(word));
        }
        users = users.stream().distinct().collect(Collectors.toList());
        log.info("Found {} users", users.size());
        return users;
    }

    @Override
    public void editSettings(Map<String, String> settings) {
        UserEntity user = findByEmail(SecurityUtil.getSessionUserEmail()).get();
        for (Map.Entry<String, String> entry : settings.entrySet()) {
            String key = entry.getKey();
            String value = entry.getValue();
            Optional<SettingsEntity> settingsEntity = settingsEntityRepository.findById(key);
            if (settingsEntity.isPresent()) {
                log.info("Changing existing settings: {} -> {}", key, value);
                settingsEntity.get().setUserId(user.getId());
                if (user.getEmail() == null) {
                    settingsEntity.get().setEmail(user.getName() + " " + user.getSurname());
                } else {
                    settingsEntity.get().setEmail(user.getEmail());
                }
                settingsEntity.get().setValue(value);
                settingsEntityRepository.save(settingsEntity.get());
            } else {
                log.info("Creating new settings: {} -> {}", key, value);
                SettingsEntity newSettingsEntity = new SettingsEntity();
                newSettingsEntity.setUserId(user.getId());
                if (user.getEmail() == null) {
                    newSettingsEntity.setEmail(user.getName() + " " + user.getSurname());
                } else {
                    newSettingsEntity.setEmail(user.getEmail());
                }
                newSettingsEntity.setCreatedAt(LocalDateTime.now());
                newSettingsEntity.setType(key);
                newSettingsEntity.setValue(value);
                settingsEntityRepository.save(newSettingsEntity);
            }
        }
    }

    @Override
    public List<SettingsEntity> getSettings() {
        log.info("Finding settings");
        List<SettingsEntity> settings = settingsEntityRepository.findAll();
        log.info("Found settings size is {}", settings.size());
        return settings;
    }

    @Override
    public List<UserConferenceJoin> findAllUserConferenceJoins(UserEntity userEntity) {
        return userConderenceJoinRepository.findAll();
    }

    @Override
    public Optional<UserEntity> findUserByNameAndSurname(String name, String surname) {
        return userEntityRepository.findFirstByNameAndSurname(name, surname);
    }


    @Override
    public Integer countUserConferenceJoinByUserAndConference(UserEntity userEntity, Conference conference) {
        return userConderenceJoinRepository.countByUserAndConference(userEntity, conference);
    }
}

package com.example.webConf.service.impl;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.dto.Conference.ConferenceDto;
import com.example.webConf.mappers.ConferenceMapper;
import com.example.webConf.model.Chat.Chat;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;
import com.example.webConf.repository.ConferenceDeviceRepository;
import com.example.webConf.repository.ConferenceRepository;
import com.example.webConf.repository.RoleRepository;
import com.example.webConf.repository.UserEntityRepository;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.UserEntityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.management.relation.Role;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConferenceServiceImpl implements ConferenceService {
    private final ConferenceRepository conferenceRepository;
    private final UserEntityService userService;
    private final UserEntityRepository userRepository;
    private final ConferenceDeviceRepository conferenceDeviceRepository;
    private final UserEntityService userEntityService;
    private final RoleRepository roleRepository;

    @Override
    public ConferenceDto findConferenceById(String identifier) {
        Optional<Conference> conference = conferenceRepository.findById(identifier);
        return conference.map(ConferenceMapper::getConferenceDtoFromConference).orElse(null);
    }

    @Override
    public Conference findById(String identifier) {
        Optional<Conference> conference = conferenceRepository.findById(identifier);
        if (conference.isEmpty()) {
            log.error("Could not find conference");
            return null;
        }
        return conference.get();
    }

    @Override
    public String createConference(UserEntity userEntity, String userName) throws Exception {
        Conference conference = new Conference();

        /// Initial save conference into database
        Conference savedConference = conferenceRepository.save(conference);
        savedConference.setConferenceDate(LocalDate.now());

        if (userEntity != null && (userName != null || !userName.isEmpty())) {
            /// If user is registered
            log.info("User is registered");
            savedConference.getUsers().add(userEntity);
            userEntity.getConferences().add(savedConference);
            userRepository.save(userEntity);
        } else if (userName != null && !userName.isEmpty() && userEntity == null) {
            /// If user is not registered , but write his name
            //  Create temporary user profile
            log.info("User doesn`t registered , temporaryName: {}", userName);
            UserEntity temporaryUser = UserEntity.builder()
                    .surname(userName)
                    .password(null)
                    .city(null)
                    .conferences(List.of(conference))
                    .email(null)
                    .country(null)
                    .accountType(UserEntity.AccountType.TEMPORARY)
                    .roles(List.of(roleRepository.findByName("USER").orElseThrow(() -> new AuthException("User Role Not Found"))))
                    .build();

            userService.save(temporaryUser);
            savedConference.getUsers().add(temporaryUser);
        }
        Conference updatedConference = conferenceRepository.save(savedConference);
        if (!updatedConference.getId().equals(savedConference.getId())) {
            log.error("Error while saving conference");
            throw new Exception("Error while saving conference");
        }
        log.info("Successfully saved conference");
        return savedConference.getId();
    }

    @Override
    public List<Conference> findConferencesByUser(Long id) {
        log.info("Getting list of past conferences for user with id: {}", id);
        Optional<UserEntity> user = userRepository.findById(id);
        if (user.isPresent()) {
            log.info("Finding conference for user {} {}", user.get().getName(), user.get().getSurname());
            return conferenceRepository.findAllByUsersContains(user.get());
        }
        return null;
    }

    @Transactional // will automatically change database condition
    public void deleteUnusedConferences() {
        log.info("Starting deletion of unused conferences");
        LocalDate currentDate = LocalDate.now().minusDays(31);

        List<Conference> unusedConferences = conferenceRepository.findUnusedConference(currentDate);
        log.info("Found {} unused conferences", unusedConferences.size());

        if (unusedConferences.isEmpty()) {
            log.info("No unused conferences found");
            return;
        }

        try {
            for (Conference conference : unusedConferences) {
                log.info("Processing deletion for conference: {}", conference.getId());

                conference.getUsers().forEach(user ->
                        user.getConferences().remove(conference));
                conference.getUserJoins().forEach(userService::deleteUserConferenceJoin);

                conference.getUsers().clear();

                conferenceDeviceRepository.deleteAllByConference(conference);

                conferenceRepository.delete(conference);
            }

            log.info("Successfully deleted {} unused conferences", unusedConferences.size());
        } catch (Exception e) {
            log.error("Error during conference deletion", e);
            throw new RuntimeException("Failed to delete unused conferences", e);
        }
    }
    @Override
    public List<Conference> findUserActiveConferences(Long id) {
        UserEntity userEntity = userEntityService.findById(id).get();
        return userService.findUserConferenceJoin(userEntity,null).stream().map(UserConferenceJoin :: getConference).toList();
    }

    @Override
    public List<Conference> findAllConferences(){
        return conferenceRepository.findAll();
    }

    @Override
    public Conference findConferenceByChat(Chat chat) {
        return conferenceRepository.findProjectByChat(chat);
    }

}

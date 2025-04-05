package com.example.webConf.service.impl;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.config.exception.ConferenceException;
import com.example.webConf.dto.Conference.ConferenceDto;
import com.example.webConf.mappers.ConferenceMapper;
import com.example.webConf.model.Chat.Chat;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.role.RoleEntity;
import com.example.webConf.model.settings.SettingsEntity;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;
import com.example.webConf.repository.*;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.UserEntityService;
import jakarta.annotation.PostConstruct;
import jdk.jshell.spi.ExecutionControl;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

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
    private final SettingsEntityRepository settingsEntityRepository;
    private final ApplicationContext context;
    private RoleEntity adminRole;
    private RoleEntity creatorRole;

    @PostConstruct // will be called when constructor is created
    public void init() {
        this.adminRole = roleRepository.findByName("ADMIN").orElseThrow(() -> new AuthException("Role [ADMIN] not found"));
        this.creatorRole = roleRepository.findByName("CREATOR").orElseThrow(() -> new AuthException("Role [CREATOR] not found"));
    }
    @Override
    public ConferenceDto findConferenceById(String identifier) {
        Optional<Conference> conference = conferenceRepository.findById(identifier);
        return conference.map(ConferenceMapper::getConferenceDtoFromConference).orElse(null);
    }

    @Override
    public Optional<Conference> findById(String identifier) {
        return conferenceRepository.findById(identifier);
    }


    @Override
    public String createConference(UserEntity userEntity, String userName) throws Exception {
        Conference conference = new Conference();

        /// Initial save conference into database
        Conference savedConference = conferenceRepository.save(conference);
        savedConference.setConferenceDate(LocalDate.now());
        savedConference.setPassword(null);

        if (userEntity != null && (userName != null || !userName.isEmpty())) {
            /// If user is registered
            context.getBean(ConferenceServiceImpl.class).addUser(userName, conference.getId()); // for working Transactional annotation for method addUser
        } else if (userName != null && !userName.isEmpty() && userEntity == null) {
            /// If user is not registered , but write his name
            context.getBean(ConferenceServiceImpl.class).addUser(userName, conference.getId()); // for working Transactional annotation for method addUser
        }
        savedConference.setChat(Chat.builder().conference(conference).build());
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
            if(user.get().getRoles().contains(adminRole) || user.get().getRoles().contains(creatorRole))
                return conferenceRepository.findAll();
            else
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
        return userService.findAllUserConferenceJoins(userEntity).stream().map(UserConferenceJoin::getConference).toList();
    }

    @Override
    public List<Conference> findAllConferences() {
        return conferenceRepository.findAll();
    }

    @Override
    public Conference findConferenceByChat(Chat chat) {
        return conferenceRepository.findProjectByChat(chat);
    }

    /// Settings
    @Override
    public Optional<SettingsEntity> findByType(String type) {
        return settingsEntityRepository.findFirstByType(type);
    }

    @Override
    public List<Conference> searchConferencesById(String id) {
        String email = SecurityUtil.getSessionUserEmail();
        if (email == null || email.isEmpty()) {
            log.error("Unauthorized user trying to find conference by id: {}", id);
            throw new AuthException("Invalid access");
        }
        UserEntity currentUser = userService.findByEmail(email).orElseThrow(() -> new AuthException("Invalid Access"));
        List<Conference> conferences = new ArrayList<>();
        if (currentUser.getRoles().contains(roleRepository.findByName("ADMIN").orElseThrow(() -> new AuthException("ADMIN Role Not Found"))) || currentUser.getRoles().contains(roleRepository.findByName("CREATOR").orElseThrow(() -> new AuthException("CREATOR Role Not Found")))) {
            conferences = conferenceRepository.searchConferenceById(id);
            log.info("Found {} conferences by ADMIN:  {}", conferences.size(), currentUser.getEmail());
        } else {
            conferences = conferenceRepository.searchUserConferences(id, currentUser.getId());
            log.info("Found {} conferences by USER:  {}", conferences.size(), currentUser.getEmail());
        }

        return conferences;
    }

    @Override
    public ResponseEntity<Void> changePassword(String conferenceId, String password, String userName) {
        UserEntity currentUser = userService.findUserByUsername(userName).get();
        Conference conference = findById(conferenceId).orElseThrow(() -> new ConferenceException("Conference not found"));
        if (currentUser == null) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
        Optional<UserConferenceJoin> userJoinOpt = userService.findUserConferenceJoin(currentUser, conference);
        if (userJoinOpt.isPresent() && !conference.getUserJoins().contains(userJoinOpt.get())) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        log.info("Changing password for  conference: {} to {} by {}", conferenceId, password, userName);

        if(!password.trim().isEmpty())
            conference.setPassword(password);
        else
            conference.setPassword(null);

        conferenceRepository.save(conference);

        return ResponseEntity.ok().build();
    }

    @Override
    @Transactional
    public void removeUserConference(String conferenceId, String userName) {
        log.info("Removing user conference: {} for user {}", conferenceId , userName);
        Conference conference = conferenceRepository.findById(conferenceId).orElseThrow(() -> new ConferenceException("Conference not found"));
        UserEntity userEntity = userService.findUserByUsername(userName).orElseThrow(() -> new AuthException("User not found"));
        if(conference.getUsers().contains(userEntity) && userEntity.getConferences().contains(conference)) {
            System.out.println("REMOVING");
            conference.getUsers().remove(userEntity);
            userEntity.getConferences().remove(conference);
        }
    }

    @Override
    @Transactional
    public void addUser(String userName, String identifier) {
        System.out.println("AddUser UserName " + userName);
        Conference conference = conferenceRepository.findById(identifier).orElseThrow(() -> new ConferenceException("Conference not found"));
        UserEntity userEntity = userService.findUserByUsername(userName).orElse(null);
        ///  If account is permanent
        if(userEntity != null && userEntity.getAccountType().equals(UserEntity.AccountType.PERMANENT)
                && !conference.getUsers().contains(userEntity) && !userEntity.getConferences().contains(conference)) {
            log.info("User is permanent : {}" , userEntity.getId());
            conference.getUsers().add(userEntity);
            userEntity.getConferences().add(conference);
        }
        else if (userEntity == null){ ///  if account is temporary
            log.info("User doesn`t registered , temporaryName: {}", userName);
            userEntity= UserEntity.builder()
                    .surname(userName.toLowerCase())
                    .password(null)
                    .city(null)
                    .conferences(List.of(conference))
                    .email(null)
                    .country(null)
                    .userName(userName)
                    .accountType(UserEntity.AccountType.TEMPORARY)
                    .roles(List.of(roleRepository.findByName("USER").orElseThrow(() -> new AuthException("User Role Not Found"))))
                    .build();
            userRepository.save(userEntity);
        }
    }

    @Override
    public List<Conference> findUserConferences(UserEntity userEntity) {
        return conferenceRepository.findAllByUsersContains(userEntity);
    }
}

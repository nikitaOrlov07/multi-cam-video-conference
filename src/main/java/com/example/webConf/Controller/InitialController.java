package com.example.webConf.controller;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.config.exception.ChatException;
import com.example.webConf.config.exception.ConferenceException;
import com.example.webConf.config.relationship.RelationshipStatus;
import com.example.webConf.dto.devices.DeviceSelectionDTO;
import com.example.webConf.dto.relationship.UserRelationshipView;
import com.example.webConf.mappers.UserEntityMapper;
import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.user.UserRelationship;
import com.example.webConf.repository.UserRelationshipRepository;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.ChatService;
import com.example.webConf.service.ConferenceDevicesService;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.UserEntityService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.webConf.model.devices.ConferenceDevices;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.ArrayList;
import java.util.List;

@Controller
@Slf4j
@RequiredArgsConstructor
public class InitialController {

    private final ConferenceService conferenceService;
    private final ObjectMapper objectMapper;
    private final UserEntityService userService;
    private final ConferenceDevicesService conferenceDevicesService;
    private final UserRelationshipRepository userRelationshipRepository;
    private final ChatService chatService;
    private final UserEntityMapper userEntityMapper;

    @GetMapping({"/", "/home"})
    public String getHomePage(Model model) {
        String currentUserEmail = (SecurityUtil.getSessionUserEmail() != null && !SecurityUtil.getSessionUserEmail().isEmpty()) ? SecurityUtil.getSessionUserEmail() : "User is not authorized";
        UserEntity user;
        if (!currentUserEmail.equals("User is not authorized")) {
            // User is authorized
            user = userService.findByEmail(currentUserEmail).orElse(null);
            if (user != null) {
                List<Conference> conferences = conferenceService.findConferencesByUser(user.getId());
                List<Conference> userConferences = conferenceService.findUserConferences(user);
                List<Conference> activeConference = conferenceService.findUserActiveConferences(user.getId());
                log.info("Size of past conferences: {}", conferences.size());
                List<String> userConferenceIds = userConferences.stream()
                        .map(Conference::getId)
                        .toList();

                model.addAttribute("pastConferences", conferences);
                model.addAttribute("userConferenceIds", userConferenceIds);
                model.addAttribute("isAuthorized", true);
                model.addAttribute("activeConferences", activeConference);

                /// User logic
                // invitations
                List<UserEntity> invitedUsers = userRelationshipRepository.findUserRelationshipByRequester(user).stream().filter(relationship -> relationship.getStatus().equals(RelationshipStatus.PENDING)).map(UserRelationship::getRequester).toList();
                model.addAttribute("userInvitations", invitedUsers);
                log.info("User name : {}", user.getUserName());
                model.addAttribute("userName", user.getUserName());
                model.addAttribute("user", user);


                // for user section
                List<UserEntity> userWhoBlocked = userRelationshipRepository.findRequstersByAddresseeAndStatus(user, RelationshipStatus.BLOCKED);
                List<UserEntity> allUsers = userService.findAllUsers();
                allUsers.removeAll(userWhoBlocked);
                model.addAttribute("users", allUsers);

                List<UserEntity> friends = userRelationshipRepository.findAddresersByRequesterAndStatus(user, RelationshipStatus.ACCEPTED);
                model.addAttribute("friends", friends);

                // for blocked users section
                List<UserEntity> blockedUsers = userRelationshipRepository.findAddresersByRequesterAndStatus(user, RelationshipStatus.BLOCKED);
                model.addAttribute("blockedUsers", blockedUsers);

                // for invitation section
                List<UserRelationship> invitationEntities = userRelationshipRepository.findInvitationToUser(user, RelationshipStatus.PENDING);
                List<UserRelationshipView> invitaties = invitationEntities.stream().map(userEntityMapper::userRelationshipToView).toList();
                model.addAttribute("invitations", invitaties);
            }
        } else {
            // User is not authorized
            model.addAttribute("isAuthorized", false);
        }

        return "initial-page";
    }

    /// Searching users by search string
    @GetMapping({"/findUsers", "/home/findUsers"})
    public ResponseEntity<List<UserEntity>> searchUsers(@RequestParam String search,
                                                        @RequestParam(defaultValue = "false") boolean fromFriends,
                                                        @RequestParam(required = false) Long chatId) {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new AuthException("User not found"));
        List<UserEntity> usersWhoBlocksCurrentUser = userRelationshipRepository.findRequstersByAddresseeAndStatus(currentUser, RelationshipStatus.BLOCKED);
        List<UserEntity> users = new ArrayList<>(userService.findAllUsers());
        if (search != null && !search.isEmpty()) {
            users = userService.findUsersByUsername(search);
            users.removeAll(usersWhoBlocksCurrentUser);
        }

        if (chatId != null) {
            Chat chat = chatService.findById(chatId).orElseThrow(() -> new ChatException("Chat not found"));
            users.removeAll(chat.getParticipants());
            users.removeAll(usersWhoBlocksCurrentUser);
        }
        if(fromFriends){
            List<Long> friendsIds = userRelationshipRepository.findAddresersByRequesterAndStatus(currentUser,RelationshipStatus.ACCEPTED).stream().map(UserEntity::getId).toList();
            users = users.stream().filter(user -> friendsIds.contains(user.getId())).toList();
        }

        return ResponseEntity.ok(users);
    }

    @GetMapping("/setDevices")
    public String getDeviceSettingPage(@RequestParam(value = "userName", required = false) String userName,
                                       @RequestParam(value = "conferenceId", required = false) String conferenceId,
                                       Model model) {
        log.info("Initial device setting page is working");


        boolean isAuthorized = SecurityUtil.getSessionUserEmail() != null && !SecurityUtil.getSessionUserEmail().isEmpty();
        /// Check userName for uniqueness
        if (!isAuthorized && userService.findUserByUsername(userName).isPresent()) {
            throw new AuthException("User with this userName already exists");
        }
        model.addAttribute("isAuthorized", isAuthorized);
        if (userName != null && !userName.isEmpty() && (SecurityUtil.getSessionUserEmail() == null || SecurityUtil.getSessionUserEmail().isEmpty())) {
            model.addAttribute("userName", userName);
        } else if (SecurityUtil.getSessionUserEmail() != null && !SecurityUtil.getSessionUserEmail().isEmpty()) {
            UserEntity user = userService.findByEmail(SecurityUtil.getSessionUserEmail()).get();
            String nameSurname = user.getName() + " " + user.getSurname();
            model.addAttribute("userName", nameSurname);
            if (conferenceId != null) {
                model.addAttribute("conferenceId", conferenceId);
            }
            List<ConferenceDevices> devices = conferenceDevicesService.findUserDevices(nameSurname);
            log.info("Found: {} device configuration for user: {}", devices.size(), nameSurname);
            model.addAttribute("devices", devices);
        } else {
            throw new ConferenceException("Error while setting devices");
        }
        return "device-setting";
    }

    @PostMapping("/connect-devices")
    @ResponseBody
    public ResponseEntity<String> connectDevices(@RequestBody DeviceSelectionDTO deviceSelection,
                                                 @RequestParam(value = "identifier", required = false) String identifier,
                                                 @RequestParam(value = "userName", required = false) String userName,
                                                 @RequestParam(value = "configurationId", required = false) Long configurationId) {
        log.info("\"connectDevices\" controller method is working");

        // Validate conference identifier if provided
        if (identifier != null && !identifier.isEmpty()) {
            Conference existingConference = conferenceService.findById(identifier).orElseThrow(() -> new ConferenceException("Conference not found"));
            if (existingConference == null) {
                log.error("No conference found with identifier: {}", identifier);
                return ResponseEntity.badRequest().body("No conference with identifier");
            }
        }

        try {
            UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElse(null);
            Conference conference;
            String conferenceId;

            // Handle existing or new conference
            if (identifier != null && !identifier.isEmpty()) {
                conference = conferenceService.findById(identifier).orElseThrow(() -> new ConferenceException("Conference not found"));
                conferenceService.addUser(userName, identifier);
                conferenceId = identifier;
            } else {
                conferenceId = conferenceService.createConference(currentUser, userName);
                conference = conferenceService.findById(conferenceId).orElseThrow(() -> new ConferenceException("Conference not found"));
            }

            // Create and save conference new devices configuration
            ConferenceDevices devices;
            if (configurationId == null) {
                devices = ConferenceDevices.builder()
                        .conference(conference)
                        .userName(deviceSelection.getUserName())
                        .cameraConfiguration(objectMapper.writeValueAsString(deviceSelection.getCameras()))
                        .build();

                if (deviceSelection.getAudio() != null && !deviceSelection.getAudio().isEmpty() && deviceSelection.getAudio().get(0) != null && deviceSelection.getAudio().get(0).getLabel() != null) {
                    devices.setMicrophoneDeviceId(deviceSelection.getAudio().get(0).getDeviceId());
                    devices.setMicrophoneLabel(deviceSelection.getAudio().get(0).getLabel());
                }
            } else { // use already defined configuration
                ConferenceDevices existedConfiguration = conferenceDevicesService.findById(configurationId).orElseThrow(() -> new ConferenceException("Device Configuration not found"));
                devices = ConferenceDevices.builder()
                        .conference(conference)
                        .userName(existedConfiguration.getUserName())
                        .microphoneDeviceId(existedConfiguration.getMicrophoneDeviceId())
                        .microphoneLabel(existedConfiguration.getMicrophoneLabel())
                        .cameraConfiguration(existedConfiguration.getCameraConfiguration())
                        .build();

                if (existedConfiguration.getMicrophoneDeviceId() != null && existedConfiguration.getMicrophoneLabel() != null) {
                    devices.setMicrophoneDeviceId(existedConfiguration.getMicrophoneDeviceId());
                    devices.setMicrophoneLabel(existedConfiguration.getMicrophoneLabel());
                }

                log.info("Found configuration with id: {}", conferenceId);
            }
            conferenceDevicesService.save(devices);

            log.info("Devices connected and saved successfully for conference: {}", conferenceId);

            return ResponseEntity.ok(conferenceId);
        } catch (Exception e) {
            log.error("Error saving device configuration", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error saving device configuration");
        }
    }
}

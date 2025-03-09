package com.example.webConf.controller;

import com.example.webConf.config.exception.ConferenceException;
import com.example.webConf.dto.Devices.DeviceSelectionDTO;
import com.example.webConf.model.Chat.Chat;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.security.SecurityUtil;
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
import java.util.Set;

@Controller
@Slf4j
@RequiredArgsConstructor
public class ConferenceSettingsController {

    private final ConferenceService conferenceService;
    private final ObjectMapper objectMapper;
    private final UserEntityService userService;
    private final ConferenceDevicesService conferenceDevicesService;

    @GetMapping({"/", "/home"})
    public String getHomePage(Model model) {
        log.info("Home page is working");
        String currentUserEmail = (SecurityUtil.getSessionUserEmail() != null && !SecurityUtil.getSessionUserEmail().isEmpty()) ? SecurityUtil.getSessionUserEmail() : "User is not authorized";
        UserEntity user;
        if (!currentUserEmail.equals("User is not authorized")) {
            // User is authorized
            user = userService.findByEmail(currentUserEmail).get();
            if (user != null) {
                List<Conference> pastConferences = conferenceService.findConferencesByUser(user.getId());
                List<Conference> activeConference = conferenceService.findUserActiveConferences(user.getId());
                String userName = user.getName() + " " + user.getSurname();
                log.info("Size of past conferences: {}", pastConferences.size());

                user.getRoles().forEach(role -> {
                    System.out.println(role.getName());
                });

                model.addAttribute("pastConferences", pastConferences);
                model.addAttribute("isAuthorized", true);
                model.addAttribute("activeConferences", activeConference);

                log.info("User name : {}", userName);

                model.addAttribute("userName", userName);
                model.addAttribute("user", user); // for account information
                // for chats
                model.addAttribute("chats", new ArrayList<Chat>());
                model.addAttribute("users", userService.findAllUsers());
            }
        } else {
            // User is not authorized
            model.addAttribute("isAuthorized", false);
        }

        return "initial-page";
    }

    /// Searching users by search string
    @GetMapping({"/findUsers", "/home/findUsers"})
    public String searchUsers(@RequestParam(required = true) String search,
                              Model model) {
        if (search == null || search.isEmpty()) {
            model.addAttribute("users", userService.findAllUsers());
        } else {
            model.addAttribute("users", userService.findUsersByUsername(search));
        }
        return "initial-page::users";
    }

    @GetMapping("/setDevices")
    public String getAvailableCameras(@RequestParam(value = "userName", required = false) String userName,
                                      Model model) {
        log.info("Initial device setting page is working");
        if (userName != null && !userName.isEmpty()) {
            model.addAttribute("userName", userName);
        } else if (SecurityUtil.getSessionUserEmail() != null && !SecurityUtil.getSessionUserEmail().isEmpty()) {
            UserEntity user = userService.findByEmail(SecurityUtil.getSessionUserEmail()).get();
            String nameSurname = user.getName() + " " + user.getSurname();
            model.addAttribute("userName", nameSurname);
        } else {
            throw new ConferenceException("Error while setting devices");
        }
        return "device-setting";
    }

    @PostMapping("/connect-devices")
    @ResponseBody
    public ResponseEntity<String> connectDevices(@RequestBody DeviceSelectionDTO deviceSelection,
                                                 @RequestParam(value = "identifier", required = false) String identifier,
                                                 @RequestParam(value = "userName", required = false) String userName) {
        log.info("\"connectDevices\" controller method is working");

        // Validate device selection
        if (deviceSelection.getCameras() == null || deviceSelection.getCameras().isEmpty()) {
            log.error("No cameras selected");
            return ResponseEntity.badRequest().body("No cameras selected");
        }
        if (deviceSelection.getAudio() == null || deviceSelection.getAudio().isEmpty()) {
            log.warn("No microphone selected");
            return ResponseEntity.badRequest().body("No microphone selected");
        }

        // Validate conference identifier if provided
        if (identifier != null && !identifier.isEmpty()) {
            Conference existingConference = conferenceService.findById(identifier);
            if (existingConference == null) {
                log.error("No conference found with identifier: {}", identifier);
                return ResponseEntity.badRequest().body("No conference with identifier");
            }
        }

        try {
            UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).get();
            Conference conference;
            String conferenceId;

            // Handle existing or new conference
            if (identifier != null && !identifier.isEmpty()) {
                conference = conferenceService.findById(identifier);
                conferenceId = identifier;
            } else {
                conferenceId = conferenceService.createConference(currentUser, userName);
                conference = conferenceService.findById(conferenceId);
            }

            // Create and save conference devices
            ConferenceDevices devices = ConferenceDevices.builder()
                    .conference(conference)
                    .userName(deviceSelection.getUserName())
                    .microphoneDeviceId(deviceSelection.getAudio().get(0).getDeviceId())
                    .microphoneLabel(deviceSelection.getAudio().get(0).getLabel())
                    .cameraConfiguration(objectMapper.writeValueAsString(deviceSelection.getCameras()))
                    .gridRows(deviceSelection.getGridSize().getRows())
                    .gridCols(deviceSelection.getGridSize().getCols())
                    .build();

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

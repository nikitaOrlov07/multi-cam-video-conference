package com.example.webConf.Controller;

import com.example.webConf.Dto.Devices.DeviceSelectionDTO;
import com.example.webConf.Mappers.ConferenceMapper;
import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.User.UserEntity;
import com.example.webConf.Security.SecurityUtil;
import com.example.webConf.Service.ConferenceDevicesService;
import com.example.webConf.Service.ConferenceService;
import com.example.webConf.Service.UserEntityService;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.example.webConf.Model.Devices.ConferenceDevices;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;

import java.util.List;

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
        log.info(currentUserEmail);
        UserEntity user;
        if (!currentUserEmail.equals("User is not authorized")) {
            // User is authorized
            user = userService.findByEmail(currentUserEmail);
            if (user != null) {
                List<Conference> pastConferences = conferenceService.findConferencesByUser(user.getId());
                String userName = user.getName() +" "+ user.getSurname();
                log.info("Size of past conferences: {}", pastConferences.size());
                model.addAttribute("pastConferences", pastConferences);
                model.addAttribute("isAuthorized", true);
                model.addAttribute("activeConferences", user.getActiveConferences());
                log.info("User name : {}",userName);
                model.addAttribute("userName" , userName);
            }
        } else {
            // User is not authorized
            model.addAttribute("isAuthorized", false);
        }

        return "initial-page";
    }

    @GetMapping("/setDevices")
    public String getAvailableCameras(@RequestParam(value = "userName", required = false) String userName,
                                      Model model) {
        log.info("Initial device setting page is working");
        if (userName != null && !userName.isEmpty()) {
            model.addAttribute("userName", userName);
        } else if (SecurityUtil.getSessionUserEmail() != null && !SecurityUtil.getSessionUserEmail().isEmpty()) {
            UserEntity user = userService.findByEmail(SecurityUtil.getSessionUserEmail());
            String nameSurname = user.getName() + " " + user.getSurname();
            model.addAttribute("userName", nameSurname);
        } else {
            return "redirect:/home?error";
        }
        return "device-setting";
    }

    // Метод для приема POST-запроса с выбранными камерами
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
            UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail());
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

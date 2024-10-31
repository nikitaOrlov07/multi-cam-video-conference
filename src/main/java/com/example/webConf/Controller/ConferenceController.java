package com.example.webConf.Controller;

import com.example.webConf.Dto.Devices.DeviceSelectionDTO;
import com.example.webConf.Mappers.ConferenceMapper;
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

@Controller
@Slf4j
@RequiredArgsConstructor
public class ConferenceController {

    private final ConferenceService conferenceService;
    private final ObjectMapper objectMapper;
    private final UserEntityService userService;
    private final ConferenceDevicesService conferenceDevicesService;

    @GetMapping({"/", "/home"})
    public String getHomePage()
    {
        log.info("Home page is working");
        return  "initial-page";
    }
    @GetMapping("/setDevices")
    public String getAvailableCameras(@RequestParam(value = "userName", required = false) String userName,
                                      Model model)
    {
        log.info("Initial device setting page is working");
        if(userName != null && !userName.isEmpty()) {
            model.addAttribute("userName", userName);
        }
        else if (SecurityUtil.getSessionUserEmail() != null && !SecurityUtil.getSessionUserEmail().isEmpty()){
            model.addAttribute("userName", SecurityUtil.getSessionUserEmail());
        }
        else {
            return "redirect:/home?error";
        }
        return "device-setting";
    }

    // Метод для приема POST-запроса с выбранными камерами
    @PostMapping("/connect-devices")
    @ResponseBody
    public ResponseEntity<String> connectDevices(@RequestBody DeviceSelectionDTO deviceSelection,
                                                 @RequestParam(value = "identifier", required = false) String identifier,
                                                 @RequestParam(value = "userName", required = false)String userName) {
        log.info("\"connectDevices\" controller method is working");

        if (deviceSelection.getCameras() == null || deviceSelection.getCameras().isEmpty()) {
            log.error("No cameras selected");
            return ResponseEntity.badRequest().body("No cameras selected");
        }
        if (deviceSelection.getAudio() == null || deviceSelection.getAudio().isEmpty()) {
            log.warn("No microphone selected");
            return ResponseEntity.badRequest().body("No microphone selected");
        }
        if(identifier != null && identifier.isEmpty() && (conferenceService.findConferenceById(identifier) == null)) // check if user add conference identifier ,but it does nnot exist
        {
         log.error("No conference with {} identifier",identifier);
         return  ResponseEntity.badRequest().body("No conference with identifier");
        }
        log.info("if-ы прошли");

        try {
            // Create new conference devices entry
            UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail());
            String conferenceId = (identifier != null && !identifier.isEmpty()) ? identifier : conferenceService.createConference(currentUser,userName);
            ConferenceDevices devices = ConferenceDevices.builder()
                    .conference(ConferenceMapper.getConferenceFromConferenceDto(conferenceService.findConferenceById(conferenceId))) // You'll need to implement this
                    .microphoneDeviceId(deviceSelection.getAudio().get(0).getDeviceId())
                    .microphoneLabel(deviceSelection.getAudio().get(0).getLabel())
                    .cameraConfiguration(objectMapper.writeValueAsString(deviceSelection.getCameras()))
                    .gridRows(deviceSelection.getGridSize().getRows())
                    .gridCols(deviceSelection.getGridSize().getCols())
                    .build();

            conferenceDevicesService.save(devices);
            log.info("Devices connected and saved successfully");
        } catch (Exception e) {
            log.error("Error saving device configuration", e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR)
                    .body("Error saving device configuration");
        }

        return ResponseEntity.ok("Devices connected successfully");
    }

    @GetMapping("/conference")
    public String conferencePage(@RequestParam(value = "userName" , required = false) String userName)
    {
      return "conference-page";
    }

}

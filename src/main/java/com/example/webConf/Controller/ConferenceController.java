package com.example.webConf.Controller;

import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.Devices.ConferenceDevices;
import com.example.webConf.Repository.ConferenceRepository;
import com.example.webConf.Security.SecurityUtil;
import com.example.webConf.Service.ConferenceService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jitsi.service.neomedia.MediaStream;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import com.example.webConf.Repository.ConferenceDeviceRepository;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Controller
@RequestMapping("/conference")
@Slf4j
@RequiredArgsConstructor
public class ConferenceController {
    private final ConferenceRepository conferenceRepository;
    private final ConferenceDeviceRepository devicesRepository;
    private final ObjectMapper objectMapper;

    @GetMapping
    public String showConference(
            @RequestParam(value = "userName", required = false) String userName,
            @RequestParam(value = "conferenceId") String conferenceId,
            Model model) {
        log.info("Processing conference page request for user: {}, conference: {}", userName, conferenceId);

        // Validate input parameters
        if (StringUtils.isEmpty(conferenceId) || StringUtils.isEmpty(userName)) {
            log.error("Missing required parameters - conferenceId: {}, userName: {}", conferenceId, userName);
            return "redirect:/home?error=invalid_params";
        }

        // Find conference
        Conference conference = conferenceRepository.findById(conferenceId)
                .orElseGet(() -> {
                    log.error("Conference not found with id: {}", conferenceId);
                    return null;
                });

        if (conference == null) {
            return "redirect:/home?error=conference_not_found";
        }
        model.addAttribute("userName", userName);
        model.addAttribute("conferenceId", conference);
        // Find user's devices
        ConferenceDevices devices = devicesRepository.findFirstByUserNameAndConference(userName, conference);
        if (devices == null) {
            log.error("No devices found for user: {} in conference: {}", userName, conferenceId);
            return "redirect:/home?error=devices_not_found";
        }
        return "conference";
    }

}
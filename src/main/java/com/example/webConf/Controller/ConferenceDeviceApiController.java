package com.example.webConf.controller;

import com.example.webConf.config.exception.ConferenceException;
import com.example.webConf.dto.Devices.AudioDeviceDTO;
import com.example.webConf.dto.Devices.DeviceSelectionDTO;
import com.example.webConf.dto.Devices.GridSizeDTO;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.devices.ConferenceDevices;
import com.example.webConf.repository.ConferenceDeviceRepository;
import com.example.webConf.repository.ConferenceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import com.example.webConf.dto.Devices.CameraDTO;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/conference/devices")
@Slf4j
public class ConferenceDeviceApiController {

    @Autowired
    private ConferenceDeviceRepository devicesRepository;
    @Autowired
    private ConferenceRepository conferenceRepository;

    @GetMapping
    public DeviceSelectionDTO getDeviceConfigurations(
            @RequestParam String conferenceId,
            @RequestParam String userName) {

        Conference conference = conferenceRepository.findById(conferenceId)
                .orElseThrow(() -> new RuntimeException("Conference not found"));

        ConferenceDevices devices = devicesRepository.findFirstByUserNameAndConference(userName, conference);
        if (devices == null) {
            throw new RuntimeException("No devices found for user");
        }
        // Parsing cameras configuration
        List<CameraDTO> cameras = parseCameraConfiguration(devices.getCameraConfiguration());

        return DeviceSelectionDTO.builder()
                .cameras(cameras)
                .gridSize(new GridSizeDTO(devices.getGridRows(), devices.getGridCols()))
                .conferenceId(conferenceId)
                .userName(userName)
                .build();
    }

    private List<CameraDTO> parseCameraConfiguration(String cameraConfigJson) {
        try {
            ObjectMapper objectMapper = new ObjectMapper();
            return objectMapper.readValue(cameraConfigJson, new TypeReference<List<CameraDTO>>() {
            });
        } catch (Exception e) {
            throw new RuntimeException("Error parsing camera configuration", e);
        }
    }
    @GetMapping("/{id}")
    public DeviceSelectionDTO getDeviceConfiguration(@PathVariable Long id) {
        ConferenceDevices devices = devicesRepository.findById(id).orElseThrow(() -> new ConferenceException("Devices no found"));
        List<CameraDTO> cameras = parseCameraConfiguration(devices.getCameraConfiguration());
        AudioDeviceDTO audioDeviceDTO = AudioDeviceDTO.builder()
                .deviceId(devices.getMicrophoneDeviceId())
                .label(devices.getMicrophoneLabel())
                .build();
        return DeviceSelectionDTO.builder()
                .cameras(cameras)
                .audio(List.of(audioDeviceDTO))      // TODO -> maybe i need to change it
                .gridSize(new GridSizeDTO(devices.getGridRows(), devices.getGridCols()))
                .conferenceId(null)
                .userName(devices.getUserName())
                .build();
    }
    /// Method for finding all user device configuration
    @GetMapping("/configuration/{conferenceId}")
    public List<ConferenceDevices> findConferenceConfig(@PathVariable String conferenceId) {
        List<ConferenceDevices> conferenceDevices = devicesRepository.findAllByConference_Id(conferenceId);
        log.info("Find All Devices for conference: {}", conferenceId);
        return conferenceDevices;
    }
}

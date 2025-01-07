package com.example.webConf.controller;

import com.example.webConf.dto.Devices.DeviceSelectionDTO;
import com.example.webConf.dto.Devices.GridSizeDTO;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.devices.ConferenceDevices;
import com.example.webConf.repository.ConferenceDeviceRepository;
import com.example.webConf.repository.ConferenceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import com.example.webConf.dto.Devices.CameraDTO;

import java.util.List;

@RestController
@RequestMapping("/api/conference/devices")
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
        if(devices == null){
            throw new RuntimeException("No devices found for user");
        }
        // Парсинг конфигурации камер из JSON
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
            return objectMapper.readValue(cameraConfigJson, new TypeReference<List<CameraDTO>>() {});
        } catch (Exception e) {
            throw new RuntimeException("Error parsing camera configuration", e);
        }
    }
}

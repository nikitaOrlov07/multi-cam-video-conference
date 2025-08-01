package com.example.webConf.controller;

import com.example.webConf.config.exception.ConferenceException;
import com.example.webConf.dto.devices.AudioDeviceDTO;
import com.example.webConf.dto.devices.DeviceSelectionDTO;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.devices.ConferenceDevices;
import com.example.webConf.repository.ConferenceDeviceRepository;
import com.example.webConf.repository.ConferenceRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import com.example.webConf.dto.devices.CameraDTO;

import java.util.*;

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
                .conferenceId(null)
                .userName(devices.getUserName())
                .build();
    }
    /// Method for finding all user device configuration
    @GetMapping("/configuration/{conferenceId}")
    public List<ConferenceDevices> findConferenceConfig(@PathVariable String conferenceId) {
        // Find all devices configurations for this conference
        List<ConferenceDevices> conferenceDevices = devicesRepository.findAllByConference_Id(conferenceId);

        // Create a map to group devices by actual username
        Map<String, List<ConferenceDevices>> userDevicesMap = new HashMap<>();

        // Group devices by actual username (stripping technical suffix if present)
        for (ConferenceDevices device : conferenceDevices) {
            String actualUserName = extractActualUsername(device.getUserName());

            if (!userDevicesMap.containsKey(actualUserName)) {
                userDevicesMap.put(actualUserName, new ArrayList<>());
            }
            userDevicesMap.get(actualUserName).add(device);
        }

        // Create new list of devices with proper configuration
        List<ConferenceDevices> resultDevices = new ArrayList<>();

        for (Map.Entry<String, List<ConferenceDevices>> entry : userDevicesMap.entrySet()) {
            String actualUserName = entry.getKey();
            List<ConferenceDevices> userDevices = entry.getValue();

            // If user has multiple device configs, we need to merge camera configurations
            if (userDevices.size() > 1) {
                // Create a merged device config for this user
                ConferenceDevices mergedConfig = new ConferenceDevices();
                mergedConfig.setUserName(actualUserName);
                mergedConfig.setConference(userDevices.get(0).getConference());


                // Merge camera configurations
                List<Map<String, Object>> allCameras = new ArrayList<>();
                int orderOffset = 0;

                for (ConferenceDevices device : userDevices) {
                    if (device.getCameraConfiguration() != null && !device.getCameraConfiguration().isEmpty()) {
                        try {
                            ObjectMapper mapper = new ObjectMapper();
                            List<Map<String, Object>> cameras = mapper.readValue(
                                    device.getCameraConfiguration(),
                                    new TypeReference<List<Map<String, Object>>>() {}
                            );

                            // Adjust order for cameras from each technical user
                            for (Map<String, Object> camera : cameras) {
                                if (camera.containsKey("order")) {
                                    int originalOrder = ((Number) camera.get("order")).intValue();
                                    camera.put("order", originalOrder + orderOffset);
                                }
                                allCameras.add(camera);
                            }

                            // Increment offset for next technical user
                            orderOffset += cameras.size();

                        } catch (Exception e) {
                            log.error("Error parsing camera configuration for {}: {}", device.getUserName(), e.getMessage());
                        }
                    }
                }

                // Convert merged cameras back to JSON
                try {
                    ObjectMapper mapper = new ObjectMapper();
                    mergedConfig.setCameraConfiguration(mapper.writeValueAsString(allCameras));
                } catch (Exception e) {
                    log.error("Error creating merged camera configuration: {}", e.getMessage());
                    mergedConfig.setCameraConfiguration("[]");
                }

                // Add the merged config to results
                resultDevices.add(mergedConfig);
            } else {
                // User has only one device config, add it as is
                resultDevices.add(userDevices.get(0));
            }
        }

        log.info("Found {} device configurations for conference: {}", resultDevices.size(), conferenceId);
        return resultDevices;}

    private String extractActualUsername(String technicalUsername) {
        // If username has format "actualName_technical1", extract the actual name
        if (technicalUsername != null && technicalUsername.contains("_technical")) {
            return technicalUsername.split("_technical")[0];
        }
        return technicalUsername;
    }
}

package com.example.webConf.Controller;

import com.example.webConf.Dto.Devices.DeviceSelectionDTO;
import com.example.webConf.Dto.Devices.GridSizeDTO;
import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.Devices.ConferenceDevices;
import com.example.webConf.Repository.ConferenceDeviceRepository;
import com.example.webConf.Repository.ConferenceRepository;
import com.example.webConf.Service.ConferenceDevicesService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.xeustechnologies.jcl.exception.ResourceNotFoundException;
import com.example.webConf.Dto.Devices.CameraDTO;

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

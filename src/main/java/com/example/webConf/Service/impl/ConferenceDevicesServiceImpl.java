package com.example.webConf.Service.impl;

import com.example.webConf.Dto.Devices.CameraDTO;
import com.example.webConf.Dto.Devices.DeviceSelectionDTO;
import com.example.webConf.Dto.Devices.GridSizeDTO;
import com.example.webConf.Model.Devices.ConferenceDevices;
import com.example.webConf.Repository.ConferenceDeviceRepository;
import com.example.webConf.Service.ConferenceDevicesService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@Slf4j
@RequiredArgsConstructor
public class ConferenceDevicesServiceImpl implements ConferenceDevicesService {
    private final ConferenceDeviceRepository conferenceDeviceRepository;


    @Override
    public void save(ConferenceDevices devices) {
        log.info("Saving conference devices information");
        conferenceDeviceRepository.save(devices);
    }

    @Override
    public ConferenceDevices findByConferenceId(String conferenceId) {
        return conferenceDeviceRepository.findByConferenceId(conferenceId);
    }
    public DeviceSelectionDTO getDeviceConfigurationsForConference(String conferenceId, String userName) {
        // Находим устройства для конкретной конференции и пользователя
        ConferenceDevices deviceConfig = conferenceDeviceRepository.findByConference_IdAndUserName(conferenceId, userName);

        if (deviceConfig == null) {
            throw new RuntimeException("No device configuration found");
        }

        // Парсим JSON конфигурации камер
        List<CameraDTO> cameras = parseCameraConfiguration(deviceConfig.getCameraConfiguration());

        return DeviceSelectionDTO.builder()
                .cameras(cameras)
                .gridSize(new GridSizeDTO(
                        deviceConfig.getGridRows(),
                        deviceConfig.getGridCols()
                ))
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

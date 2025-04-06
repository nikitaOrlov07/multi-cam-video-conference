package com.example.webConf.service.impl;

import com.example.webConf.dto.Devices.CameraDTO;
import com.example.webConf.dto.Devices.DeviceSelectionDTO;
import com.example.webConf.dto.Devices.GridSizeDTO;
import com.example.webConf.model.devices.ConferenceDevices;
import com.example.webConf.repository.ConferenceDeviceRepository;
import com.example.webConf.service.ConferenceDevicesService;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

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

    @Override
    public List<ConferenceDevices> findUserDevices(String userName) {
        List<ConferenceDevices> devices = conferenceDeviceRepository.findAllByUserName(userName);

        return devices.stream()
                .collect(Collectors.toMap(
                        device -> String.format("%s_%s_%d_%d",
                                device.getMicrophoneDeviceId(),
                                device.getMicrophoneLabel(),
                                device.getGridRows(),
                                device.getGridCols()),
                        Function.identity(),
                        (existing, replacement) -> {
                            List<ConferenceDevices.Camera> existingCameras = existing.getCameras();
                            List<ConferenceDevices.Camera> replacementCameras = replacement.getCameras();

                            int existingCount = (existingCameras != null) ? existingCameras.size() : 0;
                            int replacementCount = (replacementCameras != null) ? replacementCameras.size() : 0;

                            return replacementCount > existingCount ? replacement : existing;
                        }

                ))
                .values()
                .stream()
                .toList();
    }

    @Override
    public Optional<ConferenceDevices> findById(Long id) {
        return conferenceDeviceRepository.findById(id);
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

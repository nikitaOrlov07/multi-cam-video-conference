package com.example.webConf.dto.devices;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DeviceSelectionDTO {
    private List<CameraDTO> cameras;
    private List<AudioDeviceDTO> audio;
    private String conferenceId;
    private AudioDeviceDTO microphone;
    private String userName;
    private Boolean existingConfiguration;
}
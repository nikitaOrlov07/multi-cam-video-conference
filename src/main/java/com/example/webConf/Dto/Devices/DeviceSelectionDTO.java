package com.example.webConf.dto.Devices;

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
    private GridSizeDTO gridSize;
    private String conferenceId;
    private AudioDeviceDTO microphone;
    private String userName;
    private Boolean existingConfiguration;
}
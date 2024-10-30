package com.example.webConf.Dto.Devices;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DeviceSelectionDTO {
    private List<CameraDTO> cameras;
    private List<AudioDeviceDTO> audio;
    private GridSizeDTO gridSize;
    private String conferenceId;
}
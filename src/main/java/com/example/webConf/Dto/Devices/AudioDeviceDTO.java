package com.example.webConf.dto.Devices;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AudioDeviceDTO {
    private String deviceId;
    private String label;
}
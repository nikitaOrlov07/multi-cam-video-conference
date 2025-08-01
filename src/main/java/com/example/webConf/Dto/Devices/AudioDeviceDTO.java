package com.example.webConf.dto.devices;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AudioDeviceDTO {
    private String deviceId;
    private String label;
}
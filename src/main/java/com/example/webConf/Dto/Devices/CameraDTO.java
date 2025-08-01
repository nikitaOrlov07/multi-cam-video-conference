package com.example.webConf.dto.devices;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class CameraDTO {
    private String deviceId;
    private String label;
    private Integer order;
}
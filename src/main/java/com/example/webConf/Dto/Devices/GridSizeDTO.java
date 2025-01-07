package com.example.webConf.dto.Devices;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GridSizeDTO {
    private Integer rows;
    private Integer cols;
}
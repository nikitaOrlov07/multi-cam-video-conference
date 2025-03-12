package com.example.webConf.model.settings;

import jakarta.persistence.*;
import lombok.Data;

import java.time.LocalDateTime;

@Entity
@Table(name = "settings")
@Data
public class SettingsEntity {
    @Id
    private String type;
    private String value;
    private LocalDateTime createdAt;
    // user information
    private Long userId;
    private String email;
}

package com.example.webConf.model.devices;

import com.example.webConf.model.conference.Conference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.extern.slf4j.Slf4j;

import java.util.Collections;
import java.util.List;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data
@Table(name = "conference_devices")
@Slf4j
public class ConferenceDevices {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "conference_id", nullable = false)
    private Conference conference;

    // Microphone information
    private String microphoneDeviceId;
    private String microphoneLabel;

    // Camera information stored as JSON array
    @Column(columnDefinition = "TEXT")
    private String cameraConfiguration;

    // Username
    private String userName;
    @Transient // Не сохраняется в БД
    public List<Camera> getCameras() {
        if (cameraConfiguration == null || cameraConfiguration.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            ObjectMapper mapper = new ObjectMapper();
            return mapper.readValue(cameraConfiguration,
                    mapper.getTypeFactory().constructCollectionType(List.class, Camera.class));
        } catch (Exception e) {
            log.error("Error parsing camera configuration: {}", e.getMessage());
            return Collections.emptyList();
        }
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Camera {
        private String deviceId;
        private String label;
        private Integer order;
    }
}
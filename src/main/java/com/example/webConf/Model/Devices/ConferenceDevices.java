package com.example.webConf.Model.Devices;

import com.example.webConf.Model.Conference.Conference;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data
@Table(name = "conference_devices")
public class ConferenceDevices {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "conference_id")
    private Conference conference;

    // Microphone information
    private String microphoneDeviceId;
    private String microphoneLabel;

    // Camera information stored as JSON array
    @Column(columnDefinition = "TEXT")
    private String cameraConfiguration;

    // Grid configuration
    private Integer gridRows;
    private Integer gridCols;

}
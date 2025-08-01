package com.example.webConf.model.conference;

import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.devices.ConferenceDevices;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Data
@Builder
public class Conference {
    @Id
    private String id;

    private LocalDate conferenceDate;

    @OneToMany(mappedBy = "conference", cascade = CascadeType.ALL)
    @ToString.Exclude
    @JsonIgnore
    private List<UserConferenceJoin> userJoins = new ArrayList<>(); // to track how many user accounts are currently in the conference

    @ManyToMany(mappedBy = "conferences")
    @ToString.Exclude
    @JsonIgnore
    private List<UserEntity> users = new ArrayList<>();

    @OneToMany(mappedBy = "conference", cascade = CascadeType.ALL)
    @ToString.Exclude
    @JsonIgnore
    private List<ConferenceDevices> devices = new ArrayList<>();

    @PrePersist // will be executed before store value to database
    public void generateIdKey() {
        this.id = UUID.randomUUID().toString();
    }

    @JsonIgnore
    @OneToOne(fetch = FetchType.EAGER, cascade = CascadeType.ALL)
    @JoinColumn(name = "chat_id", referencedColumnName = "id")
    private Chat chat;

    private String password;
}

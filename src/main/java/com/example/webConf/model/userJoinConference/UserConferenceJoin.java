package com.example.webConf.model.userJoinConference;

import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "user_conference_join")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserConferenceJoin {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "user_id")
    private UserEntity user;

    @ManyToOne
    @JoinColumn(name = "conference_id")
    private Conference conference;

    private LocalDateTime joinTime;

    @PrePersist
    public void prePersist() {
        joinTime = LocalDateTime.now();
    }
}
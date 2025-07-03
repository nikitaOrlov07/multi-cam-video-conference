package com.example.webConf.model.user;

import com.example.webConf.config.relationship.RelationshipStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name ="user_relationship")
@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class UserRelationship {
    @Id
    @GeneratedValue
    private Long id;

    @ManyToOne
    @JoinColumn(name = "requester_id")
    private UserEntity requester;

    @ManyToOne
    @JoinColumn(name = "addressee_id")
    private UserEntity addressee;

    @Enumerated(EnumType.STRING)
    private RelationshipStatus status;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}

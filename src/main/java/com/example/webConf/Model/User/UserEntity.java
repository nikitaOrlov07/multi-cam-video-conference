package com.example.webConf.model.user;

import com.example.webConf.model.Chat.Chat;
import com.example.webConf.model.Chat.Message;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.role.RoleEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;
import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String name;
    private String surname;
    private String password;
    private String email;
    private String city;
    private String country;
    private String address;

    @Enumerated(EnumType.STRING)
    private AccountType accountType;

    @ManyToMany
    @JoinTable(
            name = "user_conference",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "conference_id")
    )
    private List<Conference> conferences = new ArrayList<>();

    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private List<UserConferenceJoin> userJoins = new ArrayList<>();


    public enum AccountType {
        PERMANENT, TEMPORARY
    }
    @ToString.Exclude
    @ManyToMany(fetch = FetchType.EAGER, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
            name = "users_role",joinColumns = {@JoinColumn(name ="user_id",referencedColumnName ="id")},
            inverseJoinColumns ={@JoinColumn(name = "role_id", referencedColumnName = "id")}
    )
    private List<RoleEntity> roles = new ArrayList<>();

    ///  Chats
    @JsonIgnore
    @ManyToMany(mappedBy = "participants", fetch = FetchType.EAGER, cascade = {CascadeType.PERSIST, CascadeType.MERGE , CascadeType.REFRESH})
    private List<Chat> chats = new ArrayList<>();
    ///  Messages
    @JsonIgnore
    @OneToMany(mappedBy = "user", fetch = FetchType.EAGER, cascade = CascadeType.ALL , orphanRemoval = true)  // one user --> many comments in comment side i have @ ManyToone annotation
    private List<Message> messages = new ArrayList<>();
}



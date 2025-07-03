package com.example.webConf.model.user;

import com.example.webConf.model.Chat.Chat;
import com.example.webConf.model.Chat.Message;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.role.RoleEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;
import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonManagedReference;
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
    @JsonIgnore
    @JoinTable(
            name = "user_conference",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "conference_id")
    )
    @ToString.Exclude
    private List<Conference> conferences = new ArrayList<>();


    @CreatedDate
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    @JsonIgnore
    @ToString.Exclude
    private List<UserConferenceJoin> userJoins = new ArrayList<>();


    public enum AccountType {
        PERMANENT, TEMPORARY
    }
    @ToString.Exclude
    @ManyToMany(fetch = FetchType.EAGER, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JsonIgnore
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

    ///  UserName logic
    private String userName;

    @PrePersist
    @PreUpdate
    private void setDefaultUserName() {
        String trimmedName = (name != null) ? name.trim() : "";
        String trimmedSurname = (surname != null) ? surname.trim() : "";

        if (!trimmedName.isEmpty() && !trimmedSurname.isEmpty()) {
            userName = trimmedName + " " + trimmedSurname;
        } else if (!trimmedName.isEmpty()) {
            userName = trimmedName;
        } else if (!trimmedSurname.isEmpty()) {
            userName = trimmedSurname;
        } else {
            userName = "";
        }
    }

    ///  Friends
    @JsonIgnore
    @ManyToMany(fetch = FetchType.EAGER, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
            name = "friends_invitation",joinColumns = {@JoinColumn(name ="user_id",referencedColumnName ="id")},
            inverseJoinColumns ={@JoinColumn(name = "invited_id", referencedColumnName = "id")}
    )
    private List<UserEntity> invitedUsers = new ArrayList<>();

    @JsonIgnore
    @ManyToMany(fetch = FetchType.EAGER, cascade = {CascadeType.PERSIST, CascadeType.MERGE})
    @JoinTable(
            name = "friends",joinColumns = {@JoinColumn(name ="user_id",referencedColumnName ="id")},
            inverseJoinColumns ={@JoinColumn(name = "friend_id", referencedColumnName = "id")}
    )
    private List<UserEntity> friends = new ArrayList<>();

}



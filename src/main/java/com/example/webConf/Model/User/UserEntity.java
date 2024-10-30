package com.example.webConf.Model.User;

import com.example.webConf.Model.Conference.Conference;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@Entity
@AllArgsConstructor
@NoArgsConstructor
@Builder
@Data
@Table(name = "users")
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

    @Enumerated(EnumType.STRING)
    private AccountType accountType;

    @ManyToMany
    @JoinTable(
            name = "user_conference",
            joinColumns = @JoinColumn(name = "user_id"),
            inverseJoinColumns = @JoinColumn(name = "conference_id")
    )
    private List<Conference> conferences = new ArrayList<>();

    private String role = "USER";

    public enum AccountType {
        PERMANENT, TEMPORARY
    }
}


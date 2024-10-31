package com.example.webConf.Model.Conference;

import com.example.webConf.Model.User.UserEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.Date;
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

    private Date conferenceDate;

    @ManyToMany(mappedBy = "conferences")
    private List<UserEntity> users = new ArrayList<>();

    @PrePersist // will be executed before store value to database
    public void generateIdKey(){
    this.id = UUID.randomUUID().toString();
    }

}

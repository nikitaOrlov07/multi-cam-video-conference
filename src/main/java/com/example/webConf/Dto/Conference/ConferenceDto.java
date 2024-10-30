package com.example.webConf.Dto.Conference;

import com.example.webConf.Model.User.UserEntity;
import lombok.*;

import java.util.ArrayList;
import java.util.Date;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConferenceDto {
    private String id;
    private Date conferenceDate;
    private List<UserEntity> users = new ArrayList<>();

}

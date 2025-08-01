package com.example.webConf.dto.conference;

import com.example.webConf.model.user.UserEntity;
import lombok.*;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConferenceDto {
    private String id;
    private LocalDate conferenceDate;
    private List<UserEntity> users = new ArrayList<>();

}

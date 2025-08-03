package com.example.webConf.mappers;

import com.example.webConf.dto.conference.ConferenceDto;
import com.example.webConf.dto.message.MessageView;
import com.example.webConf.model.chat.Message;
import com.example.webConf.model.conference.Conference;
import org.springframework.beans.BeanUtils;

public class ConferenceMapper {
    public static ConferenceDto getConferenceDtoFromConference(Conference conference) {
        return ConferenceDto.builder()
                .id(conference.getId())
                .conferenceDate(conference.getConferenceDate())
                .users(conference.getUsers())
                .build();
    }

    public static Conference getConferenceFromConferenceDto(ConferenceDto conferenceDto) {
        return Conference.builder()
                .conferenceDate(conferenceDto.getConferenceDate())
                .users(conferenceDto.getUsers())
                .build();
    }
}

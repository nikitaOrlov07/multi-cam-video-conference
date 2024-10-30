package com.example.webConf.Mappers;

import com.example.webConf.Dto.Conference.ConferenceDto;
import com.example.webConf.Model.Conference.Conference;

public class ConferenceMapper {
    public static ConferenceDto getConferenceDtoFromConference(Conference conference)
    {
        return ConferenceDto.builder()
                .id(conference.getId())
                .conferenceDate(conference.getConferenceDate())
                .users(conference.getUsers())
                .build();
    }
}

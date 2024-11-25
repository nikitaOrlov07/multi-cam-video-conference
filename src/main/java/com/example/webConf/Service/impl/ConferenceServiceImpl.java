package com.example.webConf.Service.impl;

import com.example.webConf.Dto.Conference.ConferenceDto;
import com.example.webConf.Mappers.ConferenceMapper;
import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.User.UserEntity;
import com.example.webConf.Repository.ConferenceRepository;
import com.example.webConf.Service.ConferenceService;
import com.example.webConf.Service.UserEntityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.Date;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class ConferenceServiceImpl implements ConferenceService {
    private final ConferenceRepository conferenceRepository;
    private final UserEntityService userService;

    @Override
    public ConferenceDto findConferenceById(String identifier) {
        Optional<Conference> conference = conferenceRepository.findById(identifier);
        return conference.map(ConferenceMapper::getConferenceDtoFromConference).orElse(null);
    }
    @Override
    public Conference findById(String identifier) {
        Optional<Conference> conference = conferenceRepository.findById(identifier);
        if(conference.isEmpty()){
            log.error("Could not find conference");
            return null;
        }
        return conference.get();
    }

    @Override
    public String createConference(UserEntity userEntity,String userName) throws Exception {
        Conference conference = new Conference();
        // Initial save conference into database
        Conference savedConference = conferenceRepository.save(conference);
        savedConference.setConferenceDate(new Date());
        if(userEntity != null && (userName == null || userName.isEmpty())) {
            /// If user is registered
            log.info("User is registered");
            savedConference.getUsers().add(userEntity);
        } else if (userName != null && !userName.isEmpty() && userEntity == null) {
            /// If user is not registered , but write his name
            //  Create temporary user profile
            log.info("User doesn`t registered , temporaryName: " + userName);
            UserEntity temporaryUser = UserEntity.builder()
                    .surname(userName)
                    .password(null)
                    .city(null)
                    .conferences(List.of(conference))
                    .email(null)
                    .country(null)
                    .accountType(UserEntity.AccountType.TEMPORARY)
                    .role(null)
                    .build();
            userService.save(temporaryUser);
            savedConference.getUsers().add(temporaryUser);
        }
        Conference updatedConference = conferenceRepository.save(savedConference);
        if(!updatedConference.getId().equals(savedConference.getId())) {
            log.error("Error while saving conference");
            throw new Exception("Error while saving conference");
        }
        log.info("Successfully saved conference");
        return savedConference.getId();
    }
}

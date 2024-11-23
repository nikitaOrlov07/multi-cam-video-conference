package com.example.webConf.Service.impl;

import com.example.webConf.Repository.ConferenceDeviceRepository;
import com.example.webConf.Repository.ConferenceRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class ConferenceService {
    private final ConferenceRepository conferenceRepository;
    private final ConferenceDeviceRepository devicesRepository;

    public ConferenceService(
            ConferenceRepository conferenceRepository,
            ConferenceDeviceRepository devicesRepository
    ) {
        this.conferenceRepository = conferenceRepository;
        this.devicesRepository = devicesRepository;
    }


}

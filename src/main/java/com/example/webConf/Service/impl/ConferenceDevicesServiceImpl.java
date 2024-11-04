package com.example.webConf.Service.impl;

import com.example.webConf.Model.Devices.ConferenceDevices;
import com.example.webConf.Repository.ConferenceDeviceRepository;
import com.example.webConf.Service.ConferenceDevicesService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
@RequiredArgsConstructor
public class ConferenceDevicesServiceImpl implements ConferenceDevicesService {
    private final ConferenceDeviceRepository conferenceDeviceRepository;

    @Override
    public void save(ConferenceDevices devices) {
        log.info("Saving conference devices information");
        conferenceDeviceRepository.save(devices);
    }

    @Override
    public ConferenceDevices findByConferenceId(String conferenceId) {
        return conferenceDeviceRepository.findByConferenceId(conferenceId);
    }
}

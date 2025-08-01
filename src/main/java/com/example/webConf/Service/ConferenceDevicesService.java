package com.example.webConf.service;

import com.example.webConf.dto.devices.DeviceSelectionDTO;
import com.example.webConf.model.devices.ConferenceDevices;

import java.util.List;
import java.util.Optional;

public interface ConferenceDevicesService {
    void save(ConferenceDevices devices);

    DeviceSelectionDTO getDeviceConfigurationsForConference(String conferenceId, String userName);

    List<ConferenceDevices> findUserDevices(String userName);

    Optional<ConferenceDevices> findById(Long id);
}

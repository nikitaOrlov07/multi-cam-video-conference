package com.example.webConf.service;

import com.example.webConf.dto.Devices.DeviceSelectionDTO;
import com.example.webConf.model.devices.ConferenceDevices;

public interface ConferenceDevicesService {
    void save(ConferenceDevices devices);

    ConferenceDevices findByConferenceId(String conferenceId);

    DeviceSelectionDTO getDeviceConfigurationsForConference(String conferenceId, String userName);
}

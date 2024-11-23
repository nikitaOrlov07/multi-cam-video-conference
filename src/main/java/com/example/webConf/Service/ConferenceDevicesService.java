package com.example.webConf.Service;

import com.example.webConf.Dto.Devices.DeviceSelectionDTO;
import com.example.webConf.Model.Devices.ConferenceDevices;

public interface ConferenceDevicesService {
    void save(ConferenceDevices devices);

    ConferenceDevices findByConferenceId(String conferenceId);

    DeviceSelectionDTO getDeviceConfigurationsForConference(String conferenceId, String userName);
}

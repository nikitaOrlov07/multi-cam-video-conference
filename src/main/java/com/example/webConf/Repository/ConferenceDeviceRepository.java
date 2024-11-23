package com.example.webConf.Repository;

import com.example.webConf.Dto.Devices.DeviceSelectionDTO;
import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.Devices.ConferenceDevices;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConferenceDeviceRepository extends JpaRepository<ConferenceDevices,Long> {
    ConferenceDevices findByConferenceId(String conferenceId);
    ConferenceDevices findFirstByUserNameAndConference(String userName, Conference conference);
    ConferenceDevices findByConference_IdAndUserName(String conferenceId, String userName);
}

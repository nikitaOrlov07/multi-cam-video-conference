package com.example.webConf.repository;

import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.devices.ConferenceDevices;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ConferenceDeviceRepository extends JpaRepository<ConferenceDevices,Long> {
    ConferenceDevices findByConferenceId(String conferenceId);
    ConferenceDevices findFirstByUserNameAndConference(String userName, Conference conference);
    ConferenceDevices findByConference_IdAndUserName(String conferenceId, String userName);
    void deleteAllByConference(Conference conference);
    List<ConferenceDevices> findAllByUserName(String userName);
    List<ConferenceDevices> findAllByConference_Id(String conferenceId);
}

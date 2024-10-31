package com.example.webConf.Repository;

import com.example.webConf.Model.Devices.ConferenceDevices;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConferenceDeviceRepository extends JpaRepository<ConferenceDevices,Long> {


}

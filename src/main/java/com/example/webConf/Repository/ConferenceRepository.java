package com.example.webConf.Repository;

import com.example.webConf.Model.Conference.Conference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface ConferenceRepository extends JpaRepository<Conference,String> {

}

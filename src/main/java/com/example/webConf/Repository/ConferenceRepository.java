package com.example.webConf.Repository;

import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.User.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.util.List;

@Repository
public interface ConferenceRepository extends JpaRepository<Conference, String> {
    List<Conference> findAllByUsersContains(UserEntity user);
    @Query("SELECT c FROM Conference c " +
            "WHERE c.conferenceDate < :currentDate")
    List<Conference> findUnusedConference(@Param("currentDate") LocalDate currentDate);
}

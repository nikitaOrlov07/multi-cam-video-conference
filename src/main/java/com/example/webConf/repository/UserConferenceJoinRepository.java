package com.example.webConf.repository;

import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface UserConferenceJoinRepository  extends JpaRepository<UserConferenceJoin,Long> {

    Integer countByUserAndConference(UserEntity userEntity, Conference conference);
    Optional<UserConferenceJoin> findFirstByUserAndConference(UserEntity user, Conference conference);
}

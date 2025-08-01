package com.example.webConf.repository;

import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.user.UserEntity;
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

    @Query("SELECT COUNT(u) FROM UserEntity u JOIN u.conferences c " +
            "WHERE u.id = :userId AND c.id = :conferenceId")
    Integer findUserJoinCount(@Param("userId") Long userId, @Param("conferenceId") String conferenceId);

    Conference findProjectByChat(Chat chat);

    ///  Search conferences
    @Query("SELECT c FROM Conference c WHERE c.id LIKE CONCAT('%',:id,'%')")
    List<Conference> searchConferenceById(@Param("id") String id);

    @Query("SELECT c FROM Conference c JOIN c.users u WHERE c.id LIKE CONCAT('%', :conferenceId, '%') AND u.id = :userId")
    List<Conference> searchUserConferences(@Param("conferenceId") String conferenceId, @Param("userId") Long userId);
}

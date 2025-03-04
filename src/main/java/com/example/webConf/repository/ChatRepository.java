package com.example.webConf.repository;

import com.example.webConf.model.Chat.Chat;
import com.example.webConf.model.user.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ChatRepository extends JpaRepository<Chat,Long> {

    List<Chat> findByParticipantsContains(UserEntity currentUser);
}

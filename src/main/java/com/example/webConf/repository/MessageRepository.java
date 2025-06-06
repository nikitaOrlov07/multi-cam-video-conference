package com.example.webConf.repository;

import com.example.webConf.model.Chat.Message;
import com.example.webConf.model.user.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MessageRepository extends JpaRepository<Message,Long> {

    List<Message> findAllByChatId(Long chaId);
    List<Message> findAllByUser(UserEntity user);
}

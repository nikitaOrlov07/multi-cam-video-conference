package com.example.webConf.repository;

import com.example.webConf.model.attachment.Attachment;
import com.example.webConf.model.chat.Chat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    List<Attachment> findAllByChat(Chat chat);
}

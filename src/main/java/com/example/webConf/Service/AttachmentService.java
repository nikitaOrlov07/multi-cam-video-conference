package com.example.webConf.service;


import com.example.webConf.model.attachment.Attachment;
import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.user.UserEntity;
import jakarta.transaction.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

public interface AttachmentService {

    Attachment saveAttachment(MultipartFile file, Chat chat, UserEntity user) throws Exception;

    @Transactional
    void updateAttachmentUrls(Long id, String downloadUrl, String viewUrl);

    @Transactional
    Attachment getAttachment(Long fileId) throws Exception;

    @Transactional
    List<Attachment> findAllByChat(Chat chat);

    @Transactional // operations with large objects must be transactional
    void deleteAttachment(Long chatId, Long fileId) throws Exception;
}

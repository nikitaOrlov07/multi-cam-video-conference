package com.example.webConf.service;


import com.example.webConf.model.attachment.Attachment;
import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.user.UserEntity;
import org.springframework.web.multipart.MultipartFile;

public interface AttachmentService {

    Attachment saveAttachment(MultipartFile file, Chat chat, UserEntity user) throws Exception;
}

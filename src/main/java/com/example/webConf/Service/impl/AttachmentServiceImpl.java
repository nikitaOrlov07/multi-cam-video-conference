package com.example.webConf.service.impl;

import com.example.webConf.model.attachment.Attachment;
import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.AttachmentRepository;
import com.example.webConf.service.AttachmentService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Repository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

@Service
@RequiredArgsConstructor
public class AttachmentServiceImpl implements AttachmentService {

    private final AttachmentRepository attachmentRepository;

    @Override
    public Attachment saveAttachment(MultipartFile file, Chat chat, UserEntity user) throws Exception {
        String fileName = StringUtils.cleanPath(file.getOriginalFilename());
        try {
            if (fileName.contains("..")) {
                throw new Exception("Filename contains invalid path sequence" + fileName);
            }

            Attachment attachment = new Attachment(fileName,
                    file.getContentType(),
                    file.getBytes(),
                    null,
                    null
            );

            attachment.setChat(chat);
            attachment.setUser(user);
            attachment.setTimestamp(LocalDateTime.now());

            return attachmentRepository.save(attachment);
        } catch (Exception exception) {
            exception.printStackTrace();
            throw new Exception("Could not save File: " + fileName);
        }
    }
}

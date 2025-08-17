package com.example.webConf.service.impl;

import com.example.webConf.config.exception.ChatException;
import com.example.webConf.model.attachment.Attachment;
import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.AttachmentRepository;
import com.example.webConf.repository.ChatRepository;
import com.example.webConf.service.AttachmentService;
import jakarta.persistence.EntityNotFoundException;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AttachmentServiceImpl implements AttachmentService {

    private final AttachmentRepository attachmentRepository;
    private final ChatRepository chatRepository;

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
    @Transactional
    @Override
    public void updateAttachmentUrls(Long id, String downloadUrl, String viewUrl) {
        Attachment attachment = attachmentRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Attachment not found"));
        attachment.setDownloadUrl(downloadUrl);
        attachment.setViewUrl(viewUrl);
        attachmentRepository.save(attachment);

    }

    @Transactional
    @Override
    public Attachment getAttachment(Long fileId) throws Exception {
        return attachmentRepository.findById(fileId).orElseThrow(() -> new Exception("File not found with id " + fileId));

    }

    @Transactional
    @Override
    public List<Attachment> findAllByChat(Chat chat) {
        return attachmentRepository.findAllByChat(chat);
    }

    @Transactional
    @Override
    public void deleteAttachment(Long chatId, Long fileId) throws Exception {
        Chat chat = chatRepository.findById(chatId).orElseThrow(() -> new ChatException("Chat not found"));
        Attachment attachment = getAttachment(fileId);
        chat.getAttachments().remove(attachment);
        attachmentRepository.delete(attachment);
    }
}

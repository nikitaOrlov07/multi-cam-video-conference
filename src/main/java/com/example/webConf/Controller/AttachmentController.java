package com.example.webConf.controller;

import com.example.webConf.config.exception.ChatException;
import com.example.webConf.dto.AttachmentUploadResponse;
import com.example.webConf.model.attachment.Attachment;
import com.example.webConf.model.chat.Chat;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.security.SecurityUtil;
import com.example.webConf.service.AttachmentService;
import com.example.webConf.service.ChatService;
import com.example.webConf.service.UserEntityService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;

@RestController
@RequiredArgsConstructor
@Slf4j
@RequestMapping("/files")
public class AttachmentController {

    private final ChatService chatService;
    private final UserEntityService userService;
    private final AttachmentService attachmentService;

    @PostMapping("/upload/{projectId}")
    public ResponseEntity<Object> uploadFile(@RequestParam("file") MultipartFile file,
                                             @PathVariable("projectId") Long projectId) throws Exception {
        Chat chat = chatService.findById(projectId).orElseThrow(() -> new ChatException("Chat not found"));
        UserEntity user = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new ChatException("User not found"));

        Attachment attachment = null;
        if (user == null || !chat.getParticipants().contains(user)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
        attachment = attachmentService.saveAttachment(file, chat, user);
        String downloadUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/files/download/")
                .path(String.valueOf(attachment.getId()))
                .toUriString();
        String viewUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path("/files/view/")
                .path(String.valueOf(attachment.getId()))
                .toUriString();

        log.info("Download URL: " + downloadUrl);
        log.info("View URL: " + viewUrl);

        attachmentService.updateAttachmentUrls(attachment.getId(), downloadUrl, viewUrl); // update attachment url
        AttachmentUploadResponse attachmentUploadResponse = new AttachmentUploadResponse(attachment.getId(), attachment.getFileName(), attachment.getDownloadUrl(), attachment.getViewUrl());
        return ResponseEntity.status(HttpStatus.OK).body(attachmentUploadResponse);
    }

    // download file
    @GetMapping("/download/{fileId}")
    public ResponseEntity<Resource> downloadFile(@PathVariable("fileId") Long fileId) throws Exception // method will return file content and file metadata
    {
        Attachment attachment = attachmentService.getAttachment(fileId);
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new ChatException("User not found"));
        Chat chat = attachment.getChat();
        if (currentUser == null || !chat.getParticipants().contains(currentUser))
            forbittenAction();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getFileType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment;filename=\"" + attachment.getFileName() + "\"")
                .body(new ByteArrayResource(attachment.getData()));
    }

    // Display file contents
    @GetMapping("/view/{fileId}")
    public ResponseEntity<Resource> viewFile(@PathVariable("fileId") Long fileId) throws Exception {
        UserEntity currentUser = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new ChatException("User not found"));
        Chat chat = attachmentService.getAttachment(fileId).getChat();
        if (currentUser == null || !chat.getParticipants().contains(currentUser))
            forbittenAction();
        Attachment attachment = attachmentService.getAttachment(fileId);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getFileType())) // ->  converts a string representation of a file type to a MediaType object
                .body(new ByteArrayResource(attachment.getData()));
    }

    private ResponseEntity<?> forbittenAction() {
        String redirectUrl = "/home";
        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
                .path(redirectUrl)
                .build()
                .toUri();
        return ResponseEntity.status(HttpStatus.FOUND).location(location).build();
    }
}

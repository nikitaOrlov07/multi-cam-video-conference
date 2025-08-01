//package com.example.webConf.controller;
//
//import com.example.webConf.config.exception.ChatException;
//import com.example.webConf.model.attachment.Attachment;
//import com.example.webConf.model.chat.Chat;
//import com.example.webConf.model.user.UserEntity;
//import com.example.webConf.security.SecurityUtil;
//import com.example.webConf.service.AttachmentService;
//import com.example.webConf.service.ChatService;
//import com.example.webConf.service.UserEntityService;
//import lombok.RequiredArgsConstructor;
//import lombok.extern.slf4j.Slf4j;
//import org.springframework.core.io.ByteArrayResource;
//import org.springframework.core.io.Resource;
//import org.springframework.http.HttpHeaders;
//import org.springframework.http.HttpStatus;
//import org.springframework.http.MediaType;
//import org.springframework.http.ResponseEntity;
//import org.springframework.web.bind.annotation.*;
//import org.springframework.web.multipart.MultipartFile;
//import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
//
//import java.net.URI;
//
//@RestController
//@RequiredArgsConstructor
//@Slf4j
//public class AttachmentController {
//
//    private final ChatService chatService;
//    private final UserEntityService userService;
//    private final AttachmentService attachmentService;
//
//    @PostMapping("/upload/{projectId}")
//    public ResponseEntity<Object> uploadFile(@RequestParam("file") MultipartFile file,
//                                             @PathVariable("projectId") Long projectId) throws Exception {
//        Chat chat = chatService.findById(projectId).orElseThrow(() -> new ChatException("Chat not found"));
//        UserEntity user = userService.findByEmail(SecurityUtil.getSessionUserEmail()).orElseThrow(() -> new ChatException("User not found"));
//
//        Attachment attachment = null;
//        if(user == null || !chat.getParticipants().contains(user))
//        {
//            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
//        }
//        attachment = attachmentService.saveAttachment(file,chat,user); // save before creating urls
//        String downloadUrl = ServletUriComponentsBuilder.fromCurrentContextPath() //This means that the initial URL will include the schema (http or https), the domain, and the root context of the application (if any).
//                .path("/download/") // then to path add "/download/" path
//                .path(String.valueOf(attachment.getId())) // and add attachment id to the path
//                .toUriString(); // converts the constructed URI object into a string -> building a URL that can be used to download a file.
//        String viewUrl = ServletUriComponentsBuilder.fromCurrentContextPath()
//                .path("/view/")
//                .path(String.valueOf(attachment.getId()))
//                .toUriString();
//        log.info("Download URL: "+ downloadUrl);
//        log.info("View URL: "+viewUrl);
//
//        attachmentService.updateAttachmentUrls(attachment.getId(),downloadUrl,viewUrl); // update attachment url
//
//        String redirectUrl = "/projects/" + projectId;
//        URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
//                .path(redirectUrl)
//                .build()
//                .toUri();
//        return ResponseEntity.status(HttpStatus.FOUND)
//                .location(location)
//                .build();
//    }
//    // download file
//    @GetMapping("/download/{fileId}")
//    public ResponseEntity<Resource> downloadFile(@PathVariable("fileId") Long fileId) throws Exception // method will return file content and file metadata
//    {
//        Attachment attachment = attachmentService.getAttachment(fileId);
//        UserEntity currentUser = userService.findByUsername(SecurityUtil.getSessionUser());
//        Project project = attachment.getProject();
//        if(currentUser == null || !project.getInvolvedUsers().contains(currentUser))
//        {
//            String redirectUrl = "/home";
//            URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
//                    .path(redirectUrl)
//                    .queryParam("operationError")
//                    .build()
//                    .toUri();
//            return ResponseEntity.status(HttpStatus.FOUND)
//                    .location(location)
//                    .build();
//        }
//        return ResponseEntity.ok() // request was successful
//                .contentType(MediaType.parseMediaType(attachment.getFileType())) // This sets the Content-Type of the file using the fileType stored in the attachment object. MediaType.parseMediaType() converts the string representation of the file type into a MediaType object.
//                .header(HttpHeaders.CONTENT_DISPOSITION ,
//                        "attachment;filename=\"" + attachment.getFileName()+"\"") // Sets the Content-Disposition header. The value "attachment;filename=\"" indicates to the browser that the file should be displayed as an attachment and not opened in the browser. attachment.getFileName() is used to set the file name.
//                .body( new ByteArrayResource(attachment.getData())); // we return the contents of the file as a resource of type ByteArrayResource. This allows Spring to treat the byte array as a data stream for the HTTP response.
//    }
//    // Display file contents
//    @GetMapping("/view/{fileId}")
//    public ResponseEntity<Resource> viewFile(@PathVariable("fileId") Long fileId) throws Exception {
//        UserEntity currentUser = userService.findByUsername(SecurityUtil.getSessionUser());
//        Project project = attachmentService.getAttachment(fileId).getProject();
//        if(currentUser == null || !project.getInvolvedUsers().contains(currentUser))
//        {
//            String redirectUrl = "/home";
//            URI location = ServletUriComponentsBuilder.fromCurrentContextPath()
//                    .path(redirectUrl)
//                    .queryParam("operationError")
//                    .build()
//                    .toUri();
//            return ResponseEntity.status(HttpStatus.FOUND)
//                    .location(location)
//                    .build();
//        }
//        Attachment attachment = attachmentService.getAttachment(fileId);
//        return ResponseEntity.ok()
//                .contentType(MediaType.parseMediaType(attachment.getFileType())) // ->  converts a string representation of a file type to a MediaType object
//                .body(new ByteArrayResource(attachment.getData()));
//    }
//}

package com.example.webConf.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class AttachmentUploadResponse {
    private Long fileId;
    private String fileName;
    private String downloadUrl;
    private String viewUrl;
}

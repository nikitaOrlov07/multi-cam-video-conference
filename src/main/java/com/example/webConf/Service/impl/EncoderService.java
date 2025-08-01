package com.example.webConf.service.impl;

import lombok.RequiredArgsConstructor;
import org.jasypt.encryption.pbe.StandardPBEStringEncryptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

@RequiredArgsConstructor
@Service
public class EncoderService {
    private final StandardPBEStringEncryptor encryptor;

    @Autowired
    public EncoderService(@Value("${jasypt.encryptor.password}") String password,
                          @Value("${jasypt.encryptor.algorithm}") String algorithm) {
        encryptor = new StandardPBEStringEncryptor();
        encryptor.setPassword(password);
        encryptor.setAlgorithm(algorithm);
    }


    public String encryptText(String text) {
        return encryptor.encrypt(text);
    }

    public String decryptText(String text) {
        return encryptor.decrypt(text);
    }

}
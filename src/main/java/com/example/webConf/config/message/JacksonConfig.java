package com.example.webConf.config.message;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class JacksonConfig {
    ///  Define global Object Mapper
    @Bean
    public ObjectMapper objectMapper() {
        ObjectMapper objectMapper = new ObjectMapper();
        objectMapper.registerModule(new JavaTimeModule()); // By default, Jackson does not know how to work with LocalDateTime and other Java 8 Date/Time APIs.
        objectMapper.disable(SerializationFeature.FAIL_ON_EMPTY_BEANS); // Disables an error when serialising classes without explicit fields.
        return objectMapper;
    }
}

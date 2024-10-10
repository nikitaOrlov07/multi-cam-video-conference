package com.example.webConf.Controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@Controller
@Slf4j
public class ConferenceController {


    @GetMapping("/api/room")
    @ResponseBody
    public String getRoomName() {
        String randomRoomName = UUID.randomUUID().toString();
        log.info("Generated room name: {}", randomRoomName);
        return  randomRoomName;
    }
}
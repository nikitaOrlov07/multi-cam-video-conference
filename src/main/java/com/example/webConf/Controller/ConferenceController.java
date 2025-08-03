package com.example.webConf.controller;

import com.example.webConf.config.exception.AuthException;
import com.example.webConf.config.exception.ConferenceException;
import com.example.webConf.dto.conference.ConferenceDto;
import com.example.webConf.mappers.ConferenceMapper;
import com.example.webConf.model.chat.Message;
import com.example.webConf.model.conference.Conference;
import com.example.webConf.model.devices.ConferenceDevices;
import com.example.webConf.model.user.UserEntity;
import com.example.webConf.model.userJoinConference.UserConferenceJoin;
import com.example.webConf.repository.ConferenceDeviceRepository;
import com.example.webConf.repository.ConferenceRepository;
import com.example.webConf.repository.UserConferenceJoinRepository;
import com.example.webConf.repository.UserEntityRepository;
import com.example.webConf.service.ConferenceDevicesService;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.MessageService;
import com.example.webConf.service.UserEntityService;
import com.example.webConf.service.impl.EncoderService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.ui.Model;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.List;
import java.util.Optional;

@Controller
@RequestMapping("/conference")
@Slf4j
@RequiredArgsConstructor
public class ConferenceController {
    private final ConferenceRepository conferenceRepository;
    private final ConferenceDeviceRepository devicesRepository;
    private final UserEntityRepository userEntityRepository;
    private final ConferenceService conferenceService;
    private final UserConferenceJoinRepository userConferenceJoinRepository;
    private final UserEntityService userService;
    private final ObjectMapper objectMapper;
    private final MessageService messageService;

    @GetMapping("/join")
    public String joinConference(@RequestParam(value = "userName", required = false) String userName,
                                 @RequestParam(value = "conferenceId") String conferenceId,
                                 @RequestParam(value = "toDeviceSettings",defaultValue = "false") boolean toDeviceSettingsPage,
                                 RedirectAttributes redirectAttributes) {
        log.info("Join conference controller method called for user [{}] and conference", userName);
        /// Redirecting to device setting page
        if(toDeviceSettingsPage){
            return "redirect:/setDevices?userName="+ userName + "&conferenceId="+ conferenceId;
        }
        /// Find the conference
        Conference conference = conferenceService.findById(conferenceId).orElseThrow(() -> new ConferenceException("Conference not found"));
        if (conference == null) {
            log.error("Conference not found with id: {}", conferenceId);
            throw new ConferenceException("Conference not found");
        }
        ///  Find user
        Optional<UserEntity> user = userService.findUserByUsername(userName);
        if (user.isPresent()) {
            log.info("Create userJoin object for {} user: {} and conference: {}", user.get().getAccountType().toString(), user.get().getId(), conference.getId());
            UserConferenceJoin userConferenceJoin = UserConferenceJoin.builder()
                    .user(user.get())
                    .conference(conference)
                    .joinTime(LocalDateTime.now())
                    .build();

            userConferenceJoinRepository.save(userConferenceJoin);
        } else {
            log.warn("User account not found with username: {}", userName);
        }
        String encodeConferenceId = Base64.getUrlEncoder().encodeToString(conferenceId.getBytes(StandardCharsets.UTF_8));
        String encodeUserName = Base64.getUrlEncoder().encodeToString(userName.getBytes(StandardCharsets.UTF_8));
        redirectAttributes.addAttribute("userName", encodeUserName);
        redirectAttributes.addAttribute("conferenceId", encodeConferenceId);

        return "redirect:/conference";
    }

    @GetMapping
    public String showConference(
            @RequestParam("userName") String userName,
            @RequestParam("conferenceId") String conferenceId,
            Model model) throws JsonProcessingException {
        log.info("Processing conference page request for user: {}, conference: {}", userName, conferenceId);
        /// Decode and Validate input parameters
        conferenceId = new String(Base64.getUrlDecoder().decode(conferenceId), StandardCharsets.UTF_8);
        userName = new String(Base64.getUrlDecoder().decode(userName), StandardCharsets.UTF_8);
        if (StringUtils.isEmpty(conferenceId) || StringUtils.isEmpty(userName)) {
            log.error("Missing required parameters - conferenceId: {}, userName: {}", conferenceId, userName);
            throw new ConferenceException("Missing required parameters");
        }
        UserEntity user = userService.findUserByUsername(userName).orElseThrow(() -> new AuthException("User not found"));
        /// Find conference
        Conference conference = conferenceRepository.findById(conferenceId).orElseThrow(() -> new ConferenceException("Conference not found"));
        Optional<UserConferenceJoin> conferenceJoin = userService.findUserConferenceJoin(user, conference);

        if (conferenceJoin.isEmpty()) {
            throw new ConferenceException("You are not a member of a conference");
        }


        model.addAttribute("userName", userName);
        model.addAttribute("conferenceId", conference.getId());
        model.addAttribute("password", conference.getPassword());

        ///  Chat logic
        if (conference.getChat() != null) {
            List<Message> messages = messageService.findAllChatMessage(conference.getChat().getId());
            model.addAttribute("messagesJson", objectMapper.writeValueAsString(messages));
            model.addAttribute("chatId", conference.getChat().getId());
        }

        /// Find user's devices
        ConferenceDevices devices = devicesRepository.findFirstByUserNameAndConference(userName, conference);
        if (devices == null) {
            log.error("No devices found for user: |{}| in conference: |{}|", userName, conferenceId);
            throw new ConferenceException("Device not found");
        }


        return "conference";
    }

    @PostMapping(path = "/leaveConference")
    @Transactional
    public String leaveConference(@RequestParam("conferenceId") String conferenceId,
                                  @RequestParam("userName") String username) {
        log.info("Processing leave conference request for user: {}, conference: {}", username, conferenceId);

        /// Find Conference by conferenceId
        Optional<Conference> conference = conferenceRepository.findById(conferenceId);
        if (conference.isEmpty()) {
            log.error("Conference not found with id: {}", conferenceId);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Conference not found");
        }

        ///  Find user by username
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        String[] parts = decodedUsername.split(" "); // parts[0] = name , parts[1] = surname
        Optional<UserEntity> optionalUser = Optional.empty();

        /// Find in Permanent Accounts
        if (parts.length > 1) {
            log.info("Searching Permanent Account for user with name: |{}| and surname: |{}|", parts[0], parts[1]);
            optionalUser = userEntityRepository.findFirstByUserNameIgnoreCaseAndAccountType(decodedUsername, UserEntity.AccountType.PERMANENT);
            if (optionalUser.isEmpty()) {
                throw new ConferenceException("User not found in Permanent Accounts with name: |" + parts[0] + "| and surname: |" + parts[1] + "|");
            }
            log.info("Removing user ({}) from active conferense ({}) users", optionalUser.get().getId(), conference.get().getId());
            userService.removeUserConferenceJoin(optionalUser.get(), conference.get());
        }

        /// Find in Temporary Accounts
        if (parts.length <= 1) {
            log.info("Finding user with userName |{}| in Temporary Accounts", parts[0]);
            /// Find in Temporary Accounts
            optionalUser = userEntityRepository.findFirstByUserNameIgnoreCaseAndAccountType(username, UserEntity.AccountType.TEMPORARY);
            // Find Coference Joib Object
            if (userService.findUserConferenceJoin(optionalUser.get(), conference.get()).isPresent()) {
                userService.removeUserConferenceJoin(optionalUser.get(), conference.get());
            }
            userEntityRepository.delete(optionalUser.get()); // delete temporary account
        }

        return "redirect:/home";
    }

    /// Method for updating count of same user in conference
    @GetMapping("/updateUserJoinCount")
    @ResponseBody
    public Integer updateUserJoinCount(@RequestParam(value = "userName", required = false) String userName,
                                       @RequestParam("conferenceId") String conferenceId) {
        log.info("Updating user join count for user: {}, conference: {}", userName, conferenceId);
        if (userName == null || userName.isEmpty() || userName.equals("undefined")) {
            log.error("Missing required parameters - userName: {}", userName);
            return null;
        }
        /// Find conference
        Conference conference = conferenceService.findById(conferenceId).orElseThrow(() -> new ConferenceException("Conference not found"));
        ///  Find user by username
        Optional<UserEntity> userEntity = userService.findUserByUsername(userName);
        if (userEntity.isEmpty() || conference == null) {
            log.error("User or Conference not found");
            return null;
        }
        Integer count = userService.countUserConferenceJoinByUserAndConference(userEntity.get(), conference);
        log.info("User has join count: {}", count);
        return count;
    }

    /// Get conferences by id
    @GetMapping("/searchConferences")
    @ResponseBody
    public List<ConferenceDto> getConferencesById(@RequestParam(name = "query") String conferenceId) {
        return conferenceService.searchConferencesById(conferenceId).stream().map(ConferenceMapper::getConferenceDtoFromConference).toList();
    }

    /// Dynamically change conference password
    @GetMapping("/changePassword/{conferenceId}")
    public ResponseEntity<Void> changePassword(@PathVariable String conferenceId, @RequestParam String password, @RequestParam String userName) {
        return conferenceService.changePassword(conferenceId, password, userName);
    }

    /// Remove Conference from users conferences (only for non active conferences)
    @GetMapping("/removeConference")
    @ResponseBody
    public ResponseEntity<String> removeConference(
            @RequestParam("conferenceId") String conferenceId,
            @RequestParam("userName") String userName) {

        conferenceService.removeUserConference(conferenceId, userName);
        return ResponseEntity.ok("Conference removed successfully");
    }

}
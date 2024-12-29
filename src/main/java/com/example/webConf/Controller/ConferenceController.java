package com.example.webConf.Controller;

import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.Devices.ConferenceDevices;
import com.example.webConf.Model.User.UserEntity;
import com.example.webConf.Repository.ConferenceDeviceRepository;
import com.example.webConf.Repository.ConferenceRepository;
import com.example.webConf.Repository.UserEntityRepository;
import com.example.webConf.Service.ConferenceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.server.ResponseStatusException;

import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
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

    @GetMapping
    public String showConference(
            @RequestParam(value = "userName", required = false) String userName,
            @RequestParam(value = "conferenceId") String conferenceId,
            Model model) {
        log.info("Processing conference page request for user: {}, conference: {}", userName, conferenceId);

        // Validate input parameters
        if (StringUtils.isEmpty(conferenceId) || StringUtils.isEmpty(userName)) {
            log.error("Missing required parameters - conferenceId: {}, userName: {}", conferenceId, userName);
            return "redirect:/home?error=invalid_params";
        }
        // Find conference
        Conference conference = conferenceRepository.findById(conferenceId)
                .orElseGet(() -> {
                    log.error("Conference not found with id: {}", conferenceId);
                    return null;
                });

        if (conference == null) {
            return "redirect:/home?error=conference_not_found";
        }
        model.addAttribute("userName", userName);
        model.addAttribute("conferenceId", conference);

        // Find user's devices
        ConferenceDevices devices = devicesRepository.findFirstByUserNameAndConference(userName, conference);
        if (devices == null) {
            log.error("No devices found for user: |{}| in conference: |{}|", userName, conferenceId);
            return "redirect:/home?error=devices_not_found";
        }
        return "conference";
    }

    @PostMapping(path = "/conference/leaveConference")
    public String leaveConference(@RequestParam("conferenceId") String conferenceId,
                                  @RequestParam("userName") String username) {
        log.info("Processing leave conference request for user: {}, conference: {}", username, conferenceId);

        /// Find Conference by conferenceId
        Optional<Conference> conference = conferenceRepository.findById(conferenceId);
        if (conference.isPresent()) {
            log.error("Conference not found with id: {}", conferenceId);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Conference not found");
        }

        ///  Find user by username
        String decodedUsername = URLDecoder.decode(username, StandardCharsets.UTF_8);
        String[] parts = decodedUsername.split(" "); // parts[0] = name , parts[1] = username
        Optional<UserEntity> optionalUser = Optional.empty();
        // Find in Permanent Accounts
        optionalUser = userEntityRepository.findUserEntityByAccountTypeAndSurnameAndName(UserEntity.AccountType.PERMANENT, parts[0], parts[1]);
        // Find in Temporary Accounts
        if (optionalUser.isEmpty()) {
            log.info("Findind in Temporary Accounts");
            // Find in Temporary Accounts
            optionalUser = userEntityRepository.findUserEntityByAccountTypeAndSurnameAndName(UserEntity.AccountType.TEMPORARY, decodedUsername, null);
            if (optionalUser.isEmpty())
                log.error("User not found with username: {}", decodedUsername);
            conference.get().getActiveUsers().remove(optionalUser.get());
            userEntityRepository.delete(optionalUser.get()); // delete temporary account
        }

        /// Remove entities if account is not in temporary
        if (conference.get().getActiveUsers().contains(optionalUser.get())) {
            log.info("Removing user ({}) from active conferense ({}) users", optionalUser.get().getId(), conference.get().getId());
            conference.get().getActiveUsers().remove(optionalUser.get());
            optionalUser.get().getActiveConferences().remove(conference.get());
            /// Saving changed entities
            userEntityRepository.save(optionalUser.get());
            conferenceRepository.save(conference.get());
        }


        return "redirect::/home";
    }

    ///  Method will be executed every 72 hours to clean up unused conferences and free resources
    @Scheduled(fixedRate = 72 * 60 * 60 * 1000)
    public void executeEvery48Hours() {
        conferenceService.deleteUnusedConferences();
    }
}
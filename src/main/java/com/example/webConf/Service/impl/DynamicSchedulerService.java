package com.example.webConf.service.impl;

import com.example.webConf.model.settings.SettingsEntity;
import com.example.webConf.repository.SettingsEntityRepository;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.UserEntityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.ScheduledFuture;

@Service
@Slf4j
public class DynamicSchedulerService {

    private final TaskScheduler taskScheduler;
    private final SettingsEntityRepository settingsEntityRepository;
    private final ConferenceService conferenceService;
    private final UserEntityService userService;

    private ScheduledFuture<?> conferenceTask;
    private ScheduledFuture<?> userTask;

    public DynamicSchedulerService(SettingsEntityRepository settingsEntityRepository, ConferenceService conferenceService, UserEntityService userService) {
        this.taskScheduler = new ThreadPoolTaskScheduler();
        ((ThreadPoolTaskScheduler) this.taskScheduler).initialize();
        this.settingsEntityRepository = settingsEntityRepository;
        this.conferenceService = conferenceService;
        this.userService = userService;
        scheduleConferenceTask();
        scheduleUserTask();
    }

    /// Delete Unused Conference task
    public void scheduleConferenceTask() {
        long interval = 72 * 60 * 60 * 1000L; // default value

        try {
            Optional<SettingsEntity> settingsOpt = settingsEntityRepository.findFirstByType("conferenceInterval");
            if(settingsOpt.isPresent()){
                interval = Long.parseLong(settingsOpt.get().getValue());
            }
        }
        catch (Exception e) {
            log.warn("Error while scheduling \" Delete unused conferences\" task (Default interval will be used (72 hours)) : {}", e.getMessage());
        }

        if (conferenceTask != null) {
            conferenceTask.cancel(false);
        }

        conferenceTask = taskScheduler.schedule(this::executeConferenceTask,
                new java.util.Date(System.currentTimeMillis() + interval));

    }

    private void executeConferenceTask() {
        conferenceService.deleteUnusedConferences();
        scheduleConferenceTask();
    }

    /// Delete temporary users task
    public void scheduleUserTask() {
        long interval = 60 * 60 * 1000L; // default interval
        try {
            Optional<SettingsEntity> settingsOpt = settingsEntityRepository.findFirstByType("userInterval");
            if(settingsOpt.isPresent()){
                interval = Long.parseLong(settingsOpt.get().getValue());
            }
        }
        catch (Exception e){
            log.warn("Error while scheduling \" Delete temporary Users Accounts\" task (Default interval will be used (1 hour)) : {}", e.getMessage());
        }

        if (userTask != null) {
            userTask.cancel(false);
        }

        userTask = taskScheduler.schedule(this::executeUserTask,
                new java.util.Date(System.currentTimeMillis() + interval));
    }

    private void executeUserTask() {
        userService.deleteUnusedTemporaryAccounts();
        scheduleUserTask();
    }

}

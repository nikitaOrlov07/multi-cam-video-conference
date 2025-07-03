package com.example.webConf.service.impl;

import com.example.webConf.model.settings.SettingsEntity;
import com.example.webConf.repository.SettingsEntityRepository;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.UserEntityService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
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
        Duration interval = Duration.ofHours(72);

        try {
            Optional<SettingsEntity> settingsOpt = settingsEntityRepository.findFirstByType("conferenceInterval");
            if (settingsOpt.isPresent()) {
                long intervalMs = Long.parseLong(settingsOpt.get().getValue());
                interval = Duration.ofMillis(intervalMs);
            }
        } catch (Exception e) {
            log.warn("Error while scheduling \"Delete unused conferences\" task (Default interval will be used (72 hours)): {}", e.getMessage());
        }

        if (conferenceTask != null) {
            conferenceTask.cancel(false);
        }

        Instant nextExecution = Instant.now().plus(interval);
        conferenceTask = taskScheduler.schedule(this::executeConferenceTask, nextExecution);
    }

    private void executeConferenceTask() {
        try {
            log.debug("Executing conference cleanup task");
            conferenceService.deleteUnusedConferences();
        } catch (Exception e) {
            log.error("Error executing conference cleanup task: {}", e.getMessage(), e);
        } finally {
            scheduleConferenceTask();
        }
    }


    /// Delete temporary users task
    public void scheduleUserTask() {
        Duration interval = Duration.ofHours(1);

        try {
            Optional<SettingsEntity> settingsOpt = settingsEntityRepository.findFirstByType("userInterval");
            if (settingsOpt.isPresent()) {
                long intervalMs = Long.parseLong(settingsOpt.get().getValue());
                interval = Duration.ofMillis(intervalMs);
            }
        } catch (Exception e) {
            log.warn("Error while scheduling \"Delete temporary Users Accounts\" task (Default interval will be used (1 hour)): {}", e.getMessage());
        }

        if (userTask != null) {
            userTask.cancel(false);
        }

        Instant nextExecution = Instant.now().plus(interval);
        userTask = taskScheduler.schedule(this::executeUserTask, nextExecution);
    }

    private void executeUserTask() {
        try {
            log.debug("Executing user cleanup task");
            userService.deleteUnusedTemporaryAccounts();
        } catch (Exception e) {
            log.error("Error executing user cleanup task: {}", e.getMessage(), e);
        } finally {
            scheduleUserTask();
        }
    }

}

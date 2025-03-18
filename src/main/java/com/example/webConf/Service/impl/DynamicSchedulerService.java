package com.example.webConf.service.impl;

import com.example.webConf.model.settings.SettingsEntity;
import com.example.webConf.repository.SettingsEntityRepository;
import com.example.webConf.service.ConferenceService;
import com.example.webConf.service.UserEntityService;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.stereotype.Service;

import java.util.Optional;
import java.util.concurrent.ScheduledFuture;

//@Service
//public class DynamicSchedulerService {
//
//    private final TaskScheduler taskScheduler;
//    private final SettingsEntityRepository settingsEntityRepository;
//    private final ConferenceService conferenceService;
//    private final UserEntityService userService;
//
//    private ScheduledFuture<?> conferenceTask;
//    private ScheduledFuture<?> userTask;
//
//    public DynamicSchedulerService(SettingsEntityRepository settingsEntityRepository, ConferenceService conferenceService, UserEntityService userService) {
//        this.taskScheduler = new ThreadPoolTaskScheduler();
//        ((ThreadPoolTaskScheduler) this.taskScheduler).initialize();
//        this.settingsEntityRepository = settingsEntityRepository;
//        this.conferenceService = conferenceService;
//        this.userService = userService;
//        scheduleConferenceTask();
//        scheduleUserTask();
//    }
//
//    /// Delete Unused Conference task
//    public void scheduleConferenceTask() {
//        Optional<SettingsEntity> settingsOpt = settingsEntityRepository.findFirstByType("conferenceInterval");
//
//        long interval = settingsOpt
//                .map(setting -> Long.parseLong(setting.getValue()))
//                .orElse(72 * 60 * 60 * 1000L); // by default task will be executed every 72 hours
//
//        if (conferenceTask != null) {
//            conferenceTask.cancel(false);
//        }
//
//        conferenceTask = taskScheduler.schedule(this::executeConferenceTask,
//                new java.util.Date(System.currentTimeMillis() + interval));
//
//    }
//
//    private void executeConferenceTask() {
//        conferenceService.deleteUnusedConferences();
//        scheduleConferenceTask();
//    }
//
//    /// Delete temporary users task
//    public void scheduleUserTask() {
//        Optional<SettingsEntity> settingsOpt = settingsEntityRepository.findFirstByType("userInterval");
//
//        long interval = settingsOpt
//                .map(setting -> Long.parseLong(setting.getValue()))
//                .orElse(60 * 60 * 1000L); // by default will be executed every hour
//
//        if (userTask != null) {
//            userTask.cancel(false);
//        }
//
//        userTask = taskScheduler.schedule(this::executeUserTask,
//                new java.util.Date(System.currentTimeMillis() + interval));
//    }
//
//    private void executeUserTask() {
//        userService.deleteUnusedTemporaryAccounts();
//        scheduleUserTask();
//    }
//
//}

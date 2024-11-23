package com.example.webConf.Service.impl;
import com.example.webConf.Dto.Devices.CameraDTO;
import com.example.webConf.Dto.Devices.GridSizeDTO;
import com.example.webConf.Model.Conference.Conference;
import com.example.webConf.Model.Devices.ConferenceDevices;
import com.example.webConf.Repository.ConferenceDeviceRepository;
import com.example.webConf.Repository.ConferenceRepository;
import org.opencv.core.*;
import org.opencv.videoio.*;
import org.opencv.imgproc.Imgproc;
import org.opencv.imgcodecs.Imgcodecs;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class VideoMergerService {
    /*
    private static final int FRAME_WIDTH = 640;
    private static final int FRAME_HEIGHT = 480;

    @Autowired
    private JitsiStreamingService jitsiStreamingService;
    @Autowired
    private ConferenceDeviceRepository conferenceDeviceRepository;
    @Autowired
    private  ConferenceRepository conferenceRepository;

    static {
        System.loadLibrary(Core.NATIVE_LIBRARY_NAME);
    }

    public List<VideoCapture> initializeCameras(List<CameraDTO> cameraConfigs) {
        return cameraConfigs.stream()
                .map(this::openCamera)
                .collect(Collectors.toList());
    }

    private VideoCapture openCamera(CameraDTO cameraConfig) {
        VideoCapture capture = new VideoCapture(cameraConfig.getDeviceId());
        if (!capture.isOpened()) {
            throw new RuntimeException("Cannot open camera: " + cameraConfig.getDeviceId());
        }

        capture.set(Videoio.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH);
        capture.set(Videoio.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT);

        return capture;
    }
    private GridSizeDTO calculateGridSize(int deviceCount) {
        // Basic grid size calculation
        int rows = (int) Math.ceil(Math.sqrt(deviceCount));
        int cols = (int) Math.ceil((double) deviceCount / rows);

        GridSizeDTO gridSize = new GridSizeDTO();
        gridSize.setRows(rows);
        gridSize.setCols(cols);
        return gridSize;
    }
    public Mat mergeVideoCameras(List<VideoCapture> cameras, List<CameraDTO> cameraConfigs, GridSizeDTO gridSize) {
        List<VideoCapture> orderedCameras = cameraConfigs.stream()
                .sorted(Comparator.comparingInt(CameraDTO::getOrder))
                .map(config -> findCameraByDeviceId(cameras, config.getDeviceId()))
                .collect(Collectors.toList());

        int rows = gridSize.getRows();
        int cols = gridSize.getCols();

        int totalWidth = FRAME_WIDTH * cols;
        int totalHeight = FRAME_HEIGHT * rows;

        Mat mergedFrame = new Mat(totalHeight, totalWidth, CvType.CV_8UC3, new Scalar(0, 0, 0));

        for (int row = 0; row < rows; row++) {
            for (int col = 0; col < cols; col++) {
                int cameraIndex = row * cols + col;

                if (cameraIndex < orderedCameras.size()) {
                    VideoCapture camera = orderedCameras.get(cameraIndex);
                    Mat frame = new Mat();

                    if (camera.read(frame)) {
                        Mat resizedFrame = new Mat();
                        Imgproc.resize(frame, resizedFrame, new Size(FRAME_WIDTH, FRAME_HEIGHT));

                        Rect roi = new Rect(
                                col * FRAME_WIDTH,
                                row * FRAME_HEIGHT,
                                FRAME_WIDTH,
                                FRAME_HEIGHT
                        );

                        resizedFrame.copyTo(mergedFrame.submat(roi));
                    }
                }
            }
        }

        return mergedFrame;
    }

    public void streamConferenceVideo(String userName, String conferenceId) {
        // Find the conference devices for the specific user
        Conference conference = conferenceRepository.findById(conferenceId)
                .orElseThrow(() -> new RuntimeException("Conference not found"));

        ConferenceDevices devices = conferenceDeviceRepository.findFirstByUserNameAndConference(userName, conference);
        if (devices == null) {
            throw new RuntimeException("No devices found for user");
        }

        // Convert DeviceDTO to CameraDTO
        List<CameraDTO> cameraConfigs = devices.        getDevices().stream()
                .map(deviceDto -> {
                    CameraDTO cameraDTO = new CameraDTO();
                    cameraDTO.setDeviceId(deviceDto.getDeviceId());
                    cameraDTO.setOrder(deviceDto.getOrder());
                    return cameraDTO;
                })
                .collect(Collectors.toList());

        // Calculate grid size based on number of devices
        GridSizeDTO gridSize = calculateGridSize(cameraConfigs.size());

        // Initialize cameras
        List<VideoCapture> cameras = initializeCameras(cameraConfigs);

        try {
            // Continuous streaming loop
            while (true) {
                processAndStreamVideo(cameras, cameraConfigs, gridSize);
                Thread.sleep(33); // Approximately 30 FPS
            }
        } catch (InterruptedException e) {
            log.error("Streaming interrupted", e);
        } finally {
            // Ensure cameras are released
            releaseResources(cameras);
        }
    }

    private VideoCapture findCameraByDeviceId(List<VideoCapture> cameras, String deviceId) {
        return cameras.stream()
                .filter(camera -> isCameraMatchingDeviceId(camera, deviceId))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Camera not found for device ID: " + deviceId));
    }

    private boolean isCameraMatchingDeviceId(VideoCapture camera, String deviceId) {
        try {
            Mat testFrame = new Mat();
            if (camera.read(testFrame)) {
                return true;
            }
        } catch (Exception e) {
            return false;
        }
        return false;
    }

    public void releaseResources(List<VideoCapture> cameras) {
        cameras.forEach(VideoCapture::release);
    }

    private byte[] convertMatToBytes(Mat frame) {
        MatOfByte mob = new MatOfByte();
        Imgcodecs.imencode(".jpg", frame, mob);
        return mob.toArray();
    }

     */
}
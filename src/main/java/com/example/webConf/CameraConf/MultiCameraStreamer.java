package com.example.webConf.CameraConf;

import lombok.extern.slf4j.Slf4j;
import org.opencv.core.*;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.opencv.videoio.VideoCapture;
import org.opencv.videoio.Videoio;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.List;

@Slf4j // for logging
public class MultiCameraStreamer {

    static {
        System.loadLibrary(Core.NATIVE_LIBRARY_NAME);
    }

    private static final int FRAME_WIDTH = 1280;
    private static final int FRAME_HEIGHT = 720;
    private static final int FPS = 30;
    private static final String WEBRTC_SERVER = "http://localhost:8080/stream";

    public static void main(String[] args) throws Exception {
        List<VideoCapture> cameras = new ArrayList<>();

        log.info("Starting searching cameras");
        for (int i = 0; i < 10; i++) {
            VideoCapture camera = new VideoCapture(i);
            if (camera.isOpened()) {
                camera.set(Videoio.CAP_PROP_FRAME_WIDTH, FRAME_WIDTH);
                camera.set(Videoio.CAP_PROP_FRAME_HEIGHT, FRAME_HEIGHT);
                camera.set(Videoio.CAP_PROP_FPS, FPS);
                cameras.add(camera);
                log.info("Camera " + i + " is opened");
            } else {
                camera.release();
            }
        }

        if (cameras.isEmpty()) {
            log.error("No cameras found");
            return;
        }

        Mat combinedFrame = new Mat();
        List<Mat> frames = new ArrayList<>();

        while (true) {
            frames.clear();
            for (VideoCapture camera : cameras) {
                Mat frame = new Mat();
                if (camera.read(frame)) {
                    Imgproc.resize(frame, frame, new Size(FRAME_WIDTH / cameras.size(), FRAME_HEIGHT));
                    frames.add(frame);
                }
            }

            if (frames.isEmpty()) {
               log.error("Failed to capture frames");
               break;
            }

            log.info("Merge frames horizontally");
            Core.hconcat(frames, combinedFrame);

            log.info("send the connected video to the webRtcService");
            sendFrameToWebRTCServer(combinedFrame);

            Thread.sleep(1000 / FPS);  // Pause to match FPS
        }

        //  Freeing up resources
        for (VideoCapture camera : cameras) {
            camera.release();
        }
    }

    private static void sendFrameToWebRTCServer(Mat frame) throws Exception {
        MatOfByte mob = new MatOfByte();
        Imgcodecs.imencode(".jpg", frame, mob);
        byte[] imageBytes = mob.toArray();

        URL url = new URL(WEBRTC_SERVER);
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setRequestMethod("POST");
        con.setDoOutput(true);
        con.setRequestProperty("Content-Type", "image/jpeg");

        try (OutputStream os = con.getOutputStream()) {
            os.write(imageBytes);
        }

        con.getResponseCode();
        con.disconnect();
    }
}
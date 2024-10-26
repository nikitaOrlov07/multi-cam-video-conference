package com.example.webConf.CameraConf;

import lombok.extern.slf4j.Slf4j;
import org.jitsi.service.libjitsi.LibJitsi;
import org.jitsi.service.neomedia.*;
import org.jitsi.service.neomedia.device.MediaDevice;
import org.jitsi.service.neomedia.format.MediaFormatFactory;
import org.jitsi.service.neomedia.format.VideoMediaFormat;
import org.jitsi.utils.MediaType;
import org.opencv.core.*;
import org.opencv.imgcodecs.Imgcodecs;
import org.opencv.imgproc.Imgproc;
import org.opencv.videoio.VideoCapture;
import org.opencv.videoio.Videoio;

import javax.media.Buffer;
import java.net.InetSocketAddress;
import java.util.ArrayList;
import java.util.List;

@Slf4j
public class MultiCameraStreamer {
  /*
    static {
        System.loadLibrary(Core.NATIVE_LIBRARY_NAME);
    }

    private static final int FRAME_WIDTH = 1280;
    private static final int FRAME_HEIGHT = 720;
    private static final int FPS = 30;
    private static final String JVB_HOST = System.getenv("JVB_HOST");
    private static final int JVB_PORT = Integer.parseInt(System.getenv("JVB_PORT"));

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

        // Initialize Jitsi MediaService
        MediaService mediaService = LibJitsi.getMediaService();
        MediaDevice device = new CustomMediaDevice();
        MediaStream mediaStream = mediaService.createMediaStream(device);
        mediaStream.setDirection(MediaDirection.SENDONLY);

        // Create a VideoMediaFormat
        MediaFormatFactory formatFactory = mediaService.getFormatFactory();
        VideoMediaFormat format = formatFactory.createVideoFormat(
                MediaType.VIDEO.toString(),
                FRAME_WIDTH,
                FRAME_HEIGHT,
                FPS
        );

        // Set the format for the media stream
        mediaStream.setFormat(format);

        // Connect to Jitsi Videobridge
        mediaStream.setTarget(new MediaStreamTarget(new InetSocketAddress(JVB_HOST, JVB_PORT), null));
        mediaStream.start();

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

            log.info("Merging frames horizontally");
            Core.hconcat(frames, combinedFrame);

            log.info("Sending the combined video to Jitsi Videobridge");
            sendFrameToJitsi(combinedFrame, mediaStream);

            Thread.sleep(1000 / FPS);  // Pause to match FPS
        }

        // Freeing up resources
        for (VideoCapture camera : cameras) {
            camera.release();
        }
        mediaStream.stop();
        mediaStream.close();
    }

    private static void sendFrameToJitsi(Mat frame, MediaStream mediaStream) throws TransmissionFailedException {
        // Convert OpenCV Mat to byte array
        MatOfByte mob = new MatOfByte();
        Imgcodecs.imencode(".jpg", frame, mob);
        byte[] imageBytes = mob.toArray();

        // Create a RawPacket from the byte array
        RawPacket packet = new RawPacket(imageBytes, 0, imageBytes.length);

        // Inject the RawPacket into the media stream
        mediaStream.injectPacket(packet, true, null);
    }

   */
}

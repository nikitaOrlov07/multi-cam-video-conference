package com.example.webConf.CameraConf;

import org.jitsi.impl.neomedia.device.AudioMediaDeviceImpl;
import org.jitsi.impl.neomedia.device.MediaDeviceImpl;
import org.jitsi.service.neomedia.*;
import org.jitsi.service.neomedia.codec.EncodingConfiguration;
import org.jitsi.service.neomedia.device.MediaDevice;
import org.jitsi.service.neomedia.format.MediaFormat;
import org.springframework.http.MediaType;

import javax.media.Format;
import java.awt.*;
import java.io.IOException;
import java.util.List;

public class CustomMediaDevice { // implements MediaDevice {
    /*
    private final MediaType mediaType;
    private final String deviceIdentifier;
    private MediaDeviceImpl delegate;

    public CustomMediaDevice() {
        this.mediaType = MediaType.VIDEO;
        this.deviceIdentifier = "CustomVideoDevice";
        this.delegate = new MediaDeviceImpl(mediaType, deviceIdentifier) {
            @Override
            public MediaDirection getDirection() {
                return MediaDirection.SENDONLY;
            }
        };
    }

    @Override
    public String getName() {
        return "Custom Multi-Camera Device";
    }

    @Override
    public MediaDirection getDirection() {
        return MediaDirection.SENDONLY;
    }

    @Override
    public MediaType getMediaType() {
        return mediaType;
    }

    @Override
    public String getUID() {
        return deviceIdentifier;
    }

    @Override
    public List<MediaFormat> getSupportedFormats() {
        return delegate.getSupportedFormats();
    }

    @Override
    public MediaFormat getFormat() {
        return delegate.getFormat();
    }

    @Override
    public MediaStream createMediaStream() throws IOException {
        return delegate.createMediaStream();
    }

    @Override
    public EncodingConfiguration getEncodingConfiguration() {
        return delegate.getEncodingConfiguration();
    }

    @Override
    public void setEncodingConfiguration(EncodingConfiguration encodingConfiguration) {
        delegate.setEncodingConfiguration(encodingConfiguration);
    }

    @Override
    public boolean setFormat(MediaFormat format) {
        return delegate.setFormat(format);
    }

    @Override
    public Format getFormatConfiguration() {
        return delegate.getFormatConfiguration();
    }

    @Override
    public void setFormatConfiguration(Format format) {
        delegate.setFormatConfiguration(format);
    }

    @Override
    public Dimension getDefaultSize() {
        return new Dimension(FRAME_WIDTH, FRAME_HEIGHT);
    }

     */
}
# Use Ubuntu 22.04 LTS with OpenJDK 17
FROM ubuntu:22.04

# Avoid timezone prompt during package installation
ENV DEBIAN_FRONTEND=noninteractive
ENV TZ=Etc/UTC

# Install required dependencies
RUN apt-get update && \
    apt-get install -y tzdata openjdk-17-jdk curl \
    libopencv-dev python3-opencv ffmpeg \
    libavcodec-dev libavformat-dev libswscale-dev libv4l-dev \
    libxvidcore-dev libx264-dev libgstreamer1.0-dev \
    libgstreamer-plugins-base1.0-dev && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set Java environment variables
ENV JAVA_HOME=/usr/lib/jvm/java-17-openjdk-amd64
ENV PATH=$JAVA_HOME/bin:$PATH

# Verify Java installation
RUN java -version

# Set working directory
WORKDIR /app

# Copy the application jar file
COPY target/demo-0.0.1-SNAPSHOT.jar /app/app.jar

# Expose port 8080
EXPOSE 8080

# Run the jar file with explicit Java 17 settings
CMD ["java", "-jar", "-XX:+UseContainerSupport", "-XX:MaxRAMPercentage=75.0", "/app/app.jar"]
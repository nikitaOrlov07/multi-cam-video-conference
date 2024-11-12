# Use an official OpenJDK runtime as a parent image
FROM openjdk:11-jdk-slim

  # Install OpenCV dependencies
RUN apt-get update && apt-get install -y \
libopencv-dev \
&& rm -rf /var/lib/apt/lists/*

  # Set the working directory in the container
WORKDIR /app

  # Copy the application jar file into the container
COPY target/demo-0.0.1-SNAPSHOT.jar /app/app.jar


  # Make port 8080 available to the world outside this container
EXPOSE 8080

  # Run the jar file
CMD ["java", "-jar", "/app/app.jar"]
# Use an official OpenJDK runtime as a parent image
FROM openjdk:11-jdk-slim

  # Install OpenCV dependencies
RUN apt-get update && apt-get install -y \
libopencv-dev \
&& rm -rf /var/lib/apt/lists/*

  # Set the working directory in the container
WORKDIR /app

  # Copy the application jar file into the container
COPY target/your-java-app.jar /app/your-java-app.jar

  # Copy OpenCV native library
COPY lib/libopencv_java454.so /usr/lib/libopencv_java454.so

  # Make port 8080 available to the world outside this container
EXPOSE 8080

  # Run the jar file
CMD ["java", "-jar", "/app/your-java-app.jar"]
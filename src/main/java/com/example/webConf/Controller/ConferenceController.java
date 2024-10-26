package com.example.webConf.Controller;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

import java.util.List;
import java.util.Map;

@Controller
@Slf4j
public class ConferenceController {
    @GetMapping("/home")
    public String getHomePage()
    {
        log.info("Home page is working");
        return  "initial-page";
    }
    @GetMapping("/setDevices")
    public String getAvailableCameras(@RequestParam(value = "userName", required = false) String userName,
                                      Model model)
    {
        log.info("Initial device setting page is working");
        model.addAttribute("userName");
        return "device-setting";
    }
    // Метод для приема POST-запроса с выбранными камерами
    @PostMapping("/connect-devices")
    public String connectDevices(@RequestBody Map<String, List<String>> requestBody, RedirectAttributes redirectAttributes) {
        log.info("\"connectDevices\" controller method is working");
        List<String> selectedCameras = requestBody.get("cameras");
        List<String> selectedAudio = requestBody.get("audio");

        boolean noCamerasSelected = selectedCameras == null || selectedCameras.isEmpty();
        boolean noMicrophonesSelected = selectedAudio == null || selectedAudio.isEmpty();

        if (noCamerasSelected) {
            redirectAttributes.addAttribute("noCamerasSelected", true);
        }

        if (noMicrophonesSelected) {
            redirectAttributes.addAttribute("noMicrophoneSelected", true);
        }

        if (!noCamerasSelected || !noMicrophonesSelected) {
            // Логика обработки выбранных устройств
            log.info("Selected cameras: {}", String.join(", ", selectedCameras));
            log.info("Selected audio devices: {}", String.join(", ", selectedAudio));
        }

        return "redirect:/setDevices";
    }


}

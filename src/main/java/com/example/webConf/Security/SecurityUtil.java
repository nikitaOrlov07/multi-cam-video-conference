package com.example.webConf.Security;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

//// Security Context Holder - information storage about user after successful authentication

public class SecurityUtil {
    public static  String getSessionUserEmail()
    {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if(!(authentication instanceof AnonymousAuthenticationToken))// user logged in
        {
            String email = authentication.getName(); // return user email
            return email;
        }
        return null; // if user not logged in
    }
}
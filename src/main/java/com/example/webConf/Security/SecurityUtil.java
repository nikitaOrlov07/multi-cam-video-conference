package com.example.webConf.security;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import java.security.Principal;

//// Security Context Holder - information storage about user after successful authentication

public class SecurityUtil {
    /// Get User Email from Session Spring Security
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
    /// Get User From Principal Object (for webSocket chat)
    public static  String getSessionUserEmail(Principal principal)
    {
        return (principal != null) ? principal.getName() : null;

    }
}
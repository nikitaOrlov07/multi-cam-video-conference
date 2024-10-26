package com.example.webConf.Security;

import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

//// Security Context Holder - information storage about user after successful authentication

public class SecurityUtil {
    public static  String getSessionUser()
    {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if(!(authentication instanceof AnonymousAuthenticationToken))// user logged in
        {
            String surname =authentication.getName();
            return surname;
        }
        return null; // if user not logged in
    }
}
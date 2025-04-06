package com.example.webConf.security;


import com.example.webConf.model.user.UserEntity;
import com.example.webConf.repository.UserEntityRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Service
public class CustomUserDetailsService implements UserDetailsService {
    private UserEntityRepository userEntityRepository;

    @Autowired
    public CustomUserDetailsService(UserEntityRepository userEntityRepository) {
        this.userEntityRepository = userEntityRepository;
    }

    // configure "loadByUsername"
    @Override
    @Transactional
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {//It loads the user by username.
        //If the user is found, the method returns a UserDetails object that represents the user in the Spring Security context.
        //If the user is not found, the method throws a UsernameNotFoundException exception.
        Optional<UserEntity> userEntity = userEntityRepository.findFirstByEmail(email);
        if (userEntity.isPresent()) {
            User authUser = new User(
                    userEntity.get().getEmail(),
                    userEntity.get().getPassword(),
                    userEntity.get().getRoles().stream().map((role) -> new SimpleGrantedAuthority("ROLE_"+role.getName())).collect(Collectors.toList())
            );
            return authUser; // we only can use User entity with 3 arguments constructor - username, password,roles
        } else {
            throw new UsernameNotFoundException("Invalid username or password");
        }
    }


}
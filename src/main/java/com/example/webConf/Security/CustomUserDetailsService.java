package com.example.webConf.Security;



import com.example.webConf.Model.User.UserEntity;
import com.example.webConf.Repository.UserEntityRepository;
import jakarta.transaction.Transactional;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;

import java.util.List;

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
        UserEntity userEntity= userEntityRepository.findFirstByEmail(email);
        if( userEntity != null)
        {
            List<SimpleGrantedAuthority> authorities = List.of(new SimpleGrantedAuthority("ROLE_" + userEntity.getRole()));
            User  authUser= new User(
                    userEntity.getEmail(),
                    userEntity.getPassword() ,
                    authorities
            );
            return authUser; // we only can use User entity with 3 arguments constructor - username, password,roles
        }
        else {
            throw new UsernameNotFoundException("Invalid username or password");
        }
    }


}
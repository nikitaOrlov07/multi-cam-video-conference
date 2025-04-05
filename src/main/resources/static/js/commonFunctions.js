function hideElementAfterDelay(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        setTimeout(() => {
            element.style.display = 'none';
        }, 10000);
    }
}

function handleUserDeletion(id) {
    if (!confirm("Are you sure you want to delete this account?")) {
        return false;
    }

    fetch(`/control/deleteUser/${id}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'ADMIN_DELETE_USER') {
                window.location.href = '/control';
            } else if (data.status === 'SELF_DELETE') {
                window.location.href = '/logout';
            } else {
                console.error('Unexpected response:', data);
                alert('Unexpected response');
            }
        })
        .catch(error => {
            console.error('Full error during deletion:', error);
            alert('An error occurred while deleting the user: ' + error.message);
        });

    return false;
}

function handleUserEditing(id) {
    // Get values from the edit form fields
    const userData = {
        name: document.getElementById('edit-name').value,
        password: document.getElementById('edit-password').value,
        surname: document.getElementById('edit-surname').value,
        email: document.getElementById('edit-email').value,
        city: document.getElementById('edit-city').value,
        country: document.getElementById('edit-country').value,
        address: document.getElementById('edit-address').value
    };

    // Initialize validation state
    let isValid = true;

    // Clear previous error messages
    const errorElements = document.querySelectorAll('.validation-error');
    errorElements.forEach(element => {
        element.remove();
    });

    // Field validation messages
    const requiredFields = ['edit-name', 'edit-surname', 'edit-email'];
    const fieldMessages = {
        'edit-name': 'You need to provide your name',
        'edit-surname': 'You need to provide your surname',
        'edit-email': 'You need to provide your email address'
    };

    // Check required fields
    requiredFields.forEach(fieldId => {
        const input = document.getElementById(fieldId);

        if (!input.value.trim()) {
            // Create and display error message
            displayErrorMessage(input, fieldMessages[fieldId]);
            isValid = false;
        }
    });

    // Email validation
    const emailInput = document.getElementById('edit-email');
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (emailInput.value && !emailPattern.test(emailInput.value)) {
        displayErrorMessage(emailInput, 'Please enter a valid email address');
        isValid = false;
    }

    // If validation passes, submit the form
    if (isValid) {
        submitUserData(id, userData);
    } else {
        console.warn("Required fields were empty or invalid");
        return false;
    }
}

// Function to display error messages under the input fields
function displayErrorMessage(inputElement, message) {
    // Create error element
    const errorElement = document.createElement('div');
    errorElement.className = 'validation-error';
    errorElement.style.color = 'red';
    errorElement.style.fontSize = '0.8rem';
    errorElement.style.marginTop = '4px';
    errorElement.textContent = message;

    // Insert after the input element
    inputElement.parentNode.insertBefore(errorElement, inputElement.nextSibling);
}

// Function to submit user data to the server
function submitUserData(id, userData) {
    fetch(`/control/editUser/${id}`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(userData)
    })
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (data.status === 'ADMIN_EDIT') {
                alert('User information updated successfully');
                window.location.reload();
            } else if (data.status === 'SELF_EDIT') {
                alert('Your information updated successfully');
                window.location.reload();
            } else {
                console.error('Unexpected response:', data);
                alert('Unexpected response');
            }
        })
        .catch(error => {
            console.error('Error during user editing:', error);
            alert('An error occurred while updating the user: ' + error.message);
        });
}
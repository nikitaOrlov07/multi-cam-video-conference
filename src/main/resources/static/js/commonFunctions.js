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

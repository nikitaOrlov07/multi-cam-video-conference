function hideElementAfterDelay(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        setTimeout(() => {
            element.style.display = 'none';
        }, 10000);
    }
}
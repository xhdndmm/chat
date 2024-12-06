function setupNavigation() {
    document.querySelectorAll('nav a').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            document.querySelectorAll('.section').forEach(section => section.classList.remove('active'));
            var target = document.querySelector(this.getAttribute('href'));
            if (target) {
                setTimeout(() => {
                    target.classList.add('active');
                }, 100); 
            }
        });
    });
}
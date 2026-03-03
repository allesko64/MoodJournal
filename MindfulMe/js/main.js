const themes = {
    light: {
        background: '#FAF7F2',
        text: '#2D3436',
        primary: '#5B8A72'
    },
    dark: {
        background: '#1A1A1A',
        text: '#FAF7F2',
        primary: '#7BA896'
    }
};

const userPreferences = {
    theme: 'light',
    notifications: true,
    language: 'en'
};


document.addEventListener('DOMContentLoaded', () => {

    const currentPage = window.location.pathname;
    const navLinks = document.querySelectorAll('.nav-links a');
    
    navLinks.forEach(link => {
        if (link.getAttribute('href').includes(currentPage)) {
            link.classList.add('active');
        }
    });


    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            document.querySelector(this.getAttribute('href')).scrollIntoView({
                behavior: 'smooth'
            });
        });
    });
});


const animateOnScroll = () => {
    const elements = document.querySelectorAll('.animate-on-scroll');
    
    elements.forEach(element => {
        const elementPosition = element.getBoundingClientRect().top;
        const screenPosition = window.innerHeight;
        
        if(elementPosition < screenPosition) {
            element.classList.add('animate');
        }
    });
};

window.addEventListener('scroll', animateOnScroll);

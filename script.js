// Mobile-only check
function checkMobileDevice() {
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < 768;
    
    if (!isMobile && !isSmallScreen) {
        document.querySelector('.desktop-blocker').style.display = 'flex';
        document.querySelector('.mobile-container').style.display = 'none';
    }
}

// Check on load and resize
window.addEventListener('load', checkMobileDevice);
window.addEventListener('resize', checkMobileDevice);

// Property type selection
document.addEventListener('DOMContentLoaded', function() {
    const propertyTypeCards = document.querySelectorAll('.property-type-card');
    
    propertyTypeCards.forEach(card => {
        card.addEventListener('click', function() {
            // Remove active class from all cards
            propertyTypeCards.forEach(c => c.classList.remove('active'));
            // Add active class to clicked card
            this.classList.add('active');
        });
    });

    // Smooth scroll for horizontal scrollable sections
    const scrollContainers = document.querySelectorAll('.property-types, .recent-cards-scroll, .recommendations-scroll');
    
    scrollContainers.forEach(container => {
        let isDown = false;
        let startX;
        let scrollLeft;

        container.addEventListener('mousedown', (e) => {
            isDown = true;
            container.style.cursor = 'grabbing';
            startX = e.pageX - container.offsetLeft;
            scrollLeft = container.scrollLeft;
        });

        container.addEventListener('mouseleave', () => {
            isDown = false;
            container.style.cursor = 'grab';
        });

        container.addEventListener('mouseup', () => {
            isDown = false;
            container.style.cursor = 'grab';
        });

        container.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.pageX - container.offsetLeft;
            const walk = (x - startX) * 2;
            container.scrollLeft = scrollLeft - walk;
        });

        // Touch events for mobile
        let touchStartX = 0;
        let touchScrollLeft = 0;

        container.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].pageX - container.offsetLeft;
            touchScrollLeft = container.scrollLeft;
        });

        container.addEventListener('touchmove', (e) => {
            if (!touchStartX) return;
            const x = e.touches[0].pageX - container.offsetLeft;
            const walk = (x - touchStartX) * 1.5;
            container.scrollLeft = touchScrollLeft - walk;
        });
    });

    // Search input focus and animated placeholder with typing effect
    const searchInput = document.getElementById('search-input');
    const searchButton = document.querySelector('.search-button');
    
    // Property search placeholder examples
    const placeholderTexts = [
        'Search city, locality, landmark...',
        '3 BHK in Vasant Kunj',
        '2 BHK flat in Sector 44, Noida',
        '4 BHK apartment in Golf Course Road',
        'Studio apartment in Connaught Place',
        'Penthouse in DLF Cyber City',
        'Villa in Greater Noida',
        '2 BHK in Dwarka',
        '3 BHK in Rohini',
        'Apartment in Saket',
        'House in Lajpat Nagar'
    ];
    
    let placeholderIndex = 0;
    let typingTimeout = null;
    let isFocused = false;
    let isTyping = false;
    let currentText = '';
    let currentCharIndex = 0;
    let isDeleting = false;
    
    if (searchInput) {
        // Set initial placeholder
        currentText = placeholderTexts[0];
        searchInput.placeholder = '';
        
        function typePlaceholder() {
            if (isFocused || searchInput.value) return;
            
            const targetText = placeholderTexts[placeholderIndex];
            
            if (!isDeleting && currentCharIndex < targetText.length) {
                // Typing
                currentText = targetText.substring(0, currentCharIndex + 1);
                searchInput.placeholder = currentText;
                currentCharIndex++;
                typingTimeout = setTimeout(typePlaceholder, 80);
            } else if (!isDeleting && currentCharIndex >= targetText.length) {
                // Finished typing, wait then start deleting
                isDeleting = true;
                typingTimeout = setTimeout(typePlaceholder, 2000);
            } else if (isDeleting && currentCharIndex > 0) {
                // Deleting
                currentCharIndex--;
                currentText = targetText.substring(0, currentCharIndex);
                searchInput.placeholder = currentText;
                typingTimeout = setTimeout(typePlaceholder, 50);
            } else {
                // Finished deleting, move to next text
                isDeleting = false;
                placeholderIndex = (placeholderIndex + 1) % placeholderTexts.length;
                currentCharIndex = 0;
                currentText = '';
                typingTimeout = setTimeout(typePlaceholder, 300);
            }
        }
        
        // Start typing animation
        typingTimeout = setTimeout(typePlaceholder, 500);
        
        // Stop animation on focus
        searchInput.addEventListener('focus', () => {
            isFocused = true;
            if (typingTimeout) {
                clearTimeout(typingTimeout);
                typingTimeout = null;
            }
            if (!searchInput.value) {
                searchInput.placeholder = 'Search city, locality, landmark...';
            }
            // Force caret to be visible
            searchInput.style.caretColor = 'var(--primary-purple)';
        });
        
        // Resume animation on blur if empty
        searchInput.addEventListener('blur', () => {
            isFocused = false;
            if (!searchInput.value.trim()) {
                placeholderIndex = 0;
                currentCharIndex = 0;
                currentText = '';
                isDeleting = false;
                searchInput.placeholder = '';
                if (!typingTimeout) {
                    typingTimeout = setTimeout(typePlaceholder, 500);
                }
            }
        });
        
        // Ensure caret is visible on click
        searchInput.addEventListener('click', () => {
            searchInput.focus();
            searchInput.style.caretColor = 'var(--primary-purple)';
        });
    }
    
    if (searchInput && searchButton) {
        searchButton.addEventListener('click', () => {
            if (searchInput.value.trim()) {
                console.log('Searching for:', searchInput.value);
                // Add search functionality here
            }
        });

        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && searchInput.value.trim()) {
                console.log('Searching for:', searchInput.value);
                // Add search functionality here
            }
        });
    }

    // Bottom Navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(nav => nav.classList.remove('active'));
            this.classList.add('active');
            const navType = this.getAttribute('data-nav');
            console.log('Navigated to:', navType);
            // Add navigation functionality here
        });
    });
});

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

    // Bottom Sheet functionality - define first so it's available in navItems loop
    const bottomSheet = document.getElementById('bottom-sheet');
    const bottomSheetOverlay = document.querySelector('.bottom-sheet-overlay');
    const scoutyGreetingText = document.getElementById('scouty-greeting-text');
    
    const greetingParts = [
        { text: "I am ", color: "var(--text-dark)" },
        { text: "Scóuty", color: "var(--primary-purple)", bold: true },
        { text: ", here to help you find that dream house", color: "var(--text-dark)" }
    ];
    
    function openBottomSheet() {
        if (!bottomSheet || !scoutyGreetingText) {
            console.error('Bottom sheet elements not found');
            return;
        }
        
        bottomSheet.classList.add('active');
        document.body.style.overflow = 'hidden';
        
        // Animate text character by character
        setTimeout(() => {
            animateText();
        }, 300);
    }
    
    function closeBottomSheet() {
        if (!bottomSheet || !scoutyGreetingText) return;
        
        const scoutyCTA = document.getElementById('scouty-cta');
        
        bottomSheet.classList.remove('active');
        document.body.style.overflow = '';
        scoutyGreetingText.innerHTML = '';
        
        if (scoutyCTA) {
            scoutyCTA.style.display = 'none';
        }
    }
    
    function animateText() {
        if (!scoutyGreetingText) return;
        
        const scoutyCTA = document.getElementById('scouty-cta');
        
        scoutyGreetingText.innerHTML = '';
        let partIndex = 0;
        let charIndex = 0;
        let totalChars = 0;
        let totalCharsCounted = false;
        
        // Count total characters
        if (!totalCharsCounted) {
            greetingParts.forEach(part => {
                totalChars += part.text.length;
            });
            totalCharsCounted = true;
        }
        
        function typeChar() {
            if (partIndex < greetingParts.length) {
                const part = greetingParts[partIndex];
                
                if (charIndex < part.text.length) {
                    const char = part.text[charIndex];
                    const span = document.createElement('span');
                    // Use regular space, not non-breaking space, but keep words together
                    span.textContent = char;
                    if (part.bold) {
                        span.style.fontWeight = '700';
                        span.classList.add('scouty-name');
                    } else {
                        span.style.color = part.color;
                    }
                    scoutyGreetingText.appendChild(span);
                    
                    // Smooth blur fade-in animation
                    requestAnimationFrame(() => {
                        span.classList.add('visible');
                    });
                    
                    
                    charIndex++;
                    setTimeout(typeChar, 50);
                } else {
                    partIndex++;
                    charIndex = 0;
                    setTimeout(typeChar, 60);
                }
            } else {
                // Text animation complete, show CTA
                setTimeout(() => {
                    if (scoutyCTA) {
                        scoutyCTA.style.display = 'block';
                    }
                }, 300);
            }
        }
        
        typeChar();
    }

    // Bottom Navigation - Smooth sliding background animation
    const navItems = document.querySelectorAll('.nav-item');
    const navSliderBg = document.querySelector('.nav-slider-bg');
    const bottomNav = document.querySelector('.bottom-nav');
    
    function updateSliderPosition(activeItem, animate = true) {
        if (!navSliderBg || !activeItem) return;
        
        const navRect = bottomNav.getBoundingClientRect();
        const iconWrapper = activeItem.querySelector('.nav-icon-wrapper');
        
        if (!iconWrapper) return;
        
        const iconRect = iconWrapper.getBoundingClientRect();
        const sliderWidth = 52;
        const sliderHeight = 36;
        
        // Calculate X position: center of icon relative to nav container
        const iconCenterX = iconRect.left + iconRect.width / 2 - navRect.left;
        const sliderLeft = iconCenterX - sliderWidth / 2;
        
        // Calculate Y position: center of icon relative to nav container
        const iconCenterY = iconRect.top + iconRect.height / 2 - navRect.top;
        const sliderTop = iconCenterY - sliderHeight / 2;
        
        // Disable transition for initial load
        if (!animate) {
            navSliderBg.style.transition = 'none';
        }
        
        navSliderBg.style.transform = `translate(${sliderLeft}px, ${sliderTop}px)`;
        
        // Re-enable transition after initial positioning
        if (!animate) {
            // Use requestAnimationFrame to ensure the position is set first
            requestAnimationFrame(() => {
                navSliderBg.style.transition = '';
            });
        }
    }
    
    function handleNavClick(item) {
        // Remove active class from all items
        navItems.forEach(nav => nav.classList.remove('active'));
        
        // Add active class to clicked item
        item.classList.add('active');
        
        // Update slider position with animation
        updateSliderPosition(item, true);
        
        const navType = item.getAttribute('data-nav');
        console.log('Navigated to:', navType);
        // Add navigation functionality here
    }
    
    // Initialize slider position for active item without animation
    const activeItem = document.querySelector('.nav-item.active');
    if (activeItem) {
        // Wait for layout to be ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                updateSliderPosition(activeItem, false);
            });
        } else {
            // Use setTimeout to ensure layout is complete
            setTimeout(() => {
                updateSliderPosition(activeItem, false);
            }, 0);
        }
    }
    
    navItems.forEach((item, index) => {
        const navType = item.getAttribute('data-nav');
        
        // Handle click events
        item.addEventListener('click', function(e) {
            e.stopPropagation();
            
            // Special handling for chat/Scouty
            if (navType === 'chat') {
                e.preventDefault();
                e.stopPropagation();
                console.log('Chat clicked, opening bottom sheet');
                openBottomSheet();
            } else {
                handleNavClick(this);
            }
        });
        
        // Handle touch events for iOS - simplified
        let touchStartTime = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        
        item.addEventListener('touchstart', function(e) {
            touchStartTime = Date.now();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        item.addEventListener('touchend', function(e) {
            const touchEndTime = Date.now();
            const touchEndX = e.changedTouches[0].clientX;
            const touchEndY = e.changedTouches[0].clientY;
            
            const timeDiff = touchEndTime - touchStartTime;
            const xDiff = Math.abs(touchEndX - touchStartX);
            const yDiff = Math.abs(touchEndY - touchStartY);
            
            // Only trigger if it's a quick tap (not a swipe)
            if (timeDiff < 300 && xDiff < 15 && yDiff < 15) {
                e.preventDefault();
                e.stopPropagation();
                
                // Special handling for chat/Scouty
                if (navType === 'chat') {
                    console.log('Chat touched, opening bottom sheet');
                    openBottomSheet();
                } else {
                    handleNavClick(this);
                }
            }
        }, { passive: false });
    });
    
    // Update slider on window resize
    window.addEventListener('resize', () => {
        const activeItem = document.querySelector('.nav-item.active');
        if (activeItem) {
            updateSliderPosition(activeItem);
        }
    });

    // Bottom Sheet overlay click handler
    if (bottomSheetOverlay) {
        bottomSheetOverlay.addEventListener('click', closeBottomSheet);
    }
    
    // Drag to close functionality
    const bottomSheetContent = document.querySelector('.bottom-sheet-content');
    const bottomSheetHandle = document.querySelector('.bottom-sheet-handle');
    let dragStartY = 0;
    let isDragging = false;
    
    function handleDragStart(e) {
        isDragging = true;
        dragStartY = e.touches ? e.touches[0].clientY : e.clientY;
        if (bottomSheetContent) {
            bottomSheetContent.style.transition = 'none';
        }
    }
    
    function handleDragMove(e) {
        if (!isDragging) return;
        
        const currentY = e.touches ? e.touches[0].clientY : e.clientY;
        const deltaY = currentY - dragStartY;
        
        if (deltaY > 0 && bottomSheetContent) {
            bottomSheetContent.style.transform = `translateY(${deltaY}px)`;
        }
    }
    
    function handleDragEnd(e) {
        if (!isDragging) return;
        isDragging = false;
        
        const currentY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const deltaY = currentY - dragStartY;
        
        if (bottomSheetContent) {
            bottomSheetContent.style.transition = '';
            
            if (deltaY > 100) {
                closeBottomSheet();
            } else {
                bottomSheetContent.style.transform = 'translateY(0)';
            }
        }
    }
    
    if (bottomSheetHandle) {
        bottomSheetHandle.addEventListener('touchstart', handleDragStart, { passive: true });
        bottomSheetHandle.addEventListener('touchmove', handleDragMove, { passive: true });
        bottomSheetHandle.addEventListener('touchend', handleDragEnd);
        
        bottomSheetHandle.addEventListener('mousedown', handleDragStart);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    }
    
    if (bottomSheetContent) {
        bottomSheetContent.addEventListener('touchstart', handleDragStart, { passive: true });
        bottomSheetContent.addEventListener('touchmove', handleDragMove, { passive: true });
        bottomSheetContent.addEventListener('touchend', handleDragEnd);
    }
    
    // CTA click handler
    const scoutyCTA = document.getElementById('scouty-cta');
    if (scoutyCTA) {
        scoutyCTA.addEventListener('click', () => {
            console.log('CTA clicked - Get Started');
            // Add navigation functionality here
        });
    }
});

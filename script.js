// Constants
const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const DESKTOP_BREAKPOINT = 768;
const SLIDER_WIDTH = 52;
const SLIDER_HEIGHT = 36;
const DRAG_CLOSE_THRESHOLD = 80;
const TOP_AREA_THRESHOLD = 100;
const TAP_THRESHOLD = 15;
const TAP_TIME_THRESHOLD = 300;

// DOM element cache
let desktopBlocker, mobileContainer, bottomSheet, bottomSheetContent, bottomSheetOverlay;
let bottomSheetHandle, bottomSheetBody, scoutyGreetingText, scoutyCTA;
let navItems, navSliderBg, bottomNav;

// Mobile-only check
function checkMobileDevice() {
    const isMobile = MOBILE_REGEX.test(navigator.userAgent);
    const isSmallScreen = window.innerWidth < DESKTOP_BREAKPOINT;
    
    if (!isMobile && !isSmallScreen) {
        if (desktopBlocker) desktopBlocker.style.display = 'flex';
        if (mobileContainer) mobileContainer.style.display = 'none';
    }
}

// Debounce utility
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize DOM cache
function initDOMCache() {
    desktopBlocker = document.querySelector('.desktop-blocker');
    mobileContainer = document.querySelector('.mobile-container');
    bottomSheet = document.getElementById('bottom-sheet');
    bottomSheetContent = document.querySelector('.bottom-sheet-content');
    bottomSheetOverlay = document.querySelector('.bottom-sheet-overlay');
    bottomSheetHandle = document.querySelector('.bottom-sheet-handle');
    bottomSheetBody = document.querySelector('.bottom-sheet-body');
    scoutyGreetingText = document.getElementById('scouty-greeting-text');
    scoutyCTA = document.getElementById('scouty-cta');
    navItems = document.querySelectorAll('.nav-item');
    navSliderBg = document.querySelector('.nav-slider-bg');
    bottomNav = document.querySelector('.bottom-nav');
}

// Check on load and resize (debounced)
window.addEventListener('load', checkMobileDevice);
window.addEventListener('resize', debounce(checkMobileDevice, 150));

// Property type selection
document.addEventListener('DOMContentLoaded', function() {
    initDOMCache();
    
    const propertyTypeCards = document.querySelectorAll('.property-type-card');
    
    propertyTypeCards.forEach(card => {
        card.addEventListener('click', function() {
            propertyTypeCards.forEach(c => c.classList.remove('active'));
            this.classList.add('active');
        });
    });

    // Smooth scroll for horizontal scrollable sections
    const scrollContainers = document.querySelectorAll('.property-types, .recent-cards-scroll, .recommendations-scroll');
    
    scrollContainers.forEach(container => {
        let isDown = false;
        let startX, scrollLeft;
        let touchStartX = 0;
        let touchScrollLeft = 0;

        // Mouse events
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
            container.scrollLeft = scrollLeft - (x - startX) * 2;
        });

        // Touch events
        container.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].pageX - container.offsetLeft;
            touchScrollLeft = container.scrollLeft;
        }, { passive: true });

        container.addEventListener('touchmove', (e) => {
            if (!touchStartX) return;
            const x = e.touches[0].pageX - container.offsetLeft;
            container.scrollLeft = touchScrollLeft - (x - touchStartX) * 1.5;
        }, { passive: true });
    });

    // Search input placeholder animation
    const searchInput = document.getElementById('search-input');
    const searchButton = document.querySelector('.search-button');
    
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
    let currentCharIndex = 0;
    let isDeleting = false;
    
    if (searchInput) {
        searchInput.placeholder = '';
        
        function typePlaceholder() {
            if (isFocused || searchInput.value) return;
            
            const targetText = placeholderTexts[placeholderIndex];
            
            if (!isDeleting && currentCharIndex < targetText.length) {
                searchInput.placeholder = targetText.substring(0, currentCharIndex + 1);
                currentCharIndex++;
                typingTimeout = setTimeout(typePlaceholder, 80);
            } else if (!isDeleting && currentCharIndex >= targetText.length) {
                isDeleting = true;
                typingTimeout = setTimeout(typePlaceholder, 2000);
            } else if (isDeleting && currentCharIndex > 0) {
                currentCharIndex--;
                searchInput.placeholder = targetText.substring(0, currentCharIndex);
                typingTimeout = setTimeout(typePlaceholder, 50);
            } else {
                isDeleting = false;
                placeholderIndex = (placeholderIndex + 1) % placeholderTexts.length;
                currentCharIndex = 0;
                typingTimeout = setTimeout(typePlaceholder, 300);
            }
        }
        
        typingTimeout = setTimeout(typePlaceholder, 500);
        
        searchInput.addEventListener('focus', () => {
            isFocused = true;
            if (typingTimeout) {
                clearTimeout(typingTimeout);
                typingTimeout = null;
            }
            if (!searchInput.value) {
                searchInput.placeholder = placeholderTexts[0];
            }
            searchInput.style.caretColor = 'var(--primary-purple)';
        });
        
        searchInput.addEventListener('blur', () => {
            isFocused = false;
            if (!searchInput.value.trim()) {
                placeholderIndex = 0;
                currentCharIndex = 0;
                isDeleting = false;
                searchInput.placeholder = '';
                if (!typingTimeout) {
                    typingTimeout = setTimeout(typePlaceholder, 500);
                }
            }
        });
        
        searchInput.addEventListener('click', () => {
            searchInput.focus();
            searchInput.style.caretColor = 'var(--primary-purple)';
        });
    }
    
    if (searchInput && searchButton) {
        const handleSearch = () => {
            if (searchInput.value.trim()) {
                console.log('Searching for:', searchInput.value);
            }
        };
        
        searchButton.addEventListener('click', handleSearch);
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') handleSearch();
        });
    }

    // Bottom Sheet functionality
    let hasAnimated = false;
    let animationTimeout = null;
    let isAnimating = false;
    
    const greetingParts = [
        { text: "I am ", color: "var(--text-dark)" },
        { text: "Scóuty", color: "var(--primary-purple)", bold: true },
        { text: ", here to help you find that dream house!", color: "var(--text-dark)" }
    ];
    
    function createTextSpan(char, part) {
        const span = document.createElement('span');
        span.textContent = char;
        if (part.bold) {
            span.style.fontWeight = '700';
            span.classList.add('scouty-name');
        } else {
            span.style.color = part.color;
        }
        return span;
    }
    
    function showTextImmediately() {
        if (!scoutyGreetingText || isAnimating) return;
        
        // Clear any ongoing animation
        if (animationTimeout) {
            clearTimeout(animationTimeout);
            animationTimeout = null;
        }
        
        scoutyGreetingText.innerHTML = '';
        greetingParts.forEach(part => {
            for (let i = 0; i < part.text.length; i++) {
                const span = createTextSpan(part.text[i], part);
                span.classList.add('visible');
                scoutyGreetingText.appendChild(span);
            }
        });
    }
    
    function openBottomSheet() {
        if (!bottomSheet || !scoutyGreetingText || !bottomSheetContent) return;
        
        // Prevent multiple simultaneous opens
        if (bottomSheet.classList.contains('active')) return;
        
        bottomSheetContent.style.transform = 'translateY(100%)';
        bottomSheetContent.style.transition = 'none';
        
        bottomSheet.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.documentElement.style.overflow = 'hidden';
        document.body.style.position = 'fixed';
        document.body.style.width = '100%';
        
        requestAnimationFrame(() => {
            bottomSheetContent.style.transition = '';
            bottomSheetContent.style.transform = 'translateY(0)';
        });
        
        if (hasAnimated) {
            showTextImmediately();
            if (scoutyCTA) scoutyCTA.style.display = 'flex';
        } else {
            // Clear any existing timeout
            if (animationTimeout) {
                clearTimeout(animationTimeout);
            }
            animationTimeout = setTimeout(() => {
                animateText();
            }, 300);
        }
    }
    
    function closeBottomSheet() {
        if (!bottomSheet || !scoutyGreetingText || !bottomSheetContent) return;
        
        // Clear any ongoing animation
        if (animationTimeout) {
            clearTimeout(animationTimeout);
            animationTimeout = null;
        }
        isAnimating = false;
        
        // Ensure transition is enabled for smooth slide-down
        bottomSheetContent.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Trigger slide-down animation by removing active class
        bottomSheet.classList.remove('active');
        
        // Reset transform to trigger slide-down
        requestAnimationFrame(() => {
            bottomSheetContent.style.transform = 'translateY(100%)';
        });
        
        // Clean up after animation completes
        setTimeout(() => {
            document.body.style.overflow = '';
            document.documentElement.style.overflow = '';
            document.body.style.position = '';
            document.body.style.width = '';
            scoutyGreetingText.innerHTML = '';
            if (scoutyCTA) scoutyCTA.style.display = 'none';
        }, 400);
    }
    
    function animateText() {
        if (!scoutyGreetingText || isAnimating) return;
        
        isAnimating = true;
        
        // Clear any existing content first
        scoutyGreetingText.innerHTML = '';
        
        let partIndex = 0;
        let charIndex = 0;
        let currentTimeout = null;
        
        function typeChar() {
            // Check if animation was cancelled
            if (!isAnimating || !bottomSheet.classList.contains('active')) {
                if (currentTimeout) clearTimeout(currentTimeout);
                isAnimating = false;
                return;
            }
            
            if (partIndex < greetingParts.length) {
                const part = greetingParts[partIndex];
                
                if (charIndex < part.text.length) {
                    const span = createTextSpan(part.text[charIndex], part);
                    scoutyGreetingText.appendChild(span);
                    
                    requestAnimationFrame(() => {
                        if (isAnimating && bottomSheet.classList.contains('active')) {
                            span.classList.add('visible');
                        }
                    });
                    
                    charIndex++;
                    currentTimeout = setTimeout(typeChar, 50);
                } else {
                    partIndex++;
                    charIndex = 0;
                    currentTimeout = setTimeout(typeChar, 60);
                }
            } else {
                // Animation complete
                hasAnimated = true;
                isAnimating = false;
                setTimeout(() => {
                    if (scoutyCTA && bottomSheet.classList.contains('active')) {
                        scoutyCTA.style.display = 'flex';
                    }
                }, 300);
            }
        }
        
        typeChar();
    }

    // Bottom Navigation
    function updateSliderPosition(activeItem, animate = true) {
        if (!navSliderBg || !activeItem || !bottomNav) return;
        
        const iconWrapper = activeItem.querySelector('.nav-icon-wrapper');
        if (!iconWrapper) return;
        
        const navRect = bottomNav.getBoundingClientRect();
        const iconRect = iconWrapper.getBoundingClientRect();
        
        const iconCenterX = iconRect.left + iconRect.width / 2 - navRect.left;
        const iconCenterY = iconRect.top + iconRect.height / 2 - navRect.top;
        const sliderLeft = iconCenterX - SLIDER_WIDTH / 2;
        const sliderTop = iconCenterY - SLIDER_HEIGHT / 2;
        
        if (!animate) {
            navSliderBg.style.transition = 'none';
        }
        
        navSliderBg.style.transform = `translate(${sliderLeft}px, ${sliderTop}px)`;
        
        if (!animate) {
            requestAnimationFrame(() => {
                navSliderBg.style.transition = '';
            });
        }
    }
    
    function handleNavClick(item) {
        navItems.forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');
        updateSliderPosition(item, true);
        
        const navType = item.getAttribute('data-nav');
        console.log('Navigated to:', navType);
    }
    
    // Initialize slider position
    const activeItem = document.querySelector('.nav-item.active');
    if (activeItem) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                updateSliderPosition(activeItem, false);
            });
        } else {
            setTimeout(() => {
                updateSliderPosition(activeItem, false);
            }, 0);
        }
    }
    
    // Nav item event handlers - ensure elements exist
    if (!navItems || navItems.length === 0) {
        console.error('Nav items not found!');
        return;
    }
    
    if (!navSliderBg) {
        console.error('Nav slider bg not found!');
    }
    
    navItems.forEach((item, index) => {
        if (!item) return;
        
        const navType = item.getAttribute('data-nav');
        if (!navType) return;
        
        let touchStartTime = 0;
        let touchStartX = 0;
        let touchStartY = 0;
        
        const handleNavAction = (e) => {
            if (e) {
                e.preventDefault();
                e.stopPropagation();
            }
            
            console.log('Nav clicked:', navType);
            
            // Update active state and slider for all nav items
            navItems.forEach(nav => {
                if (nav) nav.classList.remove('active');
            });
            item.classList.add('active');
            
            if (navSliderBg && bottomNav) {
                updateSliderPosition(item, true);
            }
            
            if (navType === 'chat') {
                // Check if user has already seen the splash screen
                const hasSeenSplash = sessionStorage.getItem('scoutySplashSeen') === 'true';
                if (hasSeenSplash) {
                    // Skip splash, go directly to chat
                    const chatScreen = document.getElementById('chat-screen');
                    if (chatScreen) {
                        // Trigger slide-in animation
                        requestAnimationFrame(() => {
                            chatScreen.classList.add('active');
                        });
                        document.body.style.overflow = 'hidden';
                        // Start placeholder animation
                        setTimeout(() => {
                            const chatInput = document.getElementById('chat-input');
                            if (chatInput && !chatInput.value) {
                                initChatPlaceholderAnimation();
                            }
                        }, 100);
                    }
                } else {
                    // Show splash screen
                    if (typeof openBottomSheet === 'function') {
                        openBottomSheet();
                    }
                }
            } else {
                console.log('Navigated to:', navType);
            }
        };
        
        // Click handler
        item.addEventListener('click', handleNavAction, false);
        
        // Touch handlers for mobile
        item.addEventListener('touchstart', function(e) {
            touchStartTime = Date.now();
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        
        item.addEventListener('touchend', function(e) {
            const timeDiff = Date.now() - touchStartTime;
            const xDiff = Math.abs(e.changedTouches[0].clientX - touchStartX);
            const yDiff = Math.abs(e.changedTouches[0].clientY - touchStartY);
            
            if (timeDiff < TAP_TIME_THRESHOLD && xDiff < TAP_THRESHOLD && yDiff < TAP_THRESHOLD) {
                handleNavAction(e);
            }
        }, { passive: false });
    });
    
    // Debounced resize handler
    window.addEventListener('resize', debounce(() => {
        const activeItem = document.querySelector('.nav-item.active');
        if (activeItem) updateSliderPosition(activeItem);
    }, 150));

    // Bottom Sheet overlay
    if (bottomSheetOverlay) {
        bottomSheetOverlay.addEventListener('click', closeBottomSheet);
    }
    
    // Drag to close functionality
    let dragStartY = 0;
    let dragStartX = 0;
    let isDragging = false;
    let hasMovedDown = false;
    let lastDeltaY = 0;
    
    function isDragStartValid(touchY, target) {
        if (!bottomSheetContent) return false;
        const isHandle = target === bottomSheetHandle || target.closest('.bottom-sheet-handle');
        const contentRect = bottomSheetContent.getBoundingClientRect();
        const isTopArea = touchY < contentRect.top + TOP_AREA_THRESHOLD;
        return isHandle || isTopArea;
    }
    
    function handleDragStart(e) {
        const touchY = e.touches ? e.touches[0].clientY : e.clientY;
        const touchX = e.touches ? e.touches[0].clientX : e.clientX;
        
        if (!isDragStartValid(touchY, e.target)) return;
        
        isDragging = true;
        hasMovedDown = false;
        lastDeltaY = 0;
        dragStartY = touchY;
        dragStartX = touchX;
        
        if (bottomSheetContent) {
            bottomSheetContent.style.transition = 'none';
        }
        
        if (e.preventDefault) e.preventDefault();
    }
    
    function handleDragMove(e) {
        if (!isDragging || !bottomSheetContent) return;
        
        const currentY = e.touches ? e.touches[0].clientY : e.clientY;
        const currentX = e.touches ? e.touches[0].clientX : e.clientX;
        const deltaY = currentY - dragStartY;
        const deltaX = Math.abs(currentX - dragStartX);
        
        // Allow downward drag (deltaY > 0) and ensure it's more vertical than horizontal
        if (deltaY > 0 && deltaY > deltaX * 1.5) {
            hasMovedDown = true;
            lastDeltaY = deltaY;
            bottomSheetContent.style.transform = `translateY(${deltaY}px)`;
            if (e.preventDefault) e.preventDefault();
        }
    }
    
    function handleDragEnd(e) {
        if (!isDragging) {
            // Reset state even if not dragging
            isDragging = false;
            hasMovedDown = false;
            lastDeltaY = 0;
            return;
        }
        
        if (!bottomSheetContent) {
            isDragging = false;
            hasMovedDown = false;
            lastDeltaY = 0;
            return;
        }
        
        isDragging = false;
        
        // Use lastDeltaY if available, otherwise calculate from end position
        const currentY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const finalDeltaY = lastDeltaY > 0 ? lastDeltaY : (currentY - dragStartY);
        
        bottomSheetContent.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
        
        // Close if moved down significantly (lower threshold for better reliability)
        if (hasMovedDown && finalDeltaY > 60) {
            closeBottomSheet();
        } else {
            // Snap back to original position
            bottomSheetContent.style.transform = 'translateY(0)';
        }
        
        // Reset state
        hasMovedDown = false;
        lastDeltaY = 0;
    }
    
    if (bottomSheetHandle) {
        bottomSheetHandle.addEventListener('touchstart', handleDragStart, { passive: false });
        bottomSheetHandle.addEventListener('touchmove', handleDragMove, { passive: false });
        bottomSheetHandle.addEventListener('touchend', handleDragEnd, { passive: false });
        bottomSheetHandle.addEventListener('mousedown', handleDragStart);
        document.addEventListener('mousemove', handleDragMove);
        document.addEventListener('mouseup', handleDragEnd);
    }
    
    // Prevent scrolling on body
    if (bottomSheetBody && bottomSheetContent) {
        let bodyTouchStartY = 0;
        let bodyTouchStartX = 0;
        
        bottomSheetBody.addEventListener('touchstart', function(e) {
            bodyTouchStartY = e.touches[0].clientY;
            bodyTouchStartX = e.touches[0].clientX;
        }, { passive: true });
        
        bottomSheetBody.addEventListener('touchmove', function(e) {
            const currentY = e.touches[0].clientY;
            const currentX = e.touches[0].clientX;
            const deltaY = currentY - bodyTouchStartY;
            const deltaX = Math.abs(currentX - bodyTouchStartX);
            const contentRect = bottomSheetContent.getBoundingClientRect();
            const isTopArea = bodyTouchStartY < contentRect.top + TOP_AREA_THRESHOLD;
            
            if (deltaY < 0 || (!isTopArea && deltaY < 50)) {
                e.preventDefault();
            } else if (isTopArea && deltaY > 0 && deltaY > deltaX * 1.5) {
                e.preventDefault();
            }
        }, { passive: false });
    }
    
    // CTA click handler - Open chat screen
    const chatScreen = document.getElementById('chat-screen');
    const chatBackBtn = document.getElementById('chat-back-btn');
    const chatInput = document.getElementById('chat-input');
    
    if (scoutyCTA) {
        scoutyCTA.addEventListener('click', () => {
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(30);
            }
            
            // Mark splash as seen in sessionStorage (resets on page refresh)
            sessionStorage.setItem('scoutySplashSeen', 'true');
            // Close bottom sheet
            closeBottomSheet();
            // Open chat screen
            if (chatScreen) {
                // Trigger slide-in animation
                requestAnimationFrame(() => {
                    chatScreen.classList.add('active');
                });
                document.body.style.overflow = 'hidden';
                // Start placeholder animation when chat opens
                setTimeout(() => {
                    if (chatInput && !chatInput.value) {
                        initChatPlaceholderAnimation();
                    }
                }, 100);
            }
        });
    }
    
    // Chat placeholder animation
    const chatPlaceholderTexts = [
        'Ask Scouty anything',
        'Help me find 3bhk in Goa',
        'Show me apartments in Mumbai',
        'Find 2bhk flats in Bangalore',
        'Search for villas in Pune',
        'Looking for studio in Delhi'
    ];
    
    let chatPlaceholderIndex = 0;
    let chatTypingTimeout = null;
    let chatIsFocused = false;
    let chatCurrentCharIndex = 0;
    let chatIsDeleting = false;
    let chatCurrentText = '';
    
    function startChatPlaceholderAnimation() {
        if (!chatInput || chatIsFocused || chatInput.value) return;
        
        const targetText = chatPlaceholderTexts[chatPlaceholderIndex];
        
        if (!chatIsDeleting && chatCurrentCharIndex < targetText.length) {
            // Typing
            chatCurrentText = targetText.substring(0, chatCurrentCharIndex + 1);
            chatInput.placeholder = chatCurrentText;
            chatCurrentCharIndex++;
            chatTypingTimeout = setTimeout(startChatPlaceholderAnimation, 80);
        } else if (!chatIsDeleting && chatCurrentCharIndex >= targetText.length) {
            // Finished typing, wait then start deleting
            chatIsDeleting = true;
            chatTypingTimeout = setTimeout(startChatPlaceholderAnimation, 2000);
        } else if (chatIsDeleting && chatCurrentCharIndex > 0) {
            // Deleting
            chatCurrentCharIndex--;
            chatCurrentText = targetText.substring(0, chatCurrentCharIndex);
            chatInput.placeholder = chatCurrentText;
            chatTypingTimeout = setTimeout(startChatPlaceholderAnimation, 50);
        } else {
            // Finished deleting, move to next text
            chatIsDeleting = false;
            chatPlaceholderIndex = (chatPlaceholderIndex + 1) % chatPlaceholderTexts.length;
            chatCurrentCharIndex = 0;
            chatCurrentText = '';
            chatTypingTimeout = setTimeout(startChatPlaceholderAnimation, 800);
        }
    }
    
    // Function to initialize chat placeholder animation
    function initChatPlaceholderAnimation() {
        if (!chatInput) return;
        
        // Reset state
        chatIsFocused = false;
        chatPlaceholderIndex = 0;
        chatCurrentCharIndex = 0;
        chatCurrentText = '';
        chatIsDeleting = false;
        chatInput.placeholder = '';
        
        // Clear any existing timeout
        if (chatTypingTimeout) {
            clearTimeout(chatTypingTimeout);
            chatTypingTimeout = null;
        }
        
        // Start animation after a short delay
        chatTypingTimeout = setTimeout(() => {
            startChatPlaceholderAnimation();
        }, 500);
    }
    
    if (chatInput) {
        // Stop animation on focus
        chatInput.addEventListener('focus', () => {
            chatIsFocused = true;
            if (chatTypingTimeout) {
                clearTimeout(chatTypingTimeout);
                chatTypingTimeout = null;
            }
            if (!chatInput.value) {
                chatInput.placeholder = 'Ask Scouty anything';
            }
        });
        
        // Resume animation on blur if empty
        chatInput.addEventListener('blur', () => {
            chatIsFocused = false;
            if (!chatInput.value.trim()) {
                initChatPlaceholderAnimation();
            }
        });
    }
    
    // Start animation when chat screen opens
    if (chatScreen) {
        // Use MutationObserver to detect when chat screen becomes active
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                    if (chatScreen.classList.contains('active') && chatInput && !chatInput.value) {
                        initChatPlaceholderAnimation();
                    }
                }
            });
        });
        
        observer.observe(chatScreen, {
            attributes: true,
            attributeFilter: ['class']
        });
        
        // Also check if already active
        if (chatScreen.classList.contains('active') && chatInput && !chatInput.value) {
            initChatPlaceholderAnimation();
        }
    }
    
    // Back button - Return to homescreen
    if (chatBackBtn) {
        chatBackBtn.addEventListener('click', () => {
            if (chatScreen) {
                // Trigger slide-out animation
                chatScreen.classList.remove('active');
                chatScreen.classList.remove('keyboard-open');
                
                // Wait for animation to complete before cleaning up
                setTimeout(() => {
                    document.body.style.overflow = '';
                    if (chatInput) {
                        chatInput.blur();
                        // Stop placeholder animation
                        if (chatTypingTimeout) {
                            clearTimeout(chatTypingTimeout);
                            chatTypingTimeout = null;
                        }
                    }
                }, 400);
                }
            }
        });
    }
    
    // Handle keyboard open/close for input
    if (chatInput && chatScreen) {
        let baseViewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
        let isKeyboardOpen = false;
        let resizeTimeout = null;
        
        // Prevent scrolling on chat screen
        chatScreen.addEventListener('scroll', (e) => {
            e.preventDefault();
            chatScreen.scrollTop = 0;
        }, { passive: false });
        
        function handleViewportResize() {
            if (!window.visualViewport) return;
            
            // Clear any pending resize
            if (resizeTimeout) {
                clearTimeout(resizeTimeout);
            }
            
            resizeTimeout = setTimeout(() => {
                const currentHeight = window.visualViewport.height;
                const heightDifference = baseViewportHeight - currentHeight;
                const inputBar = document.querySelector('.chat-input-bar');
                const topBar = document.querySelector('.chat-top-bar');
                
                if (heightDifference > 150) {
                    // Keyboard is open
                    if (!isKeyboardOpen) {
                        isKeyboardOpen = true;
                        chatScreen.classList.add('keyboard-open');
                    }
                    
                    // Calculate position: visualViewport.bottom gives us the distance from bottom
                    const viewportBottom = window.visualViewport.height;
                    const inputBarHeight = inputBar ? inputBar.offsetHeight : 80;
                    const spacing = 16;
                    
                    // Position input bar 16px above keyboard
                    if (inputBar) {
                        const newBottom = window.innerHeight - viewportBottom + spacing;
                        inputBar.style.transition = 'bottom 0.3s ease-out';
                        inputBar.style.bottom = `${newBottom}px`;
                    }
                    
                    // Ensure top bar stays at top
                    if (topBar) {
                        topBar.style.position = 'fixed';
                        topBar.style.top = '0';
                        topBar.style.zIndex = '200';
                    }
                    
                    // Prevent any scrolling
                    document.body.style.overflow = 'hidden';
                    chatScreen.style.overflow = 'hidden';
                } else {
                    // Keyboard is closed
                    if (isKeyboardOpen) {
                        isKeyboardOpen = false;
                        chatScreen.classList.remove('keyboard-open');
                    }
                    
                    // Reset input bar position
                    if (inputBar) {
                        inputBar.style.transition = 'bottom 0.3s ease-out';
                        inputBar.style.bottom = '';
                    }
                    
                    // Ensure top bar stays at top
                    if (topBar) {
                        topBar.style.position = 'fixed';
                        topBar.style.top = '0';
                        topBar.style.zIndex = '200';
                    }
                    
                    // Update base height
                    baseViewportHeight = currentHeight;
                }
            }, 50);
        }
        
        // Update base height when window resizes (but not when keyboard opens)
        window.addEventListener('resize', () => {
            if (window.visualViewport && !isKeyboardOpen) {
                baseViewportHeight = window.visualViewport.height;
            }
        });
        
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', handleViewportResize);
            window.visualViewport.addEventListener('scroll', (e) => {
                e.preventDefault();
            }, { passive: false });
        }
        
        // Haptic feedback on click
        chatInput.addEventListener('click', () => {
            if (navigator.vibrate) {
                navigator.vibrate(25);
            }
        });
        
        chatInput.addEventListener('focus', () => {
            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(25);
            }
            
            // Prevent scrolling
            document.body.style.overflow = 'hidden';
            chatScreen.style.overflow = 'hidden';
            
            // Update base height before keyboard opens
            if (window.visualViewport) {
                baseViewportHeight = window.visualViewport.height;
            }
            
            // Handle keyboard after a short delay
            setTimeout(() => {
                if (window.visualViewport) {
                    handleViewportResize();
                }
            }, 200);
        });
        
        chatInput.addEventListener('blur', () => {
            isKeyboardOpen = false;
            chatScreen.classList.remove('keyboard-open');
            const inputBar = document.querySelector('.chat-input-bar');
            const topBar = document.querySelector('.chat-top-bar');
            
            if (inputBar) {
                inputBar.style.transition = 'bottom 0.3s ease-out';
                inputBar.style.bottom = '';
            }
            
            if (topBar) {
                topBar.style.position = 'fixed';
                topBar.style.top = '0';
                topBar.style.zIndex = '200';
            }
            
            // Update base height
            if (window.visualViewport) {
                baseViewportHeight = window.visualViewport.height;
            }
        });
    }
});

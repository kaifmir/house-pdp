// ============================================================================
// PLATFORM PARITY LAYER
// ============================================================================
// Single source of truth for iOS + Android behavior parity
// Uses feature detection, not UA sniffing (unless absolutely required)
// ============================================================================

// Debug toggle (set window.__CHAT_DEBUG__ = true in console to enable)
window.__CHAT_DEBUG__ = window.__CHAT_DEBUG__ || false;

function parityLog(...args) {
    if (window.__CHAT_DEBUG__) {
        console.log('[Parity]', ...args);
    }
}

// ============================================================================
// PARITY QA CHECKLIST (verify before marking "fixed"):
// ============================================================================
// [ ] Edge fade visible on iOS + Android
// [ ] Pills drift smooth on iOS + Android (no ticking)
// [ ] Manual scroll works on both platforms
// [ ] Keyboard open/close works repeatedly on both (5+ times)
// [ ] Header stays pinned on both platforms
// [ ] Composer sits above keyboard on both platforms
// ============================================================================

// Constants
const MOBILE_REGEX = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
const DESKTOP_BREAKPOINT = 768;
const SLIDER_WIDTH = 52;
const SLIDER_HEIGHT = 36;
const DRAG_CLOSE_THRESHOLD = 80;
const TOP_AREA_THRESHOLD = 100;
const TAP_THRESHOLD = 15;
const TAP_TIME_THRESHOLD = 300;

// Step 4: Measure header/composer heights
function syncHeights() {
    const header = document.querySelector('.chat-top-bar');
    const composer = document.querySelector('.chat-input-bar');
    
    if (header) {
        const headerHeight = header.offsetHeight;
        document.documentElement.style.setProperty('--header-h', `${headerHeight}px`);
    }
    
    if (composer) {
        const composerHeight = composer.offsetHeight;
        document.documentElement.style.setProperty('--composer-h', `${composerHeight}px`);
    }
}

// Step 5: Compute keyboard height using visualViewport (the real fix)
function syncKeyboard() {
    if (!window.visualViewport) return;
    
    const vv = window.visualViewport;
    // keyboard height approx = layout viewport height - visual viewport height - offsetTop
    const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
    
    document.documentElement.style.setProperty('--kb', `${kb}px`);
    
    // Debug logging (remove in production)
    const header = document.querySelector('.chat-top-bar');
    if (header) {
        const headerTop = header.getBoundingClientRect().top;
        console.log('Header top:', headerTop, 'KB height:', kb, 'VV height:', vv.height);
    }
}

// Fix 1: Prime keyboard/viewport calculation on page load + first touch
let primed = false;

function primeViewport() {
    if (primed) return;
    primed = true;
    syncHeights();
    syncKeyboard();
    // run again after a tick to catch late viewport init
    requestAnimationFrame(syncKeyboard);
    setTimeout(syncKeyboard, 50);
}

window.addEventListener('load', primeViewport);
window.addEventListener('touchstart', primeViewport, { passive: true, once: true });
window.addEventListener('pointerdown', primeViewport, { passive: true, once: true });

// Sync heights on resize and orientation change
window.addEventListener('resize', () => {
    syncHeights();
    syncKeyboard();
});
window.addEventListener('orientationchange', () => {
    syncHeights();
    syncKeyboard();
});

// Use visualViewport for Android keyboard compatibility
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', () => {
        syncHeights();
        syncKeyboard();
    });
    window.visualViewport.addEventListener('scroll', () => {
        syncKeyboard();
    });
}

// Fix 2: Prevent focus scroll-jump on iOS (works every time, not just first)
// iOS Safari has quirks where keyboard can cause scroll jumps on every focus
const isIOSDevice = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Step 6: Prevent focus scroll-jump
// Stop the browser from scrolling the window by ensuring window scroll stays at 0
document.addEventListener('focusin', (e) => {
    if (!e.target.matches('input, textarea, [contenteditable="true"]')) return;
    if (!e.target.closest('.chat-screen')) return; // Only for chat inputs
    
    // Prime viewport before focus
    primeViewport();
    
    // iOS-specific: More aggressive scroll prevention needed
    if (isIOSDevice) {
        // Capture current scroll immediately
        const y = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        
        // Immediately prevent scroll (multiple attempts to catch iOS Safari's scroll behavior)
        const preventScroll = () => {
            window.scrollTo(0, y);
            document.documentElement.scrollTop = y;
            document.body.scrollTop = y;
        };
        
        // Apply immediately and multiple times to catch iOS Safari's delayed scroll
        preventScroll();
        requestAnimationFrame(preventScroll);
        setTimeout(preventScroll, 0);
        setTimeout(preventScroll, 10);
        setTimeout(preventScroll, 50);
        setTimeout(preventScroll, 100);
        
        // Force keyboard recalculation multiple times for iOS
        syncKeyboard();
        requestAnimationFrame(syncKeyboard);
        setTimeout(syncKeyboard, 0);
        setTimeout(syncKeyboard, 50);
        setTimeout(syncKeyboard, 100);
    } else {
        // Android: Normal handling (works reliably)
        requestAnimationFrame(() => {
            window.scrollTo(0, 0);
            document.documentElement.scrollTop = 0;
            document.body.scrollTop = 0;
            
            // Sync heights and keyboard after potential layout shift
            syncHeights();
            syncKeyboard();
        });
    }
    
    // Fix 4: Debug logging (remove after verification)
    const header = document.querySelector('.chat-top-bar');
    if (header) {
        const headerTop = header.getBoundingClientRect().top;
        const kb = getComputedStyle(document.documentElement).getPropertyValue('--kb').trim();
        console.log('focusin - headerTop:', headerTop, 'kb:', kb, 'iOS:', isIOSDevice);
    }
}, { passive: true });

// DOM element cache
let desktopBlocker, mobileContainer, bottomSheet, bottomSheetContent, bottomSheetOverlay, bottomSheetCloseBtn;
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
    bottomSheetCloseBtn = document.getElementById('bottom-sheet-close');
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
        // B) Haptics on search click (iOS + Android compatible)
        function playHaptic() {
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            
            if (isIOS) {
                // iOS-specific haptic feedback
                try {
                    // Method 1: WebKit message handler (PWA with native bridge)
                if (window.webkit?.messageHandlers?.haptic) {
                    window.webkit.messageHandlers.haptic.postMessage({ type: 'light' });
                        return;
                    }
                    
                    // Method 2: Audio context workaround for iOS web
                    if (window.AudioContext || window.webkitAudioContext) {
                        const AudioContext = window.AudioContext || window.webkitAudioContext;
                        const audioContext = new AudioContext();
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        oscillator.frequency.value = 1;
                        oscillator.type = 'sine';
                        
                        gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.01);
                        
                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + 0.01);
                        
                        setTimeout(() => {
                            audioContext.close().catch(() => {});
                        }, 20);
                        return;
                }
            } catch (e) {
                    // Silently fail if iOS haptic methods are not available
                }
            }
            
            // Android: Use Vibration API
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        }

        const handleSearch = () => {
            playHaptic(); // Haptic feedback on search click
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
        { text: "Houzy", color: "var(--primary-purple)", bold: true },
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
    
    // Nav item event handlers - SIMPLIFIED APPROACH
    if (!navItems || navItems.length === 0) {
        console.error('Nav items not found!');
    } else {
        console.log('Found', navItems.length, 'nav items');
    }
    
    // Attach event listeners directly to each nav item
    if (navItems && navItems.length > 0) {
        navItems.forEach((item) => {
            if (!item) return;
            
            const navType = item.getAttribute('data-nav');
            if (!navType) return;
            
            // Create handler for this specific item
            const handleNavClick = function(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                
                console.log('Nav clicked:', navType);
                
                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                
                // Update slider position
                if (navSliderBg && bottomNav) {
                    updateSliderPosition(item, true);
                }
                
                // Handle specific nav actions
                if (navType === 'chat') {
                    const hasSeenSplash = sessionStorage.getItem('houzySplashSeen') === 'true';
                    if (hasSeenSplash) {
                        const chatScreen = document.getElementById('chat-screen');
                        if (chatScreen) {
                            requestAnimationFrame(() => {
                                chatScreen.classList.add('active');
                                // Prime viewport when chat screen opens
                                primeViewport();
                            });
                            document.body.style.overflow = 'hidden';
                        // Placeholder animation removed
                        }
                    } else {
                        openBottomSheet();
                    }
                }
            };
            
            // Add click listener
            item.onclick = handleNavClick;
            
            // Add touch listener
            item.ontouchend = function(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                handleNavClick(e);
            };
        });
    }
    
    // Debounced resize handler
    window.addEventListener('resize', debounce(() => {
        const activeItem = document.querySelector('.nav-item.active');
        if (activeItem) updateSliderPosition(activeItem);
    }, 150));

    // Bottom Sheet overlay
    if (bottomSheetOverlay) {
        bottomSheetOverlay.addEventListener('click', closeBottomSheet);
    }
    if (bottomSheetCloseBtn) {
        bottomSheetCloseBtn.addEventListener('click', closeBottomSheet);
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
                navigator.vibrate(10);
            }
            
            // Mark splash as seen in sessionStorage (resets on page refresh)
            sessionStorage.setItem('houzySplashSeen', 'true');
            // Close bottom sheet
            closeBottomSheet();
            // Open chat screen
            if (chatScreen) {
                // Trigger slide-in animation
                requestAnimationFrame(() => {
                    chatScreen.classList.add('active');
                    // Prime viewport when chat screen opens
                    primeViewport();
                });
                document.body.style.overflow = 'hidden';
            }
        });
    }
    
    // Placeholder animation removed - using static placeholder "Got Questions..."
    
    // Setup infinite chips (clone 3x, start in middle) - Two rows layout
    function setupInfiniteChips() {
        const rail = document.getElementById('chipsRail');
        const track = document.getElementById('chipsTrack');
        if (!rail || !track) return null;

        // Get the original chips-set
        const originalSet = track.querySelector('.chips-set');
        if (!originalSet) return null;

        // Clone the set 2 more times (total 3 sets) - maintain 12px gap between sets
        const originalHTML = originalSet.outerHTML;
        track.innerHTML = originalHTML + originalHTML + originalHTML;

        // iOS detection for scrollTo
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        // iOS-safe scroll function
        function setScrollLeft(el, x) {
            if (isIOS && typeof el.scrollTo === "function") {
                el.scrollTo({ left: x, behavior: "auto" });
            } else {
                el.scrollLeft = x;
            }
        }

        const jumpToMiddle = () => {
            if (!rail || !track) return;
            const third = track.scrollWidth / 3;
            if (third > 0) {
                setScrollLeft(rail, third);
            }
        };

        // Safari iOS fix: wait for layout to be ready
        const initScroll = () => {
            requestAnimationFrame(() => {
                jumpToMiddle();
                setTimeout(jumpToMiddle, 100);
                setTimeout(jumpToMiddle, 300);
            });
        };

        initScroll();

        // Handle font loading for proper width calculation
        if (document.fonts?.ready) {
            document.fonts.ready.then(() => {
                setTimeout(jumpToMiddle, 100);
            });
        }

        // Safari iOS: Also recalculate on window load
        if (document.readyState === 'loading') {
            window.addEventListener('load', () => {
                setTimeout(jumpToMiddle, 200);
            });
        }

        // iOS-safe scroll function (reuse from above)
        const isIOSLoop = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                          (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

        function setScrollLeftLoop(el, x) {
            if (isIOSLoop && typeof el.scrollTo === "function") {
                el.scrollTo({ left: x, behavior: "auto" });
            } else {
                el.scrollLeft = x;
            }
        }

        function loopEdges() {
            const third = track.scrollWidth / 3;
            const x = rail.scrollLeft;

            if (x < third * 0.5) setScrollLeftLoop(rail, x + third);
            if (x > third * 1.5) setScrollLeftLoop(rail, x - third);
        }

        rail.addEventListener('scroll', loopEdges, { passive: true });

        return { rail, track, loopEdges };
    }

    // Step 1: Debug probe to diagnose scrollability issues
    function debugChips() {
        const rail = document.getElementById('chipsRail');
        const track = document.getElementById('chipsTrack');
        if (!rail || !track) {
            console.log('chips: missing rail/track');
            return;
        }

        const cs = getComputedStyle(rail);
        console.log('chips debug', {
            railClient: rail.clientWidth,
            railScrollW: rail.scrollWidth,
            trackScrollW: track.scrollWidth,
            railOverflowX: cs.overflowX,
            webkitOverflowScrolling: cs.webkitOverflowScrolling,
            scrollSnapType: cs.scrollSnapType,
            pointerEvents: cs.pointerEvents,
            isScrollable: rail.scrollWidth > rail.clientWidth + 5
        });

        // Can we actually scroll by code?
        const before = rail.scrollLeft;
        if (rail.scrollTo) {
            rail.scrollTo({ left: before + 10, behavior: 'auto' });
        } else {
            rail.scrollLeft = before + 10;
        }
        const after = rail.scrollLeft;
        const moved = Math.abs(after - before) > 0.5;
        console.log('programmatic scroll works?', { before, after, moved });
        
        if (!moved) {
            console.warn('⚠️ Programmatic scroll FAILED - rail may be blocked by preventDefault or scroll-snap');
        }
        if (rail.scrollWidth <= rail.clientWidth + 5) {
            console.warn('⚠️ Rail not scrollable - need more clones or wider content');
        }
    }

    // Step 2: Ensure rail is truly scrollable (clone correctly)
    function ensureScrollable() {
        const rail = document.getElementById('chipsRail');
        const track = document.getElementById('chipsTrack');
        if (!rail || !track) return false;
        return rail.scrollWidth > rail.clientWidth + 5;
    }

    // ============================================================================
    // PILLS AUTO-SCROLL: Transform-based marquee (GPU smooth on iOS + Android)
    // ============================================================================
    // Bulletproof interaction state machine - never gets stuck
    // ============================================================================
    (function() {
        const marquee = document.getElementById('chipsMarquee');
        const track = document.getElementById('chipsTrack');
        if (!marquee || !track) {
            console.warn('chipsMarquee or chipsTrack not found');
            return;
        }

        // Duplicate content for seamless loop (2x)
        const originalHTML = track.innerHTML;
        track.innerHTML = originalHTML + originalHTML;

        // State
        let isDragging = false;
        let isPaused = false;
        let pauseUntil = 0;
        let lastMoveAt = 0;
        let resumeTimer = null;
        let activePointerId = null;

        // Animation state
        let last = 0;
        let x = 0; // current translateX (px)
        const speed = 18; // px/sec subtle (tune 12–24)
        
        // Drag state
        let dragStartX = 0;
        let dragStartOffset = 0;
        
        // Momentum scrolling
        let momentumVelocity = 0;
        let lastDragX = 0;
        let lastDragTime = 0;
        const friction = 0.95; // deceleration factor (0.9-0.98)
        const minVelocity = 0.5; // stop when velocity is below this

        // Helpers
        function now() { return performance.now(); }

        function pause(ms = 900) {
            isPaused = true;
            pauseUntil = Date.now() + ms;
            clearTimeout(resumeTimer);
            resumeTimer = setTimeout(() => { isPaused = false; }, ms);
        }

        function hardResume() {
            isDragging = false;
            isPaused = false;
            pauseUntil = 0;
            activePointerId = null;
        }

        function wrapPosition(pos) {
            const halfWidth = track.scrollWidth / 2;
            if (pos >= halfWidth) {
                return pos - halfWidth;
            } else if (pos <= -halfWidth) {
                return pos + halfWidth;
            }
            return pos;
        }

        // rAF loop - never stops
        function tick(t) {
            if (!last) last = t;
            const dt = (t - last) / 1000;
            last = t;

            const halfWidth = track.scrollWidth / 2;
            const canAuto = !isDragging && (!isPaused || Date.now() > pauseUntil);

            if (isDragging) {
                // Don't animate during drag
            } else if (momentumVelocity !== 0) {
                // Apply momentum scrolling
                x += momentumVelocity * dt;
                momentumVelocity *= friction; // decelerate
                
                // Stop when velocity is too low
                if (Math.abs(momentumVelocity) < minVelocity) {
                    momentumVelocity = 0;
                    pause(100); // small delay then resume
                }
                
                // Wrap position during momentum
                x = wrapPosition(x);
                track.style.transform = `translate3d(${x}px,0,0)`;
            } else if (canAuto) {
                // Auto-scroll
                x -= speed * dt; // move left (use + for right)
                // wrap when we've moved one full set
                if (Math.abs(x) >= halfWidth) {
                    x = 0;
                }
                track.style.transform = `translate3d(${x}px,0,0)`;
            }

            requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);

        // Drag lifecycle
        marquee.addEventListener('pointerdown', (e) => {
            isDragging = true;
            activePointerId = e.pointerId;
            lastMoveAt = now();

            if (marquee.setPointerCapture) {
                marquee.setPointerCapture(e.pointerId);
            }

            // stop auto immediately
            isPaused = true;
            pauseUntil = Date.now() + 999999; // temporarily; will be reset on end

            // Setup drag
            momentumVelocity = 0;
            dragStartX = e.clientX;
            dragStartOffset = x;
            lastDragX = e.clientX;
            lastDragTime = now();
        });

        marquee.addEventListener('pointermove', (e) => {
            if (!isDragging || e.pointerId !== activePointerId) return;
            lastMoveAt = now();
            
            const nowTime = now();
            const dt = (nowTime - lastDragTime) / 1000; // seconds
            const dx = e.clientX - dragStartX;
            x = dragStartOffset + dx;
            
            // Calculate velocity for momentum
            if (dt > 0) {
                const moveX = e.clientX - lastDragX;
                momentumVelocity = moveX / dt; // pixels per second
            }
            
            lastDragX = e.clientX;
            lastDragTime = nowTime;
            track.style.transform = `translate3d(${x}px,0,0)`;
        });

        function endDrag() {
            if (!isDragging) return;
            isDragging = false;
            activePointerId = null;

            // Wrap position on end
            x = wrapPosition(x);
            track.style.transform = `translate3d(${x}px,0,0)`;

            // resume auto after 700–900ms
            pause(850);
        }

        marquee.addEventListener('pointerup', endDrag);
        marquee.addEventListener('pointercancel', endDrag);
        marquee.addEventListener('lostpointercapture', endDrag);
        window.addEventListener('blur', hardResume);
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) hardResume();
        });

        // Touch fallback for iOS (only if pointer events not supported)
        const hasPointerEvents = 'PointerEvent' in window;
        if (!hasPointerEvents) {
            marquee.addEventListener('touchstart', (e) => {
                isDragging = true;
                lastMoveAt = now();
                isPaused = true;
                pauseUntil = Date.now() + 999999;
                dragStartX = e.touches[0].clientX;
                dragStartOffset = x;
                lastDragX = e.touches[0].clientX;
                lastDragTime = now();
            }, { passive: false });

            marquee.addEventListener('touchmove', (e) => {
                if (!isDragging) return;
                lastMoveAt = now();
                const nowTime = now();
                const dt = (nowTime - lastDragTime) / 1000;
                const dx = e.touches[0].clientX - dragStartX;
                x = dragStartOffset + dx;
                
                if (dt > 0) {
                    const moveX = e.touches[0].clientX - lastDragX;
                    momentumVelocity = moveX / dt;
                }
                
                lastDragX = e.touches[0].clientX;
                lastDragTime = nowTime;
                track.style.transform = `translate3d(${x}px,0,0)`;
            }, { passive: false });

            marquee.addEventListener('touchend', endDrag, { passive: true });
            marquee.addEventListener('touchcancel', endDrag, { passive: true });
        }

        // Failsafe: if no pointermove happens for 200ms, auto-resume anyway
        setInterval(() => {
            if (isDragging && (now() - lastMoveAt > 200)) {
                endDrag();
            }
        }, 150);

        // Debug mode
        if (window.__CHIPS_DEBUG__) {
            const debugEl = document.createElement('div');
            debugEl.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.8);color:#fff;padding:8px;font-size:11px;font-family:monospace;z-index:99999;border-radius:4px;';
            document.body.appendChild(debugEl);
            
            function updateDebug() {
                const remaining = pauseUntil > Date.now() ? (pauseUntil - Date.now()) : 0;
                debugEl.textContent = `isDragging: ${isDragging}\nisPaused: ${isPaused}\npauseUntil: ${remaining}ms\nactivePointerId: ${activePointerId}`;
            }
            setInterval(updateDebug, 100);
        }
    })();
    
    // Step 3: Reliable keyboard detection for chat-intro hide/show
    (function () {
        const intro = document.getElementById('chat-intro');
        if (!intro) return;

        let baseVVH = null;
        let keyboardOpen = false;

        function setHiddenState(isOpen) {
            if (isOpen === keyboardOpen) return;
            keyboardOpen = isOpen;
            intro.classList.toggle('is-hidden', isOpen);
        }

        function onVVResize() {
            if (!window.visualViewport) return;

            const vv = window.visualViewport;
            if (baseVVH == null) baseVVH = vv.height;

            // threshold ~120px works well on Android (avoid small UI chrome changes)
            const delta = baseVVH - vv.height;
            const isOpen = delta > 120;

            setHiddenState(isOpen);
        }

        // Prime baseline once user interacts (more accurate on Android)
        function prime() {
            if (window.visualViewport && baseVVH == null) {
                baseVVH = window.visualViewport.height;
                onVVResize();
            }
        }

        window.addEventListener('load', prime);
        window.addEventListener('touchstart', prime, { once: true, passive: true });
        window.addEventListener('pointerdown', prime, { once: true, passive: true });

        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', onVVResize);
            window.visualViewport.addEventListener('scroll', onVVResize);
        }

        // Fallback: focus/blur (only if visualViewport missing)
        document.addEventListener('focusin', (e) => {
            if (!window.visualViewport && e.target.matches('input,textarea')) setHiddenState(true);
        });
        document.addEventListener('focusout', (e) => {
            if (!window.visualViewport && e.target.matches('input,textarea')) setHiddenState(false);
        });
    })();
    
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
                    }
                }, 400);
            }
        });
    }
    
    // Prime viewport on chat screen initialization
    primeViewport();
    
    // ============================================================================
    // KEYBOARD PARITY - Instant, no-jump updates
    // ============================================================================
    // Header stays at top: 0 always, composer moves instantly above keyboard
    // No transitions, no animations, no jumps
    // ============================================================================
    (function keyboardParity() {
        const header = document.querySelector('.chat-top-bar');
        const composer = document.querySelector('.chat-input-bar');
        const input = composer?.querySelector('input, textarea');

        if (!header || !composer || !input) return;

        // Detect iOS for enhanced handling
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

        function setInstantMode(on) {
            if (on) document.documentElement.classList.add('kb-instant');
            else document.documentElement.classList.remove('kb-instant');
        }

        function computeKb() {
            const vv = window.visualViewport;
            if (!vv) return 0;
            const kb = Math.max(0, window.innerHeight - (vv.height + vv.offsetTop));
            return Math.round(kb);
        }

        function apply() {
            const kb = computeKb();
            // header NEVER moves
            header.style.top = '0px';
            header.style.transform = 'translate3d(0, 0, 0)';

            // composer moves instantly above keyboard
            composer.style.bottom = kb ? `${kb}px` : '0px';

            // prevent any forced scroll jumps (critical for iOS)
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;
            window.scrollTo(0, 0);

            setInstantMode(kb > 0);
        }

        function applySoon() {
            apply();
            requestAnimationFrame(apply);
            setTimeout(apply, 0);
            setTimeout(apply, 50);
            
            // iOS: Additional delayed applies to catch late keyboard animations
            if (isIOS) {
                setTimeout(apply, 100);
                setTimeout(apply, 200);
            }
        }

        // Events
        const vv = window.visualViewport;
        if (vv) {
            vv.addEventListener('resize', apply);
            vv.addEventListener('scroll', apply);
            
            // iOS: More frequent updates during keyboard transitions
            if (isIOS) {
                vv.addEventListener('resize', () => {
                    applySoon();
                });
            }
        }
        
        window.addEventListener('orientationchange', applySoon);
        window.addEventListener('pageshow', applySoon);
        
        // Enhanced focus handling for iOS
        document.addEventListener('focusin', (e) => {
            if (e.target === input) {
                // iOS: More aggressive handling to ensure input stays visible
                if (isIOS) {
                    // Prevent scroll immediately
                    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
                    window.scrollTo(0, scrollY);
                    document.documentElement.scrollTop = scrollY;
                    document.body.scrollTop = scrollY;
                }
                applySoon();
            }
        });
        
        document.addEventListener('focusout', (e) => {
            if (e.target === input) {
                applySoon();
            }
        });

        // iOS: Also listen for input events to catch keyboard changes
        if (isIOS) {
            input.addEventListener('focus', () => {
                applySoon();
            });
            input.addEventListener('blur', () => {
                applySoon();
            });
        }

        applySoon();
    })();
    
    // Legacy keyboard handling removed - now using CSS --kb-offset approach above
    // Keep only haptic feedback and scroll prevention
    if (chatInput && chatScreen) {
        // Prevent scrolling on chat screen
        chatScreen.addEventListener('scroll', (e) => {
            e.preventDefault();
            chatScreen.scrollTop = 0;
        }, { passive: false });
        
        // Haptic feedback on click (iOS + Android)
        chatInput.addEventListener('click', () => {
            // Use the centralized haptic function for iOS compatibility
            if (typeof triggerHapticFeedback === 'function') {
                triggerHapticFeedback('subtle');
            } else if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        });
        
        chatInput.addEventListener('focus', () => {
            // Haptic feedback (iOS + Android)
            if (typeof triggerHapticFeedback === 'function') {
                triggerHapticFeedback('subtle');
            } else if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        });
        
        chatInput.addEventListener('blur', () => {
            // Keyboard closing is handled by the visualViewport update function above
            // Don't manually set bottom - let CSS --kb-offset handle it
        });
    }

    // ============================================================================
    // CHAT: Reset - UI only, no conversation logic
    // ============================================================================
    // Chat functionality will be built from scratch
    // Keeping only UI structure and basic setup
    // ============================================================================
    (function chatV1() {
        const chatInput = document.getElementById('chat-input');
        const chatSendBtn = document.getElementById('chat-send-btn');
        const chatMessages = document.getElementById('chat-messages');
        const chatIntro = document.getElementById('chat-intro');
        const chatScreen = document.getElementById('chat-screen');

        if (!chatInput || !chatSendBtn || !chatMessages || !chatIntro) return;
        
        // Debug flag for logging (must be declared before use)
        const DEBUG = false;
        
        // Ensure chat-stack wrapper exists (ChatGPT-style stacking)
        function ensureChatStack() {
            const messages = document.getElementById("chat-messages");
            if (!messages) return;
            
            let stack = document.getElementById("chat-stack");
            if (stack) return;
            
            stack = document.createElement("div");
            stack.id = "chat-stack";
            stack.className = "chat-stack";
            
            // Move all existing children into stack
            while (messages.firstChild) {
                stack.appendChild(messages.firstChild);
            }
            messages.appendChild(stack);
            
            // Ensure sentinel exists at end
            if (!document.getElementById("chat-end")) {
                const end = document.createElement("div");
                end.id = "chat-end";
                stack.appendChild(end);
            }
        }
        
        // Initialize chat stack on load
        ensureChatStack();

        // ============================================================================
        // CHAT RESET: All conversation logic removed
        // UI structure kept, functionality will be built from scratch
        // ============================================================================
        
        // Basic placeholder functions to keep UI working
        function setChatOffsets() {
            const header = document.querySelector(".chat-top-bar");
            const composer = document.querySelector(".chat-input-bar");
            const messages = document.getElementById("chat-messages");
            if (!header || !composer || !messages) return;
            
            const headerH = Math.ceil(header.getBoundingClientRect().height);
            const composerH = Math.ceil(composer.getBoundingClientRect().height);
            
            // Set padding directly on #chat-messages
            messages.style.paddingTop = (headerH + 16) + "px";
            messages.style.paddingBottom = (composerH + 16) + "px";
            
            // Update CSS variables for other uses
            document.documentElement.style.setProperty('--header-height', headerH + 'px');
            document.documentElement.style.setProperty('--composer-h', composerH + 'px');
        }
        
        // Alias for backward compatibility
        function setChatInsets() {
            setChatOffsets();
        }
        
        // Initialize insets on load and resize
        requestAnimationFrame(() => {
            requestAnimationFrame(setChatInsets);
        });
        window.addEventListener("resize", setChatInsets);
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", setChatInsets);
        }

        // Remove chat-spacer completely (it breaks layout)
        // This must be called on load and whenever messages are added
        function removeChatSpacer() {
            const spacer = document.getElementById("chat-spacer");
            if (spacer) {
                spacer.remove();
            }
        }
        
        // Initialize on load - remove spacer immediately
        removeChatSpacer();
        
        // Also remove spacer after any DOM manipulation
        const originalAppendChild = Node.prototype.appendChild;
        Node.prototype.appendChild = function(child) {
            const result = originalAppendChild.call(this, child);
            if (child.id === 'chat-spacer') {
                child.remove();
            }
            return result;
        };

        // ============================================================================
        // CHAT RESET: All conversation logic removed
        // Keeping only minimal state and UI structure
        // ============================================================================
        
        // Messages state (empty - will be built from scratch)
        const messages = [];
        let messageIdCounter = 0;

        // Generate unique message ID
        function generateMessageId() {
            return `msg-${Date.now()}-${++messageIdCounter}`;
        }

        // Scroll helper functions
        function scrollToBottom(options = {}) {
            const end = document.getElementById("chat-end");
            const messages = document.getElementById("chat-messages");
            if (!end || !messages) return;
            
            const force = options.force !== false;
            
            // Only auto-scroll if user is near bottom OR force is true
            if (!force) {
                const threshold = 120;
                const distanceFromBottom = messages.scrollHeight - messages.scrollTop - messages.clientHeight;
                if (distanceFromBottom > threshold) {
                    return; // User has scrolled up, don't auto-scroll
                }
            }
            
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    end.scrollIntoView({ block: "end", behavior: "auto" });
                });
            });
        }
        
        // Scroll message to top of viewport (below header) - the key behavior!
        function scrollMessageIntoView(msgElement, options = {}) {
            if (!msgElement) return;
            
            const messages = domCache.chatMessages;
            if (!messages) return;
            
            const header = domCache.chatTopBar;
            const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 68;
            
            // Get message position relative to messages container
            const msgRect = msgElement.getBoundingClientRect();
            const messagesRect = messages.getBoundingClientRect();
            
            // Calculate where message should be (just below header with some padding)
            const targetTop = headerH + 16; // 16px padding below header
            const currentTop = msgRect.top - messagesRect.top;
            
            // Calculate scroll offset needed
            const scrollOffset = currentTop - targetTop;
            
            // Scroll to position message at top
            messages.scrollTop = messages.scrollTop + scrollOffset;
        }
        
        // Render user message - positions at top of viewport
        function addUserMessage(text) {
            const msgId = generateMessageId();
            const message = {
                id: msgId,
                role: 'user',
                text: text.trim(),
                timestamp: Date.now()
            };
            messages.push(message);
            
            // Create message element
            const msgDiv = document.createElement('div');
            msgDiv.id = msgId;
            msgDiv.className = 'msg msg-user';

                const bubble = document.createElement('div');
                bubble.className = 'bubble';
            bubble.textContent = text.trim();
            
                msgDiv.appendChild(bubble);
            
            // Add to chat stack
            const stack = domCache.chatStack;
            if (stack) {
                stack.appendChild(msgDiv);
                
                // KEY BEHAVIOR: Scroll message to top of viewport (below header)
                // This keeps new messages visible at top instead of scrolling down
            requestAnimationFrame(() => {
                    scrollMessageIntoView(msgDiv);
                });
            }
            
            return msgId;
        }

        // Show typing indicator (loader-5 animation)
        // Haptic feedback utility for mobile devices (iOS + Android)
        function triggerHapticFeedback(intensity = 'medium') {
            // iOS Safari: Use WebKit Haptic Feedback API (if available in PWA context)
            // Fallback: Use audio context workaround for iOS web
            const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
            
            if (isIOS) {
                // iOS-specific haptic feedback
                try {
                    // Method 1: WebKit message handler (PWA with native bridge)
                    if (window.webkit?.messageHandlers?.haptic) {
                        const hapticType = intensity === 'subtle' ? 'light' : intensity === 'medium' ? 'medium' : 'heavy';
                        window.webkit.messageHandlers.haptic.postMessage({ type: hapticType });
                        return;
                    }
                    
                    // Method 2: Audio context workaround for iOS web (creates subtle vibration-like feedback)
                    // This creates a very brief, inaudible audio pulse that iOS interprets as haptic feedback
                    if (window.AudioContext || window.webkitAudioContext) {
                        const AudioContext = window.AudioContext || window.webkitAudioContext;
                        const audioContext = new AudioContext();
                        const oscillator = audioContext.createOscillator();
                        const gainNode = audioContext.createGain();
                        
                        oscillator.connect(gainNode);
                        gainNode.connect(audioContext.destination);
                        
                        // Very low frequency, inaudible
                        oscillator.frequency.value = 1;
                        oscillator.type = 'sine';
                        
                        // Very short duration and low volume
                        const duration = intensity === 'subtle' ? 0.01 : intensity === 'medium' ? 0.02 : 0.03;
                        gainNode.gain.setValueAtTime(0.001, audioContext.currentTime);
                        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + duration);
                        
                        oscillator.start(audioContext.currentTime);
                        oscillator.stop(audioContext.currentTime + duration);
                        
                        // Clean up
                        setTimeout(() => {
                            audioContext.close().catch(() => {});
                        }, duration * 1000 + 10);
                        return;
                    }
                } catch (e) {
                    // Silently fail if iOS haptic methods are not available
                }
            }
            
            // Android: Use Vibration API
            if ('vibrate' in navigator) {
                try {
                    if (intensity === 'subtle') {
                        // Subtle vibration for typing indicator (5ms)
                        navigator.vibrate(5);
                    } else if (intensity === 'medium') {
                        // Medium vibration for bot message (15ms)
                        navigator.vibrate(15);
                    } else if (intensity === 'strong') {
                        // Strong vibration (25ms)
                        navigator.vibrate(25);
                    }
                } catch (e) {
                    // Silently fail if vibration is not allowed or fails
                }
            }
        }
        
        function showTypingIndicator() {
            // Remove any existing typing indicator
            const existing = document.getElementById('typing-indicator');
            if (existing) existing.remove();
            
            // Subtle haptic feedback when bot starts thinking
            triggerHapticFeedback('subtle');
            
            // Create typing indicator message
            const msgDiv = document.createElement('div');
            msgDiv.id = 'typing-indicator';
            msgDiv.className = 'msg msg-bot typing-indicator-msg';
            
            const botContent = document.createElement('div');
            botContent.className = 'bot-message-content';
            
            const typingIndicator = document.createElement('div');
            typingIndicator.className = 'typing-indicator';
            
            // Create loader-5 structure
            const loader = document.createElement('div');
            loader.className = 'loader-5';
            
            const span = document.createElement('span');
            loader.appendChild(span);
            
            typingIndicator.appendChild(loader);
            botContent.appendChild(typingIndicator);
            msgDiv.appendChild(botContent);
            
            // Add to chat stack
            const stack = domCache.chatStack;
            if (stack) {
                stack.appendChild(msgDiv);
            }
            
                    return msgDiv;
        }
        
        // Hide typing indicator
        function hideTypingIndicator() {
            const typingIndicator = document.getElementById('typing-indicator');
            if (typingIndicator) {
                typingIndicator.remove();
            }
        }
        
        // Utility: Remove element by ID (with null check)
        function removeElementById(id) {
            const element = document.getElementById(id);
            if (element) {
                element.remove();
                return true;
            }
            return false;
        }
        
        // Render bot message - appears below user message, no auto-scroll
        function addBotMessage(text, showTyping = true) {
            // Show typing indicator first
            if (showTyping) {
                showTypingIndicator();
            }
            
            // Add longer delay before showing message (realistic thinking time)
            const delay = showTyping ? 1800 + Math.random() * 1000 : 0; // 1800-2800ms delay
            
            setTimeout(() => {
                // Hide typing indicator
                hideTypingIndicator();
                
            const msgId = generateMessageId();
            const message = {
                id: msgId,
                role: 'bot',
                    text: text.trim(),
                    timestamp: Date.now()
            };
            messages.push(message);
                
                // Create message element
                const msgDiv = document.createElement('div');
                msgDiv.id = msgId;
                msgDiv.className = 'msg msg-bot';
                
                const botContent = document.createElement('div');
                botContent.className = 'bot-message-content';
                
                const botText = document.createElement('div');
                botText.className = 'bot-text';
                botText.textContent = text.trim();
                
                botContent.appendChild(botText);
                msgDiv.appendChild(botContent);
                
            // Add to chat stack
            const stack = domCache.chatStack;
            if (stack) {
                stack.appendChild(msgDiv);
                
                // Haptic feedback when bot message appears
                triggerHapticFeedback('medium');
                
                // Bot messages appear below user message - no auto-scroll
                // User can see it in context without page jumping
            }
            }, delay);
            
            return 'typing'; // Return placeholder ID while typing
        }
        
        // Detect if message is a greeting
        function isGreeting(text) {
            const normalized = text.trim().toLowerCase();
            const greetingWords = ['hi', 'hey', 'hello', 'hola', 'namaste', 'hey there', 'hi there', 'hello there'];
            return greetingWords.some(word => normalized === word || normalized.startsWith(word + ' '));
        }
        
        // Generate varied greeting responses
        function getGreetingResponse() {
            const greetings = [
                {
                    text: "Hey! How can I help you with your house search today? Could you tell me what you're looking for - like the BHK size, your budget, whether you want to rent or buy, and which locality you prefer?",
                },
                {
                    text: "Hello! I'd be happy to help you find the perfect home. To get started, could you share a few details? What BHK are you looking for, what's your budget range, are you planning to rent or buy, and which area interests you?",
                },
                {
                    text: "Hi there! Let's find you a great place. To help me search better, could you tell me: what size property you need (BHK), your budget, whether it's for rent or purchase, and your preferred locality?",
                },
                {
                    text: "Hey! Welcome. I'm here to help with your property search. It would be great if you could share: the number of bedrooms you need, your budget, whether you're looking to rent or buy, and which locality you have in mind.",
                },
                {
                    text: "Hello! How can I assist you today? To find the best matches, I'd love to know: what BHK configuration works for you, your budget range, if you're renting or buying, and your preferred location.",
                },
                {
                    text: "Hi! Great to have you here. To help you find the right property, could you let me know: what size home you're looking for (BHK), your budget, whether it's rent or buy, and which locality you prefer?",
                },
                {
                    text: "Hey there! I'm here to help you with your home search. To get started, it would help if you could share: your BHK requirement, budget range, whether you want to rent or buy, and your preferred area or locality.",
                },
                {
                    text: "Hello! Let's find you a wonderful home. Could you help me understand what you're looking for? I'd need to know: the BHK size, your budget, rent or buy preference, and which locality you're interested in.",
                },
                {
                    text: "Hi! How can I help you with your property search today? To make this easier, could you tell me: what BHK you need, your budget, whether you're looking to rent or buy, and your preferred locality?",
                },
                {
                    text: "Hey! Welcome. To help you find the perfect match, I'd appreciate if you could share: the number of bedrooms (BHK), your budget range, whether it's for rent or purchase, and which area you're considering.",
                },
                {
                    text: "Hello there! I'm here to assist with your house search. To get the best results, could you provide: your BHK requirement, budget, rent or buy preference, and the locality you have in mind?",
                },
                {
                    text: "Hi! Great to meet you. Let's find you a home that fits perfectly. Could you share: what size property you need (BHK), your budget, whether you want to rent or buy, and which locality interests you?",
                }
            ];
            
            // Pick a random greeting
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];
            
            return greeting.text;
        }
        
        // Popular localities mapping for major Indian cities (with common misspellings)
        const localityMap = {
                'delhi': [
                'vasant kunj', 'vasantkunj', 'vasant kunj', 'saket', 'saketh', 'dwarka', 'dwarka sector',
                'rohini', 'rohini sector', 'lajpat nagar', 'lajpatnagar', 'lajpat', 'connaught place', 'cp', 'connaught',
                'karol bagh', 'karolbagh', 'rajouri garden', 'rajouri', 'janakpuri', 'pitampura', 'paschim vihar',
                'patel nagar', 'patelnagar', 'greater kailash', 'gk', 'g kailash', 'defence colony', 'defense colony',
                'south extension', 'south ext', 'hauz khas', 'hauzkhas', 'green park', 'munirka', 'vasant vihar',
                'chanakyapuri', 'lodhi road', 'new friends colony', 'nfc', 'friends colony'
            ],
            'gurgaon': [
                'dlf cyber city', 'cyber city', 'cybercity', 'sector 44', 'sector 45', 'sector 46', 'sector 47',
                'sector 48', 'sector 49', 'sector 50', 'sector 51', 'sector 52', 'sector 53', 'sector 54',
                'sector 55', 'sector 56', 'sector 57', 'golf course road', 'golf course', 'golfcourse',
                'golf course extension', 'sushant lok', 'sushantlok', 'dlf phase 1', 'dlf phase 2', 'dlf phase 3',
                'dlf phase 4', 'dlf phase 5', 'dlf phase1', 'dlf phase2', 'sector 29', 'sector 30', 'sector 31',
                'gurugram', 'gurgaon sector'
                ],
                'mumbai': [
                'bandra', 'bandra west', 'bandra east', 'worli', 'worlee', 'andheri', 'andheri west', 'andheri east',
                'powai', 'juhu', 'juhu beach', 'versova', 'versova beach', 'malad', 'malad west', 'kandivali',
                'kandivali west', 'kandivali east', 'borivali', 'borivali west', 'goregaon', 'goregaon west',
                'dadar', 'parel', 'lower parel', 'kurla', 'chembur', 'vikhroli', 'bhandup', 'mulund', 'thane',
                'navi mumbai', 'navi mumbai', 'vashi', 'nerul', 'panvel', 'kharghar', 'kalyan'
            ],
            'chennai': [
                't nagar', 'tnagar', 't nagar', 'thyagaraya nagar', 'anna nagar', 'anna nagar west', 'anna nagar east',
                'velachery', 'omr', 'old mahabalipuram road', 'mahabalipuram road', 'porur', 'adyar', 'besant nagar',
                'nunganambakkam', 'guindy', 'chrompet', 'tambaram', 'pallavaram', 'medavakkam', 'sholinganallur',
                'perungudi', 'thiruvanmiyur', 'mylapore', 'alwarpet', 'ra puram', 'raja annamalai puram', 'egmore',
                'mount road', 'nandanam'
            ],
            'goa': [
                'panaji', 'panjim', 'panjim', 'calangute', 'calangute beach', 'baga', 'baga beach', 'anjuna', 'anjuna beach',
                'vagator', 'vagator beach', 'mapusa', 'margao', 'vasco da gama', 'vasco', 'porvorim', 'candolim',
                'candolim beach', 'sinquerim', 'arambol', 'morjim', 'ashvem', 'mandrem', 'siolim', 'nerul', 'dona paula',
                'miramar', 'caranzalem', 'ribandar', 'old goa', 'pomburpa', 'saligao'
            ],
            'kolkata': [
                'salt lake', 'saltlake', 'salt lake city', 'sector 1', 'sector 2', 'sector 3', 'sector 4', 'sector 5',
                'new town', 'newtown', 'rajarhat', 'park street', 'parkstreet', 'camac street', 'elgin road',
                'ballygunge', 'alipore', 'south city', 'south kolkata', 'north kolkata', 'howrah', 'bidhannagar',
                'behala', 'jodhpur park', 'golf green', 'garia', 'naktala', 'baghajatin'
            ]
        };
        
        // Popular states and their major cities
        const stateCityMap = {
            'delhi': ['delhi', 'new delhi', 'ncr'],
            'haryana': ['gurgaon', 'gurugram', 'faridabad', 'noida', 'greater noida'],
            'maharashtra': ['mumbai', 'pune', 'nagpur', 'nashik'],
            'tamil nadu': ['chennai', 'coimbatore', 'madurai', 'salem'],
            'goa': ['goa', 'panaji', 'panjim', 'margao'],
            'west bengal': ['kolkata', 'howrah', 'durgapur', 'asansol'],
            'karnataka': ['bangalore', 'bengaluru', 'mysore', 'mangalore'],
            'telangana': ['hyderabad', 'secunderabad'],
            'gujarat': ['ahmedabad', 'surat', 'vadodara', 'rajkot'],
            'rajasthan': ['jaipur', 'udaipur', 'jodhpur', 'kota'],
            'punjab': ['chandigarh', 'ludhiana', 'amritsar', 'jalandhar'],
            'uttar pradesh': ['lucknow', 'kanpur', 'agra', 'varanasi', 'noida', 'greater noida'],
            'andhra pradesh': ['visakhapatnam', 'vijayawada', 'guntur', 'nellore']
        };
        
        // Calculate Levenshtein distance for fuzzy matching
        function levenshteinDistance(str1, str2) {
            const matrix = [];
            const len1 = str1.length;
            const len2 = str2.length;
            
            if (len1 === 0) return len2;
            if (len2 === 0) return len1;
            
            for (let i = 0; i <= len2; i++) {
                matrix[i] = [i];
            }
            
            for (let j = 0; j <= len1; j++) {
                matrix[0][j] = j;
            }
            
            for (let i = 1; i <= len2; i++) {
                for (let j = 1; j <= len1; j++) {
                    if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                        matrix[i][j] = matrix[i - 1][j - 1];
                    } else {
                        matrix[i][j] = Math.min(
                            matrix[i - 1][j - 1] + 1,
                            matrix[i][j - 1] + 1,
                            matrix[i - 1][j] + 1
                        );
                    }
                }
            }
            
            return matrix[len2][len1];
        }
        
        // Calculate similarity ratio (0 to 1)
        function similarity(str1, str2) {
            const maxLen = Math.max(str1.length, str2.length);
            if (maxLen === 0) return 1;
            const distance = levenshteinDistance(str1, str2);
            return 1 - (distance / maxLen);
        }
        
        // Capitalize first letter of each word
        function capitalizeWords(str) {
            if (!str) return str;
            return str.split(' ').map(word => {
                if (word.length === 0) return word;
                return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
            }).join(' ');
        }
        
        // Normalize locality name for matching (handles common typos)
        function normalizeLocality(text) {
            return text.toLowerCase()
                .replace(/[^\w\s]/g, ' ')           // Remove special characters
                .replace(/\s+/g, ' ')              // Normalize whitespace
                .replace(/\b(sec|sector)\s*(\d+)/gi, 'sector $2') // Normalize "sec 44" to "sector 44"
                .replace(/\b(ph|phase)\s*(\d+)/gi, 'phase $2')     // Normalize "ph 1" to "phase 1"
                .replace(/\b(rd|road)\b/gi, 'road')                // Normalize "rd" to "road"
                .replace(/\b(st|street)\b/gi, 'street')            // Normalize "st" to "street"
                .replace(/\b(nagr|nagar)\b/gi, 'nagar')            // Handle "nagr" typo
                .replace(/\b(kunj|kunz)\b/gi, 'kunj')               // Handle "kunz" typo
                .replace(/\b(delhi|dilli|delhi)\b/gi, 'delhi')     // Handle "dilli" variation
                .trim();
        }
        
        // Fuzzy match locality with tolerance for typos
        function fuzzyMatchLocality(input, locality, threshold = 0.75) {
            const normalizedInput = normalizeLocality(input);
            const normalizedLocality = normalizeLocality(locality);
            
            // Exact match
            if (normalizedInput.includes(normalizedLocality) || normalizedLocality.includes(normalizedInput)) {
                return true;
            }
            
            // Check similarity
            const sim = similarity(normalizedInput, normalizedLocality);
            if (sim >= threshold) {
                return true;
            }
            
            // Check if words match (handles "vasant kunj" vs "vasantkunj")
            const inputWords = normalizedInput.split(/\s+/);
            const localityWords = normalizedLocality.split(/\s+/);
            
            if (inputWords.length === localityWords.length) {
                let matches = 0;
                for (let i = 0; i < inputWords.length; i++) {
                    if (similarity(inputWords[i], localityWords[i]) >= 0.8) {
                        matches++;
                    }
                }
                if (matches / inputWords.length >= 0.7) {
                    return true;
                }
            }
            
            return false;
        }
        
        // Detect and validate locality from user input (with fuzzy matching for typos)
        function detectLocality(text) {
            const normalized = normalizeLocality(text);
            
            // First, check if user mentioned a major city (with fuzzy matching)
            for (const [city, localities] of Object.entries(localityMap)) {
                // Check if city name is mentioned (fuzzy match)
                if (normalized.includes(city) || fuzzyMatchLocality(text, city, 0.7)) {
                    // Check if specific locality is mentioned (fuzzy match)
                    for (const locality of localities) {
                        if (fuzzyMatchLocality(text, locality, 0.75)) {
                            return {
                                city: capitalizeWords(city),
                                locality: capitalizeWords(locality),
                                fullName: `${capitalizeWords(locality)}, ${capitalizeWords(city)}`
                            };
                        }
                    }
                    // City mentioned but no specific locality - return city
                    return {
                        city: capitalizeWords(city),
                        locality: null,
                        fullName: capitalizeWords(city)
                    };
                }
            }
            
            // Check for specific localities (without city context) with fuzzy matching
            for (const [city, localities] of Object.entries(localityMap)) {
                for (const locality of localities) {
                    if (fuzzyMatchLocality(text, locality, 0.75)) {
                        return {
                            city: capitalizeWords(city),
                            locality: capitalizeWords(locality),
                            fullName: `${capitalizeWords(locality)}, ${capitalizeWords(city)}`
                        };
                    }
                }
            }
            
            // Check for major cities from state map
            for (const [state, cities] of Object.entries(stateCityMap)) {
                for (const city of cities) {
                    if (normalized.includes(city)) {
                        return {
                            city: capitalizeWords(city),
                            locality: null,
                            fullName: capitalizeWords(city)
                        };
                    }
                }
            }
            
            // If no match found, try to extract any capitalized location words
            // (fallback to previous pattern matching)
            const locationPatterns = [
                /\b(in|at|near|around|from)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
                /\b([A-Z][a-z]+\s+(?:Sector|Road|Street|Avenue|Nagar|Colony|Extension|Phase))\s*(\d+)?/gi,
                /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Sector|Road|Street|Avenue|Nagar|Colony|Extension|Phase)/gi,
                /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\b/g
            ];
            
            for (const pattern of locationPatterns) {
                const matches = [...text.matchAll(pattern)];
                if (matches.length > 0) {
                    const match = matches[matches.length - 1];
                    let locality = match[2] || match[1] || match[0];
                    locality = locality.replace(/^(in|at|near|around|from)\s+/i, '').trim();
                    
                    const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'what', 'where', 'when', 'how', 'can', 'will', 'want', 'looking', 'search', 'find', 'show', 'need', 'bhk', 'bedroom', 'bed', 'rent', 'buy', 'price', 'budget', 'cr', 'crore', 'lakh', 'lakhs'];
                    if (locality.length >= 3 && !commonWords.includes(locality.toLowerCase())) {
                        const capitalizedLocality = capitalizeWords(locality);
            return {
                            city: null,
                            locality: capitalizedLocality,
                            fullName: capitalizedLocality
                        };
                    }
                }
            }
            
            return null;
        }
        
        // Conversation state - tracks what we know about user's search
        let conversationState = {
            intent: null, // 'rent' or 'buy'
            bhk: null, // number of bedrooms
            price: null, // price range
            priceMin: null,
            priceMax: null,
            locality: null, // locality/city name
            city: null, // major city
            isComplete: false
        };
        
        // User location state
        let userLocation = {
            latitude: null,
            longitude: null,
            hasLocation: false
        };
        
        // Local property images - using optimized HOUSE 1-5 images from local folder
        // Optimized JPEG format (1200px max width, 85% quality) - ~94% smaller file size
        // Same images used for cards, gallery, and brochures
        const PROPERTY_IMAGE_POOL = [
            'HOUSE 1.jpg',
            'HOUSE 2.jpg',
            'HOUSE 3.jpg',
            'HOUSE 4.jpg',
            'HOUSE 5.jpg'
        ];
        
        // Memoization cache for stable image selection across re-renders
        // Key: carouselId, Value: Map<propertyId, imageUrl> - final mapping for that carousel
        const carouselImageMappingCache = new Map();
        
        // Deterministic hash function for propertyId (optionally includes carouselId)
        function hashPropertyId(propertyId, carouselId = '') {
            const seed = `${propertyId}-${carouselId}`;
            let hash = 0;
            for (let i = 0; i < seed.length; i++) {
                const char = seed.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash);
        }
        
        // Get next available image from pool - ensures main property cards get unique images
        // For main cards: assigns sequentially (no duplicates)
        // For galleries: cycles through available images
        function getNextAvailableImage(usedImageUrls, forGallery = false) {
            // Find first available image that hasn't been used
            for (let i = 0; i < PROPERTY_IMAGE_POOL.length; i++) {
                const image = PROPERTY_IMAGE_POOL[i];
                if (!usedImageUrls.has(image)) {
                    if (!forGallery) {
                        usedImageUrls.add(image); // Only track main card images in usedImageUrls
                    }
                    return image;
                }
            }
            
            // If all images used (for galleries), cycle through them
            const cycleIndex = usedImageUrls.size % PROPERTY_IMAGE_POOL.length;
            return PROPERTY_IMAGE_POOL[cycleIndex];
        }
        
        // Clean up old cache entries (keep last 10 carousels)
        function cleanupImageCache() {
            if (carouselImageMappingCache.size > 10) {
                const firstKey = carouselImageMappingCache.keys().next().value;
                carouselImageMappingCache.delete(firstKey);
            }
        }
        
        // Property praise texts for brochures
        // Indian Developer Names
        const INDIAN_DEVELOPER_NAMES = [
            'DLF Limited',
            'Godrej Properties',
            'Prestige Group',
            'Sobha Limited',
            'Brigade Group',
            'Mahindra Lifespaces',
            'Shapoorji Pallonji',
            'Lodha Group',
            'Tata Housing',
            'Raheja Developers',
            'M3M India',
            'Emaar India',
            'Adani Realty',
            'Signature Global',
            'Ansal API'
        ];

        const PROPERTY_PRAISE_TEXTS = [
            "Luxury living redefined with world-class amenities and premium finishes throughout.",
            "Experience the epitome of modern architecture with spacious layouts and elegant design.",
            "Premium lifestyle destination featuring state-of-the-art facilities and breathtaking views.",
            "Sophisticated living spaces crafted with attention to detail and exceptional quality.",
            "Your dream home awaits with contemporary design and unmatched luxury amenities.",
            "Exclusive residential project offering the perfect blend of comfort and elegance.",
            "Premium residences designed for those who appreciate fine living and quality craftsmanship."
        ];
        
        // Cached DOM elements (lazy initialization)
        const domCache = {
            get chatStack() {
                return this._chatStack || (this._chatStack = document.getElementById('chat-stack'));
            },
            get chatMessages() {
                return this._chatMessages || (this._chatMessages = document.getElementById('chat-messages'));
            },
            get chatTopBar() {
                return this._chatTopBar || (this._chatTopBar = document.querySelector('.chat-top-bar'));
            },
            get chatInputBar() {
                return this._chatInputBar || (this._chatInputBar = document.querySelector('.chat-input-bar'));
            },
            clear() {
                this._chatStack = null;
                this._chatMessages = null;
                this._chatTopBar = null;
                this._chatInputBar = null;
            }
        };
        
        // Utility: Get random item from array
        function getRandomItem(array) {
            return array[Math.floor(Math.random() * array.length)];
        }
        
        // Utility: Select unique items from array
        function selectUniqueItems(array, count, excludeSet = new Set()) {
            const available = array.filter(item => !excludeSet.has(item));
            if (available.length === 0) return [];
            
            const selected = [];
            const used = new Set(excludeSet);
            const shuffled = shuffleArray([...available]);
            
            for (let i = 0; i < Math.min(count, shuffled.length); i++) {
                const item = shuffled[i];
                if (!used.has(item)) {
                    selected.push(item);
                    used.add(item);
                }
            }
            
            return selected;
        }
        
        // Reset conversation state
        function resetConversationState() {
            conversationState = {
                intent: null,
                bhk: null,
                price: null,
                priceMin: null,
                priceMax: null,
                locality: null,
                city: null,
                isComplete: false,
                useLocation: false
            };
        }
        
        // Normalize text - handle spacing, typos, and common variations
        function normalizeText(text) {
            return text.toLowerCase()
                .replace(/\s+/g, ' ')           // Normalize multiple spaces to single space
                .replace(/[^\w\s]/g, ' ')       // Replace special chars with space
                .replace(/\s+/g, ' ')           // Normalize spaces again
                .trim();
        }
        
        // Fuzzy match common words with typos - more aggressive matching
        function fuzzyMatchWord(input, target, threshold = 0.65) {
            const inputNorm = normalizeText(input);
            const targetNorm = target.toLowerCase().trim();
            
            // Exact match
            if (inputNorm.includes(targetNorm)) return true;
            
            // Check if target is contained in input (handles spacing issues)
            const inputWords = inputNorm.split(/\s+/);
            for (const word of inputWords) {
                if (word.includes(targetNorm) || targetNorm.includes(word)) {
                    if (word.length >= targetNorm.length * 0.6) return true; // At least 60% length match
                }
            }
            
            // Check similarity with lower threshold for better typo tolerance
            const sim = similarity(inputNorm, targetNorm);
            if (sim >= threshold) return true;
            
            // Check Levenshtein distance for close matches
            const distance = levenshteinDistance(inputNorm, targetNorm);
            const maxLen = Math.max(inputNorm.length, targetNorm.length);
            if (maxLen > 0) {
                const similarityScore = 1 - (distance / maxLen);
                if (similarityScore >= threshold) return true;
            }
            
            // Check word-by-word similarity
            for (const word of inputWords) {
                const wordSim = similarity(word, targetNorm);
                if (wordSim >= threshold) return true;
                
                // Also check Levenshtein distance for individual words
                const wordDistance = levenshteinDistance(word, targetNorm);
                const wordMaxLen = Math.max(word.length, targetNorm.length);
                if (wordMaxLen > 0) {
                    const wordSimilarityScore = 1 - (wordDistance / wordMaxLen);
                    if (wordSimilarityScore >= threshold) return true;
                }
            }
            
            return false;
        }
        
        // Common misspellings map (expanded for better typo tolerance)
        const misspellings = {
            'rent': ['rent', 'renting', 'rental', 'rentel', 'rentt', 'rennt', 'rnt', 'rents', 'ren', 'renta'],
            'buy': ['buy', 'buying', 'purchase', 'purchse', 'purchas', 'by', 'bui', 'buyy', 'purchaze', 'purchaze'],
            'bhk': ['bhk', 'bhks', 'bedroom', 'bedrooms', 'bed room', 'bed rooms', 'br', 'brs', 'bed', 'beds', 'bh', 'bk'],
            'thousand': ['thousand', 'thousands', 'thou', 'thousnd', 'thousnad', 'thousan', 'thous', 'k', 'kilo', 'thousnad', 'thousnad'],
            'lakh': ['lakh', 'lakhs', 'lac', 'lacs', 'lak', 'lakhh', 'lakhss', 'laksh', 'lakhsh', 'lakhshs'],
            'crore': ['crore', 'crores', 'cr', 'cror', 'croree', 'crs', 'core', 'cores', 'crorre', 'crore']
        };
        
        // Check if text contains any variation of a word (very lenient)
        function containsVariation(text, word) {
            const normalized = normalizeText(text);
            const variations = misspellings[word] || [word];
            
            for (const variation of variations) {
                // Exact match
                if (normalized.includes(variation)) return true;
                
                // Check if variation is part of any word (handles spacing issues)
                    const words = normalized.split(/\s+/);
                for (const w of words) {
                    if (w.includes(variation) || variation.includes(w)) return true;
                    // Very lenient fuzzy match for typos (lower threshold)
                    if (similarity(w, variation) >= 0.65) return true;
                }
            }
            
            // Also check if any word is similar to the base word
            const words = normalized.split(/\s+/);
            for (const w of words) {
                if (similarity(w, word) >= 0.7) return true;
            }
            
            return false;
        }

        // Extract numbers from text (handles grammatical mistakes)
        function extractNumbers(text) {
            const normalized = normalizeText(text);
            // Match numbers with flexible spacing
            const numberMatches = normalized.match(/\d+(?:\.\d+)?/g);
            return numberMatches ? numberMatches.map(n => parseFloat(n)) : [];
        }
        
        // Extract information from user message (with typo tolerance)
        function extractInformation(text) {
            const normalized = normalizeText(text);
            const updates = {};
            
            // Detect location-based queries (extract all info first, then show dialog if needed)
            const hasLocationQuery = fuzzyMatchWord(text, 'explore properties near me', 0.7) ||
                fuzzyMatchWord(text, 'properties near me', 0.7) ||
                fuzzyMatchWord(text, 'near me', 0.7) ||
                /explore.*near.*me|properties.*near.*me|show.*near.*me|around.*me/i.test(normalized);
            
            if (hasLocationQuery) {
                updates.useLocation = true;
                // Don't return early - continue extracting other info (BHK, price, etc.)
            }
            
            // Detect rent/buy intent (with typo and grammatical tolerance)
            if (!conversationState.intent) {
                // Very lenient matching - check for any variation
                if (containsVariation(text, 'rent') || 
                    fuzzyMatchWord(text, 'rent', 0.65) ||
                    /\b(ren|rent|renti|rentin|renta)\b/i.test(normalized)) {
                    updates.intent = 'rent';
                } else if (containsVariation(text, 'buy') || 
                          fuzzyMatchWord(text, 'buy', 0.65) || 
                          containsVariation(text, 'purchase') ||
                          /\b(bu|buy|buyi|buyin|purch|purcha|purchas)\b/i.test(normalized)) {
                    updates.intent = 'buy';
                }
            }
            
            // Detect BHK (bedrooms) - with typo and grammatical tolerance
            if (!conversationState.bhk) {
                // Try multiple patterns to catch variations (very flexible)
                const patterns = [
                    /\b(\d+)\s*(bhk|bhks|bedroom|bedrooms|bed room|bed rooms|br|brs|bed|beds|bh|bk|bedr|bedrm)\b/i,
                    /\b(bhk|bhks|bedroom|bedrooms|bed room|bed rooms|br|brs|bed|beds|bh|bk)\s*(\d+)\b/i,
                    /\b(\d+)\s*(bh|bk|bhks|bedr|bedrm|bedroo|bedrom)\b/i, // Common typos
                    /\b(\d+)\s*(room|rooms|rm|rms)\b/i, // Just "room"
                    /\b(\d+)\s*(bed|beds)\b/i // Just "bed"
                ];
                
                for (const pattern of patterns) {
                    const match = normalized.match(pattern);
                    if (match) {
                        const num = parseInt(match[1] || match[2]);
                        if (num >= 1 && num <= 10) { // Reasonable range
                            updates.bhk = num;
                        break;
                    }
                }
            }
            
                // Fallback: if we see a number 1-10 and bedroom-related words nearby, assume it's BHK
                if (!updates.bhk) {
                    const numbers = extractNumbers(text);
                    const hasBedroomWord = /\b(bed|room|bhk|br)\b/i.test(normalized);
                    if (numbers.length > 0 && hasBedroomWord) {
                        const num = numbers[0];
                        if (num >= 1 && num <= 10) {
                            updates.bhk = Math.floor(num);
                        }
                    }
                }
            }
            
            // Detect price/budget (with typo tolerance and all currency formats)
            if (!conversationState.price && !conversationState.priceMin) {
                const isRent = conversationState.intent === 'rent' || containsVariation(text, 'rent');
                
                // Build flexible currency unit patterns (handles typos and spacing)
                const thousandPattern = '(k|thousand|thousands|thou|thousnd|thousnad|thousan|thous|kilo)';
                const lakhPattern = '(lakh|lakhs|lac|lacs|lak|laksh|lakhh|lakhss)';
                const crorePattern = '(cr|crore|crores|cror|croree|crs|core|cores)';
                const rupeePattern = '(rs|rupees?|rupee|rupess|rupe)';
                
                // For rent: look for amounts in thousands (k), lakhs, or plain numbers
                if (isRent) {
                    // Rent range: "40k-50k", "40-50k", "40000-50000", "40 thousand to 50 thousand"
                    const rentRangePatterns = [
                        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|to|and)\\s*(\\d+(?:\\.\\d+)?)\\s*${thousandPattern}`, 'i'),
                        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|to|and)\\s*(\\d+(?:\\.\\d+)?)\\s*${rupeePattern}`, 'i'),
                        new RegExp(`(\\d{4,6})\\s*(?:-|to|and)\\s*(\\d{4,6})`, 'i') // Plain numbers
                    ];
                    
                    for (const pattern of rentRangePatterns) {
                        const match = normalized.match(pattern);
                        if (match) {
                            let min = parseFloat(match[1]);
                            let max = parseFloat(match[2]);
                            const unit = (match[3] || '').toLowerCase();
                            
                            if (containsVariation(unit, 'thousand') || unit === 'k') {
                                updates.priceMin = min / 100; // 50k = 0.5 lakh
                                updates.priceMax = max / 100;
                                break;
                            } else if (min >= 10000 && min <= 200000) {
                                // Assume it's in rupees, convert to lakhs
                                updates.priceMin = min / 100000;
                                updates.priceMax = max / 100000;
                                break;
                            }
                        }
                    }
                    
                    // Single rent amount: "50k", "50000", "50 thousand", "50k rent", "fifty thousand"
                    if (!updates.price && !updates.priceMin) {
                        const rentSinglePatterns = [
                            new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${thousandPattern}\\b`, 'i'),
                            new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${rupeePattern}\\b`, 'i'),
                            new RegExp(`\\b(\\d{4,6})\\b`, 'i') // Plain numbers in rent range
                        ];
                        
                        for (const pattern of rentSinglePatterns) {
                            const match = normalized.match(pattern);
                            if (match) {
                                let price = parseFloat(match[1]);
                                const unit = (match[2] || '').toLowerCase();
                                
                                if (containsVariation(unit, 'thousand') || unit === 'k') {
                                    updates.price = price / 100; // 50k = 0.5 lakh
                    break;
                                } else if (unit && (unit === 'rs' || unit === 'rupees' || unit === 'rupee')) {
                                    if (price >= 10000) {
                                        updates.price = price / 100000;
            } else {
                                        updates.price = price / 100;
                                    }
                                    break;
                                } else if (!unit && price >= 5000 && price <= 200000) {
                                    // Plain number in typical rent range
                                    if (price >= 10000) {
                                        updates.price = price / 100000; // 50000 = 0.5 lakh
                    } else {
                                        updates.price = price / 100; // 5000 = 0.05 lakh
                                    }
                        break;
                    }
                }
            }
                    }
                } else {
                    // For buy: look for price ranges like "2-3 cr", "50-80 lakhs", "2 cr to 4 cr"
                    const buyRangePatterns = [
                        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|to|and)\\s*(\\d+(?:\\.\\d+)?)\\s*${crorePattern}`, 'i'),
                        new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(?:-|to|and)\\s*(\\d+(?:\\.\\d+)?)\\s*${lakhPattern}`, 'i')
                    ];
                    
                    for (const pattern of buyRangePatterns) {
                        const match = normalized.match(pattern);
                        if (match) {
                            let min = parseFloat(match[1]);
                            let max = parseFloat(match[2]);
                            const unit = (match[3] || '').toLowerCase();
                            
                            if (containsVariation(unit, 'crore') || unit === 'cr') {
                                updates.priceMin = min;
                                updates.priceMax = max;
                                break;
                            } else if (containsVariation(unit, 'lakh') || unit === 'lac') {
                                updates.priceMin = min / 100;
                                updates.priceMax = max / 100;
                                break;
                            }
                        }
                    }
                    
                    // Single price like "2 cr", "50 lakhs", "2 crore", "50 lac"
                    if (!updates.price && !updates.priceMin) {
                        const buySinglePatterns = [
                            new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${crorePattern}\\b`, 'i'),
                            new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${lakhPattern}\\b`, 'i')
                        ];
                        
                        for (const pattern of buySinglePatterns) {
                            const match = normalized.match(pattern);
                            if (match) {
                                let price = parseFloat(match[1]);
                                const unit = (match[2] || '').toLowerCase();
                                
                                if (containsVariation(unit, 'crore') || unit === 'cr') {
                                    updates.price = price;
                                    break;
                                } else if (containsVariation(unit, 'lakh') || unit === 'lac') {
                                    updates.price = price / 100;
                    break;
                }
            }
                        }
                    }
                }
            }
            
            // Detect locality using smart mapping (with typo and grammatical tolerance)
            if (!conversationState.locality) {
                const detected = detectLocality(text);
                if (detected) {
                    updates.locality = detected.fullName;
                    updates.city = detected.city;
                } else {
                    // Fallback: try to extract any location-like words (handles grammatical mistakes)
                    // This handles cases where locality isn't in our map but user mentioned it
                    const locationPatterns = [
                        /\b(in|at|near|around|from|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g,
                        /\b([A-Z][a-z]+\s+(?:Sector|Road|Street|Avenue|Nagar|Colony|Extension|Phase|Area|Place))\s*(\d+)?/gi,
                        /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:Sector|Road|Street|Avenue|Nagar|Colony|Extension|Phase)/gi,
                        /\b([A-Z][a-z]{3,})\b/g // Any capitalized word (could be locality)
                    ];
                    
                    for (const pattern of locationPatterns) {
                        const matches = [...text.matchAll(pattern)];
                        if (matches.length > 0) {
                            const match = matches[matches.length - 1];
                            let locality = match[2] || match[1] || match[0];
                            locality = locality.replace(/^(in|at|near|around|from|for)\s+/i, '').trim();
                            
                            // Basic validation - should be at least 3 characters and not common words
                            const commonWords = ['the', 'and', 'for', 'with', 'this', 'that', 'what', 'where', 'when', 'how', 'can', 'will', 'want', 'looking', 'search', 'find', 'show', 'need', 'bhk', 'bedroom', 'bed', 'rent', 'buy', 'price', 'budget', 'cr', 'crore', 'lakh', 'lakhs', 'k', 'thousand', 'looking', 'searching', 'find', 'show', 'me', 'please', 'help'];
                            if (locality.length >= 3 && !commonWords.includes(locality.toLowerCase())) {
                                updates.locality = capitalizeWords(locality);
                                break;
                            }
                        }
                    }
                }
            }
            
            return updates;
        }
        
        // Check if conversation state is complete (very lenient - shows properties if we have extracted info)
        function isConversationComplete() {
            // Be very lenient - if we have extracted values (even with typos/grammar mistakes), consider complete
            const hasIntent = !!conversationState.intent;
            const hasBHK = !!conversationState.bhk && conversationState.bhk >= 1 && conversationState.bhk <= 10;
            const hasPrice = !!(conversationState.price || conversationState.priceMin);
            const hasLocality = !!conversationState.locality && conversationState.locality.length >= 3;
            const hasLocation = !!conversationState.useLocation && userLocation.hasLocation;
            
            // If using location, we don't need locality - just need intent, BHK, and price
            if (hasLocation || conversationState.useLocation) {
                return hasIntent && hasBHK && hasPrice;
            }
            
            // Otherwise, need all fields including locality
            return hasIntent && hasBHK && hasPrice && hasLocality;
        }
        
        // Smart extraction - tries multiple times with different patterns to catch typos
        function smartExtract(text) {
            const updates = extractInformation(text);
            
            // If we didn't get everything, try again with more lenient patterns
            // This helps catch information that might have been missed due to typos
            if (!updates.intent && !conversationState.intent) {
                // Try very loose patterns for intent
                const looseIntent = text.toLowerCase();
                if (/\b(ren|rent|renti|rentin|renta|rentel)\b/.test(looseIntent)) {
                    updates.intent = 'rent';
                } else if (/\b(bu|buy|buyi|buyin|purch|purcha|purchas)\b/.test(looseIntent)) {
                    updates.intent = 'buy';
                }
            }
            
            // Try to extract BHK if not found
            if (!updates.bhk && !conversationState.bhk) {
                const numbers = extractNumbers(text);
                for (const num of numbers) {
                    if (num >= 1 && num <= 10) {
                        // Check if there's any bedroom-related word nearby
                        const numIndex = text.indexOf(num.toString());
                        const nearbyText = text.substring(Math.max(0, numIndex - 20), Math.min(text.length, numIndex + 20)).toLowerCase();
                        if (/\b(bed|room|bhk|br|bh|bk)\b/.test(nearbyText)) {
                            updates.bhk = Math.floor(num);
                            break;
                        }
                    }
                }
            }
            
            return updates;
        }
        
        // Generate follow-up question based on what's missing
        function getFollowUpQuestion() {
            // Double-check state to ensure we have the latest values
            const hasIntent = !!conversationState.intent;
            const hasBHK = !!conversationState.bhk && conversationState.bhk >= 1 && conversationState.bhk <= 10;
            const hasPrice = !!(conversationState.price || conversationState.priceMin);
            const hasLocality = !!conversationState.locality && conversationState.locality.length >= 3;
            const hasLocation = !!conversationState.useLocation && userLocation.hasLocation;
            
            const missing = [];
            
            // Only ask for what's actually missing
            if (!hasIntent) {
                missing.push('rent or buy');
            }
            if (!hasBHK) {
                missing.push('BHK');
            }
            if (!hasPrice) {
                missing.push('budget');
            }
            // Only ask for locality if not using location
            if (!hasLocality && !hasLocation && !conversationState.useLocation) {
                missing.push('locality');
            }
            
            if (missing.length === 0) {
                return null; // All info collected
            }
            
            // Generate natural follow-up questions
            const questions = [
                `To help you better, I need to know: ${missing.join(', ')}. ${missing.length === 1 ? 'What' : 'What are'} your ${missing[0]} preference${missing.length === 1 ? '' : 's'}?`,
                `I'd like to know your ${missing.join(' and ')} to show you the best properties. Can you share that?`,
                `To find the perfect home, I need your ${missing.join(', ')}. What ${missing.length === 1 ? 'is' : 'are'} your ${missing.length === 1 ? 'preference' : 'preferences'}?`
            ];
            
            return questions[Math.floor(Math.random() * questions.length)];
        }
        
        // Calculate distance between two coordinates (Haversine formula)
        function calculateDistance(lat1, lon1, lat2, lon2) {
            const R = 6371; // Earth's radius in km
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c; // Distance in km
            return distance;
        }
        
        // Show location permission dialog
        function showLocationPermissionDialog() {
            // Remove existing dialog if any
            const existing = document.getElementById('location-permission-dialog');
            if (existing) existing.remove();
            
            const dialog = document.createElement('div');
            dialog.id = 'location-permission-dialog';
            dialog.className = 'location-permission-dialog';
            
            dialog.innerHTML = `
                <div class="location-dialog-content">
                    <h1 class="location-dialog-title">To continue, your device will need to use Location Accuracy</h1>
                    <p class="location-dialog-subtitle">The following settings should be on:</p>
                    <div class="location-dialog-settings">
                        <div class="location-setting-item">
                            <svg class="location-setting-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                <circle cx="12" cy="10" r="3"></circle>
                            </svg>
                            <span>Device location</span>
                        </div>
                        <div class="location-setting-item">
                            <svg class="location-setting-icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="10"></circle>
                                <circle cx="12" cy="12" r="3"></circle>
                                <line x1="12" y1="2" x2="12" y2="6"></line>
                                <line x1="12" y1="18" x2="12" y2="22"></line>
                                <line x1="2" y1="12" x2="6" y2="12"></line>
                                <line x1="18" y1="12" x2="22" y2="12"></line>
                        </svg>
                            <div class="location-setting-text">
                                <span>Location Accuracy</span>
                                <p class="location-accuracy-description">Location Accuracy, which provides more accurate location for apps and services. To do this, Google periodically processes information about device sensors and wireless signals from your device to crowdsource wireless signal locations. These are used without identifying you to improve location accuracy and location-based services and to improve, provide and maintain Google's services based on Google's and third parties' legitimate interests to serve users' needs.</p>
                    </div>
                        </div>
                        </div>
                    <p class="location-dialog-footer">You can change this at any time in location settings. <a href="#" class="location-link">Manage settings</a> or <a href="#" class="location-link">learn more</a></p>
                    <div class="location-dialog-buttons">
                        <button class="location-btn-secondary" id="location-deny-btn">No, thanks</button>
                        <button class="location-btn-primary" id="location-allow-btn">Turn on</button>
                        </div>
                </div>
            `;
            
            document.body.appendChild(dialog);
            document.body.style.overflow = 'hidden';
            
            // Handle button clicks
            document.getElementById('location-deny-btn').onclick = function() {
                dialog.remove();
                document.body.style.overflow = '';
                addBotMessage("No problem! You can still search for properties by location name. Try saying '3 BHK in Delhi' or 'Properties in Gurgaon'.");
            };
            
            document.getElementById('location-allow-btn').onclick = function() {
                dialog.remove();
                document.body.style.overflow = '';
                
                // For prototype: Use dummy location immediately
                showTypingIndicator();
                
                // Set dummy location (Delhi coordinates)
                userLocation.latitude = 28.6139;
                userLocation.longitude = 77.2090;
                userLocation.hasLocation = true;
                conversationState.useLocation = true;
                
                // Small delay for realistic feel
                setTimeout(() => {
                    hideTypingIndicator();
                    
                    // Check if we have all required info before showing properties
                    if (isConversationComplete()) {
                        addBotMessage("Great! I've got your location. Let me show you properties near you.");
                        setTimeout(() => {
                            showPropertyCards();
                        }, 1000);
                } else {
                        // Still missing some info, ask for it
                        const followUp = getFollowUpQuestion();
                        if (followUp) {
                            addBotMessage("Great! I've got your location. " + followUp);
                        } else {
                            addBotMessage("Great! I've got your location. Could you tell me what type of property you're looking for? (e.g., 2 BHK, 3 BHK)");
                        }
                    }
                }, 1500);
            };
        }
        
        // Show login bottom sheet
        function showLoginBottomSheet() {
            // Remove existing login bottom sheet if any
            const existing = document.getElementById('login-bottom-sheet');
            if (existing) existing.remove();
            
            // Create bottom sheet container
            const loginSheet = document.createElement('div');
            loginSheet.id = 'login-bottom-sheet';
            loginSheet.className = 'login-bottom-sheet';
            
            // State for login bottom sheet
            let phoneNumber = '';
            let cursorVisible = false;
            let showError = false;
            let inputFocused = false;
            
            // Create the login bottom sheet HTML structure
            loginSheet.innerHTML = `
                <div class="login-bottom-sheet-overlay"></div>
                <div class="login-bottom-sheet-content">
                    <button class="login-close-btn" id="login-close-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#656565" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    
                    <div class="login-frame3">
                        <!-- Header Section with Logo -->
                        <div class="login-frame5">
                            <div class="login-frame2">
                                <img src="Login image.jpg" alt="Login background" class="login-bg-image" onerror="this.style.display='none'">
                                <img src="Container.png" alt="Container" class="login-container-image" onerror="this.style.display='none'">
                        </div>
                            <h2 class="login-heading">Login to Housing</h2>
                    </div>
                        
                        <!-- Phone Input Field -->
                        <div class="login-container2" id="login-phone-container">
                            <div class="login-country-selector" id="login-country-selector">
                                <span class="login-flag">🇮🇳</span>
                                <span class="login-country-code">+91</span>
                    </div>
                            <div class="login-phone-input-area" id="login-phone-input-area">
                                <input type="tel" class="login-phone-input" id="login-phone-input" placeholder="Phone number" maxlength="10" inputmode="numeric">
                        </div>
                            <button class="login-clear-btn" id="login-clear-btn" style="display: none;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                            </button>
                            <div class="login-cursor" id="login-cursor" style="display: none;"></div>
                    </div>
                        </div>
                    
                    <!-- Buttons Section -->
                    <div class="login-frame7">
                        <button class="login-continue-btn" id="login-continue-btn">Continue</button>
                        
                        <div class="login-or-divider">
                            <div class="login-or-line"></div>
                            <span class="login-or-text">OR</span>
                            <div class="login-or-line"></div>
                        </div>
                        
                        <button class="login-whatsapp-btn" id="login-whatsapp-btn">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="#5e23dc" xmlns="http://www.w3.org/2000/svg">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                            </svg>
                            <span>Continue with WhatsApp</span>
                        </button>
                        </div>
                </div>
            `;
            
            document.body.appendChild(loginSheet);
            document.body.style.overflow = 'hidden';
            
            // Get references to elements
            const phoneInput = document.getElementById('login-phone-input');
            const phoneContainer = document.getElementById('login-phone-container');
            const clearBtn = document.getElementById('login-clear-btn');
            const cursor = document.getElementById('login-cursor');
            const continueBtn = document.getElementById('login-continue-btn');
            const whatsappBtn = document.getElementById('login-whatsapp-btn');
            const closeBtn = document.getElementById('login-close-btn');
            const overlay = loginSheet.querySelector('.login-bottom-sheet-overlay');
            
            // Phone input handler
            phoneInput.addEventListener('input', function(e) {
                // Only allow numbers
                const value = e.target.value.replace(/\D/g, '');
                phoneNumber = value;
                e.target.value = value;
                
                // Show/hide clear button
                if (phoneNumber.length > 0) {
                    clearBtn.style.display = 'flex';
                } else {
                    clearBtn.style.display = 'none';
                }
            });
            
            // Cursor blink animation
            let cursorBlinkInterval;
            function startCursorBlink() {
                if (cursorBlinkInterval) clearInterval(cursorBlinkInterval);
                cursorBlinkInterval = setInterval(() => {
                    if (cursorVisible && inputFocused) {
                        cursor.style.opacity = cursor.style.opacity === '0' ? '1' : '0';
                    }
                }, 500);
            }
            function stopCursorBlink() {
                if (cursorBlinkInterval) {
                    clearInterval(cursorBlinkInterval);
                    cursorBlinkInterval = null;
                }
            }
            
            // Phone input focus handler
            phoneInput.addEventListener('focus', function() {
                inputFocused = true;
                cursorVisible = true;
                cursor.style.display = 'block';
                cursor.style.opacity = '1';
                phoneContainer.classList.add('login-input-focused');
                startCursorBlink();
            });
            
            phoneInput.addEventListener('blur', function() {
                inputFocused = false;
                cursorVisible = false;
                cursor.style.display = 'none';
                phoneContainer.classList.remove('login-input-focused');
                if (!showError) {
                    phoneContainer.classList.remove('login-input-error');
                }
                stopCursorBlink();
            });
            
            // Clear button handler
            clearBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                phoneNumber = '';
                phoneInput.value = '';
                clearBtn.style.display = 'none';
                phoneInput.focus();
            });
            
            // Continue button handler
            continueBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                // Validate phone number (should be 10 digits)
                if (phoneNumber.length !== 10) {
                    showError = true;
                    phoneContainer.classList.add('login-input-error');
                    phoneContainer.classList.add('login-shake');
                    setTimeout(() => {
                        phoneContainer.classList.remove('login-shake');
                    }, 500);
                    return;
                }
                
                // Close bottom sheet and show success message
                closeLoginBottomSheet();
                addBotMessage("Great! I've received your phone number. We'll send you an OTP shortly.");
            });
            
            // WhatsApp button handler
            whatsappBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeLoginBottomSheet();
                addBotMessage("Redirecting to WhatsApp for login...");
            });
            
            // Close button handler
            closeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                closeLoginBottomSheet();
            });
            
            // Overlay click handler
            overlay.addEventListener('click', function() {
                closeLoginBottomSheet();
            });
            
            // Animate in
            requestAnimationFrame(() => {
                loginSheet.classList.add('active');
            });
            
            // Close function
            function closeLoginBottomSheet() {
                stopCursorBlink();
                loginSheet.classList.remove('active');
                setTimeout(() => {
                    loginSheet.remove();
                    document.body.style.overflow = '';
                }, 300);
            }
        }
        
        // Shuffle array to randomize order
        function shuffleArray(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }
        
        // Generate property cards with local images
        // Guarantees zero duplicate images within a single carousel using deterministic hash + linear probing
        function generatePropertyCards() {
            // Generate 4-5 property cards based on search criteria
            const numCards = 4 + Math.floor(Math.random() * 2); // 4 or 5 cards
            const cards = [];
            
            // Create stable carousel ID based on search criteria for memoization
            // This ensures same search = same carouselId = same images (stable across re-renders)
            const searchKey = `${conversationState.intent || 'any'}-${conversationState.bhk || 'any'}-${conversationState.locality || 'any'}-${numCards}`;
            const carouselId = `carousel-${hashPropertyId(searchKey, '').toString(36)}`;
            
            // Track used image URLs for this carousel (selection session)
            const usedImageUrls = new Set();
            
            // Clean up old cache entries
            cleanupImageCache();
            
            // Property names (will be customized based on locality)
            const propertyNames = [
                'Luxury Heights',
                'Green Valley',
                'Sunset Residency',
                'Park View Apartments',
                'Garden Estate',
                'Modern Living',
                'Elite Homes',
                'Premium Residences'
            ];
            
            // Property types and statuses
            const propertyTypes = ['Flat', 'Apartment', 'Villa', 'House', 'Penthouse'];
            const propertyStatuses = ['Ready to move', 'Under construction', 'New launch'];
            
            for (let i = 0; i < numCards; i++) {
                const propertyId = `property-${i + 1}`;
                
                // Get unique image URL for this card - assign sequentially from pool
                // CRITICAL: Each main property card gets a unique image (no duplicates)
                const imageUrl = getNextAvailableImage(usedImageUrls, false);
                
                const propertyName = propertyNames[i % propertyNames.length];
                
                // Generate price based on property type (rent vs buy/project)
                let priceValue;
                let priceUnit;
                const isRent = conversationState.intent === 'rent';
                
                if (isRent) {
                    // Rent properties: less than 1 lakh (use thousands)
                    if (conversationState.priceMin && conversationState.priceMax) {
                        // User provided a rent range
                        const range = conversationState.priceMax - conversationState.priceMin;
                        const basePrice = conversationState.priceMin + (range * (i / numCards));
                        // Convert to thousands (assuming price is in lakhs)
                        priceValue = Math.round(basePrice * 100 * 1000);
                        priceUnit = 'k';
                    } else if (conversationState.price) {
                        // User provided a single rent price
                        const variation = (conversationState.price * 0.1) * (i - numCards / 2) / numCards;
                        const basePrice = conversationState.price + variation;
                        // Convert to thousands
                        priceValue = Math.round(basePrice * 100 * 1000);
                        priceUnit = 'k';
                } else {
                        // Default rent range: 15k - 90k (less than 1 lakh)
                        priceValue = Math.round(15000 + Math.random() * 75000);
                        priceUnit = 'k';
                    }
                } else {
                    // Buy/Project properties: 90 lakh+ (use crores or high lakhs)
                    if (conversationState.priceMin && conversationState.priceMax) {
                        // User provided a buy range
                        const range = conversationState.priceMax - conversationState.priceMin;
                        const basePrice = conversationState.priceMin + (range * (i / numCards));
                        
                        // If base price is less than 0.9 Cr (90 lakhs), adjust it
                        const adjustedPrice = Math.max(basePrice, 0.9);
                        
                        // Randomly use crores or high lakhs (90L+)
                        const useCrores = Math.random() > 0.3; // 70% chance of crores
                        if (useCrores) {
                            priceValue = adjustedPrice.toFixed(1);
                            priceUnit = 'Cr';
                } else {
                            // Use lakhs (90L - 1.5Cr in lakhs)
                            priceValue = (adjustedPrice * 100).toFixed(1);
                            priceUnit = 'L';
                        }
                    } else if (conversationState.price) {
                        // User provided a single buy price
                        const variation = (conversationState.price * 0.1) * (i - numCards / 2) / numCards;
                        let basePrice = conversationState.price + variation;
                        
                        // Ensure minimum 90 lakhs
                        basePrice = Math.max(basePrice, 0.9);
                        
                        const useCrores = Math.random() > 0.3;
                        if (useCrores) {
                            priceValue = basePrice.toFixed(1);
                            priceUnit = 'Cr';
            } else {
                            priceValue = (basePrice * 100).toFixed(1);
                            priceUnit = 'L';
                        }
                } else {
                        // Default buy/project range: 90L - 5Cr
                        const useCrores = Math.random() > 0.3;
                        if (useCrores) {
                            // Crores: 0.9 Cr - 5 Cr
                            priceValue = (0.9 + Math.random() * 4.1).toFixed(1);
                            priceUnit = 'Cr';
                        } else {
                            // High lakhs: 90L - 150L
                            priceValue = (90 + Math.random() * 60).toFixed(1);
                            priceUnit = 'L';
                        }
                    }
                }
                
                const price = {
                    value: priceValue,
                    unit: priceUnit
                };
                
                // Generate built-up area (realistic range: 1200-3500 sq.ft)
                const builtUpArea = Math.floor(1200 + Math.random() * 2300);
                
                // Generate gallery images (3-5 images per property) - ensure unique images within this gallery
                const numGalleryImages = 3 + Math.floor(Math.random() * 3);
                
                // Generate unique gallery images - use all 5 images, ensuring no duplicates in this gallery
                const galleryImages = [imageUrl]; // Always include main image as first
                const galleryUsedImages = new Set([imageUrl]); // Track images used in THIS gallery only
                
                // Get additional unique images for gallery - cycle through all 5 images
                // Ensure no duplicate within this property's gallery
                for (let galleryIndex = 1; galleryIndex < numGalleryImages; galleryIndex++) {
                    // Try each image in the pool until we find one not used in this gallery
                    let found = false;
                    for (let poolIdx = 0; poolIdx < PROPERTY_IMAGE_POOL.length; poolIdx++) {
                        const candidateImage = PROPERTY_IMAGE_POOL[poolIdx];
                        if (!galleryUsedImages.has(candidateImage)) {
                            galleryImages.push(candidateImage);
                            galleryUsedImages.add(candidateImage);
                            found = true;
                    break;
                }
            }
                    // If all 5 images already used in this gallery (shouldn't happen with 3-5 gallery images)
                    // Just skip adding more (we already have main image)
                    if (!found && galleryImages.length < PROPERTY_IMAGE_POOL.length) {
                        // This shouldn't happen, but safety check
                        break;
                    }
                }
                
                // Generate random coordinates for property (if using location)
                let propertyLat = null;
                let propertyLon = null;
                let distance = null;
                
                if (userLocation.hasLocation && conversationState.useLocation) {
                    // Generate property coordinates within ~20km radius
                    const radius = 20; // km
                    const angle = Math.random() * 2 * Math.PI;
                    const distanceFromCenter = Math.random() * radius;
                    propertyLat = userLocation.latitude + (distanceFromCenter * Math.cos(angle) / 111); // ~111 km per degree
                    propertyLon = userLocation.longitude + (distanceFromCenter * Math.sin(angle) / (111 * Math.cos(userLocation.latitude * Math.PI / 180)));
                    distance = calculateDistance(userLocation.latitude, userLocation.longitude, propertyLat, propertyLon);
                }
                
                cards.push({
                    id: propertyId,
                    name: propertyName,
                    image: imageUrl,
                    gallery: galleryImages, // Array of gallery images (all unique)
                    price: price.value,
                    priceUnit: price.unit,
                    bhk: conversationState.bhk || 3,
                    locality: conversationState.locality || 'Location',
                    type: conversationState.intent === 'rent' ? 'rent' : 'sale',
                    propertyType: propertyTypes[i % propertyTypes.length],
                    status: propertyStatuses[i % propertyStatuses.length],
                    builtUpArea: builtUpArea,
                    distance: distance // Distance in km
                });
            }
            
            // DEV ASSERTION: Verify no duplicate MAIN images in property cards
            // Main property card images must all be unique (galleries can reuse images)
            const mainImageUrls = cards.map(card => card.image);
            const uniqueMainImages = new Set(mainImageUrls);
            
            if (mainImageUrls.length !== uniqueMainImages.size) {
                // Find duplicate main images
                const duplicateMainImages = [];
                const seen = new Set();
                mainImageUrls.forEach(url => {
                    if (seen.has(url) && !duplicateMainImages.includes(url)) {
                        duplicateMainImages.push(url);
                    }
                    seen.add(url);
                });
                
                const duplicateDetails = duplicateMainImages.map(url => ({
                    url,
                    propertyIds: cards.filter(card => card.image === url).map(card => card.id)
                }));
                
                console.error('[Image Selection] ❌ DUPLICATE MAIN IMAGES DETECTED in carousel:', {
                    carouselId,
                    totalMainImages: mainImageUrls.length,
                    uniqueMainImages: uniqueMainImages.size,
                    duplicateCount: mainImageUrls.length - uniqueMainImages.size,
                    duplicates: duplicateDetails,
                    mainImageUrls: mainImageUrls
                });
                
                // Throw error in dev mode to catch issues early
                if (window.__CHAT_DEBUG__) {
                    throw new Error(`Duplicate main images detected in carousel ${carouselId}. Duplicates: ${JSON.stringify(duplicateDetails)}`);
                }
            } else if (window.__CHAT_DEBUG__) {
                console.log('[Image Selection] ✓ All main property card images unique in carousel:', {
                    carouselId,
                    totalMainImages: mainImageUrls.length,
                    uniqueMainImages: uniqueMainImages.size
                });
            }
            
            return cards;
        }
        
        // Render property cards in horizontal scroll
        function renderPropertyCards(cards) {
            const carousel = document.createElement('div');
            carousel.className = 'property-carousel';
            carousel.style.pointerEvents = 'auto';
            
            cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'property-card';
                cardElement.setAttribute('data-property-id', card.id);
                cardElement.style.pointerEvents = 'auto';
                
                // Card image wrapper
                const imageWrapper = document.createElement('div');
                imageWrapper.className = 'property-card__imgwrap';
                
                const image = document.createElement('img');
                image.src = card.image;
                image.alt = card.name;
                image.className = 'property-card__img';
                image.loading = 'eager'; // Eager loading for visible property cards (better UX)
                image.decoding = 'async'; // Async decoding for better performance
                image.style.cursor = 'pointer';
                image.style.pointerEvents = 'auto';
                image.style.position = 'relative';
                image.style.zIndex = '1';
                
                // Handle image loading errors with fallback
                image.onerror = function() {
                    if (!this.dataset.failed) {
                        this.dataset.failed = '1';
                        // Fallback to high-quality reliable image
                        this.src = PROPERTY_IMAGE_POOL[0];
                        this.onerror = null; // Prevent infinite loop
                    }
                };
                
                // GALLERY CREATION FUNCTION - DEFINED ONCE
                function createGallery() {
                    // Remove existing gallery
                    removeElementById('property-gallery-overlay');
                    
                    // Create gallery
                    const overlay = document.createElement('div');
                    overlay.id = 'property-gallery-overlay';
                    overlay.className = 'property-gallery-overlay';
                    overlay.style.position = 'fixed';
                    overlay.style.top = '0';
                    overlay.style.left = '0';
                    overlay.style.right = '0';
                    overlay.style.bottom = '0';
                    overlay.style.background = '#ffffff';
                    overlay.style.zIndex = '999999';
                    overlay.style.display = 'flex';
                    overlay.style.alignItems = 'center';
                    overlay.style.justifyContent = 'center';
                    
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'property-gallery-close';
                    closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                    closeBtn.style.cssText = 'position: absolute !important; top: 20px !important; right: 20px !important; width: 44px !important; height: 44px !important; background: transparent !important; border: none !important; cursor: pointer !important; z-index: 1000000 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                    closeBtn.onclick = function() {
                        overlay.remove();
                        document.body.style.overflow = '';
                    };
                    
                    const container = document.createElement('div');
                    container.className = 'property-gallery-container';
                    
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'property-gallery-images';
                    const images = (card.gallery && card.gallery.length > 0) ? card.gallery : [card.image];
                    
                    images.forEach(function(url, idx) {
                        const img = document.createElement('img');
                        img.src = url;
                        img.className = 'property-gallery-image';
                        img.style.display = idx === 0 ? 'block' : 'none';
                        img.loading = 'eager';
                        img.onerror = function() {
                            // Fallback to a reliable image if gallery image fails
                            this.src = PROPERTY_IMAGE_POOL[0];
                            this.onerror = null; // Prevent infinite loop
                        };
                        img.onload = function() {
                            // Image loaded successfully
                            this.style.opacity = '1';
                        };
                        img.style.opacity = '0';
                        img.style.transition = 'opacity 0.3s ease';
                        imgContainer.appendChild(img);
                    });
                    
                    let currentIdx = 0;
                    const prev = document.createElement('button');
                    prev.className = 'property-gallery-nav property-gallery-prev';
                    prev.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
                    prev.style.cssText = 'position: absolute !important; top: 50% !important; left: 20px !important; right: auto !important; transform: translateY(-50%) !important; width: 50px !important; height: 50px !important; background: #ffffff !important; border: none !important; border-radius: 50% !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important; cursor: pointer !important; z-index: 1000000 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                    prev.onclick = function() {
                        currentIdx = (currentIdx - 1 + images.length) % images.length;
                        imgContainer.querySelectorAll('.property-gallery-image').forEach(function(img, i) {
                            img.style.display = i === currentIdx ? 'block' : 'none';
                        });
                    };
                    
                    const next = document.createElement('button');
                    next.className = 'property-gallery-nav property-gallery-next';
                    next.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
                    next.style.cssText = 'position: absolute !important; top: 50% !important; right: 20px !important; left: auto !important; transform: translateY(-50%) !important; width: 50px !important; height: 50px !important; background: #ffffff !important; border: none !important; border-radius: 50% !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important; cursor: pointer !important; z-index: 1000000 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                    next.onclick = function() {
                        currentIdx = (currentIdx + 1) % images.length;
                        imgContainer.querySelectorAll('.property-gallery-image').forEach(function(img, i) {
                            img.style.display = i === currentIdx ? 'block' : 'none';
                        });
                    };
                    
                    container.appendChild(imgContainer);
                    if (images.length > 1) {
                        container.appendChild(prev);
                        container.appendChild(next);
                    }
                    
                    // View Property button
                    const viewPropertyBtn = document.createElement('button');
                    viewPropertyBtn.className = 'property-gallery-view-btn';
                    viewPropertyBtn.textContent = 'View Property';
                    viewPropertyBtn.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Close gallery first
                        overlay.remove();
                        document.body.style.overflow = '';
                        // Open PDP
                        openPropertyDetailPage(card);
                    };
                    
                    overlay.appendChild(closeBtn);
                    overlay.appendChild(container);
                    overlay.appendChild(viewPropertyBtn);
                    overlay.onclick = function(e) {
                        if (e.target === overlay) {
                            overlay.remove();
                            document.body.style.overflow = '';
                        }
                    };
                    
                    document.body.appendChild(overlay);
                    document.body.style.overflow = 'hidden';
                }
                
                // STORE CARD DATA ON IMAGE ELEMENT
                image.setAttribute('data-property-id', card.id);
                image.setAttribute('data-gallery-images', JSON.stringify(card.gallery || [card.image]));
                image.setAttribute('data-card-image', card.image);
                
                // CLICK HANDLER
                function handleImageClick(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    
                    // Remove existing
                    removeElementById('property-gallery-overlay');
                    
                    // Create gallery with white background
                    const overlay = document.createElement('div');
                    overlay.id = 'property-gallery-overlay';
                    overlay.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: #ffffff !important; z-index: 999999 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                    
                    const closeBtn = document.createElement('button');
                    closeBtn.className = 'property-gallery-close';
                    closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                    closeBtn.style.cssText = 'position: absolute !important; top: 20px !important; right: 20px !important; width: 44px !important; height: 44px !important; background: transparent !important; border: none !important; cursor: pointer !important; z-index: 1000000 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                    closeBtn.onclick = function() {
                        overlay.remove();
                        document.body.style.overflow = '';
                    };
                    
                    const container = document.createElement('div');
                    container.className = 'property-gallery-container';
                    
                    const imgContainer = document.createElement('div');
                    imgContainer.className = 'property-gallery-images';
                    const images = (card.gallery && card.gallery.length > 0) ? card.gallery : [card.image];
                    
                    images.forEach(function(url, idx) {
                        const img = document.createElement('img');
                        img.src = url;
                        img.className = 'property-gallery-image';
                        img.style.display = idx === 0 ? 'block' : 'none';
                        img.loading = 'eager';
                        img.onerror = function() {
                            // Fallback to a reliable image if gallery image fails
                            this.src = PROPERTY_IMAGE_POOL[0];
                            this.onerror = null; // Prevent infinite loop
                        };
                        img.onload = function() {
                            // Image loaded successfully
                            this.style.opacity = '1';
                        };
                        img.style.opacity = '0';
                        img.style.transition = 'opacity 0.3s ease';
                        imgContainer.appendChild(img);
                    });
                    
                    let currentIdx = 0;
                    const prev = document.createElement('button');
                    prev.className = 'property-gallery-nav property-gallery-prev';
                    prev.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
                    prev.style.cssText = 'position: absolute !important; top: 50% !important; left: 20px !important; right: auto !important; transform: translateY(-50%) !important; width: 50px !important; height: 50px !important; background: #ffffff !important; border: none !important; border-radius: 50% !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important; cursor: pointer !important; z-index: 1000000 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                    prev.onclick = function() {
                        currentIdx = (currentIdx - 1 + images.length) % images.length;
                        imgContainer.querySelectorAll('.property-gallery-image').forEach(function(img, i) {
                            img.style.display = i === currentIdx ? 'block' : 'none';
                        });
                    };
                    
                    const next = document.createElement('button');
                    next.className = 'property-gallery-nav property-gallery-next';
                    next.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><polyline points="9 18 15 12 9 6"></polyline></svg>';
                    next.style.cssText = 'position: absolute !important; top: 50% !important; right: 20px !important; left: auto !important; transform: translateY(-50%) !important; width: 50px !important; height: 50px !important; background: #ffffff !important; border: none !important; border-radius: 50% !important; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15) !important; cursor: pointer !important; z-index: 1000000 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                    next.onclick = function() {
                        currentIdx = (currentIdx + 1) % images.length;
                        imgContainer.querySelectorAll('.property-gallery-image').forEach(function(img, i) {
                            img.style.display = i === currentIdx ? 'block' : 'none';
                        });
                    };
                    
                    container.appendChild(imgContainer);
                    if (images.length > 1) {
                        container.appendChild(prev);
                        container.appendChild(next);
                    }
                    
                    // View Property button
                    const viewPropertyBtn = document.createElement('button');
                    viewPropertyBtn.className = 'property-gallery-view-btn';
                    viewPropertyBtn.textContent = 'View Property';
                    viewPropertyBtn.onclick = function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        // Close gallery first
                        overlay.remove();
                        document.body.style.overflow = '';
                        // Open PDP
                        openPropertyDetailPage(card);
                    };
                    
                    overlay.appendChild(closeBtn);
                    overlay.appendChild(container);
                    overlay.appendChild(viewPropertyBtn);
                    overlay.onclick = function(e) {
                        if (e.target === overlay) {
                            overlay.remove();
                            document.body.style.overflow = '';
                        }
                    };
                    
                    document.body.appendChild(overlay);
                    document.body.style.overflow = 'hidden';
                    return false;
                }
                
                // ATTACH TO IMAGE
                image.onclick = handleImageClick;
                image.addEventListener('click', handleImageClick, true);
                image.addEventListener('click', handleImageClick, false);
                image.addEventListener('mousedown', handleImageClick);
                image.addEventListener('touchend', function(e) {
                    e.preventDefault();
                    handleImageClick(e);
                });
                
                // Also make wrapper clickable - MULTIPLE HANDLERS
                imageWrapper.style.cursor = 'pointer';
                imageWrapper.style.pointerEvents = 'auto';
                
                function wrapperClickHandler(e) {
                    if (e.target.closest('.property-card-favorite')) {
                        return;
                    }
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('✅ WRAPPER CLICKED - Opening gallery');
                    createGallery();
                }
                
                imageWrapper.onclick = wrapperClickHandler;
                imageWrapper.addEventListener('click', wrapperClickHandler, true);
                imageWrapper.addEventListener('click', wrapperClickHandler, false);
                
                imageWrapper.appendChild(image);
                
                // Card body
                const body = document.createElement('div');
                body.className = 'property-card__body';
                
                // Property type and status
                const typeStatus = document.createElement('div');
                typeStatus.className = 'property-card__type-status';
                typeStatus.textContent = `${card.propertyType} • ${card.status}`;
                
                // Built-up area
                const builtUpArea = document.createElement('div');
                builtUpArea.className = 'property-card__area';
                builtUpArea.textContent = `Built up area: ${card.builtUpArea.toLocaleString()} sq.ft`;
                
                // Location with pin icon
                const location = document.createElement('div');
                location.className = 'property-card__location';
                let locationText = card.locality;
                if (card.distance !== null && card.distance !== undefined) {
                    const distanceText = card.distance < 1 
                        ? `${Math.round(card.distance * 1000)}m away`
                        : `${card.distance.toFixed(1)} km away`;
                    locationText = `${card.locality} • ${distanceText}`;
                }
                location.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>${locationText}</span>
                `;
                
                // Price
                const price = document.createElement('div');
                price.className = 'property-card__price';
                // Format price with appropriate unit (k, L, or Cr)
                const priceUnit = card.priceUnit || 'Cr';
                if (priceUnit === 'k') {
                    // Format thousands: 50k, 1.2L (if > 100k)
                    const priceNum = parseFloat(card.price);
                    if (priceNum >= 100000) {
                        price.textContent = `₹${(priceNum / 100000).toFixed(1)}L`;
                } else {
                        price.textContent = `₹${(priceNum / 1000).toFixed(0)}k`;
                    }
                } else {
                    price.textContent = `₹${card.price} ${priceUnit}`;
                }
                
                // Property details (BHK)
                const chips = document.createElement('div');
                chips.className = 'property-card__chips';
                const bhkChip = document.createElement('span');
                bhkChip.className = 'property-chip';
                bhkChip.textContent = `${card.bhk} BHK`;
                chips.appendChild(bhkChip);
                
                // CTA Section with View button and Favorite button
                const ctaSection = document.createElement('div');
                ctaSection.className = 'property-card__cta-section';
                
                // View CTA button
                const viewBtn = document.createElement('button');
                viewBtn.className = 'property-card__view-btn';
                viewBtn.textContent = 'View';
                viewBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    openPropertyDetailPage(card);
                });
                
                // Favorite button (next to CTA)
                const favoriteBtn = document.createElement('button');
                favoriteBtn.className = 'property-card-favorite';
                favoriteBtn.setAttribute('aria-label', 'Save property');
                favoriteBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
                favoriteBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    favoriteBtn.classList.toggle('active');
                    // Update SVG to filled when active
                    const svg = favoriteBtn.querySelector('svg path');
                    if (favoriteBtn.classList.contains('active')) {
                        svg.setAttribute('fill', 'currentColor');
                        svg.setAttribute('stroke', 'none');
                } else {
                        svg.setAttribute('fill', 'none');
                        svg.setAttribute('stroke', 'currentColor');
                    }
                    return false;
                };
                
                ctaSection.appendChild(viewBtn);
                ctaSection.appendChild(favoriteBtn);
                
                // Order: typeStatus -> builtUpArea -> location -> BHK (chips) -> price -> CTA
                body.appendChild(typeStatus);
                body.appendChild(builtUpArea);
                body.appendChild(location);
                body.appendChild(chips); // BHK - last option before price
                body.appendChild(price); // Price - selling point, comes before CTA
                body.appendChild(ctaSection);
                
                // Make entire card clickable (except image) to open PDP
                cardElement.style.cursor = 'pointer';
                cardElement.addEventListener('click', function(e) {
                    // Don't open PDP if clicking on image or image wrapper (those open gallery)
                    if (e.target.closest('.property-card__imgwrap') || 
                        e.target.closest('.property-card__img') ||
                        e.target.closest('.property-card-favorite')) {
                        return;
                    }
                    // Don't open PDP if clicking on View button (it has its own handler)
                    if (e.target.closest('.property-card__view-btn')) {
                        return;
                    }
                    // Open PDP for any other click on the card
                    e.preventDefault();
                    e.stopPropagation();
                    openPropertyDetailPage(card);
                });
                
                cardElement.appendChild(imageWrapper);
                cardElement.appendChild(body);
                carousel.appendChild(cardElement);
            });
            
            return carousel;
        }
        
        // Open Property Detail Page (PDP) in bottom sheet
        function openPropertyDetailPage(card) {
            // Remove existing PDP if any
            removeElementById('property-detail-bottom-sheet');
            
            // Create bottom sheet overlay
            const bottomSheetOverlay = document.createElement('div');
            bottomSheetOverlay.id = 'property-detail-bottom-sheet';
            bottomSheetOverlay.className = 'pdp-bottom-sheet-overlay';
            
            // Create bottom sheet
            const bottomSheet = document.createElement('div');
            bottomSheet.className = 'pdp-bottom-sheet';
            bottomSheet.id = 'pdp-bottom-sheet';
            
            // Progressive expansion on scroll
            let initialHeight = Math.min(window.innerHeight * 0.7, 600); // Start at 70vh or 600px
            let maxHeight = window.innerHeight * 0.98; // Max at 98vh
            let currentHeight = initialHeight;
            let isFullyExpanded = false;
            let lastScrollTop = 0;
            let scrollVelocity = 0;
            let isDragging = false;
            
            // Set initial height
            bottomSheet.style.height = `${initialHeight}px`;
            bottomSheet.style.maxHeight = `${initialHeight}px`;
            
            // Handle progressive expansion on scroll
            const handleScroll = (e) => {
                if (isFullyExpanded) return; // Once fully expanded, use normal scroll
                
                const scrollTop = pdpContent.scrollTop;
                const scrollDelta = lastScrollTop - scrollTop; // Positive when scrolling up
                
                // Calculate scroll velocity
                scrollVelocity = scrollDelta;
                
                // If scrolling up (positive delta) and at or near top, expand
                if (scrollDelta > 0 && scrollTop <= 20) {
                    // Progressive expansion based on scroll velocity
                    const expansionAmount = Math.min(scrollDelta * 1.5, 10); // Cap expansion per scroll
                    currentHeight = Math.min(currentHeight + expansionAmount, maxHeight);
                    bottomSheet.style.height = `${currentHeight}px`;
                    bottomSheet.style.maxHeight = `${currentHeight}px`;
                    
                    // Prevent default scroll when expanding
                    if (currentHeight < maxHeight * 0.95) {
                        pdpContent.scrollTop = 0;
                    }
                    
                    if (currentHeight >= maxHeight * 0.95) {
                        isFullyExpanded = true;
                        bottomSheet.classList.add('fully-expanded');
                    }
                }
                
                lastScrollTop = scrollTop;
            };
            
            // Touch/mouse drag to expand
            let startY = 0;
            let startHeight = 0;
            
            const handleStart = (e) => {
                const touch = e.touches ? e.touches[0] : e;
                startY = touch.clientY;
                startHeight = currentHeight;
                isDragging = true;
            };
            
            const handleMove = (e) => {
                if (!isDragging) return;
                const touch = e.touches ? e.touches[0] : e;
                const deltaY = startY - touch.clientY; // Negative when dragging up
                
                if (deltaY > 0 && currentHeight < maxHeight) {
                    // Dragging up - expand
                    currentHeight = Math.min(startHeight + deltaY, maxHeight);
                    bottomSheet.style.height = `${currentHeight}px`;
                    bottomSheet.style.maxHeight = `${currentHeight}px`;
                    
                    if (currentHeight >= maxHeight * 0.95) {
                        isFullyExpanded = true;
                        bottomSheet.classList.add('fully-expanded');
                    }
                } else if (deltaY < 0 && currentHeight > initialHeight) {
                    // Dragging down - collapse
                    currentHeight = Math.max(startHeight + deltaY, initialHeight);
                    bottomSheet.style.height = `${currentHeight}px`;
                    bottomSheet.style.maxHeight = `${currentHeight}px`;
                    isFullyExpanded = false;
                    bottomSheet.classList.remove('fully-expanded');
                }
            };
            
            const handleEnd = () => {
                isDragging = false;
            };
            
            // Close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'pdp-bottom-sheet-close';
            closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.onclick = function() {
                closePDPBottomSheet();
            };
            
            // Drag handle - make it draggable
            const dragHandle = document.createElement('div');
            dragHandle.className = 'pdp-bottom-sheet-handle';
            dragHandle.addEventListener('touchstart', handleStart, { passive: true });
            dragHandle.addEventListener('touchmove', handleMove, { passive: true });
            dragHandle.addEventListener('touchend', handleEnd, { passive: true });
            dragHandle.addEventListener('mousedown', handleStart);
            
            // Mouse move/up handlers (scoped to prevent conflicts)
            const mouseMoveHandler = (e) => {
                if (isDragging) {
                    handleMove(e);
                }
            };
            const mouseUpHandler = () => {
                if (isDragging) {
                    handleEnd();
                }
            };
            document.addEventListener('mousemove', mouseMoveHandler);
            document.addEventListener('mouseup', mouseUpHandler);
            
            // Cleanup on close
            const cleanup = () => {
                document.removeEventListener('mousemove', mouseMoveHandler);
                document.removeEventListener('mouseup', mouseUpHandler);
            };
            
            // PDP Content Container (scrollable)
            const pdpContent = document.createElement('div');
            pdpContent.className = 'pdp-bottom-sheet-content';
            pdpContent.addEventListener('scroll', handleScroll, { passive: true });
            
            // Also allow dragging from anywhere in the header area
            const headerArea = document.createElement('div');
            headerArea.className = 'pdp-bottom-sheet-header';
            headerArea.addEventListener('touchstart', handleStart, { passive: true });
            headerArea.addEventListener('touchmove', handleMove, { passive: true });
            headerArea.addEventListener('touchend', handleEnd, { passive: true });
            headerArea.addEventListener('mousedown', handleStart);
            
            // Hero Image
            const heroImage = document.createElement('div');
            heroImage.className = 'pdp-hero-image';
            const heroImg = document.createElement('img');
            heroImg.src = card.image;
            heroImg.alt = card.name;
            heroImg.loading = 'eager';
            heroImg.onerror = function() {
                if (!this.dataset.failed) {
                    this.dataset.failed = '1';
                    this.src = PROPERTY_IMAGE_POOL[0];
                    this.onerror = null;
                }
            };
            heroImage.appendChild(heroImg);
            
            // Content Wrapper
            const contentWrapper = document.createElement('div');
            contentWrapper.className = 'pdp-content-wrapper';
            
            // Property Name
            const propertyName = document.createElement('h1');
            propertyName.className = 'pdp-property-name';
            propertyName.textContent = card.name;
            
            // Location
            const location = document.createElement('div');
            location.className = 'pdp-location';
            location.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                    <circle cx="12" cy="10" r="3"></circle>
                </svg>
                <span>${card.locality}</span>
            `;
            
            // Price
            const price = document.createElement('div');
            price.className = 'pdp-price';
            // Format price with appropriate unit (k, L, or Cr)
            const priceUnit = card.priceUnit || 'Cr';
            if (priceUnit === 'k') {
                const priceNum = parseFloat(card.price);
                if (priceNum >= 100000) {
                    price.textContent = `₹${(priceNum / 100000).toFixed(1)}L`;
            } else {
                    price.textContent = `₹${(priceNum / 1000).toFixed(0)}k`;
                }
                } else {
                price.textContent = `₹${card.price} ${priceUnit}`;
            }
            
            // Details Grid
            const detailsGrid = document.createElement('div');
            detailsGrid.className = 'pdp-details-grid';
            
            const detailItems = [
                { label: 'BHK', value: `${card.bhk} BHK` },
                { label: 'Built-up Area', value: `${card.builtUpArea.toLocaleString()} sq.ft` },
                { label: 'Type', value: card.propertyType },
                { label: 'Status', value: card.status }
            ];
            
            detailItems.forEach(item => {
                const detailItem = document.createElement('div');
                detailItem.className = 'pdp-detail-item';
                detailItem.innerHTML = `
                    <div class="pdp-detail-label">${item.label}</div>
                    <div class="pdp-detail-value">${item.value}</div>
                `;
                detailsGrid.appendChild(detailItem);
            });
            
            // Description
            const description = document.createElement('div');
            description.className = 'pdp-description';
            description.innerHTML = `
                <h2>About this property</h2>
                <p>This beautiful ${card.propertyType.toLowerCase()} is ${card.status.toLowerCase()} and offers ${card.bhk} bedrooms with a built-up area of ${card.builtUpArea.toLocaleString()} sq.ft. Located in the prime area of ${card.locality}, this property is perfect for modern living.</p>
            `;
            
            // Gallery Section
            const gallerySection = document.createElement('div');
            gallerySection.className = 'pdp-gallery-section';
            gallerySection.innerHTML = '<h2>Gallery</h2>';
            const galleryGrid = document.createElement('div');
            galleryGrid.className = 'pdp-gallery-grid';
            const galleryImages = (card.gallery && card.gallery.length > 0) ? card.gallery : [card.image];
            galleryImages.slice(0, 6).forEach((url, idx) => {
                const galleryItem = document.createElement('div');
                galleryItem.className = 'pdp-gallery-item';
                const galleryImg = document.createElement('img');
                galleryImg.src = url;
                galleryImg.alt = `${card.name} - Image ${idx + 1}`;
                galleryImg.loading = 'lazy';
                galleryImg.onerror = function() {
                    if (!this.dataset.failed) {
                        this.dataset.failed = '1';
                        this.src = PROPERTY_IMAGE_POOL[0];
                        this.onerror = null;
                    }
                };
                galleryItem.appendChild(galleryImg);
                galleryItem.onclick = function() {
                    // Open gallery from PDP
                    removeElementById('property-gallery-overlay');
                    // Trigger gallery opening - we can reuse the createGallery logic
                    // For simplicity, just open the first image in gallery
                };
                galleryGrid.appendChild(galleryItem);
            });
            gallerySection.appendChild(galleryGrid);
            
            // Sticky CTA Section
            const ctaSection = document.createElement('div');
            ctaSection.className = 'pdp-bottom-sheet-cta';
            const contactBtn = document.createElement('button');
            contactBtn.className = 'pdp-cta-primary';
            contactBtn.textContent = 'Contact Owner';
            const scheduleBtn = document.createElement('button');
            scheduleBtn.className = 'pdp-cta-secondary';
            scheduleBtn.textContent = 'Schedule Visit';
            ctaSection.appendChild(contactBtn);
            ctaSection.appendChild(scheduleBtn);
            
            // Assemble content
            contentWrapper.appendChild(propertyName);
            contentWrapper.appendChild(location);
            contentWrapper.appendChild(price);
            contentWrapper.appendChild(detailsGrid);
            contentWrapper.appendChild(description);
            contentWrapper.appendChild(gallerySection);
            
            pdpContent.appendChild(heroImage);
            pdpContent.appendChild(contentWrapper);
            
            bottomSheet.appendChild(headerArea);
            bottomSheet.appendChild(pdpContent);
            bottomSheet.appendChild(ctaSection);
            
            bottomSheetOverlay.appendChild(bottomSheet);
            document.body.appendChild(bottomSheetOverlay);
            
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            
            // Animate in
            requestAnimationFrame(() => {
                bottomSheetOverlay.classList.add('show');
                bottomSheet.classList.add('show');
            });
            
            // Close on overlay click
            bottomSheetOverlay.addEventListener('click', (e) => {
                if (e.target === bottomSheetOverlay) {
                    closePDPBottomSheet();
                }
            });
            
            // Smooth scroll to top
            pdpContent.scrollTop = 0;
        }
        
        // Close PDP bottom sheet
        function closePDPBottomSheet() {
            const bottomSheetOverlay = document.getElementById('property-detail-bottom-sheet');
            if (!bottomSheetOverlay) return;
            
            // Cleanup mouse event listeners if they exist
            if (bottomSheetOverlay._cleanupMouseEvents) {
                bottomSheetOverlay._cleanupMouseEvents();
            }
            
            const bottomSheet = bottomSheetOverlay.querySelector('.pdp-bottom-sheet');
            if (bottomSheet) {
                bottomSheet.classList.remove('show');
            }
            bottomSheetOverlay.classList.remove('show');
            
            setTimeout(() => {
                bottomSheetOverlay.remove();
                document.body.style.overflow = '';
            }, 300);
        }
        
        // Open property gallery in fullscreen
        function openPropertyGallery(card) {
            // Create gallery overlay
            const galleryOverlay = document.createElement('div');
            galleryOverlay.className = 'property-gallery-overlay';
            galleryOverlay.id = 'property-gallery-overlay';
            
            // Create close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'property-gallery-close';
            closeBtn.setAttribute('aria-label', 'Close gallery');
            closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.addEventListener('click', () => {
                closePropertyGallery();
            });
            
            // Create gallery container
            const galleryContainer = document.createElement('div');
            galleryContainer.className = 'property-gallery-container';
            
            // Create image container
            const imageContainer = document.createElement('div');
            imageContainer.className = 'property-gallery-images';
            
            let currentImageIndex = 0;
            const images = card.gallery && card.gallery.length > 0 ? card.gallery : [card.image];
            
            // Create image elements
            images.forEach((imgUrl, index) => {
                const img = document.createElement('img');
                img.src = imgUrl;
                img.alt = `${card.name} - Image ${index + 1}`;
                img.className = 'property-gallery-image';
                if (index !== 0) img.style.display = 'none';
                imageContainer.appendChild(img);
            });
            
            // Create navigation arrows
            const prevBtn = document.createElement('button');
            prevBtn.className = 'property-gallery-nav property-gallery-prev';
            prevBtn.setAttribute('aria-label', 'Previous image');
            prevBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            
            const nextBtn = document.createElement('button');
            nextBtn.className = 'property-gallery-nav property-gallery-next';
            nextBtn.setAttribute('aria-label', 'Next image');
            nextBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>';
            
            // Navigation functions
            function showImage(index) {
                const allImages = imageContainer.querySelectorAll('.property-gallery-image');
                allImages.forEach((img, i) => {
                    img.style.display = i === index ? 'block' : 'none';
                });
                currentImageIndex = index;
                
                // Update button visibility
                if (images.length > 1) {
                    prevBtn.style.display = 'flex';
                    nextBtn.style.display = 'flex';
            } else {
                    prevBtn.style.display = 'none';
                    nextBtn.style.display = 'none';
                }
            }
            
            function nextImage() {
                const nextIndex = (currentImageIndex + 1) % images.length;
                showImage(nextIndex);
            }
            
            function prevImage() {
                const prevIndex = (currentImageIndex - 1 + images.length) % images.length;
                showImage(prevIndex);
            }
            
            prevBtn.addEventListener('click', prevImage);
            nextBtn.addEventListener('click', nextImage);
            
            // Swipe support for mobile
            let touchStartX = 0;
            let touchEndX = 0;
            
            imageContainer.addEventListener('touchstart', (e) => {
                touchStartX = e.changedTouches[0].screenX;
            });
            
            imageContainer.addEventListener('touchend', (e) => {
                touchEndX = e.changedTouches[0].screenX;
                handleSwipe();
            });
            
            function handleSwipe() {
                const swipeThreshold = 50;
                const diff = touchStartX - touchEndX;
                
                if (Math.abs(diff) > swipeThreshold) {
                    if (diff > 0) {
                        nextImage(); // Swipe left - next
                } else {
                        prevImage(); // Swipe right - previous
                    }
                }
            }
            
            // Keyboard navigation
            function handleKeyPress(e) {
                if (e.key === 'ArrowLeft') prevImage();
                if (e.key === 'ArrowRight') nextImage();
                if (e.key === 'Escape') closePropertyGallery();
            }
            
            document.addEventListener('keydown', handleKeyPress);
            galleryOverlay._keyHandler = handleKeyPress; // Store for cleanup
            
            // Close on overlay click (but not on image click)
            galleryOverlay.addEventListener('click', (e) => {
                if (e.target === galleryOverlay) {
                    closePropertyGallery();
                }
            });
            
            // Assemble gallery
            galleryContainer.appendChild(imageContainer);
            if (images.length > 1) {
                galleryContainer.appendChild(prevBtn);
                galleryContainer.appendChild(nextBtn);
            }
            galleryOverlay.appendChild(closeBtn);
            galleryOverlay.appendChild(galleryContainer);
            
            // Add to body
            document.body.appendChild(galleryOverlay);
            document.body.style.overflow = 'hidden'; // Prevent body scroll
            
            // Show first image
            showImage(0);
        }
        
        // Close property gallery
        function closePropertyGallery() {
            const galleryOverlay = document.getElementById('property-gallery-overlay');
            if (galleryOverlay) {
                // Remove keyboard listener
                if (galleryOverlay._keyHandler) {
                    document.removeEventListener('keydown', galleryOverlay._keyHandler);
                }
                galleryOverlay.remove();
                document.body.style.overflow = ''; // Restore body scroll
            }
        }
        
        // Show brochure message with CTA
        function showBrochureMessage() {
            showTypingIndicator();
            
            const delay = 1800 + Math.random() * 1000; // 1800-2800ms delay
            
            setTimeout(() => {
                hideTypingIndicator();
                
                const msgId = generateMessageId();
                const message = {
                    id: msgId,
                    role: 'bot',
                    text: 'Here\'s the project brochure for you.',
                    timestamp: Date.now(),
                    hasBrochure: true
                };
                messages.push(message);
                
                // Haptic feedback when brochure appears
                triggerHapticFeedback('medium');
                
                // Create message element
                const msgDiv = document.createElement('div');
                msgDiv.id = msgId;
                msgDiv.className = 'msg msg-bot';
                
                const botContent = document.createElement('div');
                botContent.className = 'bot-message-content';
                
                // Add text
                const botText = document.createElement('div');
                botText.className = 'bot-text';
                botText.textContent = message.text;
                
                // Create brochure component
                // Use a random property image as brochure cover
                const randomCoverImage = getRandomItem(PROPERTY_IMAGE_POOL);
                
                // Create brochure card component
                const brochureComponent = document.createElement('div');
                brochureComponent.className = 'brochure-card';
                
                // Image wrapper (full-width filled image)
                const brochureImageWrapper = document.createElement('div');
                brochureImageWrapper.className = 'brochure-card__image-wrapper';
                const coverImg = document.createElement('img');
                coverImg.src = randomCoverImage;
                coverImg.alt = 'Project Brochure';
                coverImg.className = 'brochure-card__image';
                coverImg.loading = 'eager';
                coverImg.decoding = 'async';
                coverImg.onerror = function() {
                    // Fallback to local image if primary fails
                    if (!this.dataset.failed) {
                        this.dataset.failed = '1';
                        this.src = PROPERTY_IMAGE_POOL[0];
                    } else {
                        // If fallback also fails, show placeholder background
                        this.style.display = 'none';
                        this.parentElement.style.backgroundColor = '#f2f2f2';
                    }
                };
                brochureImageWrapper.appendChild(coverImg);
                
                // Card body
                const brochureBody = document.createElement('div');
                brochureBody.className = 'brochure-card__body';
                
                // Get random developer name
                const developerName = getRandomItem(INDIAN_DEVELOPER_NAMES);
                
                // Title
                const brochureTitle = document.createElement('div');
                brochureTitle.className = 'brochure-card__title';
                brochureTitle.textContent = 'Project Brochure';
                
                // Developer name
                const brochureDeveloper = document.createElement('div');
                brochureDeveloper.className = 'brochure-card__developer';
                brochureDeveloper.textContent = developerName;
                
                // Subtitle
                const brochureSubtitle = document.createElement('div');
                brochureSubtitle.className = 'brochure-card__subtitle';
                brochureSubtitle.textContent = 'View detailed project information and specifications';
                
                // CTA button
                const brochureCta = document.createElement('button');
                brochureCta.className = 'brochure-card__cta';
                brochureCta.textContent = 'View Brochure';
                
                // Assemble body
                brochureBody.appendChild(brochureTitle);
                brochureBody.appendChild(brochureDeveloper);
                brochureBody.appendChild(brochureSubtitle);
                brochureBody.appendChild(brochureCta);
                
                // Assemble card
                brochureComponent.appendChild(brochureImageWrapper);
                brochureComponent.appendChild(brochureBody);
                
                // Make entire card clickable
                brochureComponent.onclick = function(e) {
                    // Don't trigger if clicking the button (handled separately)
                    if (e.target !== brochureCta && !brochureCta.contains(e.target)) {
                        openBrochurePDF(randomCoverImage, developerName);
                    }
                };
                
                brochureCta.onclick = function(e) {
                    e.stopPropagation();
                    openBrochurePDF(randomCoverImage, developerName);
                };
                
                botContent.appendChild(botText);
                botContent.appendChild(brochureComponent);
                
                // Add feedback buttons
                const feedbackButtons = createFeedbackButtons(msgId);
                botContent.appendChild(feedbackButtons);
                
                msgDiv.appendChild(botContent);
                
                // Add to chat stack
                const stack = domCache.chatStack;
                if (stack) {
                    stack.appendChild(msgDiv);
                    
                    // Scroll message to top
            requestAnimationFrame(() => {
                        scrollMessageIntoView(msgDiv);
                    });
                }
            }, delay);
        }
        
        // Open fullscreen PDF brochure viewer
        function openBrochurePDF(coverImage, developerName) {
            // Remove existing brochure viewer
            removeElementById('brochure-pdf-overlay');
            
            // Create overlay
            const overlay = document.createElement('div');
            overlay.id = 'brochure-pdf-overlay';
            overlay.className = 'brochure-pdf-overlay';
            
            // Create close button
            const closeBtn = document.createElement('button');
            closeBtn.className = 'brochure-pdf-close';
            closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.onclick = function() {
                overlay.remove();
                document.body.style.overflow = '';
            };
            
            // Create PDF container
            const pdfContainer = document.createElement('div');
            pdfContainer.className = 'brochure-pdf-container';
            
            // Create scrollable brochure content
            const brochureContent = document.createElement('div');
            brochureContent.className = 'brochure-pdf-content';
            
            // Get random images for brochure pages
            const brochureImages = selectUniqueItems(PROPERTY_IMAGE_POOL, 6);
            
            // Page 1: Cover Page
            const coverPage = createBrochurePage('cover', {
                image: coverImage,
                developerName: developerName,
                title: 'Luxury Living Redefined',
                subtitle: 'Premium Residential Project'
            });
            brochureContent.appendChild(coverPage);
            
            // Page 2: About the Project
            const aboutPage = createBrochurePage('about', {
                image: brochureImages[0],
                title: 'About the Project',
                content: [
                    'Experience luxury living at its finest with our meticulously designed residential project.',
                    'Spread across 25 acres of prime land, this development offers world-class amenities and modern architecture.',
                    'With over 15 years of expertise in real estate, we bring you homes that combine comfort, style, and functionality.',
                    'Each unit is designed to maximize natural light and ventilation, ensuring a healthy living environment.'
                ],
                features: ['25 Acres', '500+ Units', 'RERA Approved', 'Ready to Move']
            });
            brochureContent.appendChild(aboutPage);
            
            // Page 3: Amenities
            const amenitiesPage = createBrochurePage('amenities', {
                image: brochureImages[1],
                title: 'World-Class Amenities',
                content: [
                    'Our project offers an extensive range of amenities designed to enhance your lifestyle.',
                    'From recreational facilities to essential services, everything is thoughtfully planned.'
                ],
                amenities: [
                    { icon: '🏊', text: 'Swimming Pool' },
                    { icon: '🏋️', text: 'Gym & Fitness Center' },
                    { icon: '🌳', text: 'Landscaped Gardens' },
                    { icon: '🚗', text: 'Covered Parking' },
                    { icon: '🎮', text: 'Kids Play Area' },
                    { icon: '🏛️', text: 'Clubhouse' },
                    { icon: '🔒', text: '24/7 Security' },
                    { icon: '🏥', text: 'Medical Center' }
                ]
            });
            brochureContent.appendChild(amenitiesPage);
            
            // Page 4: Location & Connectivity
            const locationPage = createBrochurePage('location', {
                image: brochureImages[2],
                title: 'Prime Location',
                content: [
                    'Strategically located in the heart of the city with excellent connectivity.',
                    'Close to major business hubs, educational institutions, and healthcare facilities.',
                    'Well-connected to metro stations, airports, and shopping malls.'
                ],
                highlights: [
                    '5 mins from Metro Station',
                    '10 mins from International Airport',
                    '15 mins from Business District',
                    '2 mins from Shopping Mall'
                ]
            });
            brochureContent.appendChild(locationPage);
            
            // Page 5: Specifications
            const specsPage = createBrochurePage('specifications', {
                image: brochureImages[3],
                title: 'Specifications',
                content: [
                    'Built with premium materials and modern construction techniques.',
                    'Every detail is carefully planned to ensure durability and aesthetics.'
                ],
                specs: [
                    { label: 'Structure', value: 'RCC Framed' },
                    { label: 'Walls', value: 'Premium Paints' },
                    { label: 'Flooring', value: 'Vitrified Tiles' },
                    { label: 'Doors', value: 'Teak Wood' },
                    { label: 'Windows', value: 'UPVC with Grills' },
                    { label: 'Kitchen', value: 'Modular with Hobs' },
                    { label: 'Bathrooms', value: 'Premium Fittings' },
                    { label: 'Power Backup', value: '100% Coverage' }
                ]
            });
            brochureContent.appendChild(specsPage);
            
            // Page 6: Contact & Pricing
            const contactPage = createBrochurePage('contact', {
                image: brochureImages[4],
                title: 'Get in Touch',
                content: [
                    'Ready to make this your home? Contact us today for site visits and exclusive offers.',
                    'Our sales team is available to assist you with all your queries.'
                ],
                contact: [
                    { label: 'Sales Office', value: '+91 98765 43210' },
                    { label: 'Email', value: 'sales@developer.com' },
                    { label: 'Website', value: 'www.developer.com' },
                    { label: 'Office Hours', value: 'Mon-Sat: 10 AM - 7 PM' }
                ],
                pricing: 'Starting from ₹1.2 Cr*'
            });
            brochureContent.appendChild(contactPage);
            
            pdfContainer.appendChild(brochureContent);
            overlay.appendChild(closeBtn);
            overlay.appendChild(pdfContainer);
            
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';
            
            // Scroll to top
            pdfContainer.scrollTop = 0;
        }
        
        // Helper function to create brochure pages
        function createBrochurePage(type, data) {
            const page = document.createElement('div');
            page.className = 'brochure-page';
            
            // Page header with image
            const pageHeader = document.createElement('div');
            pageHeader.className = 'brochure-page__header';
            const headerImage = document.createElement('img');
            headerImage.src = data.image;
            headerImage.alt = data.title || 'Brochure Image';
            headerImage.className = 'brochure-page__image';
            headerImage.loading = 'eager';
            headerImage.decoding = 'async';
            headerImage.onerror = function() {
                // Fallback to a reliable Unsplash image if primary fails
                if (!this.dataset.failed) {
                    this.dataset.failed = '1';
                    this.src = PROPERTY_IMAGE_POOL[0];
            } else {
                    // If fallback also fails, show placeholder background
                    this.style.display = 'none';
                    this.parentElement.style.backgroundColor = '#f2f2f2';
                }
            };
            pageHeader.appendChild(headerImage);
            
            // Page body
            const pageBody = document.createElement('div');
            pageBody.className = 'brochure-page__body';
            
            // Title
            const pageTitle = document.createElement('h2');
            pageTitle.className = 'brochure-page__title';
            pageTitle.textContent = data.title;
            pageBody.appendChild(pageTitle);
            
            // Developer name (for cover page)
            if (type === 'cover' && data.developerName) {
                const developerDiv = document.createElement('div');
                developerDiv.className = 'brochure-page__developer';
                developerDiv.textContent = data.developerName;
                pageBody.appendChild(developerDiv);
            }
            
            // Subtitle (for cover page)
            if (type === 'cover' && data.subtitle) {
                const subtitle = document.createElement('div');
                subtitle.className = 'brochure-page__subtitle';
                subtitle.textContent = data.subtitle;
                pageBody.appendChild(subtitle);
            }
            
            // Content paragraphs
            if (data.content && Array.isArray(data.content)) {
                data.content.forEach(text => {
                    const para = document.createElement('p');
                    para.className = 'brochure-page__text';
                    para.textContent = text;
                    pageBody.appendChild(para);
                });
            }
            
            // Features (for about page)
            if (data.features && Array.isArray(data.features)) {
                const featuresGrid = document.createElement('div');
                featuresGrid.className = 'brochure-page__features';
                data.features.forEach(feature => {
                    const featureItem = document.createElement('div');
                    featureItem.className = 'brochure-page__feature-item';
                    featureItem.textContent = feature;
                    featuresGrid.appendChild(featureItem);
                });
                pageBody.appendChild(featuresGrid);
            }
            
            // Amenities (for amenities page)
            if (data.amenities && Array.isArray(data.amenities)) {
                const amenitiesGrid = document.createElement('div');
                amenitiesGrid.className = 'brochure-page__amenities';
                data.amenities.forEach(amenity => {
                    const amenityItem = document.createElement('div');
                    amenityItem.className = 'brochure-page__amenity-item';
                    amenityItem.innerHTML = `<span class="amenity-icon">${amenity.icon}</span><span class="amenity-text">${amenity.text}</span>`;
                    amenitiesGrid.appendChild(amenityItem);
                });
                pageBody.appendChild(amenitiesGrid);
            }
            
            // Highlights (for location page)
            if (data.highlights && Array.isArray(data.highlights)) {
                const highlightsList = document.createElement('div');
                highlightsList.className = 'brochure-page__highlights';
                data.highlights.forEach(highlight => {
                    const highlightItem = document.createElement('div');
                    highlightItem.className = 'brochure-page__highlight-item';
                    highlightItem.innerHTML = `<span class="highlight-icon">📍</span><span>${highlight}</span>`;
                    highlightsList.appendChild(highlightItem);
                });
                pageBody.appendChild(highlightsList);
            }
            
            // Specifications (for specs page)
            if (data.specs && Array.isArray(data.specs)) {
                const specsList = document.createElement('div');
                specsList.className = 'brochure-page__specs';
                data.specs.forEach(spec => {
                    const specItem = document.createElement('div');
                    specItem.className = 'brochure-page__spec-item';
                    specItem.innerHTML = `<span class="spec-label">${spec.label}:</span><span class="spec-value">${spec.value}</span>`;
                    specsList.appendChild(specItem);
                });
                pageBody.appendChild(specsList);
            }
            
            // Contact info (for contact page)
            if (data.contact && Array.isArray(data.contact)) {
                const contactList = document.createElement('div');
                contactList.className = 'brochure-page__contact';
                data.contact.forEach(contact => {
                    const contactItem = document.createElement('div');
                    contactItem.className = 'brochure-page__contact-item';
                    contactItem.innerHTML = `<span class="contact-label">${contact.label}:</span><span class="contact-value">${contact.value}</span>`;
                    contactList.appendChild(contactItem);
                });
                pageBody.appendChild(contactList);
            }
            
            // Pricing (for contact page)
            if (data.pricing) {
                const pricingDiv = document.createElement('div');
                pricingDiv.className = 'brochure-page__pricing';
                pricingDiv.textContent = data.pricing;
                pageBody.appendChild(pricingDiv);
            }
            
            page.appendChild(pageHeader);
            page.appendChild(pageBody);
            
            return page;
        }
        
        // Show property cards with loading indicator
        function showPropertyCards() {
            // Show typing indicator first
            showTypingIndicator();
            
            // Generate cards
            const cards = generatePropertyCards();
            
            // Add delay before showing properties (realistic processing time)
            const delay = 1800 + Math.random() * 1000; // 1800-2800ms delay
            
                setTimeout(() => {
                // Hide typing indicator
                hideTypingIndicator();
                
                const carousel = renderPropertyCards(cards);
                
                // Create bot message with cards
                const msgId = generateMessageId();
                const message = {
                    id: msgId,
                    role: 'bot',
                    text: `Great! I found ${cards.length} properties matching your criteria.`,
                    timestamp: Date.now(),
                    hasCards: true
                };
                messages.push(message);
                
                // Haptic feedback when property cards appear
                triggerHapticFeedback('medium');
                
                // Create message element
                const msgDiv = document.createElement('div');
                msgDiv.id = msgId;
                msgDiv.className = 'msg msg-bot';
                
                const botContent = document.createElement('div');
                botContent.className = 'bot-message-content';
                
                // Add text
                const botText = document.createElement('div');
                botText.className = 'bot-text';
                botText.textContent = message.text;
                
                botContent.appendChild(botText);
                botContent.appendChild(carousel);
                
                // Add feedback buttons
                const feedbackButtons = createFeedbackButtons(msgId);
                botContent.appendChild(feedbackButtons);
                
                msgDiv.appendChild(botContent);
                
                // Add to chat stack
                const stack = document.getElementById('chat-stack');
                if (stack) {
                    stack.appendChild(msgDiv);
                    
                    // KEY BEHAVIOR: Scroll message to top of viewport (below header)
                    // This keeps new messages visible at top instead of scrolling down
                    requestAnimationFrame(() => {
                        scrollMessageIntoView(msgDiv);
                    });
                }
            }, delay);
            
            return 'loading';
        }
        
        // Create feedback buttons (thumbs up/down) for property cards and brochures
        function createFeedbackButtons(messageId) {
            const feedbackContainer = document.createElement('div');
            feedbackContainer.className = 'feedback-buttons';
            feedbackContainer.dataset.messageId = messageId;
            
            // Add text before buttons
            const feedbackText = document.createElement('span');
            feedbackText.className = 'feedback-text';
            feedbackText.textContent = 'Was this helpful?';
            
            const thumbsUpBtn = document.createElement('button');
            thumbsUpBtn.className = 'feedback-btn feedback-btn-up';
            thumbsUpBtn.setAttribute('aria-label', 'Thumbs up');
            thumbsUpBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32ZM223.94,97l-12,96a8,8,0,0,1-7.94,7H88V105.89l36.71-73.43A24,24,0,0,1,144,56V80a8,8,0,0,0,8,8h64a8,8,0,0,1,7.94,9Z"></path>
                </svg>
            `;
            
            const thumbsDownBtn = document.createElement('button');
            thumbsDownBtn.className = 'feedback-btn feedback-btn-down';
            thumbsDownBtn.setAttribute('aria-label', 'Thumbs down');
            thumbsDownBtn.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" fill="currentColor">
                    <path d="M239.82,157l-12-96A24,24,0,0,0,204,40H32A16,16,0,0,0,16,56v88a16,16,0,0,0,16,16H75.06l37.78,75.58A8,8,0,0,0,120,240a40,40,0,0,0,40-40V184h56a24,24,0,0,0,23.82-27ZM72,144H32V56H72Zm150,21.29a7.88,7.88,0,0,1-6,2.71H152a8,8,0,0,0-8,8v24a24,24,0,0,1-19.29,23.54L88,150.11V56H204a8,8,0,0,1,7.94,7l12,96A7.87,7.87,0,0,1,222,165.29Z"></path>
                </svg>
            `;
            
            // Track selected state
            let selectedFeedback = null;
            
            const handleFeedback = (type) => {
                if (selectedFeedback === type) {
                    // Deselect if clicking the same button
                    selectedFeedback = null;
                    thumbsUpBtn.classList.remove('active');
                    thumbsDownBtn.classList.remove('active');
                } else {
                    // Select new feedback
                    selectedFeedback = type;
                    if (type === 'up') {
                        thumbsUpBtn.classList.add('active');
                        thumbsDownBtn.classList.remove('active');
                    } else {
                        thumbsDownBtn.classList.add('active');
                        thumbsUpBtn.classList.remove('active');
                    }
                    
                    // Show toast notification
                    showFeedbackToast();
                }
            };
            
            thumbsUpBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleFeedback('up');
            });
            
            thumbsDownBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                handleFeedback('down');
            });
            
            feedbackContainer.appendChild(feedbackText);
            feedbackContainer.appendChild(thumbsUpBtn);
            feedbackContainer.appendChild(thumbsDownBtn);
            
            return feedbackContainer;
        }
        
        // Show minimal toast notification for feedback
        function showFeedbackToast() {
            // Remove existing toast if any
            const existingToast = document.querySelector('.feedback-toast');
            if (existingToast) {
                existingToast.remove();
            }
            
            const toast = document.createElement('div');
            toast.className = 'feedback-toast';
            toast.textContent = 'Thanks for sharing feedback';
            
            document.body.appendChild(toast);
            
            // Position toast based on keyboard state
            positionFeedbackToast(toast);
            
            // Show toast
            requestAnimationFrame(() => {
                toast.classList.add('show');
            });
            
            // Hide and remove after 2 seconds
            setTimeout(() => {
                toast.classList.remove('show');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            }, 2000);
        }
        
        // Position toast above keyboard or input field
        function positionFeedbackToast(toast) {
            const inputBar = document.querySelector('.chat-input-bar');
            if (!inputBar) return;
            
            const updatePosition = () => {
                // Check if keyboard is open using visualViewport
                const isKeyboardOpen = window.visualViewport && 
                    (window.innerHeight - window.visualViewport.height) > 150;
                
                if (isKeyboardOpen) {
                    // Position above keyboard
                    const keyboardHeight = window.innerHeight - window.visualViewport.height;
                    toast.style.bottom = `${keyboardHeight + 16}px`;
                } else {
                    // Position above input field
                    const inputRect = inputBar.getBoundingClientRect();
                    toast.style.bottom = `${window.innerHeight - inputRect.top + 16}px`;
                }
            };
            
            updatePosition();
            
            // Update position on keyboard state changes
            if (window.visualViewport) {
                const handleViewportChange = () => {
                    if (toast && document.body.contains(toast)) {
                        updatePosition();
                    } else {
                        window.visualViewport.removeEventListener('resize', handleViewportChange);
                    }
                };
                window.visualViewport.addEventListener('resize', handleViewportChange);
            }
        }
        
        // Track last fallback message to ensure non-repeating randomness
        let lastFallbackIndex = -1;
        
        // Fallback responses for unmatched messages (casual, demo-aware responses)
        // Returns a random message from the pool, never repeating consecutively
        function getFallbackResponse() {
            const fallbackMessages = [
                "Haha I'm not set up for that yet. Still very demo right now.",
                "That's a bit outside what I can do today. I'm still warming up.",
                "Not there yet, honestly. This is just a partial demo.",
                "I'm gonna sit this one out for now. Still very early days.",
                "I don't really know that yet. I'm still learning the basics here.",
                "That's out of scope for me right now. Demo brain only.",
                "I'm not smart enough for that yet. Working on it though.",
                "That's a future-me problem. Present-me is still in demo mode.",
                "I can't help with that just yet. This is still pretty limited.",
                "Yeah not something I handle right now. Very early build.",
                "I'm only good at a few things so far. This isn't one of them.",
                "That's beyond me for now. Still very much a work in progress.",
                "I wish I knew that already. I'm not there yet though.",
                "That's outside what I'm trained on right now. Demo vibes only.",
                "Not today I'm still figuring things out here."
            ];
            
            // Non-repeating randomness: ensure we don't return the same message twice in a row
            let randomIndex;
            do {
                randomIndex = Math.floor(Math.random() * fallbackMessages.length);
            } while (randomIndex === lastFallbackIndex && fallbackMessages.length > 1);
            
            lastFallbackIndex = randomIndex;
            return fallbackMessages[randomIndex];
        }
        
        // Detect non-housing topics that should trigger fallback
        // Comprehensive detection for ANY random query that's not housing-related
        // This runs BEFORE property extraction to catch non-housing queries
        function isNonHousingTopic(text, normalized) {
            // Property keywords - if message has these, it might be housing-related (check later)
            const propertyKeywords = /\b(property|properties|home|house|houses|apartment|apartments|flat|flats|bhk|bedroom|bedrooms|rent|rental|buy|purchase|sale|sell|price|budget|locality|area|sqft|sq ft|square feet|builder|developer|project|residential|commercial|real estate|realestate)\b/i.test(normalized);
            
            // ===== ENVIRONMENT & WEATHER =====
            if (/\b(aqi|air quality|pollution|pm2|pm10|air index|air pollution|pollutant|smog|haze)\b/i.test(normalized)) return true;
            if (/\b(weather|temperature|temp|rain|rainy|sunny|cloudy|humidity|forecast|climate|wind|storm|snow|fog|drizzle)\b/i.test(normalized)) return true;
            if (/\b(season|winter|summer|spring|autumn|monsoon|drought|flood)\b/i.test(normalized)) return true;
            
            // ===== NEWS & CURRENT EVENTS =====
            if (/\b(news|headlines|latest|update|happening|event|breaking|trending|viral|article|report)\b/i.test(normalized)) return true;
            if (/\b(politics|election|vote|government|minister|president|prime minister|party)\b/i.test(normalized)) return true;
            
            // ===== ENTERTAINMENT =====
            if (/\b(movie|film|actor|actress|celebrity|tv|show|series|episode|netflix|youtube|amazon prime|disney|hulu)\b/i.test(normalized)) return true;
            if (/\b(music|song|singer|album|playlist|spotify|apple music|concert|gig|band)\b/i.test(normalized)) return true;
            if (/\b(game|gaming|playstation|xbox|nintendo|pc game|mobile game|esports|streamer)\b/i.test(normalized)) return true;
            if (/\b(joke|funny|meme|comedy|humor|laugh|hilarious|rofl|lol)\b/i.test(normalized)) return true;
            if (/\b(book|novel|author|reading|library|story|fiction|non-fiction)\b/i.test(normalized)) return true;
            
            // ===== SPORTS =====
            if (/\b(sport|football|cricket|basketball|tennis|match|game|player|team|score|league|tournament|world cup|olympics)\b/i.test(normalized)) return true;
            if (/\b(soccer|hockey|baseball|golf|swimming|running|cycling|gym|workout|fitness|exercise)\b/i.test(normalized)) return true;
            
            // ===== FOOD & DINING =====
            if (/\b(recipe|cooking|food|restaurant|cafe|dining|cuisine|dish|meal|breakfast|lunch|dinner|snack|hungry|thirsty)\b/i.test(normalized)) return true;
            if (/\b(pizza|burger|pasta|sushi|chinese|italian|indian|mexican|bakery|coffee|tea|drink|beverage)\b/i.test(normalized)) return true;
            if (/\b(delivery|zomato|swiggy|uber eats|doordash|grubhub|order food)\b/i.test(normalized)) return true;
            
            // ===== HEALTH & MEDICAL =====
            if (/\b(health|doctor|hospital|medicine|sick|pain|symptom|disease|treatment|therapy|clinic|pharmacy|medication)\b/i.test(normalized)) return true;
            if (/\b(fever|cough|cold|headache|stomach|ache|injury|wound|emergency|ambulance)\b/i.test(normalized)) return true;
            if (/\b(fitness|gym|workout|exercise|yoga|meditation|diet|weight loss|weight gain|muscle)\b/i.test(normalized)) return true;
            
            // ===== TECHNOLOGY =====
            if (/\b(tech|technology|computer|phone|mobile|smartphone|iphone|android|laptop|pc|mac|tablet)\b/i.test(normalized)) return true;
            if (/\b(internet|wifi|network|software|app|application|website|bug|error|crash|update|upgrade)\b/i.test(normalized)) return true;
            if (/\b(ai|artificial intelligence|machine learning|chatbot|robot|automation|blockchain|crypto|bitcoin)\b/i.test(normalized)) return true;
            if (/\b(social media|facebook|instagram|twitter|linkedin|tiktok|snapchat|whatsapp|telegram)\b/i.test(normalized)) return true;
            
            // ===== EDUCATION & LEARNING =====
            if (/\b(learn|study|education|school|college|university|course|class|exam|test|quiz|homework|assignment)\b/i.test(normalized)) return true;
            if (/\b(teacher|professor|student|tuition|coaching|tutorial|lesson|subject|math|science|history|language)\b/i.test(normalized)) return true;
            if (/\b(degree|diploma|certificate|scholarship|admission|enrollment|semester|grade|marks|result)\b/i.test(normalized)) return true;
            
            // ===== TRAVEL & TOURISM =====
            if (/\b(travel|trip|vacation|holiday|tourist|visit|sightseeing|flight|ticket|hotel|resort|beach|mountain)\b/i.test(normalized) && !propertyKeywords) return true;
            if (/\b(passport|visa|airport|airline|booking|reservation|itinerary|tour|guide|backpacking)\b/i.test(normalized)) return true;
            
            // ===== SHOPPING & E-COMMERCE =====
            if (/\b(shop|shopping|buy|purchase|order|amazon|flipkart|myntra|product|item|delivery|cart|checkout)\b/i.test(normalized) && !propertyKeywords) return true;
            if (/\b(price|cost|discount|offer|sale|deal|bargain|cheap|expensive|affordable)\b/i.test(normalized) && !propertyKeywords) return true;
            
            // ===== FINANCE & INVESTMENTS (non-property) =====
            if (/\b(stock|share|market|trading|investment|mutual fund|sip|fd|fixed deposit|savings|bank|loan)\b/i.test(normalized) && !propertyKeywords) return true;
            if (/\b(credit card|debit card|upi|paytm|gpay|phonepe|wallet|payment|transaction|balance)\b/i.test(normalized)) return true;
            if (/\b(tax|income tax|gst|pan|aadhaar|account|balance|statement|emi)\b/i.test(normalized) && !propertyKeywords) return true;
            
            // ===== TIME & DATE =====
            if (/\b(time|date|day|today|tomorrow|yesterday|week|month|year|clock|schedule|calendar|appointment)\b/i.test(normalized) && !propertyKeywords) return true;
            if (/\b(morning|afternoon|evening|night|midnight|noon|am|pm|hour|minute|second|when)\b/i.test(normalized) && !propertyKeywords) return true;
            
            // ===== PETS & ANIMALS =====
            if (/\b(pet|dog|cat|puppy|kitten|animal|veterinary|vet|adopt|breed|feed|walk)\b/i.test(normalized)) return true;
            if (/\b(bird|fish|rabbit|hamster|turtle|snake|parrot|pigeon|cow|goat|chicken)\b/i.test(normalized)) return true;
            
            // ===== SCIENCE & SPACE =====
            if (/\b(science|space|planet|star|moon|sun|earth|mars|galaxy|universe|astronomy|physics|chemistry|biology)\b/i.test(normalized)) return true;
            if (/\b(experiment|research|discovery|invention|theory|hypothesis|scientist|lab|laboratory)\b/i.test(normalized)) return true;
            
            // ===== HISTORY & CULTURE =====
            if (/\b(history|historical|ancient|medieval|war|battle|empire|king|queen|dynasty|civilization)\b/i.test(normalized)) return true;
            if (/\b(culture|cultural|tradition|festival|celebration|holiday|custom|ritual|religion|spiritual)\b/i.test(normalized)) return true;
            
            // ===== RELATIONSHIPS & DATING =====
            if (/\b(dating|relationship|girlfriend|boyfriend|marriage|wedding|divorce|love|romance|crush)\b/i.test(normalized)) return true;
            if (/\b(family|parent|mother|father|sibling|brother|sister|child|kid|baby|grandparent)\b/i.test(normalized) && !propertyKeywords) return true;
            
            // ===== HOBBIES & INTERESTS =====
            if (/\b(hobby|interest|passion|photography|painting|drawing|art|craft|music|dance|singing)\b/i.test(normalized)) return true;
            if (/\b(collect|collection|stamp|coin|antique|vintage|artwork|sculpture|gallery|museum)\b/i.test(normalized)) return true;
            
            // ===== MATH & CALCULATIONS =====
            if (/\b(calculate|math|mathematics|equation|formula|solve|add|subtract|multiply|divide|percentage)\b/i.test(normalized) && !propertyKeywords) return true;
            if (/\b(convert|conversion|unit|measurement|meter|kilometer|kilogram|pound|currency|exchange rate)\b/i.test(normalized) && !propertyKeywords) return true;
            
            // ===== LANGUAGE & TRANSLATION =====
            if (/\b(translate|translation|language|dictionary|meaning|definition|word|vocabulary|grammar|sentence)\b/i.test(normalized)) return true;
            if (/\b(english|hindi|spanish|french|german|chinese|japanese|korean|arabic|tamil|telugu|marathi)\b/i.test(normalized) && !propertyKeywords) return true;
            
            // ===== RANDOM CHAT & CONVERSATION =====
            if (/\b(how are you|what's up|whats up|how's it going|how do you do|tell me about|explain|describe)\b/i.test(normalized) && !propertyKeywords) return true;
            if (/\b(hello|hi|hey|good morning|good afternoon|good evening|good night|greetings)\b/i.test(normalized) && !propertyKeywords) return true;
            
            // ===== GENERAL QUESTIONS (catch-all) =====
            // If it's a question word but no property keywords, likely non-housing
            const questionWords = /\b(what|how|why|when|where|who|which|can you|could you|would you|tell me|explain|describe|what is|what are|how is|how are|why is|why are|when is|when are|where is|where are|who is|who are)\b/i.test(normalized);
            if (questionWords && !propertyKeywords) {
                // Additional check: if question is about something specific (not properties)
                const specificTopics = /\b(is|are|was|were|do|does|did|has|have|had|will|would|should|can|could|may|might)\b/i.test(normalized);
                if (specificTopics) {
                    return true; // Likely a general question, not about properties
                }
            }
            
            // ===== RANDOM TOPICS (catch-all patterns) =====
            // Questions starting with "what's" or "what is" without property context
            if (/^(what'?s|what is|what are)\s+/i.test(normalized) && !propertyKeywords) return true;
            
            // "How to" questions (usually tutorials/guides, not property search)
            if (/^how to\s+/i.test(normalized) && !propertyKeywords) return true;
            
            // "Why" questions (usually explanations, not property search)
            if (/^why\s+/i.test(normalized) && !propertyKeywords) return true;
            
            // "When" questions about events/time (not property-related)
            if (/^when\s+/i.test(normalized) && !/\b(property|home|house|apartment|flat|rent|buy)\b/i.test(normalized)) return true;
            
            // "Where" questions about locations/places (not property search)
            if (/^where\s+/i.test(normalized) && !/\b(property|home|house|apartment|flat|rent|buy|locality|area)\b/i.test(normalized)) return true;
            
            // "Who" questions (people, not properties)
            if (/^who\s+/i.test(normalized)) return true;
            
            // "Which" questions without property context
            if (/^which\s+/i.test(normalized) && !propertyKeywords) return true;
            
            return false;
        }
        
        // Check if message is clearly housing-related (strict check)
        // Only returns true if message is explicitly about properties/homes
        function isHousingRelated(text, normalized, updates) {
            // Must have explicit housing keywords AND property-related extraction
            const housingKeywords = /\b(property|properties|home|house|houses|apartment|apartments|flat|flats|bhk|bedroom|rent|rental|buy|purchase|sale|sell|price|budget|locality|area|sqft|sq ft|square feet|builder|developer|project|residential|commercial)\b/i.test(normalized);
            
            const hasIntent = !!updates.intent;
            const hasBHK = !!updates.bhk;
            const hasPrice = !!(updates.price || updates.priceMin || updates.priceMax);
            const hasLocality = !!updates.locality;
            const hasLocationRequest = !!updates.useLocation;
            
            // Only consider it housing-related if:
            // 1. Has housing keywords AND property-related extraction, OR
            // 2. Has explicit property search intent (rent/buy), OR
            // 3. Has BHK (clearly property-related), OR
            // 4. Has price with housing context, OR
            // 5. Location request for property search
            if (housingKeywords && (hasIntent || hasBHK || hasPrice || hasLocality || hasLocationRequest)) {
                return true;
            }
            
            // Explicit property search intent
            if (hasIntent) return true;
            
            // BHK is always property-related
            if (hasBHK) return true;
            
            // Price with housing keywords
            if (hasPrice && housingKeywords) return true;
            
            // Location request for properties
            if (hasLocationRequest) return true;
            
            return false;
        }
        
        // Check if CURRENT message matches a handled intent (state-agnostic)
        // This ensures fallback triggers even mid-conversation if user switches topics
        function wasMessageHandled(text, updates) {
            // Normalize input before intent checks (handles case, spacing, punctuation, typos)
            const normalized = normalizeText(text);
            
            // INTENT CHECK 0: Non-housing topics (NOT handled - triggers fallback)
            // This MUST run first to catch non-housing queries even if they extract locality
            if (isNonHousingTopic(text, normalized)) {
                if (window.__CHAT_DEBUG__) {
                    console.log('[Intent] Unhandled: Non-housing topic detected - will trigger fallback', {
                        normalized,
                        text
                    });
                }
                return false; // Not handled - will trigger fallback
            }
            
            // INTENT CHECK 1: Greeting (handled)
            if (isGreeting(text)) {
                if (window.__CHAT_DEBUG__) console.log('[Intent] Handled: Greeting');
                return true;
            }
            
            // INTENT CHECK 2: Brochure request (handled)
            const isBrochureRequest = /show.*brochure|brochure.*show|view.*brochure|brochure.*view|download.*brochure|brochure.*download/i.test(normalized) ||
                fuzzyMatchWord(text, 'show brochure', 0.7) ||
                fuzzyMatchWord(text, 'brochure', 0.7);
            if (isBrochureRequest) {
                if (window.__CHAT_DEBUG__) console.log('[Intent] Handled: Brochure request');
                return true;
            }
            
            // INTENT CHECK 3: Strict housing-related check
            // Only consider it handled if it's clearly about properties/homes
            if (isHousingRelated(text, normalized, updates)) {
                if (window.__CHAT_DEBUG__) {
                    console.log('[Intent] Handled: Housing-related message', {
                        intent: !!updates.intent,
                        bhk: !!updates.bhk,
                        price: !!(updates.price || updates.priceMin || updates.priceMax),
                        locality: !!updates.locality,
                        location: !!updates.useLocation
                    });
                }
                return true;
            }
            
            // INTENT CHECK 4: Location permission keywords (handled)
            // Check for location-related requests even if not explicitly extracted
            const locationKeywords = /near me|around me|nearby|my location|current location|where am i|explore.*near me|properties.*near me/i.test(normalized);
            if (locationKeywords) {
                if (window.__CHAT_DEBUG__) console.log('[Intent] Handled: Location request for properties');
                return true;
            }
            
            // Message does NOT match any handled intent - will trigger fallback
            if (window.__CHAT_DEBUG__) {
                console.log('[Intent] Unhandled: No matching intent found - will trigger fallback', {
                    normalized,
                    updates,
                    conversationState: { ...conversationState }
                });
            }
            return false;
        }
        
        // Handle user message with slot filling
        function handleUserMessage(text) {
            // Add user message
            addUserMessage(text);
            
            // Small delay before bot response
            setTimeout(() => {
                if (isGreeting(text)) {
                    // PATH: Handled intent - Greeting
                    if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to greeting flow');
                    // Reset state on new greeting
                    resetConversationState();
                    const response = getGreetingResponse();
                    addBotMessage(response);
                } else {
                    // Normalize input before processing (handles case, spacing, punctuation, typos)
                    const normalized = normalizeText(text);
                    
                    // Check for login request first (with typo tolerance)
                    const isLoginRequest = /login|log in|loggin|loging|loign|loin|sign in|signin|sign.*in/i.test(normalized) ||
                        fuzzyMatchWord(text, 'login', 0.7) ||
                        fuzzyMatchWord(text, 'log in', 0.7) ||
                        fuzzyMatchWord(text, 'sign in', 0.7);
                    
                    if (isLoginRequest) {
                        if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to login flow');
                        // Only open login bottom sheet if we're on the chat screen
                        const chatScreen = document.getElementById('chat-screen');
                        if (chatScreen && chatScreen.classList.contains('active')) {
                            showLoginBottomSheet();
                        } else {
                            addBotMessage("Please open the chat to login.");
                        }
                        return;
                    }
                    
                    // Check for brochure request
                    const isBrochureRequest = /show.*brochure|brochure.*show|view.*brochure|brochure.*view|download.*brochure|brochure.*download/i.test(normalized) ||
                        fuzzyMatchWord(text, 'show brochure', 0.7) ||
                        fuzzyMatchWord(text, 'brochure', 0.7);
                    
                    if (isBrochureRequest) {
                        if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to brochure flow');
                        showBrochureMessage();
                        return;
                    }
                    
                    // Extract information from user message (with smart extraction for typos)
                    const updates = smartExtract(text);
                    
                    // INTENT ROUTING: Check if CURRENT message matches a handled intent
                    // This is state-agnostic - works regardless of conversation state
                    // If message doesn't match any handled intent, show fallback immediately
                    if (!wasMessageHandled(text, updates)) {
                        // PATH: Fallback - message doesn't match any handled intent
                        if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to fallback response');
                        const fallbackResponse = getFallbackResponse();
                        addBotMessage(fallbackResponse);
                        return; // Don't proceed with property search flow
                    }
                    
                    // PATH: Handled intent - proceed with property search flow
                    if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to property search flow');
                    
                    // Update conversation state - preserve existing values, only update new ones
                    // This ensures we don't lose context from previous messages
                    for (const key in updates) {
                        if (updates[key] !== null && updates[key] !== undefined) {
                            // Special handling for price fields
                            if (key === 'price' || key === 'priceMin' || key === 'priceMax') {
                                // Only update if we don't already have price info
                                if (!conversationState.price && !conversationState.priceMin) {
                                    conversationState[key] = updates[key];
                                }
                            } else {
                                // For other fields, only update if not already set (preserve context)
                                if (!conversationState[key]) {
                                    conversationState[key] = updates[key];
                                }
                            }
                        }
                    }
                    
                    // If location is requested but not yet granted, show dialog
                    if (updates.useLocation && !userLocation.hasLocation) {
                        showLocationPermissionDialog();
                        return; // Don't proceed until location is granted
                    }
                    
                    // Check if we have all information (very lenient - shows properties if info is present)
                    if (isConversationComplete()) {
                        // Show property cards
                        conversationState.isComplete = true;
                        showPropertyCards();
                    } else {
                        // Ask follow-up question only if we're really missing something
                        // Double-check state before asking to avoid repeating questions
                        const followUp = getFollowUpQuestion();
                        if (followUp) {
                            addBotMessage(followUp);
                        } else {
                            // If no follow-up needed but not complete, something might be wrong
                            // Show properties anyway if we have most info
                            const hasIntent = !!conversationState.intent;
                            const hasBHK = !!conversationState.bhk;
                            const hasPrice = !!(conversationState.price || conversationState.priceMin);
                            if (hasIntent && hasBHK && hasPrice) {
                                // We have enough info, show properties
                                conversationState.isComplete = true;
                                showPropertyCards();
                            }
                        }
                    }
                }
            }, 300);
        }
        
        // Basic send button handler
        chatSendBtn.addEventListener('click', () => {
            const text = chatInput.value.trim();
            if (!text) return;
            
            // Clear input
            chatInput.value = '';
            
            // Hide intro on first message
            if (messages.length === 0 && chatScreen) {
                chatScreen.classList.add('chat-started');
            }
            
            // Handle the message
            handleUserMessage(text);
        });
        
        // Enter key handler
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                chatSendBtn.click();
            }
        });
        
        // Pill click handlers
        const pills = document.querySelectorAll('.chat-pill');
        pills.forEach(pill => {
            pill.addEventListener('click', () => {
                const text = pill.textContent.trim();
                
                // Hide intro on first message
                if (messages.length === 0 && chatScreen) {
                    chatScreen.classList.add('chat-started');
                }
                
                // Handle the message directly
                handleUserMessage(text);
            });
        });
        
        // ============================================================================
        // GLOBAL CLICK HANDLER FOR PROPERTY IMAGES (OUTSIDE IIFE SCOPE)
        // ============================================================================
        
        // Global gallery opener - accessible from anywhere
        window.openPropertyImageGallery = function(cardData) {
            const existing = document.getElementById('property-gallery-overlay');
            if (existing) existing.remove();
            
            const overlay = document.createElement('div');
            overlay.id = 'property-gallery-overlay';
            overlay.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: #ffffff !important; z-index: 999999 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
            
            const closeBtn = document.createElement('button');
            closeBtn.className = 'property-gallery-close';
            closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            closeBtn.style.cssText = 'position: absolute !important; top: 20px !important; right: 20px !important; width: 44px !important; height: 44px !important; background: transparent !important; border: none !important; cursor: pointer !important; z-index: 1000000 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
            closeBtn.onclick = function() {
                overlay.remove();
                document.body.style.overflow = '';
            };
            
            const img = document.createElement('img');
            const images = cardData.gallery && cardData.gallery.length > 0 ? cardData.gallery : [cardData.image];
            img.src = images[0];
            img.style.cssText = 'max-width: 90% !important; max-height: 90% !important; object-fit: contain !important;';
            
            overlay.appendChild(closeBtn);
            overlay.appendChild(img);
            overlay.onclick = function(e) {
                if (e.target === overlay) {
                    overlay.remove();
                    document.body.style.overflow = '';
                }
            };
            
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';
        };
        
        // ============================================================================
        // GLOBAL CLICK HANDLER FOR PROPERTY IMAGES (FALLBACK)
        // ============================================================================
        document.addEventListener('click', function(e) {
            const img = e.target.closest('.property-card__img');
            if (img && img.hasAttribute('data-card-image')) {
                e.preventDefault();
                e.stopPropagation();
                
                const cardData = {
                    id: img.getAttribute('data-property-id'),
                    image: img.getAttribute('data-card-image'),
                    gallery: JSON.parse(img.getAttribute('data-gallery-images') || '[]')
                };
                
                const existing = document.getElementById('property-gallery-overlay');
                if (existing) existing.remove();
                
                const overlay = document.createElement('div');
                overlay.id = 'property-gallery-overlay';
                overlay.style.cssText = 'position: fixed !important; top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important; background: #ffffff !important; z-index: 999999 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                
                const closeBtn = document.createElement('button');
                closeBtn.className = 'property-gallery-close';
                closeBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
                closeBtn.style.cssText = 'position: absolute !important; top: 20px !important; right: 20px !important; width: 44px !important; height: 44px !important; background: transparent !important; border: none !important; cursor: pointer !important; z-index: 1000000 !important; padding: 0 !important; display: flex !important; align-items: center !important; justify-content: center !important;';
                closeBtn.onclick = function() {
                    overlay.remove();
                    document.body.style.overflow = '';
                };
                
                const galleryImg = document.createElement('img');
                const images = cardData.gallery && cardData.gallery.length > 0 ? cardData.gallery : [cardData.image];
                galleryImg.src = images[0];
                galleryImg.style.cssText = 'max-width: 90% !important; max-height: 90% !important; object-fit: contain !important;';
                galleryImg.loading = 'eager';
                galleryImg.onerror = function() {
                    this.src = PROPERTY_IMAGE_POOL[0];
                    this.onerror = null;
                };
                
                overlay.appendChild(closeBtn);
                overlay.appendChild(galleryImg);
                overlay.onclick = function(e) {
                    if (e.target === overlay) {
                        overlay.remove();
                        document.body.style.overflow = '';
                    }
                };
                
                document.body.appendChild(overlay);
                document.body.style.overflow = 'hidden';
            }
        }, true); // Capture phase
        
        // ============================================================================
        // End of chat reset - ready to build from scratch
        // ============================================================================
    })();
});

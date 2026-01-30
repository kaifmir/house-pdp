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

// Fix 2: Prevent the initial focus scroll-jump (only for first focus)
let firstFocusFixDone = false;

// Step 6: Prevent focus scroll-jump
// Stop the browser from scrolling the window by ensuring window scroll stays at 0
document.addEventListener('focusin', (e) => {
    if (!e.target.matches('input, textarea, [contenteditable="true"]')) return;
    if (!e.target.closest('.chat-screen')) return; // Only for chat inputs
    
    // Prime viewport before focus
    primeViewport();
    
    // Fix 2: Special handling for first focus
    if (!firstFocusFixDone) {
        firstFocusFixDone = true;
        
        // Capture current scroll
        const y = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
        
        // Immediately undo any browser scroll attempt (multiple attempts to catch it)
        requestAnimationFrame(() => {
            window.scrollTo(0, y);
            document.documentElement.scrollTop = y;
            document.body.scrollTop = y;
        });
        setTimeout(() => {
            window.scrollTo(0, y);
            document.documentElement.scrollTop = y;
            document.body.scrollTop = y;
        }, 0);
        setTimeout(() => {
            window.scrollTo(0, y);
            document.documentElement.scrollTop = y;
            document.body.scrollTop = y;
        }, 50);
        
        // Force kb recalculation early + after viewport settles
        syncKeyboard();
        requestAnimationFrame(syncKeyboard);
        setTimeout(syncKeyboard, 50);
    } else {
        // Normal handling for subsequent focuses
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
        console.log('focusin - headerTop:', headerTop, 'kb:', kb, 'firstFocus:', !firstFocusFixDone);
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
        // B) Haptics on search click (iOS-safe)
        // Note: iOS web haptics need a native bridge (window.webkit.messageHandlers.haptic).
        // Without a bridge, only Android vibrate will work.
        function playHaptic() {
            // Android fallback
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
            // Optional iOS bridge if available (PWA with native bridge)
            try {
                if (window.webkit?.messageHandlers?.haptic) {
                    window.webkit.messageHandlers.haptic.postMessage({ type: 'light' });
                }
            } catch (e) {
                // No native bridge available - gracefully do nothing
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

            // composer moves instantly
            composer.style.bottom = kb ? `${kb}px` : '0px';

            // prevent any forced scroll jumps
            document.body.scrollTop = 0;
            document.documentElement.scrollTop = 0;

            setInstantMode(kb > 0);
        }

        function applySoon() {
            apply();
            requestAnimationFrame(apply);
            setTimeout(apply, 0);
            setTimeout(apply, 50);
        }

        // Events
        const vv = window.visualViewport;
        vv?.addEventListener('resize', apply);
        vv?.addEventListener('scroll', apply);
        window.addEventListener('orientationchange', applySoon);
        window.addEventListener('pageshow', applySoon);
        document.addEventListener('focusin', (e) => {
            if (e.target === input) applySoon();
        });
        document.addEventListener('focusout', (e) => {
            if (e.target === input) applySoon();
        });

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
        
        // Haptic feedback on click
        chatInput.addEventListener('click', () => {
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }
        });
        
        chatInput.addEventListener('focus', () => {
            // Haptic feedback
            if (navigator.vibrate) {
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
            
            const messages = document.getElementById("chat-messages");
            if (!messages) return;
            
            const header = document.querySelector(".chat-top-bar");
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
            const stack = document.getElementById('chat-stack');
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
        function showTypingIndicator() {
            // Remove any existing typing indicator
            const existing = document.getElementById('typing-indicator');
            if (existing) existing.remove();
            
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
            const stack = document.getElementById('chat-stack');
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
                const stack = document.getElementById('chat-stack');
                if (stack) {
                    stack.appendChild(msgDiv);
                    
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
                    text: "Hi! 👋 How can I help you find your perfect home today?",
                    withExamples: "Hi! 👋 How can I help you find your perfect home today?\n\nTry: '3 BHK in Delhi' or '2 BHK near metro'"
                },
                {
                    text: "Hey there! What are you looking for in your home search?",
                    withExamples: "Hey there! What are you looking for in your home search?\n\nTry: 'Apartments in Noida' or 'Villa with pool'"
                },
                {
                    text: "Hello! I'm here to help you find your dream home. What can I assist you with?",
                    withExamples: "Hello! I'm here to help you find your dream home. What can I assist you with?\n\nTry: '2 BHK in Gurgaon' or 'Studio apartment'"
                },
                {
                    text: "Hi! Ready to explore some amazing properties? How can I help?",
                    withExamples: "Hi! Ready to explore some amazing properties? How can I help?\n\nTry: '4 BHK in Bangalore' or 'Penthouse near nature'"
                },
                {
                    text: "Hey! What kind of home are you searching for today?",
                    withExamples: "Hey! What kind of home are you searching for today?\n\nTry: '3 BHK in Mumbai' or '2 BHK furnished'"
                },
                {
                    text: "Hello there! Let's find you the perfect place. What are you looking for?",
                    withExamples: "Hello there! Let's find you the perfect place. What are you looking for?\n\nTry: 'Buy property in Delhi' or 'Rent 2 BHK'"
                },
                {
                    text: "Hi! I'm here to make your home search easier. What can I help with?",
                    withExamples: "Hi! I'm here to make your home search easier. What can I help with?\n\nTry: '3 BHK in Pune' or 'Apartment near school'"
                },
                {
                    text: "Hey! What brings you here today? Looking for a new home?",
                    withExamples: "Hey! What brings you here today? Looking for a new home?\n\nTry: '2 BHK in Hyderabad' or 'Villa in gated community'"
                },
                {
                    text: "Hi there! How can I help you with your home search today?",
                    withExamples: "Hi there! How can I help you with your home search today?\n\nTry: '3 BHK sea view' or '2 BHK gated community'"
                },
                {
                    text: "Hello! What are you looking for in your next home?",
                    withExamples: "Hello! What are you looking for in your next home?\n\nTry: 'Luxury apartment' or 'Penthouse terrace'"
                }
            ];
            
            // Pick a random greeting
            const greeting = greetings[Math.floor(Math.random() * greetings.length)];
            
            // Sometimes add examples (35% chance) - makes it feel more helpful
            if (Math.random() < 0.35) {
                return greeting.withExamples;
            }
            
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
                isComplete: false
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
        
        // Fuzzy match common words with typos
        function fuzzyMatchWord(input, target, threshold = 0.7) {
            const inputNorm = normalizeText(input);
            const targetNorm = target.toLowerCase();
            
            // Exact match
            if (inputNorm.includes(targetNorm)) return true;
            
            // Check similarity
            const sim = similarity(inputNorm, targetNorm);
            if (sim >= threshold) return true;
            
            // Check if target is contained in input (handles spacing issues)
            const words = inputNorm.split(/\s+/);
            for (const word of words) {
                if (similarity(word, targetNorm) >= threshold) return true;
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
            
            // If all required fields are present (even if extracted with typos), show properties
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
            const missing = [];
            
            if (!conversationState.intent) {
                missing.push('rent or buy');
            }
            if (!conversationState.bhk) {
                missing.push('BHK');
            }
            if (!conversationState.price && !conversationState.priceMin) {
                missing.push('budget');
            }
            if (!conversationState.locality) {
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
        
        // Shuffle array to randomize order
        function shuffleArray(array) {
            const shuffled = [...array];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            return shuffled;
        }
        
        // Generate property cards with Unsplash images
        function generatePropertyCards() {
            // Generate 4-5 property cards based on search criteria
            const numCards = 4 + Math.floor(Math.random() * 2); // 4 or 5 cards
            const cards = [];
            
            // Unsplash house image URLs (curated modern houses - using reliable sources)
            const allUnsplashImages = [
                'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-156401379991-9e60461eb61e?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1568605117035-2bf5c19ec013?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600585154340-be0671e3e94d?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600566753194-8e4b8c4c5b5a?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600585154525-9e4b8c4c5b5a?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600566752354-8e4b8c4c5b5a?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600585154084-4d0d3e5b3b5a?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600585152915-d0ec10b55c56?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600047509358-9dc75507daeb?w=800&h=600&fit=crop',
                'https://images.unsplash.com/photo-1600607687644-c7171b42498b?w=800&h=600&fit=crop'
            ];
            
            // Shuffle and take unique images for each card (ensure no duplicates)
            const shuffledImages = shuffleArray([...allUnsplashImages]);
            const unsplashImages = [];
            const usedImageIndices = new Set();
            
            // Select unique images for each card
            for (let i = 0; i < numCards; i++) {
                let attempts = 0;
                let imageIndex;
                do {
                    imageIndex = Math.floor(Math.random() * shuffledImages.length);
                    attempts++;
                } while (usedImageIndices.has(imageIndex) && attempts < 50); // Prevent infinite loop
                
                usedImageIndices.add(imageIndex);
                unsplashImages.push(shuffledImages[imageIndex]);
            }
            
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
                const imageUrl = unsplashImages[i]; // Each card gets a unique image
                const propertyName = propertyNames[i % propertyNames.length];
                
                // Generate price based on user's budget
                let price;
                if (conversationState.priceMin && conversationState.priceMax) {
                    const range = conversationState.priceMax - conversationState.priceMin;
                    price = (conversationState.priceMin + (range * (i / numCards))).toFixed(1);
                } else if (conversationState.price) {
                    const variation = (conversationState.price * 0.1) * (i - numCards / 2) / numCards;
                    price = (conversationState.price + variation).toFixed(1);
                } else {
                    price = (2.5 + i * 0.3).toFixed(1); // Default range
                }
                
                // Generate built-up area (realistic range: 1200-3500 sq.ft)
                const builtUpArea = Math.floor(1200 + Math.random() * 2300);
                
                // Generate gallery images (3-5 images per property) - ensure unique images
                const numGalleryImages = 3 + Math.floor(Math.random() * 3);
                const galleryImages = [];
                const usedGalleryIndices = new Set();
                
                // Track all images used in this card stack (to avoid duplicates across cards)
                const allUsedInStack = new Set([...usedImageIndices]);
                
                // First image in gallery is the card's main image
                const mainImageIndex = shuffledImages.indexOf(imageUrl);
                if (mainImageIndex !== -1) {
                    usedGalleryIndices.add(mainImageIndex);
                    allUsedInStack.add(mainImageIndex);
                }
                
                // Add other unique images for gallery (avoiding images used in other cards)
                for (let j = 0; j < numGalleryImages - 1; j++) {
                    let attempts = 0;
                    let galleryIndex;
                    do {
                        galleryIndex = Math.floor(Math.random() * shuffledImages.length);
                        attempts++;
                    } while ((usedGalleryIndices.has(galleryIndex) || allUsedInStack.has(galleryIndex)) && attempts < 100);
                    
                    if (attempts < 100) {
                        usedGalleryIndices.add(galleryIndex);
                        allUsedInStack.add(galleryIndex);
                        galleryImages.push(shuffledImages[galleryIndex]);
                    }
                }
                
                // Always include the main image as first in gallery
                galleryImages.unshift(imageUrl);
                
                cards.push({
                    id: `property-${i + 1}`,
                    name: propertyName,
                    image: imageUrl,
                    gallery: galleryImages, // Array of gallery images
                    price: price,
                    bhk: conversationState.bhk || 3,
                    locality: conversationState.locality || 'Location',
                    type: conversationState.intent === 'rent' ? 'rent' : 'sale',
                    propertyType: propertyTypes[i % propertyTypes.length],
                    status: propertyStatuses[i % propertyStatuses.length],
                    builtUpArea: builtUpArea
                });
            }
            
            return cards;
        }
        
        // Render property cards in horizontal scroll
        function renderPropertyCards(cards) {
            const carousel = document.createElement('div');
            carousel.className = 'property-carousel';
            
            cards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'property-card';
                cardElement.setAttribute('data-property-id', card.id);
                
                // Card image wrapper
                const imageWrapper = document.createElement('div');
                imageWrapper.className = 'property-card__imgwrap';
                
                const image = document.createElement('img');
                image.src = card.image;
                image.alt = card.name;
                image.className = 'property-card__img';
                image.loading = 'lazy';
                image.style.cursor = 'pointer'; // Indicate it's clickable
                
                // Handle image loading errors with fallback
                image.onerror = function() {
                    // Fallback to a reliable Unsplash image if original fails
                    this.src = 'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800&h=600&fit=crop';
                    this.onerror = null; // Prevent infinite loop
                };
                
                // Click on image to open gallery
                image.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent event bubbling
                    openPropertyGallery(card);
                });
                
                // Make image wrapper clickable too
                imageWrapper.style.cursor = 'pointer';
                imageWrapper.addEventListener('click', (e) => {
                    // Only open gallery if clicking on wrapper, not favorite button
                    if (e.target === imageWrapper || e.target === image) {
                        openPropertyGallery(card);
                    }
                });
                
                // Favorite button (top right)
                const favoriteBtn = document.createElement('button');
                favoriteBtn.className = 'property-card-favorite';
                favoriteBtn.setAttribute('aria-label', 'Save property');
                favoriteBtn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>';
                favoriteBtn.addEventListener('click', (e) => {
                    e.stopPropagation(); // Prevent opening gallery when clicking favorite
                    // Handle favorite toggle
                    favoriteBtn.classList.toggle('active');
                });
                
                imageWrapper.appendChild(image);
                imageWrapper.appendChild(favoriteBtn);
                
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
                location.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                        <circle cx="12" cy="10" r="3"></circle>
                    </svg>
                    <span>${card.locality}</span>
                `;
                
                // Price
                const price = document.createElement('div');
                price.className = 'property-card__price';
                price.textContent = `₹${card.price} Cr`;
                
                // Property details (BHK)
                const chips = document.createElement('div');
                chips.className = 'property-card__chips';
                const bhkChip = document.createElement('span');
                bhkChip.className = 'property-chip';
                bhkChip.textContent = `${card.bhk} BHK`;
                chips.appendChild(bhkChip);
                
                // View CTA button
                const viewBtn = document.createElement('button');
                viewBtn.className = 'property-card__view-btn';
                viewBtn.textContent = 'View';
                viewBtn.addEventListener('click', () => {
                    // Handle view button click (can open property details)
                    console.log('View property:', card.id);
                });
                
                body.appendChild(typeStatus);
                body.appendChild(builtUpArea);
                body.appendChild(location);
                body.appendChild(price);
                body.appendChild(chips);
                body.appendChild(viewBtn);
                
                cardElement.appendChild(imageWrapper);
                cardElement.appendChild(body);
                carousel.appendChild(cardElement);
            });
            
            return carousel;
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
                msgDiv.appendChild(botContent);
                
                // Add to chat stack
                const stack = document.getElementById('chat-stack');
                if (stack) {
                    stack.appendChild(msgDiv);
                }
            }, delay);
            
            return 'loading';
        }
        
        // Handle user message with slot filling
        function handleUserMessage(text) {
            // Add user message
            addUserMessage(text);
            
            // Small delay before bot response
            setTimeout(() => {
                if (isGreeting(text)) {
                    // Reset state on new greeting
                    resetConversationState();
                    const response = getGreetingResponse();
                    addBotMessage(response);
                } else {
                    // Extract information from user message (with smart extraction for typos)
                    const updates = smartExtract(text);
                    
                    // Update conversation state
                    Object.assign(conversationState, updates);
                    
                    // Check if we have all information (very lenient - shows properties if info is present)
                    if (isConversationComplete()) {
                        // Show property cards
                        conversationState.isComplete = true;
                        showPropertyCards();
                    } else {
                        // Ask follow-up question only if we're really missing something
                        const followUp = getFollowUpQuestion();
                        if (followUp) {
                            addBotMessage(followUp);
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
        // End of chat reset - ready to build from scratch
        // ============================================================================
    })();
});

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
                    const hasSeenSplash = sessionStorage.getItem('scoutySplashSeen') === 'true';
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
            sessionStorage.setItem('scoutySplashSeen', 'true');
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
    // Switched from scrollLeft to transform translate3d to avoid WebKit quantization
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

        let last = 0;
        let x = 0; // current translateX (px)
        const speed = 18; // px/sec subtle (tune 12–24)
        let pausedUntil = 0;
        let dragging = false;
        let dragStartX = 0;
        let dragStartOffset = 0;

        function pause(ms = 1000) {
            pausedUntil = Date.now() + ms;
        }

        function loop(t) {
            if (!last) last = t;
            const dt = (t - last) / 1000;
            last = t;

            const halfWidth = track.scrollWidth / 2; // since 2x duplicate

            if (!dragging && Date.now() >= pausedUntil) {
                x -= speed * dt; // move left (use + for right)
                // wrap when we've moved one full set
                if (Math.abs(x) >= halfWidth) {
                    x = 0;
                }
                track.style.transform = `translate3d(${x}px,0,0)`;
            }

            requestAnimationFrame(loop);
        }
        requestAnimationFrame(loop);

        // Manual drag (keeps it smooth + works on iOS)
        function wrapPosition(pos) {
            const halfWidth = track.scrollWidth / 2;
            // Wrap continuously for seamless loop
            if (pos >= halfWidth) {
                return pos - halfWidth;
            } else if (pos <= -halfWidth) {
                return pos + halfWidth;
            }
            return pos;
        }

        marquee.addEventListener('pointerdown', (e) => {
            dragging = true;
            pause(999999); // freeze auto while dragging
            if (marquee.setPointerCapture) {
                marquee.setPointerCapture(e.pointerId);
            }
            dragStartX = e.clientX;
            dragStartOffset = x;
            e.preventDefault();
        });

        marquee.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            e.preventDefault();
            const dx = e.clientX - dragStartX;
            x = dragStartOffset + dx;
            track.style.transform = `translate3d(${x}px,0,0)`;
        });

        function endDrag() {
            if (!dragging) return;
            dragging = false;
            // Wrap position on end to ensure we're in valid range for seamless loop
            x = wrapPosition(x);
            track.style.transform = `translate3d(${x}px,0,0)`;
            pausedUntil = Date.now() + 900; // resume after a beat
        }
        marquee.addEventListener('pointerup', endDrag);
        marquee.addEventListener('pointercancel', endDrag);

        // Also support touch events for older browsers (non-passive to prevent scrolling)
        marquee.addEventListener('touchstart', (e) => {
            dragging = true;
            pause(999999);
            dragStartX = e.touches[0].clientX;
            dragStartOffset = x;
        }, { passive: false });

        marquee.addEventListener('touchmove', (e) => {
            if (!dragging) return;
            e.preventDefault(); // Prevent page scroll
            const dx = e.touches[0].clientX - dragStartX;
            x = dragStartOffset + dx;
            track.style.transform = `translate3d(${x}px,0,0)`;
        }, { passive: false });

        marquee.addEventListener('touchend', endDrag, { passive: true });
        marquee.addEventListener('touchcancel', endDrag, { passive: true });
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
    // KEYBOARD PARITY LAYER (single source of truth)
    // ============================================================================
    // Computes --kb-offset, --vv-top, --header-h, --composer-h
    // Updates on visualViewport resize/scroll, focusin/focusout, pageshow, visibilitychange
    // Works on iOS + Android (no per-platform duplicated logic)
    // ============================================================================
    (function keyboardParityLayer() {
        const root = document.documentElement;
        const header = document.querySelector('.chat-top-bar');
        const composer = document.querySelector('.chat-input-bar');
        const messages = document.querySelector('.chat-messages');
        
        if (!header || !composer || !messages) {
            parityLog('Keyboard parity: missing elements', { header: !!header, composer: !!composer, messages: !!messages });
            return;
        }

        let raf = null;

        function updateAll() {
            // Update header height
            const headerHeight = header.offsetHeight;
            root.style.setProperty('--header-h', `${headerHeight}px`);
            
            // Update composer height
            const composerHeight = composer.offsetHeight;
            root.style.setProperty('--composer-h', `${composerHeight}px`);
            root.style.setProperty('--composer-height', `${composerHeight}px`);
            
            // Update visual viewport offset (header pinning)
            const vv = window.visualViewport;
            const vvTop = vv ? vv.offsetTop : 0;
            root.style.setProperty('--vv-top', `${vvTop}px`);
            
            // Update keyboard offset (composer positioning)
            if (vv) {
                const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
                root.style.setProperty('--kb-offset', `${kb}px`);
                root.style.setProperty('--kb', `${kb}px`);
                
                if (window.__CHAT_DEBUG__) {
                    const scrollY = window.scrollY || window.pageYOffset || document.documentElement.scrollTop;
                    parityLog('Keyboard parity:', {
                        scrollY: scrollY,
                        vvTop: vv.offsetTop,
                        vvHeight: vv.height,
                        keyboardHeight: kb,
                        headerH: headerHeight,
                        composerH: composerHeight
                    });
                    
                    if (Math.abs(scrollY) > 1) {
                        console.warn('[Parity] Window scroll detected:', scrollY, '- only messages container should scroll');
                    }
                }
            } else {
                root.style.setProperty('--kb-offset', '0px');
                root.style.setProperty('--kb', '0px');
            }
        }

        // Run multiple times to beat iOS timing (first open + reopen)
        function syncHard() {
            if (raf) cancelAnimationFrame(raf);
            updateAll();
            raf = requestAnimationFrame(() => {
                updateAll();
                setTimeout(updateAll, 50);
                setTimeout(updateAll, 150);
                setTimeout(updateAll, 300);
            });
        }

        // Key events: visualViewport changes
        window.addEventListener('load', syncHard);
        window.addEventListener('resize', syncHard);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', syncHard);
            window.visualViewport.addEventListener('scroll', syncHard);
        }

        // Critical: re-prime on every keyboard open/close
        document.addEventListener('focusin', (e) => {
            if (!e.target.matches('input, textarea, [contenteditable="true"]')) return;
            syncHard();
        });

        document.addEventListener('focusout', (e) => {
            if (!e.target.matches('input, textarea, [contenteditable="true"]')) return;
            // iOS often updates offsetTop AFTER blur
            setTimeout(syncHard, 50);
            setTimeout(syncHard, 200);
        });

        // Critical: iOS bfcache restores stale viewport values
        window.addEventListener('pageshow', syncHard);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) syncHard();
        });

        // Initial
        syncHard();
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
});

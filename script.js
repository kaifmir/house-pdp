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
    // CHAT v1: User messages + bot replies + intro hide
    // ============================================================================
    // Only handles message rendering and intro visibility
    // Does NOT touch header/keyboard/pills logic
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

        // Helper to get chat messages element
        function getChatMessagesEl() {
            return document.getElementById("chat-messages");
        }
        
        // Check if user is near bottom (threshold ~120px)
        function isNearBottom(thresholdPx = 120) {
            const messages = document.getElementById("chat-messages");
            if (!messages) return false;
            return (messages.scrollHeight - (messages.scrollTop + messages.clientHeight)) < thresholdPx;
        }
        
        // Scroll to bottom using sentinel (ChatGPT-style)
        // Uses #chat-end sentinel with scrollIntoView for iOS stability
        function scrollToBottom(options = {}) {
            // If we're keeping user message at top, don't scroll during typing
            if (keepUserMessageAtTop && !options.forceKeepUserAtTop) {
                return;
            }
            
            const messages = document.getElementById("chat-messages");
            const end = document.getElementById("chat-end");
            if (!messages || !end) return;
            
            const force = options.force !== false; // Default to true
            
            // Only auto-scroll if user is near bottom OR force is true
            if (!force && !isNearBottom()) {
                return;
            }
            
            // Use double requestAnimationFrame for iOS stability
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    end.scrollIntoView({ block: "end", behavior: "auto" });
                });
            });
        }
        
        // Legacy scroll functions (kept for compatibility)
        function scrollChatToBottom(options = {}) {
            scrollToBottom(options);
        }
        
        function scrollToBottomIfNeeded({ force = false, immediate = false } = {}) {
            scrollToBottom({ force });
        }
        
        function scrollToBottomTyping(msgElement = null) {
            scrollToBottom({ force: true });
        }
        
        // Set chat offsets dynamically (header + composer heights)
        // Sets padding-top and padding-bottom on #chat-messages
        // Makes first message appear 16px under header (always)
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

        // Messages state
        const messages = [];
        let messageIdCounter = 0;
        let typewriterTimer = null;
        
        // Bot responding state for Send ↔ Stop toggle
        let isBotResponding = false;

        // Generate unique message ID
        function generateMessageId() {
            return `msg-${Date.now()}-${++messageIdCounter}`;
        }

        // Auto-scroll state tracking - stick to bottom unless user scrolled up
        let isAtBottom = true;
        let scrollTimeout = null;
        let typingScrollRaf = null;

        // Check if user is near bottom (within 120px threshold for auto-scroll)
        function checkIfAtBottom() {
            if (!chatMessages) return false;
            const threshold = 120; // Increased threshold for better UX
            const distanceFromBottom = chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;
            return distanceFromBottom <= threshold;
        }

        // Update isAtBottom on scroll
        function handleScroll() {
            isAtBottom = checkIfAtBottom();
        }

        // Add scroll listener to track if user is at bottom (after functions are defined)
        // Initialize at bottom state
        if (chatMessages) {
            isAtBottom = checkIfAtBottom();
            chatMessages.addEventListener('scroll', handleScroll, { passive: true });
        }

        // Legacy function - kept for compatibility but not used
        // Chat layout now uses stick-to-bottom auto-scroll
        function scrollMessageIntoView(msgElement, options = {}) {
            // This function is deprecated - use scrollToBottom instead
            scrollToBottom(options);
        }

        // Note: scrollToBottom is defined above (line 1432) using sentinel-based scrolling

        // Track if we should keep user message at top (don't auto-scroll during typing)
        let keepUserMessageAtTop = false;
        let lastUserMessageId = null;
        
        // Add user message
        function addUserMessage(text) {
            const msgId = generateMessageId();
            const message = {
                id: msgId,
                role: 'user',
                text: text.trim(),
                status: 'sent'
            };
            messages.push(message);
            const msgElement = renderMessage(message);
            
            // Set flag to keep user message at top
            keepUserMessageAtTop = true;
            lastUserMessageId = msgId;
            
            // Scroll user's message to top of viewport with space below
            if (msgElement) {
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        // Get header height for offset
                        const header = document.querySelector(".chat-top-bar");
                        const headerH = header ? Math.ceil(header.getBoundingClientRect().height) : 68;
                        
                        // Scroll the user message to the top (accounting for header)
                        const messagesContainer = document.getElementById("chat-messages");
                        if (messagesContainer && msgElement) {
                            const elementTop = msgElement.offsetTop;
                            messagesContainer.scrollTop = elementTop - headerH - 16;
                        }
                    });
                });
            }
            
            return msgId;
        }

        // Add bot message (empty initially for typewriter)
        function addBotMessage(text = '') {
            const msgId = generateMessageId();
            const message = {
                id: msgId,
                role: 'bot',
                text: text,
                status: 'typing'
            };
            messages.push(message);
            const msgElement = renderMessage(message);
            // Don't scroll if we're keeping user message at top
            // Bot message will appear below user message naturally
            if (!keepUserMessageAtTop) {
                scrollToBottom({ force: true });
            }
            return msgId;
        }

        // Update message text (for typewriter)
        function updateMessageText(msgId, text) {
            const message = messages.find(m => m.id === msgId);
            if (!message) return;
            message.text = text;
            const msgEl = document.getElementById(msgId);
            if (msgEl) {
                const textEl = msgEl.querySelector('.bot-text');
                if (textEl) {
                    textEl.textContent = text;
                }
                // Don't scroll during typing if we're keeping user message at top
                // The user message should stay at top with space below
                // Only scroll if explicitly requested
                if (!keepUserMessageAtTop) {
                    const currentLength = text.length;
                    if (currentLength % 6 === 0 || currentLength === 1) {
                        scrollToBottom({ force: true });
                    }
                }
            }
        }

        // Render message to DOM (legacy - for user messages and simple bot messages)
        function renderMessage(message) {
            const msgDiv = document.createElement('div');
            msgDiv.id = message.id;
            msgDiv.className = `msg msg-${message.role} msg-enter`;

            if (message.role === 'user') {
                const bubble = document.createElement('div');
                bubble.className = 'bubble';
                bubble.textContent = message.text;
                msgDiv.appendChild(bubble);
            } else {
                // For bot messages: only create bot-message-content if text is not empty
                // If text is empty, renderBotTurn() will create it later
                if (message.text && message.text.trim() !== '') {
                    const botMessage = document.createElement('div');
                    botMessage.className = 'bot-message-content';
                    const textDiv = document.createElement('div');
                    textDiv.className = 'bot-text';
                    textDiv.textContent = message.text;
                    botMessage.appendChild(textDiv);
                    msgDiv.appendChild(botMessage);
                }
                // If text is empty, don't create bot-message-content here
                // renderBotTurn() will create it when called
            }

            // Remove spacer if it exists (it breaks layout)
            removeChatSpacer();
            
            // Ensure chat-stack exists
            ensureChatStack();
            
            // Insert message into chat-stack (not directly into chat-messages)
            const stack = document.getElementById('chat-stack');
            if (!stack) {
                // Fallback: ensure stack exists and retry
                ensureChatStack();
                const stackRetry = document.getElementById('chat-stack');
                if (!stackRetry) {
                    // Last resort: append to messages directly
                    chatMessages.appendChild(msgDiv);
                    return msgDiv;
                }
            }
            
            const finalStack = document.getElementById('chat-stack');
            const anchor = document.getElementById('chat-end');
            
            if (finalStack && anchor && finalStack.contains(anchor)) {
                // Insert before anchor if anchor is a child of stack
                finalStack.insertBefore(msgDiv, anchor);
            } else if (finalStack) {
                // Append to stack and ensure anchor exists at end
                finalStack.appendChild(msgDiv);
                // Ensure anchor exists
                if (!document.getElementById('chat-end')) {
                    const end = document.createElement('div');
                    end.id = 'chat-end';
                    finalStack.appendChild(end);
                }
            } else {
                // Last resort fallback
                chatMessages.appendChild(msgDiv);
            }

            // Trigger animation
            requestAnimationFrame(() => {
                msgDiv.classList.add('msg-enter-active');
            });

            return msgDiv;
        }

        // Typewriter effect for bot reply (TEXT ONLY - for non-core conversations)
        // This function NEVER renders chips, cards, or any UI components
        // Use this for: greetings, redirects, gibberish, platform comparisons, broker requests
        function typeBotReply(fullText = 'Hi') {
            const msgId = addBotMessage('');
            const msgEl = document.getElementById(msgId);
            if (!msgEl) return;
            
            // Set bot responding state and update button
            isBotResponding = true;
            updateSendButtonState();
            
            // Use strict structure even for simple replies
            const botMessage = document.createElement('div');
            botMessage.className = 'bot-message-content';
            const textEl = document.createElement('div');
            textEl.className = 'bot-text';
            botMessage.appendChild(textEl);
            msgEl.appendChild(botMessage);
            
            let i = 0;

            if (typewriterTimer) {
                clearInterval(typewriterTimer);
            }

            let lastWordCount = 0;
            
            typewriterTimer = setInterval(() => {
                // Check if user stopped the response
                if (!isBotResponding) {
                    clearInterval(typewriterTimer);
                    typewriterTimer = null;
                    return;
                }
                
                i++;
                const currentText = fullText.slice(0, i);
                textEl.textContent = currentText;
                
                // Detect new word: count words in current text
                const currentWordCount = currentText.trim().split(/\s+/).filter(w => w.length > 0).length;
                
                // Subtle haptic feedback when a new word appears
                if (currentWordCount > lastWordCount && navigator.vibrate) {
                    navigator.vibrate(5); // Very subtle 5ms vibration
                    lastWordCount = currentWordCount;
                }
                
                // Don't scroll during typing if we're keeping user message at top
                // The user message should stay at top with space below
                if (!keepUserMessageAtTop) {
                    if (i % 6 === 0 || i === 1) {
                        scrollToBottom({ force: true });
                    }
                }
                if (i >= fullText.length) {
                    clearInterval(typewriterTimer);
                    typewriterTimer = null;
                    isBotResponding = false;
                    updateSendButtonState();
                    const message = messages.find(m => m.id === msgId);
                    if (message) {
                        message.status = 'complete';
                    }
                    // After typing completes, reset the flag so future messages can scroll normally
                    // But don't scroll now if we were keeping user message at top
                    if (!keepUserMessageAtTop) {
                        scrollToBottom({ force: true });
                    } else {
                        // Reset flag after bot response completes
                        keepUserMessageAtTop = false;
                    }
                }
            }, 55);
        }

        // Stop bot response - cancels typing animation
        function stopBotResponse() {
            if (!isBotResponding) return;
            
            // Clear typing timer
            if (typewriterTimer) {
                clearInterval(typewriterTimer);
                typewriterTimer = null;
            }
            
            // Reset state
            isBotResponding = false;
            updateSendButtonState();
        }
        
        // Update send button state (Send ↔ Stop toggle)
        function updateSendButtonState() {
            if (!chatSendBtn) return;
            
            const svg = chatSendBtn.querySelector('svg');
            if (!svg) return;
            
            if (isBotResponding) {
                // Show Stop icon (square)
                svg.innerHTML = `
                    <rect x="6" y="6" width="12" height="12" fill="currentColor" stroke="none"/>
                `;
                svg.setAttribute('viewBox', '0 0 24 24');
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                chatSendBtn.setAttribute('aria-label', 'Stop');
            } else {
                // Show Send icon (paper plane) - restore original
                svg.innerHTML = `
                    <rect width="256" height="256" fill="none"/>
                    <path d="M223.69,42.18a8,8,0,0,0-9.87-9.87l-192,58.22a8,8,0,0,0-1.25,14.93L108,148l42.54,87.42a8,8,0,0,0,14.93-1.25Z" opacity="0.2" fill="currentColor"/>
                    <line x1="108" y1="148" x2="160" y2="96" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                    <path d="M223.69,42.18a8,8,0,0,0-9.87-9.87l-192,58.22a8,8,0,0,0-1.25,14.93L108,148l42.54,87.42a8,8,0,0,0,14.93-1.25Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/>
                `;
                svg.setAttribute('viewBox', '0 0 256 256');
                svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
                chatSendBtn.setAttribute('aria-label', 'Send');
            }
        }

        // Handle send message
        function handleSend() {
            // If bot is responding, stop it instead
            if (isBotResponding) {
                stopBotResponse();
                return;
            }
            
            // Step 1: Read input value BEFORE any mutation
            const rawInput = chatInput.value;
            const text = rawInput.trim();
            
            // Debug: verify input is being read
            console.log('Input read:', { raw: rawInput, trimmed: text, inputElement: chatInput });
            
            if (!text) return;

            // Haptic feedback
            if (navigator.vibrate) {
                navigator.vibrate(10);
            }

            // Step 2: Clear input AFTER reading
            chatInput.value = '';

            // Check if this is first message
            const isFirstMessage = messages.length === 0;

            // Add user message
            addUserMessage(text);

            // Hide intro on first message
            if (isFirstMessage && chatScreen) {
                chatScreen.classList.add('chat-started');
            }

            // Step 3: Trigger bot reply after 200ms (text is already captured)
            setTimeout(() => {
                handleHousingIntent(text);
            }, 200);
        }

        // Send button click
        chatSendBtn.addEventListener('click', handleSend);
        
        // Initialize button state
        updateSendButtonState();

        // Enter key press
        chatInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
            }
        });

        // ============================================================================
        // CORE HOUSING CONVERSATIONS
        // ============================================================================
        // Intent detection, slot filling, and conversation flow
        // ============================================================================

        // Mock property data
        const mockProperties = [
            { id: 1, city: 'Gurgaon', locality: 'Sector 43', price: 25000, priceUnit: 'rent', bhk: 2, type: 'Apartment', furnished: 'Semi', amenities: ['Parking', 'Lift', 'Power Backup'], tags: ['Near Metro'], images: [] },
            { id: 2, city: 'Gurgaon', locality: 'DLF Phase 1', price: 35000, priceUnit: 'rent', bhk: 3, type: 'Apartment', furnished: 'Fully', amenities: ['Gym', 'Pool', 'Parking'], tags: ['Gated'], images: [] },
            { id: 3, city: 'Mumbai', locality: 'Andheri', price: 18000, priceUnit: 'rent', bhk: 1, type: 'Apartment', furnished: 'Unfurnished', amenities: ['Lift'], tags: [], images: [] },
            { id: 4, city: 'Bangalore', locality: 'Indiranagar', price: 45000, priceUnit: 'rent', bhk: 3, type: 'Apartment', furnished: 'Fully', amenities: ['Gym', 'Pool', 'Parking', 'Clubhouse'], tags: ['Near Metro', 'Quiet'], images: [] },
            { id: 5, city: 'Noida', locality: 'Sector 62', price: 7000000, priceUnit: 'buy', bhk: 2, type: 'Apartment', furnished: 'Semi', amenities: ['Parking', 'Lift'], tags: [], images: [] },
            { id: 6, city: 'Pune', locality: 'Koregaon Park', price: 55000, priceUnit: 'rent', bhk: 3, type: 'Villa', furnished: 'Fully', amenities: ['Gym', 'Pool', 'Parking', 'Garden'], tags: ['Quiet', 'Green'], images: [] },
            { id: 7, city: 'Mumbai', locality: 'Powai', price: 50000, priceUnit: 'rent', bhk: 2, type: 'Apartment', furnished: 'Fully', amenities: ['Gym', 'Pool', 'Parking'], tags: ['Near Metro'], images: [] },
            { id: 8, city: 'Bangalore', locality: 'Whitefield', price: 30000, priceUnit: 'rent', bhk: 2, type: 'Apartment', furnished: 'Semi', amenities: ['Parking', 'Lift'], tags: [], images: [] },
            { id: 9, city: 'Gurgaon', locality: 'Sector 29', price: 8500000, priceUnit: 'buy', bhk: 3, type: 'Apartment', furnished: 'Semi', amenities: ['Gym', 'Pool', 'Parking'], tags: ['Gated'], images: [] },
            { id: 10, city: 'Delhi', locality: 'Dwarka', price: 22000, priceUnit: 'rent', bhk: 2, type: 'Apartment', furnished: 'Unfurnished', amenities: ['Parking', 'Lift'], tags: ['Near Metro'], images: [] }
        ];

        // Conversation state - SINGLE SOURCE OF TRUTH (NON-NEGOTIABLE)
        // NEVER reset unless user explicitly says "start over"
        // This is the persistent chatState object that tracks all conversation state
        const chatState = {
            intent: null,              // 'property_search' | null
            category: null,            // 'rent'|'buy'|'pg'|'commercial'|'plot'|'projects'
            city: null,
            locality: null,
            bhk: null,                 // number (1,2,3,4,5) or null
            budgetMin: null,           // number in INR
            budgetMax: null,           // number in INR
            budgetUnit: null,          // 'monthly'|'total'|null
            propertyType: null,        // 'apartment'|'villa'|'studio'|'row house' etc
            amenities: [],             // strings
            furnished: null,           // 'full'|'semi'|'unfurnished'|null
            moveIn: null,              // 'immediate'|'this_week' etc
            readyToShowResults: false  // CRITICAL: Only show cards when this is true
        };
        
        // Backward compatibility: map old searchContext properties
        // For now, keep both until all code is migrated
        const searchContext = chatState;

        // Pending question state - tracks what question is currently being asked
        let pendingQuestion = null; // null or one of: 'category', 'cityOrLocality', 'bhkOrType', 'budget'
        
        // Track last question to avoid repeats
        let lastQuestionKey = null;
        let lastQuestionValueSnapshot = null;
        
        // Backward compatibility: map mode to intentType
        Object.defineProperty(searchContext, 'mode', {
            get: function() { return this.intentType; },
            set: function(val) { this.intentType = val; }
        });

        // Greeting detection - high recall
        function detectGreeting(text) {
            if (!text || typeof text !== 'string') {
                return false;
            }

            const normalized = text.trim().toLowerCase();
            
            // Check for emoji-only greetings
            const emojiOnly = /^[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]+$/u;
            if (emojiOnly.test(text.trim())) {
                // Check if it's a greeting emoji
                if (text.includes('👋') || text.includes('🙂') || text.includes('🙏') || text.includes('😊')) {
                    return true;
                }
            }
            
            // Standalone greeting words
            const standaloneGreetings = /^(hi|hello|hey|yo|sup|wassup|whats\s*up)$/i;
            if (standaloneGreetings.test(normalized)) {
                return true;
            }
            
            // Greeting phrases (must be at start or standalone)
            const greetingPhrases = [
                /^(hi|hello|hey|yo)[\s,]/i,
                /^(whats\s*up|sup|wassup)[\s,?!]*$/i,
                /^(how\s+are\s+you|how\s+r\s+u|hru)[\s,?!]*$/i,
                /^(good\s+(morning|afternoon|evening))[\s,?!]*$/i,
                /^(thanks|thank\s+you)[\s,?!]*$/i
            ];
            
            for (const pattern of greetingPhrases) {
                if (pattern.test(normalized)) {
                    // For "thanks/thank you", only treat as greeting if it's short and not followed by housing query
                    if (normalized.match(/^(thanks|thank\s+you)/i)) {
                        // If it's just "thanks" or "thank you" (short), treat as greeting
                        if (normalized.length < 20) {
                            return true;
                        }
                    } else {
                        return true;
                    }
                }
            }
            
            return false;
        }

        // Intent detection - tolerant and comprehensive
        function detectIntent(text) {
            if (!text || typeof text !== 'string') {
                return null;
            }

            const raw = text;
            const normalized = text.trim().toLowerCase();
            
            // A) Service-only messages - MUST be recognized as CORE housing
            if (normalized === 'rent' || normalized === 'buy' || 
                normalized.match(/^(rent|buy)$/i)) {
                return 'rent_buy_search';
            }

            // B) BHK + location messages - recognize all variants
            const bhkPattern = /\d+\s*[-]?\s*(bhk|b\s*h\s*k|bedroom|bed|rk)/i;
            const hasBHK = bhkPattern.test(normalized);
            
            // Location patterns
            const cities = ['delhi', 'gurgaon', 'mumbai', 'bangalore', 'pune', 'noida', 'chennai', 'hyderabad', 'kolkata', 'indiranagar', 'koramangala', 'andheri', 'whitefield', 'cyber city', 'dwarka', 'powai', 'koregaon park'];
            const hasLocation = cities.some(city => normalized.includes(city)) || 
                               normalized.match(/\bin\s+(delhi|gurgaon|mumbai|bangalore|pune|noida|chennai|hyderabad|kolkata)/i);
            
            if (hasBHK || (hasBHK && hasLocation)) {
                return 'rent_buy_search';
            }

            // C) Location-only messages - treat as CORE intent
            if (hasLocation && !hasBHK) {
                return 'rent_buy_search';
            }

            // Check for any housing-related keywords (comprehensive)
            const housingKeywords = [
                'bhk', 'rent', 'buy', 'apartment', 'house', 'villa', 'flat', 'property', 
                'home', 'pg', 'commercial', 'office', 'plot', 'studio', 'rk', 'furnished', 
                'budget', 'price', 'locality', 'area', 'near', 'metro', 'school', 'hospital', 
                'park', 'sea', 'view', 'hills', 'quiet', 'safe', 'pet', 'senior', 'wheelchair', 
                'vastu', 'invest', 'appreciation', 'project', 'projects', 'under construction', 
                'ready to move', 'new project', 'gurgaon', 'mumbai', 'bangalore', 'delhi', 
                'pune', 'noida', 'chennai', 'hyderabad', 'kolkata', 'koramangala', 'indiranagar',
                'andheri', 'whitefield', 'dwarka', 'powai', 'rohini', 'sector'
            ];
            
            const hasHousingKeyword = housingKeywords.some(keyword => normalized.includes(keyword));
            
            if (!hasHousingKeyword) {
                return null; // Not a housing intent
            }

            // Detect specific intents (order matters - more specific first)
            if (normalized.match(/(villa|plot|office|pg|commercial|studio|row\s+house)/i)) {
                return 'type_search';
            }
            if (normalized.match(/(hills|sea\s+view|quiet|green|parks|cafes|no\s+traffic|vibe|lifestyle)/i)) {
                return 'lifestyle_search';
            }
            if (normalized.match(/(near|commute|office|metro|airport|landmark|minutes?|min)/i)) {
                return 'commute_search';
            }
            if (normalized.match(/(cheapest|budget|under|price|₹|rs|rupees?|lakh|lac|cr|crore)/i)) {
                return 'budget_search';
            }
            if (normalized.match(/(furnished|move\s*in|possession|ready)/i)) {
                return 'furnished_search';
            }
            if (normalized.match(/(pool|gym|clubhouse|parking|backup|lift|gated|amenit)/i)) {
                return 'amenities_search';
            }
            if (normalized.match(/(pet|senior|wheelchair|accessible|vastu)/i)) {
                return 'special_needs';
            }
            if (normalized.match(/(school|kids|safe|hospital|family)/i)) {
                return 'family_search';
            }
            // Price trend intent - check BEFORE investment_search
            if (normalized.match(/(price\s+trend|trend|rates|pricing|avg\s+price|property\s+prices|price\s+in)/i)) {
                return 'price_trend';
            }
            
            if (normalized.match(/(invest|appreciation|upcoming|roi)/i)) {
                return 'investment_search';
            }

            // Default to rent/buy search if housing keywords present
            return 'rent_buy_search';
        }
        
        // Extract locality from price trend queries
        function extractTrendLocality(text) {
            if (!text || typeof text !== 'string') return null;
            
            const normalized = normalizeText(text);
            
            // Pattern 1: "price trend in [locality]"
            const inPattern = /(?:price\s+trend|trend|rates|pricing|avg\s+price|property\s+prices|price)\s+in\s+([a-z\s]+?)(?:\?|$|\.)/i;
            const inMatch = normalized.match(inPattern);
            if (inMatch && inMatch[1]) {
                const locality = inMatch[1].trim();
                if (locality.length > 0 && locality.length < 50) {
                    return locality;
                }
            }
            
            // Pattern 2: "[locality] price trend" or "rates [locality]"
            const afterPattern = /(?:price\s+trend|trend|rates|pricing)\s+([a-z\s]+?)(?:\?|$|\.)/i;
            const afterMatch = normalized.match(afterPattern);
            if (afterMatch && afterMatch[1]) {
                const locality = afterMatch[1].trim();
                if (locality.length > 0 && locality.length < 50) {
                    return locality;
                }
            }
            
            // Pattern 3: Take last 1-3 words if query contains trend/rates/price
            if (normalized.match(/(trend|rates|pricing|price)/i)) {
                const words = normalized.split(/\s+/);
                // Remove trend-related words
                const filtered = words.filter(w => !w.match(/^(price|trend|rates|pricing|in|the|a|an|are|how)$/i));
                if (filtered.length > 0) {
                    // Take last 1-3 words as locality
                    const locality = filtered.slice(-3).join(' ').trim();
                    if (locality.length > 0 && locality.length < 50) {
                        return locality;
                    }
                }
            }
            
            return null;
        }
        
        // Generate mock trend data (deterministic based on locality)
        function generateTrendData(locality, city) {
            if (!locality) return null;
            
            // Deterministic hash from locality string
            let hash = 0;
            const locStr = (locality + (city || '')).toLowerCase();
            for (let i = 0; i < locStr.length; i++) {
                hash = ((hash << 5) - hash) + locStr.charCodeAt(i);
                hash = hash & hash; // Convert to 32bit integer
            }
            
            // Use hash to generate consistent values
            const seed = Math.abs(hash);
            
            // Trend direction: Up (60%), Down (25%), Flat (15%)
            const directionRand = (seed % 100);
            let direction, yoyPct, sixMPct;
            if (directionRand < 60) {
                direction = 'Up';
                yoyPct = 3 + (seed % 9); // 3-12%
                sixMPct = 1 + (seed % 5); // 1-6%
            } else if (directionRand < 85) {
                direction = 'Down';
                yoyPct = -(2 + (seed % 4)); // -2 to -5%
                sixMPct = -(1 + (seed % 2)); // -1 to -2%
            } else {
                direction = 'Flat';
                yoyPct = (seed % 3) - 1; // -1 to 1%
                sixMPct = (seed % 3) - 1; // -1 to 1%
            }
            
            // Current price per sq.ft (based on city)
            const cityPrices = {
                'delhi': { min: 8500, max: 18000 },
                'mumbai': { min: 12000, max: 28000 },
                'bangalore': { min: 6000, max: 15000 },
                'pune': { min: 5500, max: 12000 },
                'gurgaon': { min: 7000, max: 16000 },
                'noida': { min: 6000, max: 14000 }
            };
            
            const cityKey = (city || 'delhi').toLowerCase();
            const priceRange = cityPrices[cityKey] || cityPrices['delhi'];
            const currentPsf = priceRange.min + (seed % (priceRange.max - priceRange.min));
            
            // Format locality name (capitalize words)
            const formattedLocality = locality.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ');
            
            const formattedCity = city ? city.split(' ').map(word => 
                word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
            ).join(' ') : '';
            
            return {
                locality: formattedLocality,
                city: formattedCity,
                direction,
                yoyPct,
                sixMPct,
                currentPsf,
                updatedText: 'Updated 2 weeks ago'
            };
        }
        
        // Get Unsplash image for locality/city
        function getTrendImage(city) {
            const cityImages = {
                'delhi': [
                    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560449752-915c5c0b0b4a?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560185008-5bf9cf11f2b7?w=300&h=300&fit=crop&q=80'
                ],
                'mumbai': [
                    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560448204-61dc36dc5d4a?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560185008-5bf9cf11f2b7?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=300&fit=crop&q=80'
                ],
                'bangalore': [
                    'https://images.unsplash.com/photo-1560448204-61dc36dc5d4b?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=300&h=300&fit=crop&q=80'
                ],
                'pune': [
                    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560449752-915c5c0b0b4a?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560185008-5bf9cf11f2b7?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=300&fit=crop&q=80'
                ],
                'gurgaon': [
                    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560448204-61dc36dc5d4a?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=300&h=300&fit=crop&q=80'
                ],
                'noida': [
                    'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560185008-5bf9cf11f2b7?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1560449752-915c5c0b0b4a?w=300&h=300&fit=crop&q=80',
                    'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=300&h=300&fit=crop&q=80'
                ]
            };
            
            const cityKey = (city || 'delhi').toLowerCase();
            const images = cityImages[cityKey] || cityImages['delhi'];
            // Use deterministic selection based on city
            const index = Math.abs(cityKey.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)) % images.length;
            return images[index];
        }
        
        // Render trend card HTML
        function renderTrendCard(trend) {
            if (!trend) return '';
            
            const imageUrl = getTrendImage(trend.city);
            
            // Generate simple sparkline SVG path
            const sparklinePoints = [];
            const width = 120;
            const height = 40;
            const pointCount = 8;
            
            // Generate points based on trend direction
            for (let i = 0; i < pointCount; i++) {
                const x = (i / (pointCount - 1)) * width;
                let y;
                if (trend.direction === 'Up') {
                    y = height - (i / (pointCount - 1)) * (height * 0.4) - (height * 0.2);
                } else if (trend.direction === 'Down') {
                    y = (height * 0.2) + (i / (pointCount - 1)) * (height * 0.4);
                } else {
                    y = height * 0.4 + (Math.sin(i * 0.5) * height * 0.1);
                }
                sparklinePoints.push(`${x},${y}`);
            }
            const sparklinePath = `M ${sparklinePoints.join(' L ')}`;
            
            const directionClass = trend.direction.toLowerCase();
            const yoySign = trend.yoyPct >= 0 ? '+' : '';
            const sixMSign = trend.sixMPct >= 0 ? '+' : '';
            
            return `
                <div class="trend-card">
                    <div class="trend-header">
                        <img src="${imageUrl}" alt="${trend.locality}" class="trend-thumb" loading="lazy">
                        <div class="trend-meta">
                            <div class="trend-title">${trend.locality}</div>
                            <div class="trend-subtitle">${trend.city || 'Delhi'}</div>
                        </div>
                    </div>
                    <div class="trend-body">
                        <div class="trend-pill trend-pill-${directionClass}">${trend.direction}</div>
                        <div class="trend-yoy">YoY ${yoySign}${trend.yoyPct}%</div>
                    </div>
                    <div class="trend-spark">
                        <svg width="120" height="40" viewBox="0 0 120 40" preserveAspectRatio="none">
                            <path d="${sparklinePath}" fill="none" stroke="${trend.direction === 'Up' ? '#4CAF50' : trend.direction === 'Down' ? '#F44336' : '#9E9E9E'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                        </svg>
                    </div>
                    <div class="trend-stats">
                        <div class="trend-stat">
                            <div class="trend-stat-label">Current</div>
                            <div class="trend-stat-value">₹${trend.currentPsf.toLocaleString()}/sq.ft</div>
                        </div>
                        <div class="trend-stat">
                            <div class="trend-stat-label">6M</div>
                            <div class="trend-stat-value">${sixMSign}${trend.sixMPct}%</div>
                        </div>
                        <div class="trend-stat">
                            <div class="trend-stat-label">YoY</div>
                            <div class="trend-stat-value">${yoySign}${trend.yoyPct}%</div>
                        </div>
                    </div>
                    <div class="trend-note">Indicative estimates.</div>
                </div>
            `;
        }

        // Normalize text: lowercase, trim, collapse spaces, remove spaces around single letters
        function normalizeText(raw) {
            if (!raw || typeof raw !== 'string') return '';
            
            let normalized = raw
                .toLowerCase()
                .trim()
                .replace(/\s+/g, ' ') // Collapse multiple spaces
                .replace(/\s+([a-z])\s+/g, '$1') // Remove spaces around single letters: "R ohini" -> "rohini"
                .replace(/[^\w\s₹,]/g, ' ') // Remove punctuation except numbers, currency, commas
                .replace(/[,]/g, ' ') // Convert commas to spaces
                .replace(/\s+/g, ' ') // Collapse spaces again
                .trim();
            
            return normalized;
        }

        // Typo correction dictionary - fixes common misspellings
        function correctTypos(normalized) {
            if (!normalized) return normalized;
            
            let corrected = normalized;
            
            // BHK variants
            corrected = corrected.replace(/\b(\d+)\s*(bhl|bkh|bk|bh)\b/g, '$1bhk');
            corrected = corrected.replace(/\b(\d+)\s*b\s*h\s*k\b/g, '$1bhk');
            corrected = corrected.replace(/\b(\d+)\s*b\s*h\s*l\b/g, '$1bhk');
            corrected = corrected.replace(/\b1\s*r\s*k\b/g, '1rk');
            corrected = corrected.replace(/\br\s*k\b/g, 'rk');
            corrected = corrected.replace(/\bstudio\b/g, 'studio');
            corrected = corrected.replace(/\bstudeo\b/g, 'studio');
            
            // Mode variants
            corrected = corrected.replace(/\brnt\b/g, 'rent');
            corrected = corrected.replace(/\bren\b/g, 'rent');
            corrected = corrected.replace(/\bbiy\b/g, 'buy');
            corrected = corrected.replace(/\bbyu\b/g, 'buy');
            corrected = corrected.replace(/\bpurchse\b/g, 'purchase');
            corrected = corrected.replace(/\bp\s*g\b/g, 'pg');
            corrected = corrected.replace(/\bpaying\s+guest\b/g, 'pg');
            
            // Budget variants
            corrected = corrected.replace(/\b(\d+)\s*k\b/g, '$1k');
            corrected = corrected.replace(/\b(\d+)\s*,\s*(\d{3})\b/g, '$1$2'); // 30,000 -> 30000
            corrected = corrected.replace(/\b(\d+)\s*l\b/g, '$1l');
            corrected = corrected.replace(/\b(\d+)\s*lac\b/g, '$1l');
            corrected = corrected.replace(/\b(\d+)\s*lakh\b/g, '$1l');
            corrected = corrected.replace(/\b(\d+)\s*cr\b/g, '$1cr');
            corrected = corrected.replace(/\b(\d+)\s*crore\b/g, '$1cr');
            
            // Locality spacing fixes
            corrected = corrected.replace(/\bvasantkunj\b/g, 'vasant kunj');
            corrected = corrected.replace(/\bgolfcourseroad\b/g, 'golf course road');
            corrected = corrected.replace(/\bdlfphase\s*(\d+)\b/g, 'dlf phase $1');
            corrected = corrected.replace(/\bsector\s*(\d+)\b/g, 'sector $1');
            
            return corrected;
        }

        // Extract parameters from text - supports all modes with typo tolerance
        function extractParams(text) {
            // Defensive guard - never throw if input is invalid
            if (!text || typeof text !== 'string') {
                return {};
            }

            // CRITICAL: Define lower FIRST before any usage
            const raw = String(text).trim();
            const lower = raw.toLowerCase();
            
            // Normalize and correct typos
            const normalized = normalizeText(text);
            const corrected = correctTypos(normalized);
            
            // Use corrected for matching, but keep lower for fallback
            const searchText = corrected || normalized || lower;
            
            const params = {};

            // Category (Rent/Buy/PG/Commercial/Plot/Projects) - priority order (use searchText)
            // Return as both category and intentType for backward compatibility
            if (searchText.match(/\bpg\b/)) {
                params.category = 'pg';
                params.intentType = 'pg'; // Backward compat
            } else if (searchText.match(/\b(commercial|office|shop|retail|warehouse)\b/)) {
                params.category = 'commercial';
                params.intentType = 'commercial'; // Backward compat
            } else if (searchText.match(/\b(plot|land)\b/)) {
                params.category = 'plot';
                params.intentType = 'plot'; // Backward compat
            } else if (searchText.match(/\b(project|projects|new project|under construction|ready to move|r2m|new launch)\b/)) {
                params.category = 'projects';
                params.intentType = 'projects'; // Backward compat
            } else if (searchText.match(/\b(rent|renting|for rent|to rent)\b/)) {
                params.category = 'rent';
                params.intentType = 'rent'; // Backward compat
            } else if (searchText.match(/\b(buy|buying|purchase|for sale|to buy)\b/)) {
                params.category = 'buy';
                params.intentType = 'buy'; // Backward compat
            }

            // BHK - handle all variants with typo tolerance (use searchText)
            // Handle: "3bhl", "3 bkh", "3bhk", "3 bhk", "3 b h k"
            const bhkMatch = searchText.match(/(\d+)\s*(?:b\s*h\s*k|b\s*h\s*l|b\s*k\s*h|bhk|bhl|bkh|rk|bedroom|bed)/);
            if (bhkMatch) {
                params.bhk = parseInt(bhkMatch[1]);
            }

            // Budget - more flexible matching (use searchText)
            // Match: "under 30k", "30k", "30,000", "50l", "1cr", "20-30k", etc.
            // Determine budget unit: if "rent" present or "/mo" → monthly, if "cr/lakh/l" → total
            const isRent = searchText.match(/\b(rent|renting|for rent|to rent|pg)\b/);
            const hasMonthlyIndicator = searchText.match(/\b\/mo\b/);
            const hasTotalIndicator = searchText.match(/\b(cr|crore|l|lakh|lac)\b/);
            
            // Budget range matching: "20-30k", "20 to 30k"
            const rangeMatch = searchText.match(/(\d+)\s*[-to]\s*(\d+)\s*(k|l|cr|crore|lakh|lac)/);
            if (rangeMatch) {
                let minAmount = parseInt(rangeMatch[1]);
                let maxAmount = parseInt(rangeMatch[2]);
                const unit = rangeMatch[3].toLowerCase();
                if (unit === 'k') {
                    minAmount = minAmount * 1000;
                    maxAmount = maxAmount * 1000;
                } else if (unit === 'l' || unit === 'lakh' || unit === 'lac') {
                    minAmount = minAmount * 100000;
                    maxAmount = maxAmount * 100000;
                } else if (unit === 'cr' || unit === 'crore') {
                    minAmount = minAmount * 10000000;
                    maxAmount = maxAmount * 10000000;
                }
                params.budgetMin = minAmount;
                params.budgetMax = maxAmount;
                params.budgetUnit = (isRent || hasMonthlyIndicator) ? 'monthly' : (hasTotalIndicator ? 'total' : null);
                params.budget = maxAmount; // Backward compat: use max as single budget value
            } else {
                // Single budget value
                const budgetMatch = searchText.match(/(?:under|upto|max|budget|₹|rs|rupees?|less than)?\s*(\d+)\s*(k|l|cr|crore|lakh|lac)/);
                if (budgetMatch) {
                    let amount = parseInt(budgetMatch[1]);
                    const unit = budgetMatch[2].toLowerCase();
                    if (unit === 'k') {
                        amount = amount * 1000;
                    } else if (unit === 'l' || unit === 'lakh' || unit === 'lac') {
                        amount = amount * 100000;
                    } else if (unit === 'cr' || unit === 'crore') {
                        amount = amount * 10000000;
                    }
                    params.budgetMin = amount;
                    params.budgetMax = amount;
                    params.budgetUnit = (isRent || hasMonthlyIndicator) ? 'monthly' : (hasTotalIndicator ? 'total' : null);
                    params.budget = amount; // Backward compat
                } else {
                    // Also try matching raw numbers with context
                    const rawBudgetMatch = searchText.match(/(?:under|upto|max|budget|₹|rs|rupees?|less than)\s*(\d{4,})/);
                    if (rawBudgetMatch) {
                        const num = parseInt(rawBudgetMatch[1]);
                        // If it's 4-5 digits, assume thousands (rent)
                        if (num >= 1000 && num < 100000) {
                            params.budgetMin = num;
                            params.budgetMax = num;
                            params.budgetUnit = (isRent || hasMonthlyIndicator) ? 'monthly' : null;
                            params.budget = num; // Backward compat
                        }
                        // If it's 6-7 digits, assume lakhs (buy)
                        else if (num >= 100000 && num < 10000000) {
                            params.budgetMin = num;
                            params.budgetMax = num;
                            params.budgetUnit = hasTotalIndicator ? 'total' : null;
                            params.budget = num; // Backward compat
                        }
                        // If it's 8+ digits, assume crores (buy)
                        else if (num >= 10000000) {
                            params.budgetMin = num;
                            params.budgetMax = num;
                            params.budgetUnit = 'total';
                            params.budget = num; // Backward compat
                        }
                    }
                }
            }

            // Locality → City mapping (AUTO-INFERENCE - MANDATORY)
            // COMPREHENSIVE DATASET: Top 30+ localities per city
            // If user mentions ANY locality from this list → city is auto-resolved
            // The bot MUST NEVER ask "Which city?" if a locality is present
            // Use corrected text for matching
            let matchedLocality = null;
            const localityToCityMap = {
                // Delhi localities (30)
                'vasant kunj': 'delhi',
                'vasant vihar': 'delhi',
                'saket': 'delhi',
                'malviya nagar': 'delhi',
                'greater kailash i': 'delhi',
                'greater kailash ii': 'delhi',
                'greater kailash': 'delhi', // Fallback for GK
                'hauz khas': 'delhi',
                'green park': 'delhi',
                'defence colony': 'delhi',
                'lajpat nagar': 'delhi',
                'kalkaji': 'delhi',
                'south extension': 'delhi',
                'rohini': 'delhi',
                'pitampura': 'delhi',
                'shalimar bagh': 'delhi',
                'ashok vihar': 'delhi',
                'model town': 'delhi',
                'dwarka': 'delhi',
                'janakpuri': 'delhi',
                'uttam nagar': 'delhi',
                'rajouri garden': 'delhi',
                'punjabi bagh': 'delhi',
                'karol bagh': 'delhi',
                'patel nagar': 'delhi',
                'connaught place': 'delhi',
                'mayur vihar': 'delhi',
                'preet vihar': 'delhi',
                'dilshad garden': 'delhi',
                'shahdara': 'delhi',
                'okhla': 'delhi',
                
                // Gurgaon (Gurugram) localities (25)
                'dlf phase 1': 'gurgaon',
                'dlf phase 2': 'gurgaon',
                'dlf phase 3': 'gurgaon',
                'dlf phase 4': 'gurgaon',
                'dlf phase 5': 'gurgaon',
                'golf course road': 'gurgaon',
                'golf course extension': 'gurgaon',
                'cyber city': 'gurgaon',
                'sector 14': 'gurgaon',
                'sector 22': 'gurgaon',
                'sector 23': 'gurgaon',
                'sector 27': 'gurgaon',
                'sector 31': 'gurgaon',
                'sector 43': 'gurgaon',
                'sector 45': 'gurgaon',
                'sector 46': 'gurgaon',
                'sector 49': 'gurgaon',
                'sector 50': 'gurgaon',
                'sector 52': 'gurgaon',
                'sector 56': 'gurgaon',
                'sector 57': 'gurgaon',
                'sushant lok phase 1': 'gurgaon',
                'sushant lok phase 2': 'gurgaon',
                'nirvana country': 'gurgaon',
                'south city 1': 'gurgaon',
                'gurugram': 'gurgaon',
                'gurgaon': 'gurgaon',
                
                // Noida localities (29)
                'sector 15': 'noida',
                'sector 16': 'noida',
                'sector 18': 'noida',
                'sector 22': 'noida',
                'sector 25': 'noida',
                'sector 37': 'noida',
                'sector 41': 'noida',
                'sector 44': 'noida',
                'sector 50': 'noida',
                'sector 51': 'noida',
                'sector 52': 'noida',
                'sector 61': 'noida',
                'sector 62': 'noida',
                'sector 63': 'noida',
                'sector 74': 'noida',
                'sector 75': 'noida',
                'sector 76': 'noida',
                'sector 77': 'noida',
                'sector 78': 'noida',
                'sector 79': 'noida',
                'sector 93': 'noida',
                'sector 104': 'noida',
                'sector 107': 'noida',
                'sector 110': 'noida',
                'sector 120': 'noida',
                'sector 121': 'noida',
                'sector 137': 'noida',
                'sector 143': 'noida',
                'sector 150': 'noida',
                'noida': 'noida',
                
                // Mumbai localities (29)
                'andheri east': 'mumbai',
                'andheri west': 'mumbai',
                'andheri': 'mumbai', // Fallback
                'bandra east': 'mumbai',
                'bandra west': 'mumbai',
                'bandra': 'mumbai', // Fallback
                'khar west': 'mumbai',
                'santacruz east': 'mumbai',
                'santacruz west': 'mumbai',
                'santacruz': 'mumbai', // Fallback
                'juhu': 'mumbai',
                'powai': 'mumbai',
                'vikhroli': 'mumbai',
                'ghatkopar': 'mumbai',
                'chembur': 'mumbai',
                'kurla': 'mumbai',
                'lower parel': 'mumbai',
                'worli': 'mumbai',
                'dadar': 'mumbai',
                'prabhadevi': 'mumbai',
                'malad east': 'mumbai',
                'malad west': 'mumbai',
                'malad': 'mumbai', // Fallback
                'goregaon east': 'mumbai',
                'goregaon west': 'mumbai',
                'goregaon': 'mumbai', // Fallback
                'kandivali east': 'mumbai',
                'kandivali west': 'mumbai',
                'kandivali': 'mumbai', // Fallback
                'borivali east': 'mumbai',
                'borivali west': 'mumbai',
                'borivali': 'mumbai', // Fallback
                'mira road': 'mumbai',
                'thane west': 'mumbai',
                'thane east': 'mumbai',
                'thane': 'mumbai', // Fallback
                'navi mumbai': 'mumbai',
                'mumbai': 'mumbai',
                'bombay': 'mumbai',
                
                // Bangalore localities (25)
                'indiranagar': 'bangalore',
                'whitefield': 'bangalore',
                'hsr layout': 'bangalore',
                'koramangala': 'bangalore',
                'bellandur': 'bangalore',
                'sarjapur road': 'bangalore',
                'marathahalli': 'bangalore',
                'electronic city': 'bangalore',
                'btm layout': 'bangalore',
                'jp nagar': 'bangalore',
                'jayanagar': 'bangalore',
                'banashankari': 'bangalore',
                'yelahanka': 'bangalore',
                'hebbal': 'bangalore',
                'hennur': 'bangalore',
                'kalyan nagar': 'bangalore',
                'kr puram': 'bangalore',
                'brookefield': 'bangalore',
                'hoodi': 'bangalore',
                'ulsoor': 'bangalore',
                'malleshwaram': 'bangalore',
                'rajajinagar': 'bangalore',
                'vijayanagar': 'bangalore',
                'basavanagudi': 'bangalore',
                'nagarbhavi': 'bangalore',
                'bangalore': 'bangalore',
                'bengaluru': 'bangalore',
                
                // Pune localities (24)
                'baner': 'pune',
                'balewadi': 'pune',
                'wakad': 'pune',
                'hinjewadi phase 1': 'pune',
                'hinjewadi phase 2': 'pune',
                'hinjewadi phase 3': 'pune',
                'hinjewadi': 'pune', // Fallback
                'aundh': 'pune',
                'pashan': 'pune',
                'bavdhan': 'pune',
                'kothrud': 'pune',
                'karve nagar': 'pune',
                'hadapsar': 'pune',
                'magarpatta': 'pune',
                'kharadi': 'pune',
                'viman nagar': 'pune',
                'yerwada': 'pune',
                'koregaon park': 'pune',
                'kalyani nagar': 'pune',
                'mundhwa': 'pune',
                'wagholi': 'pune',
                'pimpri': 'pune',
                'chinchwad': 'pune',
                'nigdi': 'pune',
                'talegaon': 'pune',
                'pune': 'pune'
            };
            
            // Direct city names (explicit mentions)
            const cityNames = [
                { name: 'gurgaon', aliases: ['gurgaon', 'gurugram'] },
                { name: 'mumbai', aliases: ['mumbai', 'bombay'] },
                { name: 'bangalore', aliases: ['bangalore', 'bengaluru'] },
                { name: 'delhi', aliases: ['delhi', 'new delhi'] },
                { name: 'pune', aliases: ['pune'] },
                { name: 'noida', aliases: ['noida'] },
                { name: 'chennai', aliases: ['chennai', 'madras'] },
                { name: 'hyderabad', aliases: ['hyderabad'] },
                { name: 'kolkata', aliases: ['kolkata', 'calcutta'] }
            ];
            
            // First, check for explicit city mentions (use searchText)
            for (const city of cityNames) {
                if (city.aliases.some(alias => searchText.includes(alias))) {
                    params.city = city.name;
                    break;
                }
            }
            
            // If no explicit city, infer from locality (AUTO-INFERENCE - STRICT ENFORCEMENT)
            // Match longest locality first to avoid partial matches
            if (!params.city) {
                const sortedLocalities = Object.keys(localityToCityMap).sort((a, b) => b.length - a.length);
                for (const locality of sortedLocalities) {
                    // Check if locality appears in the text (word boundary aware)
                    const localityPattern = new RegExp(`\\b${locality.replace(/\s+/g, '\\s+')}\\b`, 'i');
                    if (localityPattern.test(searchText)) {
                        params.city = localityToCityMap[locality];
                        // Also store locality for reference
                        params.locality = locality;
                        break;
                    }
                }
            }
            
            // Handle city/locality conflicts (if user mentions both and they conflict)
            if (params.city && params.locality) {
                const inferredCity = localityToCityMap[params.locality.toLowerCase()];
                if (inferredCity && inferredCity !== params.city.toLowerCase()) {
                    // Conflict detected - city explicitly mentioned conflicts with locality
                    // For now, trust explicit city mention over locality inference
                    // But log for debugging
                    if (DEBUG || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        console.warn('City/locality conflict:', {
                            explicitCity: params.city,
                            locality: params.locality,
                            inferredCity: inferredCity,
                            action: 'Using explicit city'
                        });
                    }
                }
            }
            
            // Handle ambiguous cases (e.g., "sector 15" could be Noida/Gurgaon/Faridabad)
            // If we see just "sector" without a city, store locality for clarification
            if (!params.city && searchText.match(/\bsector\s+\d+/) && !searchText.match(/\b(noida|gurgaon|faridabad|delhi)\b/)) {
                const sectorMatch = searchText.match(/\bsector\s+\d+/);
                if (sectorMatch) {
                    params.locality = sectorMatch[0];
                }
            }

            // Type (for additional filtering)
            if (searchText.match(/\bvilla\b/i)) params.propertyType = 'villa';
            else if (searchText.match(/\b(studio|1rk)\b/i)) params.propertyType = 'studio';
            else if (searchText.match(/\bapartment\b/i)) params.propertyType = 'apartment';
            else if (searchText.match(/\brow\s+house\b/i)) params.propertyType = 'row house';
            else if (searchText.match(/\boffice\b/i)) params.propertyType = 'office';

            return params;
        }

        // Check what's missing - priority order: mode → location → budget → bhk
        function getMissingParams() {
            const missing = [];
            if (!chatState.category && !chatState.intentType) missing.push('mode');
            if (!chatState.city && !chatState.locality) missing.push('location');
            if (!chatState.budget && !chatState.budgetMin && !chatState.budgetMax) missing.push('budget');
            if (!chatState.bhk) missing.push('bhk');
            return missing;
        }

        // Get next missing param (only one at a time)
        function getNextMissingParam() {
            const missing = getMissingParams();
            return missing.length > 0 ? missing[0] : null;
        }

        // Get pending question based on missing required slots
        // CRITICAL: Never ask for city if it can be inferred from locality
        // Priority order: category → cityOrLocality → bhkOrType → budget
        function getPendingQuestion() {
            // Priority 1: Check category (rent/buy/pg/commercial/plot/projects)
            if (!chatState.category && !chatState.intentType) {
                return 'category';
            }
            
            // AUTO-INFERENCE CHECK: If locality exists but city doesn't, try to infer
            if (!chatState.city && chatState.locality) {
                // Try to infer city from locality (should have been done in extractParams, but double-check)
                const inferredCity = inferCityFromLocality(chatState.locality);
                if (inferredCity) {
                    chatState.city = inferredCity;
                    // City is now set, continue to next check
                } else {
                    // Locality exists but can't be inferred - ask for clarification
                    return 'cityOrLocality';
                }
            }
            
            // Priority 2: Only ask for city/locality if both are missing
            if (!chatState.city && !chatState.locality) {
                return 'cityOrLocality';
            }
            
            // Priority 3: Ask for BHK/type if missing (but only if we don't have enough to show results)
            // For demo, we can show results even without BHK if we have category + location
            // So only ask BHK if we have category + location but nothing else
            if (!chatState.bhk && !chatState.propertyType) {
                // Only ask BHK if we don't have budget either (to avoid asking too many questions)
                // If we have category + location, we can show results without BHK
                const hasEnough = hasEnoughToShowResults(chatState);
                if (!hasEnough) {
                    return 'bhkOrType';
                }
            }
            
            // Priority 4: Budget is optional for demo, but ask if nothing else is present
            // Only ask budget if we have category + location but no BHK and no budget
            if (!chatState.budgetMin && !chatState.budgetMax && !chatState.budget) {
                const hasEnough = hasEnoughToShowResults(chatState);
                if (!hasEnough) {
                    return 'budget';
                }
            }
            
            return null; // All required slots filled OR we have enough to show results
        }
        
        // Infer city from locality (helper function)
        // COMPREHENSIVE DATASET: Must match extractParams localityToCityMap
        // STRICT RULE: If locality exists in this map, city is auto-resolved
        function inferCityFromLocality(locality) {
            if (!locality) return null;
            
            const localityToCityMap = {
                // Delhi (30)
                'vasant kunj': 'delhi', 'vasant vihar': 'delhi', 'saket': 'delhi', 'malviya nagar': 'delhi',
                'greater kailash i': 'delhi', 'greater kailash ii': 'delhi', 'greater kailash': 'delhi',
                'hauz khas': 'delhi', 'green park': 'delhi', 'defence colony': 'delhi', 'lajpat nagar': 'delhi',
                'kalkaji': 'delhi', 'south extension': 'delhi', 'rohini': 'delhi', 'pitampura': 'delhi',
                'shalimar bagh': 'delhi', 'ashok vihar': 'delhi', 'model town': 'delhi', 'dwarka': 'delhi',
                'janakpuri': 'delhi', 'uttam nagar': 'delhi', 'rajouri garden': 'delhi', 'punjabi bagh': 'delhi',
                'karol bagh': 'delhi', 'patel nagar': 'delhi', 'connaught place': 'delhi', 'mayur vihar': 'delhi',
                'preet vihar': 'delhi', 'dilshad garden': 'delhi', 'shahdara': 'delhi', 'okhla': 'delhi',
                
                // Gurgaon (27)
                'dlf phase 1': 'gurgaon', 'dlf phase 2': 'gurgaon', 'dlf phase 3': 'gurgaon',
                'dlf phase 4': 'gurgaon', 'dlf phase 5': 'gurgaon', 'golf course road': 'gurgaon',
                'golf course extension': 'gurgaon', 'cyber city': 'gurgaon', 'sector 14': 'gurgaon',
                'sector 22': 'gurgaon', 'sector 23': 'gurgaon', 'sector 27': 'gurgaon', 'sector 31': 'gurgaon',
                'sector 43': 'gurgaon', 'sector 45': 'gurgaon', 'sector 46': 'gurgaon', 'sector 49': 'gurgaon',
                'sector 50': 'gurgaon', 'sector 52': 'gurgaon', 'sector 56': 'gurgaon', 'sector 57': 'gurgaon',
                'sushant lok phase 1': 'gurgaon', 'sushant lok phase 2': 'gurgaon', 'nirvana country': 'gurgaon',
                'south city 1': 'gurgaon', 'gurugram': 'gurgaon', 'gurgaon': 'gurgaon',
                
                // Noida (30)
                'sector 15': 'noida', 'sector 16': 'noida', 'sector 18': 'noida', 'sector 22': 'noida',
                'sector 25': 'noida', 'sector 37': 'noida', 'sector 41': 'noida', 'sector 44': 'noida',
                'sector 50': 'noida', 'sector 51': 'noida', 'sector 52': 'noida', 'sector 61': 'noida',
                'sector 62': 'noida', 'sector 63': 'noida', 'sector 74': 'noida', 'sector 75': 'noida',
                'sector 76': 'noida', 'sector 77': 'noida', 'sector 78': 'noida', 'sector 79': 'noida',
                'sector 93': 'noida', 'sector 104': 'noida', 'sector 107': 'noida', 'sector 110': 'noida',
                'sector 120': 'noida', 'sector 121': 'noida', 'sector 137': 'noida', 'sector 143': 'noida',
                'sector 150': 'noida', 'noida': 'noida',
                
                // Mumbai (38)
                'andheri east': 'mumbai', 'andheri west': 'mumbai', 'andheri': 'mumbai',
                'bandra east': 'mumbai', 'bandra west': 'mumbai', 'bandra': 'mumbai',
                'khar west': 'mumbai', 'santacruz east': 'mumbai', 'santacruz west': 'mumbai', 'santacruz': 'mumbai',
                'juhu': 'mumbai', 'powai': 'mumbai', 'vikhroli': 'mumbai', 'ghatkopar': 'mumbai',
                'chembur': 'mumbai', 'kurla': 'mumbai', 'lower parel': 'mumbai', 'worli': 'mumbai',
                'dadar': 'mumbai', 'prabhadevi': 'mumbai', 'malad east': 'mumbai', 'malad west': 'mumbai',
                'malad': 'mumbai', 'goregaon east': 'mumbai', 'goregaon west': 'mumbai', 'goregaon': 'mumbai',
                'kandivali east': 'mumbai', 'kandivali west': 'mumbai', 'kandivali': 'mumbai',
                'borivali east': 'mumbai', 'borivali west': 'mumbai', 'borivali': 'mumbai',
                'mira road': 'mumbai', 'thane west': 'mumbai', 'thane east': 'mumbai', 'thane': 'mumbai',
                'navi mumbai': 'mumbai', 'mumbai': 'mumbai', 'bombay': 'mumbai',
                
                // Bangalore (27)
                'indiranagar': 'bangalore', 'whitefield': 'bangalore', 'hsr layout': 'bangalore',
                'koramangala': 'bangalore', 'bellandur': 'bangalore', 'sarjapur road': 'bangalore',
                'marathahalli': 'bangalore', 'electronic city': 'bangalore', 'btm layout': 'bangalore',
                'jp nagar': 'bangalore', 'jayanagar': 'bangalore', 'banashankari': 'bangalore',
                'yelahanka': 'bangalore', 'hebbal': 'bangalore', 'hennur': 'bangalore',
                'kalyan nagar': 'bangalore', 'kr puram': 'bangalore', 'brookefield': 'bangalore',
                'hoodi': 'bangalore', 'ulsoor': 'bangalore', 'malleshwaram': 'bangalore',
                'rajajinagar': 'bangalore', 'vijayanagar': 'bangalore', 'basavanagudi': 'bangalore',
                'nagarbhavi': 'bangalore', 'bangalore': 'bangalore', 'bengaluru': 'bangalore',
                
                // Pune (26)
                'baner': 'pune', 'balewadi': 'pune', 'wakad': 'pune',
                'hinjewadi phase 1': 'pune', 'hinjewadi phase 2': 'pune', 'hinjewadi phase 3': 'pune',
                'hinjewadi': 'pune', 'aundh': 'pune', 'pashan': 'pune', 'bavdhan': 'pune',
                'kothrud': 'pune', 'karve nagar': 'pune', 'hadapsar': 'pune', 'magarpatta': 'pune',
                'kharadi': 'pune', 'viman nagar': 'pune', 'yerwada': 'pune', 'koregaon park': 'pune',
                'kalyani nagar': 'pune', 'mundhwa': 'pune', 'wagholi': 'pune', 'pimpri': 'pune',
                'chinchwad': 'pune', 'nigdi': 'pune', 'talegaon': 'pune', 'pune': 'pune'
            };
            
            const normalizedLocality = locality.toLowerCase().trim();
            return localityToCityMap[normalizedLocality] || null;
        }

        // Check if we have enough info to show results (DEMO-FRIENDLY)
        // For demo we should show properties even if some fields missing.
        // Minimum requirement: category OR inferred category, plus at least ONE of: city/locality/budget/bhk/propertyType.
        function hasEnoughToShowResults(state) {
            // Must have category (rent/buy/pg/commercial/plot/projects)
            const hasCategory = !!(state.category || state.intentType);
            
            // Must have at least one signal: city/locality/budget/bhk/propertyType
            const hasAnySignal = !!(state.city || state.locality || state.bhk || 
                                   state.budgetMin || state.budgetMax || state.budget || 
                                   state.propertyType);
            
            // No pending question (don't show results while asking)
            const noPendingQuestion = pendingQuestion === null;
            
            const ready = hasCategory && hasAnySignal && noPendingQuestion;
            
            // Update readyToShowResults flag
            state.readyToShowResults = ready;
            return ready;
        }
        
        // Backward compatibility wrapper
        function canShowResults() {
            return hasEnoughToShowResults(chatState);
        }

        // Generate bot response - strict sequencing with pendingQuestion
        // CRITICAL: This function NEVER asks for something the user already provided
        // Params are extracted and context is updated BEFORE checking pending questions
        function generateBotResponse(intent, userText) {
            // Handle price trend intent FIRST (before normal housing flow)
            if (intent === 'price_trend') {
                const locality = extractTrendLocality(userText);
                let city = null;
                
                // Try to infer city from locality
                if (locality) {
                    city = inferCityFromLocality(locality);
                }
                
                // If locality is unknown or city can't be inferred, ask for clarification
                if (!locality || !city) {
                    return {
                        text: locality ? 'Which city is this locality in?' : 'Which locality are you asking about?',
                        chips: null,
                        results: null,
                        trendCard: null
                    };
                }
                
                // Generate trend data
                const trendData = generateTrendData(locality, city);
                
                // Generate response text
                const directionText = trendData.direction === 'Up' ? 'slightly up' : 
                                     trendData.direction === 'Down' ? 'slightly down' : 'relatively stable';
                const yoyText = trendData.yoyPct >= 0 ? `+${trendData.yoyPct}%` : `${trendData.yoyPct}%`;
                const responseText = `${trendData.locality} prices look ${directionText} overall. YoY is around ${yoyText}, with ${trendData.direction === 'Up' ? 'steady' : trendData.direction === 'Down' ? 'moderate' : 'minimal'} movement in the last 6 months.`;
                
                return {
                    text: responseText,
                    chips: null,
                    results: null,
                    trendCard: trendData
                };
            }
            
            // Normalize and extract params
            const raw = userText;
            const normalized = normalizeText(raw);
            const corrected = correctTypos(normalized);
            const params = extractParams(userText);
            
            // Debug logging (dev mode) - log state transitions
            if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                console.log('🔍 State Transition:', {
                    detectedIntent: intent,
                    extractedParams: {
                        category: params.category || params.intentType || params.mode,
                        city: params.city,
                        locality: params.locality,
                        bhk: params.bhk,
                        budget: params.budget || (params.budgetMin && params.budgetMax ? `${params.budgetMin}-${params.budgetMax}` : null),
                        propertyType: params.propertyType
                    },
                    chatStateBefore: { ...chatState },
                    missingSlots: getPendingQuestion() ? [getPendingQuestion()] : [],
                    willShowResults: false // Will be set below
                });
            }
            
            // CRITICAL: Check if user answered the last question
            // If they did, don't ask it again
            if (lastQuestionKey === 'category' && (params.category || params.intentType || params.mode)) {
                lastQuestionKey = null;
                lastQuestionValueSnapshot = null;
            } else if (lastQuestionKey === 'cityOrLocality' && (params.city || params.locality)) {
                lastQuestionKey = null;
                lastQuestionValueSnapshot = null;
            } else if (lastQuestionKey === 'bhkOrType' && (params.bhk || params.propertyType)) {
                lastQuestionKey = null;
                lastQuestionValueSnapshot = null;
            } else if (lastQuestionKey === 'budget' && (params.budget || params.budgetMin || params.budgetMax)) {
                lastQuestionKey = null;
                lastQuestionValueSnapshot = null;
            }
            
            // CRITICAL: Merge params into chatState WITHOUT overwriting existing fields with null/undefined
            // This ensures we remember what user said across turns
            // Example: If user says "I want to rent 3bhk", category='rent' and bhk=3 are set here
            // Then getPendingQuestion() will NOT return 'category' because category is already set
            for (const key in params) {
                if (params[key] !== null && params[key] !== undefined) {
                    // Only update if new value is not null/undefined
                    if (Array.isArray(params[key]) && params[key].length > 0) {
                        chatState[key] = params[key];
                    } else if (!Array.isArray(params[key])) {
                        chatState[key] = params[key];
                    }
                }
            }
            
            // Set intent to property_search if we have any housing-related params
            if (params.category || params.intentType || params.city || params.locality || params.bhk || params.budget) {
                chatState.intent = 'property_search';
            }

            // Determine pending question based on missing required slots
            // This will NOT include anything the user just provided in params
            pendingQuestion = getPendingQuestion();
            
            // Debug logging (behind DEBUG flag)
            if (DEBUG || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                const canShow = hasEnoughToShowResults(chatState);
                console.log('🔍 State After User Action:', {
                    chatState: {
                        category: chatState.category || chatState.intentType,
                        city: chatState.city,
                        locality: chatState.locality,
                        bhk: chatState.bhk,
                        propertyType: chatState.propertyType,
                        budget: chatState.budget || (chatState.budgetMin && chatState.budgetMax ? `${chatState.budgetMin}-${chatState.budgetMax}` : null),
                        budgetUnit: chatState.budgetUnit
                    },
                    pendingQuestion,
                    hasEnoughToShowResults: canShow,
                    willShowResults: canShow && !pendingQuestion,
                    readyToShowResults: chatState.readyToShowResults
                });
            }
            
            let responseText = '';
            let chips = [];
            let results = null; // Only show results when pendingQuestion is null

            // STRICT RULE: If chips are shown, text must be minimal (no duplication)
            // IMPORTANT: If showing chips, do NOT repeat the same question text again
            // If there's a pending question, show only prompt + chips (NO cards)
            if (pendingQuestion === 'category') {
                // Chip only mode - minimal prompt (chips show options, no need to repeat)
                responseText = 'Select a category.';
                chips = ['Rent', 'Buy', 'PG', 'Commercial', 'Plot', 'Projects'].slice(0, 6);
                lastQuestionKey = 'category';
            } else if (pendingQuestion === 'cityOrLocality') {
                // Check if we have a locality but need city clarification (ambiguous case)
                if (chatState.locality && !chatState.city && lastQuestionKey !== 'cityOrLocality') {
                    // Ambiguous locality (e.g., "sector 15" could be multiple cities)
                    const localityDisplay = chatState.locality.charAt(0).toUpperCase() + chatState.locality.slice(1);
                    responseText = `Which city is ${localityDisplay} in?`;
                    chips = ['Gurgaon', 'Mumbai', 'Bangalore', 'Delhi', 'Pune', 'Noida'].slice(0, 6);
                    lastQuestionKey = 'cityOrLocality';
                } else if (!chatState.locality && !chatState.city && lastQuestionKey !== 'cityOrLocality') {
                    // No locality or city - ask normally (minimal text since chips show options)
                    responseText = 'Select a city.';
                    chips = ['Gurgaon', 'Mumbai', 'Bangalore', 'Delhi', 'Pune', 'Noida'].slice(0, 6);
                    lastQuestionKey = 'cityOrLocality';
                } else {
                    // Already asked, don't ask again
                    pendingQuestion = null;
                }
            } else if (pendingQuestion === 'bhkOrType' && lastQuestionKey !== 'bhkOrType') {
                // Chip only mode - minimal prompt (chips show options)
                responseText = 'Select configuration.';
                chips = ['1RK', '1BHK', '2BHK', '3BHK', '4BHK+'].slice(0, 6);
                lastQuestionKey = 'bhkOrType';
            } else if (pendingQuestion === 'budget' && lastQuestionKey !== 'budget') {
                // Budget question - polite but minimal (chips show ranges)
                const isRent = chatState.category === 'rent' || chatState.category === 'pg' || chatState.intentType === 'rent' || chatState.intentType === 'pg';
                responseText = 'Select a budget range.';
                chips = isRent
                    ? ['Under ₹20k', '₹20-30k', '₹30-50k', '₹50k+'].slice(0, 6)
                    : ['Under ₹50L', '₹50L-1Cr', '₹1-2Cr', '₹2Cr+'].slice(0, 6);
                lastQuestionKey = 'budget';
            } else if (pendingQuestion && lastQuestionKey === pendingQuestion) {
                // Already asked this question, don't ask again - show results if we can
                pendingQuestion = null;
            }
            
            // CRITICAL: Only show results if NO pending question AND we have enough info
            // Never show cards in the same turn as a clarifying question
            const canShow = hasEnoughToShowResults(chatState);
            
            if (!pendingQuestion && canShow) {
                // All required slots filled OR we have enough - ready to show results
                chatState.readyToShowResults = true; // CRITICAL FLAG
                
                // Natural response with inferred city (don't announce inference explicitly)
                // Use locality if available, otherwise city, otherwise generic
                const locationText = chatState.locality || chatState.city || '';
                if (locationText) {
                    const displayLocation = locationText.split(' ').map(word => 
                        word.charAt(0).toUpperCase() + word.slice(1)
                    ).join(' ');
                    responseText = `Here are a few options in ${displayLocation}.`;
                } else {
                    responseText = 'Here are a few options.';
                }
                
                // Get filtered results (ONLY when readyToShowResults is true AND no pending question)
                const filtered = filterProperties();
                results = filtered.length > 0 ? filtered.slice(0, 3) : getFallbackResults();
                
                // Optional refinement chips (only if budget not set and we're showing results)
                if (!chatState.budget && !chatState.budgetMin && !chatState.budgetMax && chatState.category) {
                    const category = chatState.category || chatState.intentType;
                    if (category === 'rent' || category === 'pg') {
                        chips = ['Under ₹20k', '₹20-30k', '₹30-50k'].slice(0, 6);
                    } else if (category === 'buy' || category === 'projects') {
                        chips = ['Under ₹50L', '₹50L-1Cr', '₹1-2Cr'].slice(0, 6);
                    }
                }
            } else if (pendingQuestion) {
                // If there's a pending question, DO NOT show results
                results = null;
                chatState.readyToShowResults = false;
            }

            return {
                text: responseText,
                results: results, // null if pendingQuestion exists
                chips: chips.length > 0 ? chips : null,
                summary: null,
                followUp: null
            };
        }

        // Get fallback results (always return at least 3)
        function getFallbackResults() {
            return mockProperties.slice(0, 3);
        }

        // Removed getFollowUpQuestion - now handled in generateBotResponse

        // Generate mock listings that match resolved city/locality
        function generateMockListings({ city, locality, bhk, mode, budgetBucket }) {
            const cityKey = (city || 'delhi').toLowerCase();
            const localityKey = (locality || '').toLowerCase();
            
            // Title case helper
            const titleCase = (str) => {
                if (!str) return '';
                return str.split(' ').map(word => 
                    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
                ).join(' ');
            };
            
            const areaLabel = localityKey 
                ? `${titleCase(localityKey)}, ${titleCase(cityKey)}`
                : titleCase(cityKey);
            
            const isRent = mode === 'rent' || mode === 'pg';
            const priceRanges = isRent 
                ? [
                    { min: 18000, max: 25000, display: '₹20k/mo' },
                    { min: 25000, max: 35000, display: '₹28k/mo' },
                    { min: 35000, max: 50000, display: '₹42k/mo' }
                ]
                : [
                    { min: 5000000, max: 7000000, display: '₹65L' },
                    { min: 7000000, max: 10000000, display: '₹85L' },
                    { min: 10000000, max: 15000000, display: '₹1.2Cr' }
                ];
            
            const listings = [];
            for (let i = 0; i < 3; i++) {
                const priceRange = priceRanges[i % priceRanges.length];
                const price = Math.floor(priceRange.min + (priceRange.max - priceRange.min) * 0.5);
                
                listings.push({
                    id: `mock-${cityKey}-${i + 1}`,
                    city: cityKey,
                    locality: localityKey || areaLabel.split(',')[0].trim(),
                    price: price,
                    priceUnit: isRent ? 'rent' : 'buy',
                    bhk: bhk || (i % 3) + 2, // Default to 2, 3, 4 BHK
                    type: 'Apartment',
                    furnished: i === 0 ? 'Fully' : i === 1 ? 'Semi' : 'Unfurnished',
                    amenities: ['Parking', 'Lift', i === 0 ? 'Gym' : 'Power Backup'],
                    tags: localityKey ? [`Near ${titleCase(localityKey)}`] : ['Gated'],
                    images: []
                });
            }
            
            return listings;
        }
        
        // Filter properties based on context - demo-friendly (loose matching)
        // CRITICAL: Enforce city/locality matching - never show wrong-city cards
        function filterProperties() {
            let filtered = [...mockProperties];
            
            // Apply filters (loose matching for demo)
            const category = chatState.category || chatState.intentType;
            if (category) {
                // Map category to priceUnit for filtering
                if (category === 'rent' || category === 'pg') {
                    filtered = filtered.filter(prop => prop.priceUnit === 'rent');
                } else if (category === 'buy' || category === 'projects' || category === 'plot') {
                    filtered = filtered.filter(prop => prop.priceUnit === 'buy');
                } else if (category === 'commercial') {
                    // Commercial properties might have different structure - for now, show all
                    filtered = filtered;
                }
            }
            
            // CRITICAL: Enforce city matching - never show wrong-city cards
            if (chatState.city) {
                const cityKey = chatState.city.toLowerCase();
                filtered = filtered.filter(prop => prop.city.toLowerCase() === cityKey);
                
                // If no matches, generate city-specific mock listings
                if (filtered.length === 0) {
                    const mockListings = generateMockListings({
                        city: chatState.city,
                        locality: chatState.locality,
                        bhk: chatState.bhk,
                        mode: category,
                        budgetBucket: null
                    });
                    filtered = mockListings;
                }
            }
            
            // If locality is specified, prefer listings with matching locality
            if (chatState.locality && filtered.length > 0) {
                const localityKey = chatState.locality.toLowerCase();
                const localityMatches = filtered.filter(prop => 
                    prop.locality && prop.locality.toLowerCase().includes(localityKey)
                );
                if (localityMatches.length > 0) {
                    filtered = localityMatches;
                }
            }
            
            if (chatState.bhk) {
                filtered = filtered.filter(prop => prop.bhk === chatState.bhk);
            }
            if (chatState.propertyType || chatState.type) {
                const propType = chatState.propertyType || chatState.type;
                filtered = filtered.filter(prop => prop.type === propType);
            }
            // Filter by budget (support both single budget and budgetMin/Max)
            const budget = chatState.budget || chatState.budgetMax || chatState.budgetMin;
            if (budget) {
                const isRent = category === 'rent' || category === 'pg';
                if (isRent) {
                    filtered = filtered.filter(prop => prop.price <= budget * 1.2); // Allow 20% tolerance
                } else {
                    filtered = filtered.filter(prop => prop.price <= budget * 1.2);
                }
            }
            
            // CRITICAL SANITY CHECK: Assert every listing city matches session.city
            if (chatState.city) {
                const cityKey = chatState.city.toLowerCase();
                const mismatches = filtered.filter(prop => prop.city.toLowerCase() !== cityKey);
                if (mismatches.length > 0) {
                    console.warn('City mismatch detected, regenerating listings:', mismatches);
                    // Regenerate listings with correct city
                    filtered = generateMockListings({
                        city: chatState.city,
                        locality: chatState.locality,
                        bhk: chatState.bhk,
                        mode: category,
                        budgetBucket: null
                    });
                }
            }
            
            // Always return at least 3 results (demo-friendly)
            if (filtered.length === 0) {
                // Generate fallback listings matching the resolved city
                return generateMockListings({
                    city: chatState.city || 'delhi',
                    locality: chatState.locality,
                    bhk: chatState.bhk,
                    mode: category,
                    budgetBucket: null
                });
            }
            
            return filtered;
        }

        // Generate search summary (removed - using cleaner UI)
        function generateSummary() {
            return null; // Not used anymore
        }

        // Strict renderBotTurn function - enforces layout contract (no duplicates)
        function renderBotTurn(options, existingMsgId = null) {
            const { text, chips, carousel } = options;
            
            // Strict contract: only text, chips, carousel - no followUp (handled in generateBotResponse)
            
            // CRITICAL SAFETY GATE: Never render cards unless readyToShowResults is true AND no pending question
            // This prevents premature card display and ensures cards only show after slot-filling
            const safeCarousel = (chatState.readyToShowResults && 
                                 pendingQuestion === null && 
                                 carousel && 
                                 carousel.length > 0) ? carousel : null;
            
            let msgEl;
            if (existingMsgId) {
                msgEl = document.getElementById(existingMsgId);
            } else {
                const msgId = addBotMessage('');
                msgEl = document.getElementById(msgId);
            }
            
            if (!msgEl) return null;

            // Clear any existing content (except the message wrapper)
            const existingContent = msgEl.querySelector('.bot-message-content');
            if (existingContent) {
                existingContent.remove();
            }

            // Create bot message container with strict structure
            const botMessage = document.createElement('div');
            botMessage.className = 'bot-message-content';
            
            // 1. BotText (optional) - but if chips are shown, text should be minimal
            // STRICT RULE: Don't duplicate what chips already communicate
            if (text) {
                const textEl = document.createElement('div');
                textEl.className = 'bot-text';
                textEl.textContent = text;
                botMessage.appendChild(textEl);
            }
            
            // 2. ChipsRow (optional) - left-aligned
            if (chips && chips.length > 0) {
                const chipsContainer = document.createElement('div');
                chipsContainer.className = 'chat-chips';
                
                chips.forEach(chipText => {
                    const chip = document.createElement('button');
                    chip.className = 'chat-chip';
                    chip.textContent = chipText;
                    chip.addEventListener('click', () => {
                        handleChipClick(chipText);
                    });
                    chipsContainer.appendChild(chip);
                });
                
                botMessage.appendChild(chipsContainer);
                
                // Guardrail: check chips height
                requestAnimationFrame(() => {
                    const height = chipsContainer.getBoundingClientRect().height;
                    if (height > 96 && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
                        console.warn('Chips overflow - check wrapping:', height);
                    }
                });
            }
            
            // 3. CarouselRow (optional, horizontal scroll) - below chips/text
            // Safety gate: Never show cards if pendingQuestion exists
            if (safeCarousel && safeCarousel.length > 0) {
                // Create bot-results wrapper
                const resultsWrapper = document.createElement('div');
                resultsWrapper.className = 'bot-results';
                
                // Create property rail (proper carousel container)
                const propertyRail = document.createElement('div');
                propertyRail.className = 'property-rail';

                // Reset image tracker for this new set of properties to avoid repeats
                getListingImage(null, true);

                safeCarousel.forEach(prop => {
                    const card = createPropertyCard(prop);
                    propertyRail.appendChild(card);
                });

                resultsWrapper.appendChild(propertyRail);
                botMessage.appendChild(resultsWrapper);
            }
            
            // 4. TrendCard (optional) - for price trend queries
            if (trendCard) {
                const trendWrapper = document.createElement('div');
                trendWrapper.className = 'trend-wrapper';
                trendWrapper.innerHTML = renderTrendCard(trendCard);
                botMessage.appendChild(trendWrapper);
            }
            
            // Append to message element
            msgEl.appendChild(botMessage);
            
            // Guardrail: check for overflow
            requestAnimationFrame(() => {
                checkOverflow(msgEl);
            });
            
            // Don't scroll if we're keeping user message at top
            // Bot response will appear below user message naturally
            if (!keepUserMessageAtTop) {
                scrollToBottom({ force: true });
            }
            return existingMsgId || msgEl.id;
        }

        // Default fallback image URL (must always work)
        // Local aesthetic interior images (saved locally for faster loading)
        const LOCAL_IMAGES = [
            'images/property/interior1.jpg',
            'images/property/interior2.jpg',
            'images/property/interior3.jpg',
            'images/property/interior4.jpg',
            'images/property/interior5.jpg',
            'images/property/interior6.jpg',
            'images/property/interior7.jpg',
            'images/property/interior8.jpg'
        ];
        
        const DEFAULT_FALLBACK_IMAGE = LOCAL_IMAGES[0];
        
        // City-based image mapping using local images (rotated for variety)
        const CITY_IMAGE_MAP = {
            'delhi': [
                LOCAL_IMAGES[0],
                LOCAL_IMAGES[1],
                LOCAL_IMAGES[2]
            ],
            'mumbai': [
                LOCAL_IMAGES[3],
                LOCAL_IMAGES[4],
                LOCAL_IMAGES[5]
            ],
            'bangalore': [
                LOCAL_IMAGES[6],
                LOCAL_IMAGES[7],
                LOCAL_IMAGES[0]
            ],
            'pune': [
                LOCAL_IMAGES[1],
                LOCAL_IMAGES[2],
                LOCAL_IMAGES[3]
            ],
            'gurgaon': [
                LOCAL_IMAGES[4],
                LOCAL_IMAGES[5],
                LOCAL_IMAGES[6]
            ],
            'noida': [
                LOCAL_IMAGES[7],
                LOCAL_IMAGES[0],
                LOCAL_IMAGES[1]
            ]
        };
        
        // Track used images to avoid repeats within a single property set
        let usedImagesInCurrentSet = new Set();
        
        // Helper function to get listing image based on city (using local images, no repeats)
        function getListingImage(city, resetTracker = false) {
            if (resetTracker) {
                usedImagesInCurrentSet.clear();
            }
            
            const cityKey = (city || '').toLowerCase();
            const images = CITY_IMAGE_MAP[cityKey] || LOCAL_IMAGES; // Default to all local images
            
            // Filter out already used images
            const availableImages = images.filter(img => !usedImagesInCurrentSet.has(img));
            
            // If all images are used, reset and use all images again
            const imagesToUse = availableImages.length > 0 ? availableImages : images;
            
            // Select random image from available set
            const selectedImage = imagesToUse[Math.floor(Math.random() * imagesToUse.length)];
            
            // Mark as used
            usedImagesInCurrentSet.add(selectedImage);
            
            return selectedImage;
        }

        // Create property card element with modern design and Unsplash images
        function createPropertyCard(prop) {
            const card = document.createElement('div');
            card.className = 'property-card';
            
            const price = prop.priceUnit === 'rent' 
                ? `₹${(prop.price / 1000).toFixed(0)}k/mo`
                : prop.price >= 10000000
                ? `₹${(prop.price / 10000000).toFixed(1)}Cr`
                : `₹${(prop.price / 100000).toFixed(0)}L`;
            
            const title = `${prop.bhk}BHK ${prop.type} in ${prop.locality}`;
            // Fix "near near" issue: check if tag already starts with "Near"
            let localityLine = prop.locality;
            if (prop.tags.length > 0) {
                const tag = prop.tags[0];
                localityLine = tag.toLowerCase().startsWith('near') ? tag : `Near ${tag}`;
            }
            const amenityChips = prop.amenities.slice(0, 3).map(a => `<span class="property-chip">${a}</span>`).join('');
            
            // Get city-specific image (local path)
            const finalImageUrl = getListingImage(prop.city);
            
            // Heart icon SVGs - outline (default) and filled (clicked)
            const heartIconOutline = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M128,224S24,168,24,102A54,54,0,0,1,78,48c22.59,0,41.94,12.31,50,32,8.06-19.69,27.41-32,50-32a54,54,0,0,1,54,54C232,168,128,224,128,224Z" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="16"/></svg>`;
            const heartIconFilled = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256"><rect width="256" height="256" fill="none"/><path d="M240,102c0,70-103.79,126.66-108.21,129a8,8,0,0,1-7.58,0C119.79,228.66,16,172,16,102A62.07,62.07,0,0,1,78,40c20.65,0,38.73,8.88,50,23.89C139.27,48.88,157.35,40,178,40A62.07,62.07,0,0,1,240,102Z"/></svg>`;
            
            // Track saved state for this card
            let isSaved = false;
            
            card.innerHTML = `
                <div class="property-card__imgwrap">
                    <img class="property-card__img" src="${finalImageUrl}" alt="${title}" loading="eager" onerror="this.onerror=null; this.src='${DEFAULT_FALLBACK_IMAGE}';" />
                </div>
                <div class="property-card__body">
                    <div class="property-card__title">${title}</div>
                    <div class="property-card__price">${price}</div>
                    <div class="property-card__meta">${localityLine}</div>
                    <div class="property-card__chips">${amenityChips}</div>
                    <div class="property-card__actions">
                        <button class="property-cta">View details</button>
                        <button class="property-like" aria-label="Shortlist">${heartIconOutline}</button>
                    </div>
                </div>
            `;
            
            // Ensure image loads - add additional fallback after DOM insertion
            const img = card.querySelector('.property-card__img');
            if (img) {
                img.addEventListener('error', function() {
                    if (this.src !== DEFAULT_FALLBACK_IMAGE) {
                        this.src = DEFAULT_FALLBACK_IMAGE;
                    }
                });
                // Force load attempt by setting src again if not complete
                if (!img.complete && img.src) {
                    const currentSrc = img.src;
                    img.src = '';
                    img.src = currentSrc;
                }
            }
            
            // Add click handlers
            card.querySelector('.property-cta').addEventListener('click', () => {
                console.log('View details:', prop);
            });
            
            const likeButton = card.querySelector('.property-like');
            likeButton.addEventListener('click', () => {
                isSaved = !isSaved;
                likeButton.innerHTML = isSaved ? heartIconFilled : heartIconOutline;
                likeButton.classList.toggle('property-like--saved', isSaved);
                console.log(isSaved ? 'Saved:' : 'Unsaved:', prop);
            });
            
            return card;
        }

        // Overflow detector (dev mode)
        function checkOverflow(element) {
            if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
                return;
            }
            
            const rect = element.getBoundingClientRect();
            if (rect.right > window.innerWidth) {
                console.warn('Element overflow detected:', {
                    element: element.className,
                    right: rect.right,
                    viewportWidth: window.innerWidth,
                    overflow: rect.right - window.innerWidth
                });
            }
        }

        // Legacy render functions (kept for compatibility, but will be replaced)
        function renderChips(chips, msgId, isFollowUp = false) {
            // Deprecated - use renderBotTurn instead
            console.warn('renderChips is deprecated - use renderBotTurn');
        }

        function renderResults(results, msgId) {
            // Deprecated - use renderBotTurn instead
            console.warn('renderResults is deprecated - use renderBotTurn');
        }

        function renderSummary(summary, msgId) {
            // Deprecated - use renderBotTurn instead
            console.warn('renderSummary is deprecated - use renderBotTurn');
        }

        // Handle chip click - supports all modes
        function handleChipClick(chipText) {
            const lower = chipText.toLowerCase();
            
            // Category chips (rent/buy/pg/commercial/plot/projects)
            if (lower === 'rent' || lower === 'buy' || lower === 'pg' || lower === 'commercial' || lower === 'plot' || lower === 'projects') {
                chatState.category = lower;
                chatState.intentType = lower; // Backward compat
                addUserMessage(chipText);
                setTimeout(() => {
                    handleHousingIntent(chipText);
                }, 200);
            } else if (chipText.includes('₹') || chipText.includes('k') || chipText.includes('L') || chipText.includes('Cr')) {
                // Budget chip
                const match = chipText.match(/(\d+)(k|L|Cr)/i);
                if (match) {
                    let amount = parseInt(match[1]);
                    if (match[2].toLowerCase() === 'k') amount *= 1000;
                    else if (match[2].toLowerCase() === 'l') amount *= 100000;
                    else if (match[2].toLowerCase() === 'cr') amount *= 10000000;
                    chatState.budget = amount;
                    chatState.budgetMin = amount;
                    chatState.budgetMax = amount;
                    // Infer unit from category
                    const isRent = chatState.category === 'rent' || chatState.category === 'pg';
                    chatState.budgetUnit = isRent ? 'monthly' : 'total';
                }
                addUserMessage(chipText);
                setTimeout(() => {
                    handleHousingIntent(chipText);
                }, 200);
            } else if (lower.match(/\d+\s*(bhk|rk)/i)) {
                // BHK chip (e.g., "2BHK", "3BHK")
                const bhkMatch = lower.match(/(\d+)\s*(bhk|rk)/i);
                if (bhkMatch) {
                    chatState.bhk = parseInt(bhkMatch[1]);
                }
                addUserMessage(chipText);
                setTimeout(() => {
                    handleHousingIntent(chipText);
                }, 200);
            } else {
                // City or other
                const cities = ['gurgaon', 'mumbai', 'bangalore', 'delhi', 'pune', 'noida'];
                if (cities.some(c => chipText.toLowerCase().includes(c))) {
                    chatState.city = chipText.toLowerCase();
                }
                addUserMessage(chipText);
                setTimeout(() => {
                    handleHousingIntent(chipText);
                }, 200);
            }
        }

        // Detect gibberish (random characters, no meaningful words)
        function detectGibberish(text) {
            if (!text || typeof text !== 'string') {
                return false;
            }
            
            const normalized = text.trim().toLowerCase();
            
            // Very short (1-2 chars) is not gibberish
            if (normalized.length <= 2) {
                return false;
            }
            
            // Check if it's mostly random characters (no vowels, repeated chars, etc.)
            const hasVowels = /[aeiou]/i.test(normalized);
            const hasRepeatedChars = /(.)\1{3,}/.test(normalized); // Same char 4+ times
            const hasMeaningfulWords = /\b(rent|buy|pg|commercial|plot|project|bhk|delhi|mumbai|bangalore|gurgaon|pune|noida|hi|hello|hey|thanks|thank|you|what|where|how|when|why|is|are|the|a|an|in|on|at|for|to|of|with|from)\b/i.test(normalized);
            
            // If no vowels, lots of repeated chars, and no meaningful words → likely gibberish
            if (!hasVowels && hasRepeatedChars && !hasMeaningfulWords) {
                return true;
            }
            
            // If very short and no meaningful words
            if (normalized.length < 5 && !hasMeaningfulWords) {
                return true;
            }
            
            return false;
        }

        // Detect platform comparisons (Airbnb, Magicbricks, etc.)
        function detectPlatformComparison(text) {
            if (!text || typeof text !== 'string') return false;
            const normalized = text.trim().toLowerCase();
            const platforms = ['airbnb', 'magicbricks', '99acres', 'makaan', 'housing.com', 'nobroker', 'zomato', 'swiggy', 'olx', 'quikr'];
            return platforms.some(platform => normalized.includes(platform));
        }

        // Detect broker/phone/contact requests
        function detectBrokerRequest(text) {
            if (!text || typeof text !== 'string') return false;
            const normalized = text.trim().toLowerCase();
            const brokerKeywords = ['broker', 'agent', 'contact', 'phone', 'number', 'call', 'whatsapp', 'email', 'reach'];
            return brokerKeywords.some(keyword => normalized.includes(keyword));
        }

        // Generate greeting response with housing redirect (STRICT FORMAT)
        function generateGreetingResponse() {
            // Exact format: Polite acknowledgement + Redirect to housing + Open housing question
            // No emojis, semi-professional tone
            return "Hello. How can I help with your home search today?";
        }

        // Generate response for single letter or gibberish
        function generateSingleLetterResponse() {
            return "I did not understand that. Please share what you are looking for. For example, 2BHK for Rent in Rohini with a budget.";
        }

        // Generate polite redirect for non-housing questions (context-aware)
        function generateRedirectResponse(userText) {
            if (!userText) {
                return "I'm here to help with housing-related queries. Let me know what kind of home you're looking for.";
            }

            const normalized = userText.trim().toLowerCase();

            // Weather-related
            if (normalized.match(/\b(weather|temperature|rain|sunny|cloudy|forecast|aqi|air quality)\b/i)) {
                return "I can't help with the weather, but I can help you find a bright, well-ventilated home. What kind of place are you looking for?";
            }

            // Platform comparison
            if (detectPlatformComparison(userText)) {
                return "I can't help with other platforms, but I can help you explore verified listings and local insights here. What kind of property are you looking for?";
            }

            // Broker/contact request
            if (detectBrokerRequest(userText)) {
                return "To contact a seller or broker, you can open the property details page and submit a lead. I can help you find the right property to start with.";
            }

            // Default redirect for random facts/off-topic
            return "I focus on homes and localities. If you're exploring options to rent or buy, tell me your requirements.";
        }

        // Generate gibberish response
        function generateGibberishResponse() {
            return "I did not understand that. Please share what you are looking for. For example, 2BHK for Rent in Rohini with a budget.";
        }

        // Main housing intent handler with debug logging
        // Wrapped in try/catch to prevent crashes from breaking the chat loop
        function handleHousingIntent(userText) {
            try {
                // Step 1: Read input value (already done, but ensure we have it)
                const raw = userText;
                const normalized = userText ? userText.trim().toLowerCase() : '';
                
                // Step 2: Routing logic order (strict priority for NON-CORE conversations)
                // NON-CORE HANDLERS (text-only, no UI, no cards, no chips)
                
                // 1. Detect single letter or very short non-meaningful input
                if (normalized.length === 1 || (normalized.length <= 2 && !detectGreeting(userText) && !detectIntent(userText))) {
                    const singleLetterText = generateSingleLetterResponse();
                    typeBotReply(singleLetterText); // TEXT ONLY - no UI components
                    return;
                }
                
                // 2. Detect gibberish
                if (detectGibberish(userText)) {
                    const gibberishText = generateGibberishResponse();
                    typeBotReply(gibberishText); // TEXT ONLY - no UI components
                    return;
                }
                
                // 3. Detect greeting (NON-CORE - text only)
                const isGreeting = detectGreeting(userText);
                
                // 4. Detect housing intent (CORE) - STRICT ROUTING: GREETING → CORE → OTHER
                const intent = detectIntent(userText);
                const slots = extractParams(userText);
                const isCore = intent !== null || !!(slots.category || slots.intentType || slots.city || slots.locality || slots.bhk || slots.budget);
                
                // 5. Detect platform comparisons (NON-CORE - text only)
                if (detectPlatformComparison(userText) && !isCore) {
                    const redirectText = generateRedirectResponse(userText);
                    typeBotReply(redirectText); // TEXT ONLY - no UI components
                    return;
                }
                
                // 6. Detect broker requests (NON-CORE - text only)
                if (detectBrokerRequest(userText) && !isCore) {
                    const redirectText = generateRedirectResponse(userText);
                    typeBotReply(redirectText); // TEXT ONLY - no UI components
                    return;
                }
                
                // Step 3: Priority routing - if both greeting and housing, prioritize housing (CORE)
                if (isGreeting && isCore) {
                    // Mixed: greeting + housing query (e.g., "Hi, 3bhk in Rohini")
                    // Treat as CORE housing, skip greeting-only response
                    console.log('Intent Detection: Mixed greeting + housing - prioritizing housing');
                } else if (isGreeting && !isCore) {
                    // Pure greeting - respond with greeting + redirect (TEXT ONLY)
                    const greetingText = generateGreetingResponse();
                    typeBotReply(greetingText); // TEXT ONLY - no UI components
                    return;
                } else if (!isGreeting && !isCore) {
                    // Non-housing question - redirect (TEXT ONLY)
                    const redirectText = generateRedirectResponse(userText);
                    typeBotReply(redirectText); // TEXT ONLY - no UI components
                    return;
                }
                
                // Step 4: Debug logging for CORE housing intents
                if (isCore) {
                    const matchedSignals = [];
                    if (slots.category || slots.intentType || slots.mode) matchedSignals.push('category');
                    if (slots.bhk) matchedSignals.push('bhk');
                    if (slots.city) matchedSignals.push('city');
                    if (slots.locality) matchedSignals.push('locality');
                    if (slots.budget || slots.budgetMin || slots.budgetMax) matchedSignals.push('budget');
                    if (slots.propertyType || slots.type) matchedSignals.push('propertyType');
                    
                    // Debug logging
                    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
                        console.log('🔍 Intent Detection:', {
                            normalized: normalized,
                            isCore: isCore,
                            isGreeting: isGreeting,
                            detectedIntent: intent,
                            matchedSignals: matchedSignals,
                            extractedSlots: slots
                        });
                    }
                }
                
                // Step 5: Route based on intent
                if (!intent && !isCore) {
                    // Fallback for unmapped intents (NON-CORE - text only)
                    const redirectText = generateRedirectResponse(userText);
                    typeBotReply(redirectText); // TEXT ONLY - no UI components
                    return;
                }

                // Step 6: Handle core housing intent
                // Note: generateBotResponse will merge slots into chatState (without overwriting with null)
                const response = generateBotResponse(intent, userText);
                
                // Set bot responding state and update button
                isBotResponding = true;
                updateSendButtonState();
                
                // Use strict renderBotTurn contract
                const msgId = addBotMessage('');
                const msgEl = document.getElementById(msgId);
                if (!msgEl) return;
                
                // Type out the text first
                let i = 0;
                const fullText = response.text;
                
                if (typewriterTimer) {
                    clearInterval(typewriterTimer);
                }

                let lastWordCount = 0;
                
                typewriterTimer = setInterval(() => {
                    // Check if user stopped the response
                    if (!isBotResponding) {
                        clearInterval(typewriterTimer);
                        typewriterTimer = null;
                        // Finalize message in current state
                        renderBotTurn({
                            text: fullText.slice(0, i),
                            chips: response.chips || null,
                            carousel: response.results || null,
                            trendCard: response.trendCard || null
                        }, msgId);
                        return;
                    }
                    
                    i++;
                    const currentText = fullText.slice(0, i);
                    updateMessageText(msgId, currentText);
                    
                    // Detect new word: count words in current text
                    const currentWordCount = currentText.trim().split(/\s+/).filter(w => w.length > 0).length;
                    
                    // Subtle haptic feedback when a new word appears
                    if (currentWordCount > lastWordCount && navigator.vibrate) {
                        navigator.vibrate(5); // Very subtle 5ms vibration
                        lastWordCount = currentWordCount;
                    }
                    
                    if (i >= fullText.length) {
                        clearInterval(typewriterTimer);
                        typewriterTimer = null;
                        isBotResponding = false;
                        updateSendButtonState();
                        
                        // Render using strict contract after typing completes
                        setTimeout(() => {
                            // Render using strict contract (reuse existing message)
                            // No followUp - everything is in one response (text + chips + carousel)
                            renderBotTurn({
                                text: response.text,
                                chips: response.chips || null,
                                carousel: response.results || null,
                                trendCard: response.trendCard || null
                            }, msgId);
                        }, 100);
                    }
                }, 55);
            } catch (error) {
                // Fallback: safe bot response if parsing fails
                console.error('Error handling housing intent:', error);
                const fallbackText = "I can help with property search and locality insights. What are you looking for?";
                typeBotReply(fallbackText);
            }
        }

        // Test harness for intent detection
        function runIntentTests() {
            const tests = [
                { input: 'rent', expected: 'CORE' },
                { input: 'buy', expected: 'CORE' },
                { input: '3bhk in delhi', expected: 'CORE' },
                { input: '3 bhk in delhi', expected: 'CORE' },
                { input: 'delhi', expected: 'CORE' },
                { input: 'villa in bangalore', expected: 'CORE' },
                { input: 'aqi today', expected: 'OTHER' },
                { input: 'dfsdfsdf', expected: 'OTHER' }
            ];

            console.log('=== Intent Detection Tests ===');
            tests.forEach(test => {
                const intent = detectIntent(test.input);
                const result = intent ? 'CORE' : 'OTHER';
                const passed = result === test.expected;
                console.log(`${passed ? '✅' : '❌'} "${test.input}" → ${result} (expected: ${test.expected})`);
                if (!passed) {
                    console.log('  Details:', { intent, normalized: test.input.trim().toLowerCase() });
                }
            });
            console.log('=== End Tests ===');
        }

        // Run tests in dev mode
        if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
            setTimeout(runIntentTests, 1000);
        }
    })();
});

// ============================================================================
// PLATFORM PARITY LAYER
// ============================================================================
// Single source of truth for iOS + Android behavior parity
// Uses feature detection, not UA sniffing (unless absolutely required)
// ============================================================================

// Debug toggle (set window.__CHAT_DEBUG__ = true in console to enable)
window.__CHAT_DEBUG__ = window.__CHAT_DEBUG__ || false;

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

// Helpers: throttle/debounce for resize/scroll handlers (reduce layout thrash)
function throttle(fn, ms) {
    let last = 0;
    return function throttled() {
        const now = performance.now();
        if (now - last >= ms) { last = now; fn(); }
    };
}
function debounce(fn, ms) {
    let t = null;
    return function debounced() {
        if (t) clearTimeout(t);
        t = setTimeout(() => { t = null; fn(); }, ms);
    };
}

// Constants
const MOBILE_MAX_WIDTH = 480;
const DESKTOP_LAYOUT_MIN = 1024;
/** Shared desktop split motion — keep in sync with CSS --houzy-split-* */
var DESKTOP_SPLIT_MS = 560;
var DESKTOP_SPLIT_EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';

function isDesktopLayout() {
    return window.innerWidth >= DESKTOP_LAYOUT_MIN
        && !document.body.classList.contains('force-mobile-demo');
}

function isDesktopSplit() {
    return isDesktopLayout() && document.body.classList.contains('desktop-split');
}

/** Split only for property / Housing.com handoff — Claude-style 50:50 from the side */
var __houzySplitExitTimer = null;

function enterDesktopSplit() {
    if (!isDesktopLayout()) return;
    ensureDesktopComposerDocked();

    if (__houzySplitExitTimer) {
        clearTimeout(__houzySplitExitTimer);
        __houzySplitExitTimer = null;
    }

    const wasSplit = document.body.classList.contains('desktop-split');
    const stage = document.getElementById('desktop-stage');
    const chat = document.querySelector('.chat-screen');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (stage) {
        stage.hidden = false;
        stage.removeAttribute('hidden');
        stage.setAttribute('aria-hidden', 'false');
    }

    if (!wasSplit) {
        document.body.classList.add('desktop-splitting');
        if (!reduceMotion) {
            document.body.classList.add('desktop-split-willchange');
            if (stage) stage.style.willChange = 'transform, opacity';
            if (chat) chat.style.willChange = 'width, max-width, min-width';
        }
        if (stage) stage.classList.remove('desktop-stage--entered');
        // Park stage off-canvas, then open — lets width + slide share one easing curve
        document.body.classList.add('desktop-split');
        void (stage && stage.offsetWidth);
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                if (stage) stage.classList.add('desktop-stage--entered');
                document.body.classList.add('desktop-split--open');
                document.body.classList.remove('desktop-splitting');
                if (!reduceMotion) {
                    setTimeout(clearDesktopSplitWillChange, DESKTOP_SPLIT_MS + 40);
                }
            });
        });
    } else {
        document.body.classList.add('desktop-split', 'desktop-split--open');
        if (stage) stage.classList.add('desktop-stage--entered');
    }

    if (typeof setChatOffsets === 'function') setChatOffsets();
    if (typeof window.__houzyRemeasureChips === 'function') {
        requestAnimationFrame(function() {
            window.__houzyRemeasureChips();
        });
    }
}

function exitDesktopSplit() {
    const stage = document.getElementById('desktop-stage');
    const wasOpen = document.body.classList.contains('desktop-split');

    document.body.classList.remove('desktop-split--open', 'desktop-splitting');
    if (stage) stage.classList.remove('desktop-stage--entered');
    document.body.classList.remove('desktop-split');

    function finishExit() {
        __houzySplitExitTimer = null;
        if (document.body.classList.contains('desktop-split')) return;
        if (stage) {
            stage.hidden = true;
            stage.setAttribute('aria-hidden', 'true');
        }
        ['desktop-stage-listings', 'desktop-stage-photos', 'desktop-stage-pdp', 'desktop-stage-housing'].forEach(function(id) {
            const el = document.getElementById(id);
            if (!el) return;
            el.hidden = true;
            if (id === 'desktop-stage-pdp' || id === 'desktop-stage-housing') el.innerHTML = '';
            if (id === 'desktop-stage-photos') {
                const mosaic = document.getElementById('desktop-stage-photos-mosaic');
                if (mosaic) mosaic.innerHTML = '';
            }
        });
        const empty = document.getElementById('desktop-stage-empty');
        if (empty) empty.hidden = false;
        if (typeof setChatOffsets === 'function') setChatOffsets();
        if (typeof window.__houzyRemeasureChips === 'function') {
            requestAnimationFrame(function() {
                window.__houzyRemeasureChips();
            });
        }
    }

    if (wasOpen) {
        if (__houzySplitExitTimer) clearTimeout(__houzySplitExitTimer);
        __houzySplitExitTimer = setTimeout(finishExit, DESKTOP_SPLIT_MS);
    } else {
        finishExit();
    }
}

/** Layout rect of el as if ancestor's current transform were identity (final split pose). */
function getSplitSettledRect(el, transformedAncestor) {
    const rect = el.getBoundingClientRect();
    if (!transformedAncestor) {
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    const t = getComputedStyle(transformedAncestor).transform;
    if (!t || t === 'none') {
        return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
    }
    const m = new DOMMatrixReadOnly(t);
    return {
        left: rect.left - m.m41,
        top: rect.top - m.m42,
        width: rect.width,
        height: rect.height
    };
}

function clearDesktopSplitWillChange() {
    const stage = document.getElementById('desktop-stage');
    const chat = document.querySelector('.chat-screen');
    if (stage) stage.style.willChange = '';
    if (chat) chat.style.willChange = '';
    document.body.classList.remove('desktop-split-willchange');
}

/** Soft fly from a property card image into the stage hero (shared easing with split). */
function animateCardIntoDesktopSplit(sourceEl) {
    if (!isDesktopLayout() || !sourceEl || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return null;
    }
    const img = sourceEl.matches && sourceEl.matches('img')
        ? sourceEl
        : (sourceEl.querySelector && sourceEl.querySelector('img.property-card__img, img'));
    if (!img) return null;
    const from = img.getBoundingClientRect();
    if (from.width < 12 || from.height < 12) return null;

    document.querySelectorAll('.desktop-split-ghost').forEach(function(g) { g.remove(); });

    const prevImgOpacity = img.style.opacity;
    const prevImgTransition = img.style.transition;
    img.style.transition = 'opacity 0.18s ease';
    img.style.opacity = '0.35';

    const dur = (DESKTOP_SPLIT_MS / 1000) + 's';
    const ease = DESKTOP_SPLIT_EASE;
    const ghost = document.createElement('img');
    ghost.className = 'desktop-split-ghost';
    ghost.src = img.currentSrc || img.src;
    ghost.alt = '';
    ghost.setAttribute('aria-hidden', 'true');
    ghost.style.cssText = [
        'position:fixed',
        'left:' + from.left + 'px',
        'top:' + from.top + 'px',
        'width:' + from.width + 'px',
        'height:' + from.height + 'px',
        'object-fit:cover',
        'border-radius:14px',
        'z-index:10050',
        'margin:0',
        'pointer-events:none',
        'box-shadow:0 18px 48px rgba(40,20,80,0.22)',
        'transform:translateZ(0)',
        'opacity:1',
        'will-change:left, top, width, height, border-radius, opacity, box-shadow',
        'transition:left ' + dur + ' ' + ease +
            ', top ' + dur + ' ' + ease +
            ', width ' + dur + ' ' + ease +
            ', height ' + dur + ' ' + ease +
            ', border-radius ' + dur + ' ' + ease +
            ', box-shadow ' + dur + ' ' + ease +
            ', opacity 0.16s ease ' + ((DESKTOP_SPLIT_MS - 150) / 1000) + 's'
    ].join(';');
    document.body.appendChild(ghost);

    var settled = false;
    function restoreSourceImg() {
        img.style.transition = prevImgTransition || '';
        img.style.opacity = prevImgOpacity || '';
    }

    return function settleGhost(heroImgEl) {
        if (settled) return;
        settled = true;
        const hero = heroImgEl || document.querySelector(
            '#desktop-stage-pdp .houzy-pdp__hero-img, #desktop-stage-housing .desktop-housing__hero img'
        );
        const stage = document.getElementById('desktop-stage');
        var to = null;
        if (hero) {
            to = getSplitSettledRect(hero, stage);
        } else if (stage) {
            const stageTo = getSplitSettledRect(stage, stage);
            to = {
                left: stageTo.left,
                top: stageTo.top + 48,
                width: Math.max(240, stageTo.width),
                height: Math.min(320, Math.max(240, window.innerHeight * 0.42))
            };
        }
        if (!to || to.width < 8) {
            restoreSourceImg();
            ghost.remove();
            if (hero) {
                hero.style.opacity = '1';
            }
            const pdpFail = document.querySelector('#desktop-stage-pdp .houzy-pdp--desktop');
            if (pdpFail) pdpFail.classList.remove('houzy-pdp--morphing');
            const housingFail = document.querySelector('#desktop-stage-housing .desktop-housing');
            if (housingFail) housingFail.classList.remove('desktop-housing--morphing');
            clearDesktopSplitWillChange();
            return;
        }

        // Ensure the browser commits the "from" styles before animating to the settled hero.
        void ghost.offsetWidth;
        requestAnimationFrame(function() {
            ghost.style.left = to.left + 'px';
            ghost.style.top = to.top + 'px';
            ghost.style.width = to.width + 'px';
            ghost.style.height = to.height + 'px';
            ghost.style.borderRadius = '0';
            ghost.style.boxShadow = '0 8px 28px rgba(40,20,80,0.1)';
            ghost.style.opacity = '0';
        });

        const revealAt = Math.max(0, DESKTOP_SPLIT_MS - 140);
        setTimeout(function() {
            if (hero) {
                hero.style.transition = 'opacity 0.18s ease';
                hero.style.opacity = '1';
            }
            const pdp = document.querySelector('#desktop-stage-pdp .houzy-pdp--desktop');
            if (pdp) pdp.classList.remove('houzy-pdp--morphing');
            const housing = document.querySelector('#desktop-stage-housing .desktop-housing');
            if (housing) housing.classList.remove('desktop-housing--morphing');
        }, revealAt);

        setTimeout(function() {
            restoreSourceImg();
            ghost.style.willChange = '';
            if (ghost.parentNode) ghost.remove();
            clearDesktopSplitWillChange();
        }, DESKTOP_SPLIT_MS + 80);
    };
}

/**
 * Desktop: soft-animate Ask Houzy from mid-screen → sticky bottom footer
 * (triggered when the user sends their first message).
 */
function ensureDesktopComposerDocked() {
    if (!isDesktopLayout()) return;
    const chat = document.getElementById('chat-screen');
    if (!chat || chat.classList.contains('composer-docked')) return;

    const bar = chat.querySelector('.chat-input-bar');
    const first = bar ? bar.getBoundingClientRect() : null;

    chat.classList.add('composer-docked', 'composer-docking');

    if (bar && first && first.height > 0) {
        const last = bar.getBoundingClientRect();
        const dy = first.top - last.top;
        if (Math.abs(dy) > 2) {
            bar.style.transition = 'none';
            bar.style.transform = 'translateY(' + dy + 'px)';
            // Force reflow, then ease into place
            void bar.offsetWidth;
            requestAnimationFrame(function() {
                bar.style.transition = 'transform 0.48s cubic-bezier(0.22, 1, 0.36, 1)';
                bar.style.transform = 'translateY(0)';
            });
            const clearDockAnim = function() {
                bar.style.transition = '';
                bar.style.transform = '';
                chat.classList.remove('composer-docking');
                bar.removeEventListener('transitionend', clearDockAnim);
            };
            bar.addEventListener('transitionend', clearDockAnim);
            setTimeout(clearDockAnim, 600);
        } else {
            chat.classList.remove('composer-docking');
        }
    } else {
        chat.classList.remove('composer-docking');
    }

    if (typeof setChatOffsets === 'function') {
        requestAnimationFrame(function() {
            setChatOffsets();
        });
    }
}

function buildHousingRedirectUrl(card) {
    const locality = encodeURIComponent((card && (card.locality || card.location)) || 'India');
    const name = encodeURIComponent((card && card.name) || '');
    if (name) {
        return 'https://housing.com/in/buy/search/' + locality + '?q=' + name;
    }
    return 'https://housing.com/in/buy/search/' + locality;
}
const SLIDER_WIDTH = 52;
const SLIDER_HEIGHT = 36;
const DRAG_CLOSE_THRESHOLD = 80;
const TOP_AREA_THRESHOLD = 100;
const TAP_THRESHOLD = 15;
const TAP_TIME_THRESHOLD = 300;

// Global handler for Houzy bottom nav (button, icon wrapper, image). Uses app's real chat navigation.
function openAiChatScreen(e) {
    if (e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (window.__CHAT_DEBUG__) console.log('Houzy clicked');
    var trigger = document.getElementById('ai-chat-trigger');
    if (typeof window.__openAiChatScreenImpl === 'function' && trigger) {
        window.__openAiChatScreenImpl(trigger);
        return;
    }
    if (typeof navigateTo === 'function') {
        navigateTo('chat');
        return;
    }
    if (typeof showScreen === 'function') {
        showScreen('ai-chat');
        return;
    }
    // GitHub Pages / single-page: no ai-chat.html — open chat on index
    var cs = document.getElementById('chat-screen');
    if (cs) {
        cs.classList.add('slide-from-right');
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(function() {
            requestAnimationFrame(function() {
                cs.classList.add('active');
                if (typeof primeViewport === 'function') primeViewport();
            });
        });
        var bb = document.getElementById('chat-back-btn');
        if (bb) {
            bb.removeAttribute('disabled');
            bb.removeAttribute('tabindex');
        }
        return;
    }
    window.location.href = 'index.html';
}

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
        if (window.__CHAT_DEBUG__) console.log('Header top:', headerTop, 'KB height:', kb, 'VV height:', vv.height);
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

// Sync heights on resize and orientation change (debounced to reduce layout thrash)
const syncOnResize = debounce(() => { syncHeights(); syncKeyboard(); }, 120);
window.addEventListener('resize', syncOnResize);
window.addEventListener('orientationchange', syncOnResize);

// Use visualViewport for Android keyboard compatibility (throttled during keyboard animation)
if (window.visualViewport) {
    const syncOnVV = throttle(() => { syncHeights(); syncKeyboard(); }, 100);
    window.visualViewport.addEventListener('resize', syncOnVV);
    window.visualViewport.addEventListener('scroll', syncOnVV);
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
        if (window.__CHAT_DEBUG__) console.log('focusin - headerTop:', headerTop, 'kb:', kb, 'iOS:', isIOSDevice);
    }
}, { passive: true });

// DOM element cache
let desktopBlocker, mobileContainer, bottomSheet, bottomSheetContent, bottomSheetOverlay, bottomSheetCloseBtn;
let bottomSheetHandle, bottomSheetBody, scoutyGreetingText, scoutyCTA;
let navItems, navSliderBg, bottomNav;

// Viewport gate: phone ≤480, tablet blocker 481–1023, split d-web ≥1024
function checkMobileDevice() {
    const width = window.innerWidth;
    const forcePhone = document.body.classList.contains('force-mobile-demo');
    const desktop = width >= DESKTOP_LAYOUT_MIN && !forcePhone;
    const showBlocker = width > MOBILE_MAX_WIDTH && !forcePhone && !desktop;

    document.body.classList.toggle('desktop-layout', desktop);

    if (desktopBlocker) {
        desktopBlocker.style.display = showBlocker ? 'flex' : 'none';
    }
    if (mobileContainer) {
        mobileContainer.style.display = (desktop || showBlocker) ? 'none' : '';
    }

    const stage = document.getElementById('desktop-stage');
    const chat = document.getElementById('chat-screen');

    if (desktop) {
        if (chat) {
            chat.classList.add('active');
            chat.classList.remove('slide-from-right');
        }
        if (bottomNav) bottomNav.style.display = 'none';
        if (typeof setChatOffsets === 'function') setChatOffsets();
        // Full-width conversation by default; stage only while split (property / Housing)
        if (stage) {
            stage.hidden = !document.body.classList.contains('desktop-split');
        }
        const intro = document.getElementById('chat-intro');
        if (intro && intro.classList.contains('initial-load') && !intro.classList.contains('revealed')) {
            requestAnimationFrame(function() {
                intro.classList.add('revealed');
            });
        }
        if (typeof window.__houzyRemeasureChips === 'function') {
            requestAnimationFrame(function() {
                window.__houzyRemeasureChips();
            });
        }
        if (document.body.classList.contains('desktop-split') &&
            window.__houzyDesktop && typeof window.__houzyDesktop.syncListings === 'function') {
            window.__houzyDesktop.syncListings();
        }
    } else {
        document.body.classList.remove('desktop-split');
        if (stage) stage.hidden = true;
        if (bottomNav && !showBlocker) bottomNav.style.display = '';
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

    // Allow continuing the mobile demo on desktop (property cards / Houzy flows)
    const desktopContinueBtn = document.getElementById('desktop-continue-btn');
    if (desktopContinueBtn) {
        desktopContinueBtn.addEventListener('click', function() {
            document.body.classList.add('force-mobile-demo');
            const blocker = document.getElementById('desktop-blocker');
            if (blocker) blocker.style.display = 'none';
        });
    }
    
    // Land on homepage on phone; d-web opens chat with floating pills immediately
    const chatScreenEl = document.getElementById('chat-screen');
    const chatIntroEl = document.getElementById('chat-intro');
    if (chatScreenEl) {
        if (typeof isDesktopLayout === 'function' && isDesktopLayout()) {
            chatScreenEl.classList.add('active');
            chatScreenEl.classList.remove('slide-from-right');
            document.body.classList.add('desktop-layout');
            if (chatIntroEl && chatIntroEl.classList.contains('initial-load')) {
                requestAnimationFrame(function() {
                    chatIntroEl.classList.add('revealed');
                });
            }
        } else {
            chatScreenEl.classList.remove('active');
        }
        // When user later opens chat on mobile, primeViewport and intro reveal run from nav handler
    }
    
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
                if (window.__CHAT_DEBUG__) console.log('Searching for:', searchInput.value);
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
                    currentTimeout = setTimeout(typeChar, 35);
                } else {
                    partIndex++;
                    charIndex = 0;
                    currentTimeout = setTimeout(typeChar, 45);
                }
            } else {
                // Animation complete
                hasAnimated = true;
                isAnimating = false;
                setTimeout(() => {
                    if (scoutyCTA && bottomSheet.classList.contains('active')) {
                        scoutyCTA.style.display = 'flex';
                    }
                }, 200);
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
        if (window.__CHAT_DEBUG__) console.log('Navigated to:', navType);
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
        if (window.__CHAT_DEBUG__) console.error('Nav items not found!');
    } else {
        if (window.__CHAT_DEBUG__) console.log('Found', navItems.length, 'nav items');
    }
    
    // Single app navigation: open AI chat screen (homepage bottom nav Houzy)
    function openAiChatScreen(activeNavItem) {
        sessionStorage.setItem('houzySplashSeen', 'true');
        var chatScreen = document.getElementById('chat-screen');
        var chatIntroEl = document.getElementById('chat-intro');
        var chatBackBtn = document.getElementById('chat-back-btn');
        if (navItems && navItems.length && activeNavItem) {
            navItems.forEach(function(nav) { nav.classList.remove('active'); });
            activeNavItem.classList.add('active');
            if (navSliderBg && bottomNav) updateSliderPosition(activeNavItem, true);
        }
        if (chatScreen) {
            if (!document.body.dataset.returnToCase1 && chatBackBtn) {
                chatBackBtn.removeAttribute('disabled');
                chatBackBtn.removeAttribute('tabindex');
            }
            chatScreen.classList.add('slide-from-right');
            document.body.style.overflow = 'hidden';
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    chatScreen.classList.add('active');
                    if (typeof primeViewport === 'function') primeViewport();
                    function revealIntro() {
                        if (chatIntroEl && chatIntroEl.classList.contains('initial-load')) {
                            chatIntroEl.classList.add('revealed');
                        }
                    }
                    if (chatScreen.classList.contains('slide-from-right')) {
                        chatScreen.addEventListener('transitionend', function onSlideEnd(ev) {
                            if (ev.target === chatScreen && ev.propertyName === 'transform') {
                                chatScreen.removeEventListener('transitionend', onSlideEnd);
                                revealIntro();
                            }
                        });
                        setTimeout(revealIntro, 400);
                    } else {
                        setTimeout(revealIntro, 100);
                    }
                });
            });
        }
    }
    window.__openAiChatScreenImpl = openAiChatScreen;

    // Attach event listeners directly to each nav item
    if (navItems && navItems.length > 0) {
        navItems.forEach((item) => {
            if (!item) return;
            
            const navType = item.getAttribute('data-nav');
            if (!navType) return;
            
            // Chat item uses inline onclick (button, wrapper, image); do not overwrite so those handlers run
            if (navType === 'chat') return;
            
            const handleNavClick = function(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                if (window.__CHAT_DEBUG__) console.log('Nav clicked:', navType);
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');
                if (navSliderBg && bottomNav) updateSliderPosition(item, true);
                // Saved: open the Houzy welcome / onboarding bottom sheet (same as first-time flow)
                if (navType === 'saved') {
                    openBottomSheet();
                }
            };
            
            item.onclick = handleNavClick;
            item.ontouchend = function(e) {
                if (e) {
                    e.preventDefault();
                    e.stopPropagation();
                }
                handleNavClick(e);
            };
        });
    }
    
    // Houzy item is handled by inline openAiChatScreen(event); no delegated handler so no double-call

    // Houzy nav uses inline onclick on button, icon wrapper, and image (openAiChatScreen); no overlay.

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
    
    if (chatBackBtn && chatScreen) {
        chatBackBtn.addEventListener('click', function() {
            var returnId = document.body.dataset.returnToCase1;
            if (returnId) {
                // Back from chat when opened from SRP/case page: return to that page
                var casePage = document.getElementById(returnId);
                if (casePage) {
                    casePage.style.display = '';
                    casePage.style.visibility = '';
                    casePage.style.zIndex = '';
                }
                chatScreen.classList.remove('active');
                chatBackBtn.setAttribute('disabled', '');
                chatBackBtn.setAttribute('tabindex', '-1');
                delete document.body.dataset.returnToCase1;
                document.body.style.overflow = '';
            } else {
                // Back from chat when opened from homepage: slide out then return to homepage
                var hadSlide = chatScreen.classList.contains('slide-from-right');
                chatScreen.classList.remove('active');
                if (hadSlide) {
                    chatScreen.addEventListener('transitionend', function onOut() {
                        chatScreen.removeEventListener('transitionend', onOut);
                        chatScreen.classList.remove('slide-from-right');
                    });
                } else {
                    chatScreen.classList.remove('slide-from-right');
                }
                chatBackBtn.setAttribute('disabled', '');
                chatBackBtn.setAttribute('tabindex', '-1');
                document.body.style.overflow = '';
                var homeNav = document.querySelector('.nav-item[data-nav="home"]');
                if (homeNav) {
                    var navItems = document.querySelectorAll('.nav-item');
                    navItems.forEach(function(n) { n.classList.remove('active'); });
                    homeNav.classList.add('active');
                    setTimeout(function() { window.dispatchEvent(new Event('resize')); }, 50);
                }
            }
        });
    }
    
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
            // Open chat screen with slide-in from right (same as homepage Houzy click)
            if (chatScreen) {
                chatScreen.classList.add('slide-from-right');
                document.body.style.overflow = 'hidden';
                var chatBackBtn = document.getElementById('chat-back-btn');
                if (chatBackBtn) {
                    chatBackBtn.removeAttribute('disabled');
                    chatBackBtn.removeAttribute('tabindex');
                }
                requestAnimationFrame(() => {
                    requestAnimationFrame(() => {
                        chatScreen.classList.add('active');
                        primeViewport();
                    });
                });
            }
        });
    }
    
    // ============================================================================
    // PILLS AUTO-SCROLL: Two independent marquee tracks (no gaps, smooth scroll)
    // Root cause of past jerk: (1) Integer px rounding ignored devicePixelRatio
    // so subpixel positions caused frame-to-frame shimmer; (2) No dt cap so
    // tab visibility resume could advance one huge step. Fix: DPR snap + dt cap.
    // ============================================================================
    (function() {
        const marquee = document.getElementById('chipsRail');
        const track = document.getElementById('chipsTrack');
        if (!marquee || !track) {
            if (window.__CHAT_DEBUG__) console.warn('chipsMarquee/chipsRail or chipsTrack not found');
            return;
        }

        const chipsSet = track.querySelector('.chips-set');
        const row1 = chipsSet && chipsSet.querySelector('.chat-starter-pills-row:nth-child(1)');
        const row2 = chipsSet && chipsSet.querySelector('.chat-starter-pills-row:nth-child(2)');
        if (!row1 || !row2) return;

        const pills1 = Array.from(row1.children);
        const pills2 = Array.from(row2.children);
        if (pills1.length === 0 || pills2.length === 0) return;

        // Row 2: same pills shifted (e.g. start from index 3) for visual variety
        const ROW2_SHIFT = 3;
        const pills2Shifted = pills2.slice(ROW2_SHIFT).concat(pills2.slice(0, ROW2_SHIFT));

        const wrapper = document.createElement('div');
        wrapper.className = 'chips-tracks-wrapper';
        const viewport1 = document.createElement('div');
        viewport1.className = 'chips-row-viewport';
        const viewport2 = document.createElement('div');
        viewport2.className = 'chips-row-viewport';
        const track1 = document.createElement('div');
        track1.className = 'chips-track';
        const track2 = document.createElement('div');
        track2.className = 'chips-track';
        viewport1.appendChild(track1);
        viewport2.appendChild(track2);
        wrapper.appendChild(viewport1);
        wrapper.appendChild(viewport2);
        marquee.appendChild(wrapper);

        const MIN_MULTIPLE = 2.5;
        let viewportWidthCached = 0;
        let trackWidthCached = 0;
        let loopWidthCached = 0;
        let duplicateCountCached = 0;

        function fillTrack(trackEl, pillSource) {
            const vw = marquee.getBoundingClientRect().width;
            const minTarget = vw * MIN_MULTIPLE;
            let count = 0;
            for (let i = 0; i < pillSource.length; i++) {
                trackEl.appendChild(pillSource[i].cloneNode(true));
                count++;
            }
            let segmentW = trackEl.getBoundingClientRect().width;
            while (trackEl.getBoundingClientRect().width < minTarget) {
                for (let i = 0; i < pillSource.length; i++) {
                    trackEl.appendChild(pillSource[i].cloneNode(true));
                    count++;
                }
            }
            return { segmentWidth: segmentW, count: Math.ceil(count / pillSource.length) };
        }

        const r1 = fillTrack(track1, pills1);
        const r2 = fillTrack(track2, pills2Shifted);
        viewportWidthCached = marquee.getBoundingClientRect().width;
        trackWidthCached = track1.scrollWidth;
        loopWidthCached = r1.segmentWidth;
        duplicateCountCached = Math.round(track1.scrollWidth / loopWidthCached);

        marquee.removeChild(track);

        let x = 0;
        let last = 0;
        const speed = 12;
        let isDragging = false;
        let isPaused = false;
        let pauseUntil = 0;
        let activePointerId = null;
        let dragStartX = 0;
        let dragStartOffset = 0;
        let momentumVelocity = 0;
        let lastDragX = 0;
        let lastDragTime = 0;
        const friction = 0.95;
        const minVelocity = 0.5;
        let resumeTimer = null;
        let lastMoveAt = 0;

        function now() { return performance.now(); }
        function pause(ms) {
            isPaused = true;
            pauseUntil = Date.now() + (ms || 900);
            clearTimeout(resumeTimer);
            resumeTimer = setTimeout(() => { isPaused = false; }, ms || 900);
        }
        function hardResume() {
            isDragging = false;
            isPaused = false;
            pauseUntil = 0;
            activePointerId = null;
        }

        function applyX(val) {
            const dpr = window.devicePixelRatio || 1;
            const snappedX = Math.round(val * dpr) / dpr;
            track1.style.transform = `translate3d(${snappedX}px,0,0)`;
            track2.style.transform = `translate3d(${snappedX}px,0,0)`;
        }

        function wrapX(pos) {
            const lw = loopWidthCached;
            if (lw <= 0) return pos;
            while (pos <= -lw) pos += lw;
            while (pos >= lw) pos -= lw;
            return pos;
        }

        const MAX_DT = 0.05;
        function tick(t) {
            if (document.hidden) {
                last = t;
                requestAnimationFrame(tick);
                return;
            }
            if (!last) last = t;
            let dt = (t - last) / 1000;
            dt = dt > MAX_DT ? MAX_DT : dt;
            last = t;
            const canAuto = !isDragging && (!isPaused || Date.now() > pauseUntil);
            if (isDragging) {
                requestAnimationFrame(tick);
                return;
            }
            if (momentumVelocity !== 0) {
                x += momentumVelocity * dt;
                momentumVelocity *= friction;
                if (Math.abs(momentumVelocity) < minVelocity) {
                    momentumVelocity = 0;
                    pause(100);
                }
                x = wrapX(x);
                applyX(x);
            } else if (canAuto) {
                x -= speed * dt;
                if (loopWidthCached > 0) {
                    if (x <= -loopWidthCached) x += loopWidthCached;
                }
                applyX(x);
            }
            requestAnimationFrame(tick);
        }

        marquee.addEventListener('pointerdown', (e) => {
            isDragging = true;
            activePointerId = e.pointerId;
            lastMoveAt = now();
            if (marquee.setPointerCapture) marquee.setPointerCapture(e.pointerId);
            isPaused = true;
            pauseUntil = Date.now() + 999999;
            momentumVelocity = 0;
            dragStartX = e.clientX;
            dragStartOffset = x;
            lastDragX = e.clientX;
            lastDragTime = now();
        });

        marquee.addEventListener('pointermove', (e) => {
            if (!isDragging || e.pointerId !== activePointerId) return;
            lastMoveAt = now();
            const dt = (now() - lastDragTime) / 1000;
            const dx = e.clientX - dragStartX;
            x = dragStartOffset + dx;
            if (dt > 0) momentumVelocity = (e.clientX - lastDragX) / dt;
            lastDragX = e.clientX;
            lastDragTime = now();
            applyX(x);
        });

        function endDrag() {
            if (!isDragging) return;
            isDragging = false;
            activePointerId = null;
            x = wrapX(x);
            applyX(x);
            pause(850);
        }

        marquee.addEventListener('pointerup', endDrag);
        marquee.addEventListener('pointercancel', endDrag);
        marquee.addEventListener('lostpointercapture', endDrag);
        window.addEventListener('blur', hardResume);
        document.addEventListener('visibilitychange', () => { if (document.hidden) hardResume(); });

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
                const dt = (now() - lastDragTime) / 1000;
                x = dragStartOffset + (e.touches[0].clientX - dragStartX);
                if (dt > 0) momentumVelocity = (e.touches[0].clientX - lastDragX) / dt;
                lastDragX = e.touches[0].clientX;
                lastDragTime = now();
                applyX(x);
            }, { passive: false });
            marquee.addEventListener('touchend', endDrag, { passive: true });
            marquee.addEventListener('touchcancel', endDrag, { passive: true });
        }

        setInterval(() => {
            if (isDragging && (now() - lastMoveAt > 200)) endDrag();
        }, 150);

        requestAnimationFrame(tick);

        // Rebuild track fill when chat column width changes (desktop split)
        function remeasureChips() {
            const vw = marquee.getBoundingClientRect().width;
            if (vw < 40) return;
            if (Math.abs(vw - viewportWidthCached) < 8) return;
            track1.innerHTML = '';
            track2.innerHTML = '';
            const nr1 = fillTrack(track1, pills1);
            fillTrack(track2, pills2Shifted);
            viewportWidthCached = vw;
            trackWidthCached = track1.scrollWidth;
            loopWidthCached = nr1.segmentWidth || loopWidthCached;
            duplicateCountCached = loopWidthCached
                ? Math.round(track1.scrollWidth / loopWidthCached)
                : duplicateCountCached;
            x = wrapX(x);
            applyX(x);
        }
        window.__houzyRemeasureChips = remeasureChips;
        window.addEventListener('resize', debounce(remeasureChips, 150));

        if (window.__CHIPS_DEBUG__) {
            const debugEl = document.createElement('div');
            debugEl.style.cssText = 'position:fixed;top:10px;right:10px;background:rgba(0,0,0,0.8);color:#fff;padding:8px;font-size:11px;font-family:monospace;z-index:99999;border-radius:4px;max-width:220px;';
            document.body.appendChild(debugEl);
            function updateDebug() {
                debugEl.textContent = [
                    'viewportWidth: ' + viewportWidthCached,
                    'trackWidth: ' + trackWidthCached,
                    'loopWidth: ' + loopWidthCached,
                    'duplicateCount: ' + duplicateCountCached,
                    'isDragging: ' + isDragging,
                    'isPaused: ' + isPaused
                ].join('\n');
            }
            setInterval(updateDebug, 300);
        }
    })();
    
    // Floating pills stay visible until Send — never hide on focus / keyboard alone.
    (function () {
        const pillsWrapper = document.getElementById('chat-pills-wrapper');
        if (!pillsWrapper) return;

        function clearKeyboardHide() {
            pillsWrapper.classList.remove('pills--hidden');
            pillsWrapper.style.pointerEvents = '';
        }

        clearKeyboardHide();
        window.addEventListener('resize', clearKeyboardHide);
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', clearKeyboardHide);
            window.visualViewport.addEventListener('scroll', clearKeyboardHide);
        }
    })();
    
    // Back button is disabled on AI chat (not clickable) – no handler

    // Info bottom sheet (opens when header info icon is clicked)
    const infoSheet = document.getElementById('info-bottom-sheet');
    const infoSheetOverlay = infoSheet?.querySelector('.info-bottom-sheet-overlay');
    const infoSheetCloseBtn = document.getElementById('info-bottom-sheet-close');
    const infoSheetCta = document.getElementById('info-bottom-sheet-cta');
    const chatInfoBtn = document.querySelector('.chat-header-menu-btn');

    function openInfoBottomSheet() {
        if (!infoSheet) return;
        infoSheet.setAttribute('aria-hidden', 'false');
        infoSheet.classList.add('active');
    }

    function closeInfoBottomSheet() {
        if (!infoSheet) return;
        infoSheet.classList.remove('active');
        infoSheet.setAttribute('aria-hidden', 'true');
    }

    if (chatInfoBtn) {
        chatInfoBtn.addEventListener('click', () => {
            openInfoBottomSheet();
        });
    }
    if (infoSheetOverlay) {
        infoSheetOverlay.addEventListener('click', closeInfoBottomSheet);
    }
    if (infoSheetCloseBtn) {
        infoSheetCloseBtn.addEventListener('click', closeInfoBottomSheet);
    }
    if (infoSheetCta) {
        infoSheetCta.addEventListener('click', closeInfoBottomSheet);
    }
    
    // Houzy pill: shortcut to list view (All flows) – user picks SRP or other flows
    const chatTitleBtn = document.getElementById('chat-title-btn');
    function openSRPShortcut() {
        if (typeof window.__openSRPDirect === 'function') window.__openSRPDirect();
    }
    if (chatTitleBtn) chatTitleBtn.addEventListener('click', openSRPShortcut);
    
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
    // Keep only haptic feedback (scroll prevention removed so chat-messages can scroll when property cards are visible)
    if (chatInput && chatScreen) {
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
            const chatScreen = document.getElementById("chat-screen");
            if (!header || !composer || !messages) return;
            
            const headerH = Math.ceil(header.getBoundingClientRect().height);
            const composerH = Math.ceil(composer.getBoundingClientRect().height);
            
            const isIntroState = chatScreen && !chatScreen.classList.contains('chat-started');
            
            messages.style.paddingTop = (headerH + 16) + "px";
            if (isIntroState) {
                // Intro state: no 50% gap – keep hey + pills centered exactly between header and input
                messages.style.paddingBottom = (composerH + 16) + "px";
            } else {
                // After first message: 50% viewport gap above input (ChatGPT-style)
                const vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
                const gapPercent = 0.50;
                const gapAboveInput = Math.max(96, Math.round(vh * gapPercent));
                messages.style.paddingBottom = (composerH + gapAboveInput) + "px";
            }
            
            document.documentElement.style.setProperty('--header-height', headerH + 'px');
            document.documentElement.style.setProperty('--composer-h', composerH + 'px');
        }
        
        // Alias for backward compatibility
        function setChatInsets() {
            setChatOffsets();
        }
        
        // Initialize insets on load and resize (debounced to reduce layout thrash)
        requestAnimationFrame(() => {
            requestAnimationFrame(setChatInsets);
        });
        const setChatInsetsDebounced = debounce(setChatInsets, 120);
        window.addEventListener("resize", setChatInsetsDebounced);
        if (window.visualViewport) {
            window.visualViewport.addEventListener("resize", setChatInsetsDebounced);
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
        
        const TYPING_STATUS_TEXTS = [
            'Thinking...',
            'Finding the answers...',
            'Searching properties...',
            'Looking that up...',
            'One sec...',
            'Checking...'
        ];

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
            
            const loader = document.createElement('div');
            loader.className = 'loader-5';
            const span = document.createElement('span');
            loader.appendChild(span);
            typingIndicator.appendChild(loader);
            
            const statusText = document.createElement('span');
            statusText.className = 'typing-indicator-shimmer-text';
            statusText.textContent = TYPING_STATUS_TEXTS[0];
            typingIndicator.appendChild(statusText);
            
            let index = 0;
            const textInterval = setInterval(function() {
                index = (index + 1) % TYPING_STATUS_TEXTS.length;
                statusText.textContent = TYPING_STATUS_TEXTS[index];
            }, 1500);
            msgDiv._typingTextInterval = textInterval;
            
            botContent.appendChild(typingIndicator);
            msgDiv.appendChild(botContent);
            
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
                if (typingIndicator._typingTextInterval) clearInterval(typingIndicator._typingTextInterval);
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
        
        // Stream bot text word-by-word (ChatGPT-style) – ~50ms per word
        const STREAM_WORD_MS = 50;

        function streamTextIntoElement(element, text, wordMs, onComplete) {
            const words = (text || '').trim() ? (text || '').trim().split(/(\s+)/) : [];
            let idx = 0;
            function next() {
                if (idx >= words.length) { if (onComplete) onComplete(); return; }
                element.textContent += words[idx];
                idx++;
                setTimeout(next, wordMs || STREAM_WORD_MS);
            }
            next();
        }

        // Render bot message - appears below user message, streams word-by-word
        function addBotMessage(text, showTyping = true) {
            if (showTyping) showTypingIndicator();

            const delay = showTyping ? 1800 : 0;
            const fullText = text.trim();
            const words = fullText ? fullText.split(/(\s+)/) : []; /* preserve spaces */

            setTimeout(() => {
                hideTypingIndicator();

                const msgId = generateMessageId();
                const message = { id: msgId, role: 'bot', text: fullText, timestamp: Date.now() };
                messages.push(message);

                const msgDiv = document.createElement('div');
                msgDiv.id = msgId;
                msgDiv.className = 'msg msg-bot';

                const botContent = document.createElement('div');
                botContent.className = 'bot-message-content';

                const botText = document.createElement('div');
                botText.className = 'bot-text';

                botContent.appendChild(botText);
                msgDiv.appendChild(botContent);

                const stack = domCache.chatStack;
                if (stack) stack.appendChild(msgDiv);
                triggerHapticFeedback('light');

                if (words.length === 0) {
                    const feedbackButtons = createFeedbackButtons(msgId);
                    botContent.appendChild(feedbackButtons);
                    return;
                }

                let idx = 0;
                function streamNext() {
                    if (idx >= words.length) {
                        const feedbackButtons = createFeedbackButtons(msgId);
                        botContent.appendChild(feedbackButtons);
                        triggerHapticFeedback('medium');
                        return;
                    }
                    botText.textContent += words[idx];
                    idx++;
                    setTimeout(streamNext, STREAM_WORD_MS);
                }
                setTimeout(streamNext, 0);
            }, delay);

            return 'typing';
        }
        
        // Locality / "tell me about [place]" info cards (Figma Case 1 structure)
        const LOCALITY_INFO_CARDS = {
            'richmond park': {
                title: 'Richmond Park',
                byline: 'Residential society in Gurgaon by DLF',
                locationLine: '📍 Richmond Park, Gurgaon',
                overview: 'Richmond Park is a residential society and construction project in Gurgaon by DLF. It offers gated living with amenities like power backup, water supply, security, and good connectivity to the rest of the city. The project typically features 2 BHK to 4 BHK apartments and is suited for families and professionals. You can search for listings by saying "2 BHK in Richmond Park Gurgaon" or "Properties for sale in Richmond Park DLF".',
                highlightsLabel: 'Key highlights',
                highlights: [
                    'DLF residential project in Gurgaon',
                    'Gated society with security and amenities',
                    'Good connectivity to NH-8 and city centres',
                    'Mix of 2 BHK, 3 BHK, and 4 BHK options',
                    'Family-friendly and investment-friendly'
                ],
                amenities: ['Power backup and water supply', 'Security and CCTV', 'Gated access', 'Lift and parking', 'Parks and common areas'],
                propertyTypesText: 'Apartments in a gated DLF society, with ready-to-move and under-construction options. Configurations from 2 BHK to 4 BHK for rent and sale.'
            },
            'rohini': {
                title: 'Rohini',
                byline: 'Residential area in North West Delhi',
                locationLine: '📍 Rohini, Delhi',
                overview: 'Rohini is a well-developed residential and commercial hub in North West Delhi. It has multiple sectors with parks, schools, hospitals, and metro connectivity. Property options range from affordable to premium across sectors.',
                highlightsLabel: 'Key highlights',
                highlights: [
                    'Metro connectivity (Red Line)',
                    'Multiple sectors with parks and amenities',
                    'Schools, hospitals, and shopping nearby',
                    'Mix of 2 BHK, 3 BHK, and 4 BHK options',
                    'Good rental and resale demand'
                ],
                amenities: ['Metro (Red Line)', 'Parks and green spaces', 'Power backup and water supply', 'Security and gated societies', 'Parking and lift'],
                propertyTypesText: 'Builder floors, apartments in gated sectors, and independent houses. Configurations from 2 BHK to 4 BHK with both ready-to-move and under-construction options.'
            },
            'koramangala': {
                title: 'Koramangala',
                byline: 'Locality in Bangalore',
                locationLine: '📍 Koramangala, Bangalore',
                overview: 'Koramangala is a major residential and commercial area in Bangalore with a mix of tech offices, cafes, and residential blocks. It offers good connectivity and a range of apartments and independent houses.',
                highlightsLabel: 'Key highlights',
                highlights: [
                    'Tech hub with offices and startups',
                    'Wide range of 1–4 BHK apartments',
                    'Restaurants, cafes, and shopping',
                    'Well connected by road and metro',
                    'Strong rental demand'
                ],
                amenities: ['Power backup and water supply', 'Security and CCTV', 'Lift and parking', 'Gym, pool, clubhouse in many projects'],
                propertyTypesText: 'Apartments in gated communities, builder floors, and independent houses. Strong mix of 1–4 BHK with furnished and unfurnished options for rent and sale.'
            }
        };
        
        function getLocalityCardData(placeName) {
            const key = (placeName || '').trim().toLowerCase().replace(/\s+/g, ' ');
            return LOCALITY_INFO_CARDS[key] || null;
        }
        
        function getGenericPlaceCard(displayName) {
            return {
                title: displayName,
                byline: 'Society / Locality / Project – India',
                locationLine: '📍 ' + displayName,
                overview: displayName + ' is a well-known society, locality, or construction project in India. Such projects typically offer a mix of ready-to-move and under-construction units from reputed builders, with options ranging from 1–2 BHK to 3–4 BHK and villas. Residents value good connectivity, proximity to schools and hospitals, and amenities like power backup, water supply, and security. Family-oriented living, strong resale and rental demand, and RERA-registered projects are common. You can search for specific options by saying things like "2 BHK in ' + displayName + ' under 50 lakh" or "Properties for rent in ' + displayName + '".',
                highlightsLabel: 'Key highlights',
                highlights: [
                    'Good connectivity (metro, highways, or main roads)',
                    'Schools, hospitals, and daily-needs nearby',
                    'Mix of 1 BHK to 4 BHK and builder projects',
                    'Power backup, water supply, and security common in societies',
                    'Family-friendly and suitable for long-term stay or investment',
                    'RERA-registered projects and clear titles preferred by buyers'
                ],
                amenities: [
                    'Power backup and water supply',
                    'Security, CCTV, and gated access',
                    'Lift and parking',
                    'Play area, gym, or clubhouse in many societies'
                ],
                propertyTypesText: 'You’ll find a mix of builder floors, apartments in gated societies, and under-construction projects. Configurations range from 1 BHK to 4 BHK and villas, with both furnished and unfurnished options for rent and sale.'
            };
        }
        
        function showLocalityInfoCard(placeName) {
            showTypingIndicator();
            const delay = 3000;
            setTimeout(() => {
                hideTypingIndicator();
                const data = getLocalityCardData(placeName);
                const displayName = (placeName || '').trim() || 'This area';
                const card = data || getGenericPlaceCard(displayName);
                const title = card.title;
                const byline = card.byline;
                const locationLine = card.locationLine;
                const overview = card.overview;
                const highlightsLabel = (card.highlightsLabel != null) ? card.highlightsLabel : 'Key highlights';
                const highlights = (card.highlights && card.highlights.length) ? card.highlights : [];
                
                const msgId = generateMessageId();
                const message = {
                    id: msgId,
                    role: 'bot',
                    text: title + ' – ' + overview.substring(0, 80) + '…',
                    timestamp: Date.now()
                };
                messages.push(message);
                
                const msgDiv = document.createElement('div');
                msgDiv.id = msgId;
                msgDiv.className = 'msg msg-bot';
                
                const botContent = document.createElement('div');
                botContent.className = 'bot-message-content';
                
                const h1 = document.createElement('h1');
                h1.textContent = '📍 ' + title;
                botContent.appendChild(h1);
                
                const pByline = document.createElement('p');
                pByline.textContent = byline;
                pByline.classList.add('bot-reply-muted');
                botContent.appendChild(pByline);
                
                const pLocation = document.createElement('p');
                pLocation.textContent = locationLine;
                pLocation.classList.add('bot-reply-muted');
                botContent.appendChild(pLocation);
                
                const hr1 = document.createElement('hr');
                botContent.appendChild(hr1);
                
                const h2Overview = document.createElement('h2');
                h2Overview.textContent = 'Locality Overview';
                botContent.appendChild(h2Overview);
                
                const pOverview = document.createElement('p');
                botContent.appendChild(pOverview);
                streamTextIntoElement(pOverview, overview, STREAM_WORD_MS);
                
                if (highlights.length > 0) {
                    const hr2 = document.createElement('hr');
                    botContent.appendChild(hr2);
                    const h2High = document.createElement('h2');
                    h2High.textContent = highlightsLabel;
                    botContent.appendChild(h2High);
                    const ul = document.createElement('ul');
                    ul.className = 'place-card-list';
                    highlights.forEach(function (item) {
                        const li = document.createElement('li');
                        li.textContent = item;
                        ul.appendChild(li);
                    });
                    botContent.appendChild(ul);
                }
                
                var amenities = card.amenities && card.amenities.length ? card.amenities : null;
                if (amenities && amenities.length > 0) {
                    const hrA = document.createElement('hr');
                    botContent.appendChild(hrA);
                    const h2A = document.createElement('h2');
                    h2A.textContent = 'Amenities';
                    botContent.appendChild(h2A);
                    const ulA = document.createElement('ul');
                    ulA.className = 'place-card-list';
                    amenities.forEach(function (item) {
                        const li = document.createElement('li');
                        li.textContent = item;
                        ulA.appendChild(li);
                    });
                    botContent.appendChild(ulA);
                }
                
                if (card.propertyTypesText) {
                    const hrP = document.createElement('hr');
                    botContent.appendChild(hrP);
                    const h2P = document.createElement('h2');
                    h2P.textContent = 'Property types';
                    botContent.appendChild(h2P);
                    const pP = document.createElement('p');
                    botContent.appendChild(pP);
                    streamTextIntoElement(pP, card.propertyTypesText, STREAM_WORD_MS);
                }
                
                const feedbackButtons = createFeedbackButtons(msgId);
                botContent.appendChild(feedbackButtons);
                msgDiv.appendChild(botContent);
                
                const stack = domCache.chatStack;
                if (stack) stack.appendChild(msgDiv);
                triggerHapticFeedback('medium');
            }, delay);
        }

        function normalizePropertyKey(name) {
            return (name || '').trim().toLowerCase().replace(/\s+/g, ' ');
        }

        function isPropertyPicturesRequest(text) {
            const normalized = normalizeText(text);
            return /(?:show|see|view|get|display|share|send)\s+(?:me\s+)?(?:the\s+)?(?:property\s+|project\s+)?(?:pics?|pictures?|photos?|images?)/i.test(normalized) ||
                /(?:show|see|view)\s+(?:me\s+)?(?:the\s+)?project\s+(?:pics?|pictures?|photos?|images?)/i.test(normalized) ||
                /(?:pics?|pictures?|photos?|images?)\s+(?:of|for)\s+(?:the\s+)?/.test(normalized) ||
                /(?:can\s+i\s+see|want\s+to\s+see)\s+(?:the\s+)?(?:project\s+)?(?:pics?|pictures?|photos?|images?)/i.test(normalized) ||
                /\bproject\s+(?:pics?|pictures?|photos?|images?)\b/i.test(normalized);
        }

        const ROOM_PICTURE_ALIASES = [
            { room: 'master bedroom', re: /\bmaster\s*bedrooms?\b/i },
            { room: 'bedroom', re: /\bbedrooms?\b/i },
            { room: 'living room', re: /\bliving\s*rooms?\b/i },
            { room: 'kitchen', re: /\bkitchens?\b/i },
            { room: 'bathroom', re: /\b(bathrooms?|washrooms?|toilets?)\b/i },
            { room: 'balcony', re: /\bbalcon(?:y|ies)\b/i },
            { room: 'dining', re: /\bdining(?:\s*rooms?)?\b/i },
            { room: 'hall', re: /\bhalls?\b/i }
        ];

        // Demo counts so each mosaic layout is reachable from natural room asks
        const ROOM_PHOTO_DISPLAY_COUNTS = {
            kitchen: 1,
            dining: 2,
            'living room': 2,
            hall: 3,
            balcony: 3,
            bathroom: 3,
            bedroom: 16,
            'master bedroom': 16
        };

        function extractRoomFromPicturesRequest(text) {
            const raw = text || '';
            for (let i = 0; i < ROOM_PICTURE_ALIASES.length; i++) {
                if (ROOM_PICTURE_ALIASES[i].re.test(raw)) {
                    return ROOM_PICTURE_ALIASES[i].room;
                }
            }
            return '';
        }

        function padGalleryImages(gallery, minCount) {
            const images = (gallery && gallery.length) ? gallery.slice() : [];
            if (!images.length && typeof PROPERTY_IMAGE_POOL !== 'undefined') {
                images.push(PROPERTY_IMAGE_POOL[0]);
            }
            let i = 0;
            while (images.length < minCount && typeof PROPERTY_IMAGE_POOL !== 'undefined' && PROPERTY_IMAGE_POOL.length) {
                images.push(PROPERTY_IMAGE_POOL[i % PROPERTY_IMAGE_POOL.length]);
                i += 1;
            }
            return images;
        }

        function resolvePictureDisplayPlan(propertyData, room) {
            const baseGallery = (propertyData.gallery && propertyData.gallery.length)
                ? propertyData.gallery
                : (propertyData.image ? [propertyData.image] : []);
            let total = baseGallery.length || 1;
            if (room && ROOM_PHOTO_DISPLAY_COUNTS[room]) {
                total = ROOM_PHOTO_DISPLAY_COUNTS[room];
            }
            const images = padGalleryImages(baseGallery, Math.max(total, 4));
            const layout = total >= 4 ? 4 : Math.max(1, total);
            const visible = images.slice(0, layout);
            const remaining = total > 4 ? total - 4 : 0;
            return {
                room: room || '',
                layout: layout,
                visible: visible,
                remaining: remaining,
                total: total,
                gallery: images.slice(0, Math.max(total, images.length))
            };
        }

        function buildPicturesIntroText(propertyData, plan) {
            const room = plan.room;
            const projectName = propertyData.name || 'this project';
            if (room === 'kitchen' && plan.layout === 1) {
                return 'Showcasing one picture of the kitchen';
            }
            if (room) {
                const roomLabel = room === 'bedroom' || room === 'master bedroom' ? 'bedroom' : room;
                return 'Here are the ' + roomLabel + ' pictures of ' + projectName;
            }
            return 'Here are photos of ' + projectName + '.';
        }

        function buildPicturesFollowupText(plan) {
            if (plan.layout === 4 && plan.remaining > 0) {
                return "Anything else you'd like a look at — kitchen, living room, bathroom?";
            }
            return 'Want to check photos of other rooms of the same project?';
        }

        function isProjectPicturesContext(text) {
            return /\bproject\b/i.test(text || '');
        }

        function cleanExtractedProjectName(rawName) {
            return (rawName || '')
                .replace(/\b(please|thanks|thank you|pics?|associated|related)\b/gi, '')
                .replace(/\b(master\s*bedrooms?|bedrooms?|living\s*rooms?|kitchens?|bathrooms?|washrooms?|toilets?|balcon(?:y|ies)|dining(?:\s*rooms?)?|halls?)\b/gi, '')
                .replace(/\s+project\s*$/i, '')
                .replace(/^project\s+/i, '')
                .replace(/^(the|a|an|of|for)\s+/i, '')
                .replace(/[?.!,]+$/g, '')
                .replace(/\s+/g, ' ')
                .trim();
        }

        function extractPropertyNameFromPicturesRequest(text) {
            const raw = (text || '').trim();
            const patterns = [
                /(?:show|see|view)\s+(?:me\s+)?(?:the\s+)?project\s+(?:pics?|pictures?|photos?|images?)\s+(?:of|for)\s+(?:the\s+)?(.+)/i,
                /(?:pics?|pictures?|photos?|images?)\s+(?:of|for)\s+(?:the\s+)?(.+?)(?:\s+project)?[?.!,]*$/i,
                /(?:show|see|view|get|display|share|send)\s+(?:me\s+)?(?:the\s+)?(?:project\s+)?(?:pics?|pictures?|photos?|images?)\s+(?:of|for)\s+(?:the\s+)?(.+)/i,
                /(?:show|see|view|get|display|share|send)\s+(?:me\s+)?(?:the\s+)?(.+?)\s+project\s+(?:pics?|pictures?|photos?|images?)/i,
                /(?:show|see|view|get|display|share|send)\s+(?:me\s+)?(?:the\s+)?(.+?)\s+(?:pics?|pictures?|photos?|images?)/i
            ];
            for (let i = 0; i < patterns.length; i++) {
                const match = raw.match(patterns[i]);
                if (match && match[1]) {
                    const cleaned = cleanExtractedProjectName(match[1]);
                    if (cleaned.length >= 2) return cleaned;
                }
            }
            return '';
        }

        function toProjectPictureResult(project, overrides) {
            return {
                id: project.id,
                name: project.name,
                location: project.location,
                developer: project.developer || null,
                status: project.status || null,
                priceRange: project.priceRange || null,
                isProject: project.isProject !== false,
                image: project.gallery[0],
                gallery: project.gallery,
                ...(overrides || {})
            };
        }

        function buildGalleryForProperty(name, seedImage) {
            const startIndex = hashPropertyId(name || 'property') % PROPERTY_IMAGE_POOL.length;
            const gallery = [];
            const used = new Set();
            for (let i = 0; i < EXTENDED_GALLERY_IMAGES.length; i++) {
                const image = EXTENDED_GALLERY_IMAGES[(startIndex + i) % EXTENDED_GALLERY_IMAGES.length];
                if (!used.has(image)) {
                    gallery.push(image);
                    used.add(image);
                }
            }
            if (seedImage && !used.has(seedImage)) {
                gallery.unshift(seedImage);
            }
            return gallery.slice(0, 10);
        }

        function cardToProjectPictureData(card) {
            if (!card) return null;
            const gallery = (card.gallery && card.gallery.length >= 5)
                ? card.gallery
                : buildGalleryForProperty(card.name, card.image);
            const priceLabel = card.price != null
                ? ('₹' + card.price + (card.priceUnit ? ' ' + card.priceUnit : ''))
                : (card.priceRange || null);
            return {
                id: card.id,
                name: card.name,
                location: card.locality || card.location || 'India',
                developer: card.developer || null,
                status: card.status || null,
                priceRange: priceLabel,
                isProject: true,
                image: card.image || gallery[0],
                gallery: gallery
            };
        }

        function projectNameTokens(name) {
            return normalizePropertyKey(name)
                .split(' ')
                .filter(function(token) {
                    return token.length > 2 && !/^(the|and|for|bhk|flat|apartment|project)$/.test(token);
                });
        }

        function scoreProjectNameMatch(query, candidateName) {
            const q = normalizePropertyKey(query);
            const c = normalizePropertyKey(candidateName);
            if (!q || !c) return 0;
            if (q === c) return 100;
            if (c.includes(q) || q.includes(c)) return 80;
            const qTokens = projectNameTokens(q);
            const cTokens = projectNameTokens(c);
            if (!qTokens.length || !cTokens.length) return 0;
            let hits = 0;
            qTokens.forEach(function(token) {
                if (cTokens.some(function(ct) { return ct.includes(token) || token.includes(ct); })) {
                    hits += 1;
                }
            });
            if (!hits) return 0;
            return Math.round((hits / qTokens.length) * 60);
        }

        function findBestCardForPictures(query) {
            if (!lastShownPropertyCards.length) return null;
            let best = null;
            let bestScore = 0;
            lastShownPropertyCards.forEach(function(card) {
                const score = scoreProjectNameMatch(query, card.name);
                if (score > bestScore) {
                    bestScore = score;
                    best = card;
                }
            });
            return bestScore >= 40 ? best : null;
        }

        function resolvePropertyForPictures(propertyName) {
            const query = normalizePropertyKey(propertyName);
            if (!query) {
                if (lastMentionedProject) {
                    return { ...lastMentionedProject };
                }
                if (lastShownPropertyCards.length > 0) {
                    return cardToProjectPictureData(lastShownPropertyCards[0]);
                }
                return null;
            }

            // Prefer the carousel the user just saw (this projects view)
            const matchedCard = findBestCardForPictures(query);
            if (matchedCard) {
                return cardToProjectPictureData(matchedCard);
            }

            const predefined = PROPERTY_PICTURE_PROJECTS[query];
            if (predefined) {
                return toProjectPictureResult(predefined);
            }

            let bestKey = null;
            let bestScore = 0;
            for (const key in PROPERTY_PICTURE_PROJECTS) {
                const score = scoreProjectNameMatch(query, key);
                if (score > bestScore) {
                    bestScore = score;
                    bestKey = key;
                }
            }
            if (bestKey && bestScore >= 40) {
                return toProjectPictureResult(PROPERTY_PICTURE_PROJECTS[bestKey]);
            }

            const brochureMatch = findBrochureProjectMatch(query);
            if (brochureMatch) {
                return toProjectPictureResult(brochureMatch);
            }

            return {
                id: 'project-' + query.replace(/\s+/g, '-'),
                name: propertyName.trim().replace(/\b\w/g, function(ch) { return ch.toUpperCase(); }),
                location: conversationState.locality || 'India',
                developer: null,
                status: 'Under construction',
                isProject: true,
                image: PROPERTY_IMAGE_POOL[hashPropertyId(query) % PROPERTY_IMAGE_POOL.length],
                gallery: buildGalleryForProperty(query)
            };
        }

        function findBrochureProjectMatch(query) {
            const names = typeof BROCHURE_PROJECT_NAMES !== 'undefined' ? BROCHURE_PROJECT_NAMES : [];
            for (let i = 0; i < names.length; i++) {
                const key = normalizePropertyKey(names[i]);
                if (key.includes(query) || query.includes(key)) {
                    const existing = PROPERTY_PICTURE_PROJECTS[key];
                    if (existing) return existing;
                    return {
                        id: key.replace(/\s+/g, '-'),
                        name: names[i],
                        location: conversationState.locality || 'India',
                        developer: getRandomItem(INDIAN_DEVELOPER_NAMES),
                        status: 'New launch',
                        priceRange: BROCHURE_PRICE_RANGES[i % BROCHURE_PRICE_RANGES.length],
                        isProject: true,
                        gallery: buildGalleryForProperty(names[i])
                    };
                }
            }
            return null;
        }

        function applyNativeSingleImageBounds(img, item) {
            const nw = img.naturalWidth;
            const nh = img.naturalHeight;
            if (!nw || !nh) return;

            const ratio = nw / nh;
            const maxW = 240;
            const maxH = 320;
            const minH = 120;

            // Fit inside max box while keeping native ratio (no crop)
            let w = nw;
            let h = nh;
            const down = Math.min(1, maxW / w, maxH / h);
            w *= down;
            h *= down;

            // Enforce min-height without cropping — may letterbox via object-fit:contain if capped
            if (h < minH) {
                h = minH;
                w = h * ratio;
                if (w > maxW) {
                    w = maxW;
                    h = w / ratio;
                }
                if (h > maxH) {
                    h = maxH;
                    w = h * ratio;
                }
            }

            item.style.aspectRatio = String(ratio);
            item.style.width = Math.round(w) + 'px';
            item.style.height = Math.round(h) + 'px';
            item.style.maxWidth = maxW + 'px';
            item.style.maxHeight = maxH + 'px';
            item.style.minHeight = Math.min(minH, Math.round(h)) + 'px';
            item.dataset.nativeRatio = String(ratio);
        }

        function createPropertyPicturesPreview(propertyData, plan, options) {
            const opts = options || {};
            const displayPlan = plan || resolvePictureDisplayPlan(propertyData, '');
            const preview = document.createElement('div');
            preview.className = 'property-pictures-preview property-pictures-preview--mosaic' +
                (opts.desktop ? ' property-pictures-preview--desktop' : '');

            const galleryData = Object.assign({}, propertyData, {
                gallery: displayPlan.gallery && displayPlan.gallery.length
                    ? displayPlan.gallery
                    : (propertyData.gallery || [propertyData.image])
            });

            const grid = document.createElement('div');
            grid.className = 'property-pictures-grid property-pictures-grid--' + displayPlan.layout;
            grid.setAttribute('data-layout', String(displayPlan.layout));

            displayPlan.visible.forEach(function(url, index) {
                const item = document.createElement('button');
                item.type = 'button';
                item.className = 'property-pictures-item' +
                    (displayPlan.layout === 1 ? ' property-pictures-item--native' : '');
                item.style.setProperty('--reveal-index', String(index));
                item.setAttribute('aria-label', (propertyData.name || 'Property') + ' photo ' + (index + 1));
                const img = document.createElement('img');
                img.src = url;
                img.alt = (propertyData.name || 'Property') + ' – photo ' + (index + 1);
                img.loading = index < 2 ? 'eager' : 'lazy';
                img.onerror = function() {
                    if (!this.dataset.failed) {
                        this.dataset.failed = '1';
                        this.src = PROPERTY_IMAGE_POOL[0];
                    }
                };
                if (displayPlan.layout === 1) {
                    const applyBounds = function() {
                        applyNativeSingleImageBounds(img, item);
                    };
                    if (img.complete && img.naturalWidth) {
                        applyBounds();
                    } else {
                        img.addEventListener('load', applyBounds, { once: true });
                    }
                }
                item.appendChild(img);

                if (index === 3 && displayPlan.remaining > 0) {
                    const overlay = document.createElement('span');
                    overlay.className = 'property-pictures-item__overlay';
                    overlay.textContent = '+' + displayPlan.remaining;
                    item.appendChild(overlay);
                }

                item.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    // Lightbox (PDP prod gallery) — full project gallery from this image
                    openPropertyGallery(galleryData, index);
                });
                grid.appendChild(item);
            });
            preview.appendChild(grid);

            if (!opts.omitFollowup) {
                const followup = document.createElement('p');
                followup.className = 'property-pictures-followup';
                followup.textContent = buildPicturesFollowupText(displayPlan);
                preview.appendChild(followup);
            }

            preview.classList.add('property-pictures-preview--pending');
            return preview;
        }

        function revealPropertyPicturesPreview(previewEl) {
            if (!previewEl || previewEl.classList.contains('property-pictures-preview--revealing')) return;
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    previewEl.classList.remove('property-pictures-preview--pending');
                    previewEl.classList.add('property-pictures-preview--revealing');
                });
            });
        }

        function hideDesktopStagePanels(exceptId) {
            ['desktop-stage-empty', 'desktop-stage-listings', 'desktop-stage-photos', 'desktop-stage-pdp', 'desktop-stage-housing'].forEach(function(id) {
                const el = document.getElementById(id);
                if (!el) return;
                if (id === exceptId) {
                    el.hidden = false;
                } else {
                    el.hidden = true;
                    if (id === 'desktop-stage-pdp' || id === 'desktop-stage-housing') el.innerHTML = '';
                }
            });
        }

        function openHousingRedirectPanel(card, sourceEl) {
            if (!isDesktopLayout()) {
                window.open(buildHousingRedirectUrl(card), '_blank', 'noopener');
                return;
            }
            const settleGhost = animateCardIntoDesktopSplit(sourceEl);
            enterDesktopSplit();
            const stage = document.getElementById('desktop-stage');
            const housing = document.getElementById('desktop-stage-housing');
            if (!stage || !housing) {
                window.open(buildHousingRedirectUrl(card), '_blank', 'noopener');
                return;
            }
            const url = buildHousingRedirectUrl(card);
            const priceLabel = card && card.price != null
                ? ('₹' + card.price + (card.priceUnit ? ' ' + card.priceUnit : ''))
                : (card && card.priceRange) || '';
            const imgSrc = (card && (card.image || (card.gallery && card.gallery[0]))) || '';
            hideDesktopStagePanels('desktop-stage-housing');
            housing.innerHTML =
                '<div class="desktop-housing desktop-housing--enter">' +
                    '<div class="desktop-housing__chrome">' +
                        '<button type="button" class="desktop-housing__cancel" aria-label="Cancel">' +
                            '<img src="assets/figma/pdp/close.svg" alt="" width="18" height="18">' +
                            '<span>Cancel</span>' +
                        '</button>' +
                        '<span class="desktop-housing__brand">housing.com</span>' +
                        '<a class="desktop-housing__open" href="' + url + '" target="_blank" rel="noopener">Open in new tab</a>' +
                    '</div>' +
                    (imgSrc
                        ? '<div class="desktop-housing__hero"><img src="" alt=""></div>'
                        : '') +
                    '<div class="desktop-housing__body">' +
                        '<p class="desktop-housing__eyebrow">Property details</p>' +
                        '<h2 class="desktop-housing__title"></h2>' +
                        '<p class="desktop-housing__meta"></p>' +
                        '<p class="desktop-housing__copy">Continue on Housing.com for full details, photos, floor plans, and seller contact.</p>' +
                        '<a class="desktop-housing__cta" href="' + url + '" target="_blank" rel="noopener">Continue on Housing.com</a>' +
                    '</div>' +
                '</div>';
            housing.querySelector('.desktop-housing__title').textContent = (card && card.name) || 'Property';
            housing.querySelector('.desktop-housing__meta').textContent =
                [(card && (card.locality || card.location)) || '', priceLabel].filter(Boolean).join(' · ');
            const heroImg = housing.querySelector('.desktop-housing__hero img');
            const housingRoot = housing.querySelector('.desktop-housing');
            if (heroImg && imgSrc) {
                heroImg.src = imgSrc;
                heroImg.alt = (card && card.name) || '';
                if (settleGhost) {
                    heroImg.style.opacity = '0';
                    if (housingRoot) housingRoot.classList.add('desktop-housing--morphing');
                }
            }
            const cancelBtn = housing.querySelector('.desktop-housing__cancel');
            if (cancelBtn) {
                cancelBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    exitDesktopSplit();
                });
            }
            // Settle fly-in after layout paints the 50% stage (same timing as PDP)
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    if (typeof settleGhost === 'function') {
                        settleGhost(heroImg);
                    } else if (heroImg) {
                        heroImg.style.opacity = '';
                    }
                });
            });
        }

        function renderDesktopPhotoMosaic(propertyData, plan, introText) {
            if (!isDesktopSplit()) return;
            enterDesktopSplit();
            const stage = document.getElementById('desktop-stage');
            const photos = document.getElementById('desktop-stage-photos');
            const mosaicHost = document.getElementById('desktop-stage-photos-mosaic');
            const titleEl = document.getElementById('desktop-stage-photos-title');
            const eyebrowEl = document.getElementById('desktop-stage-photos-eyebrow');
            const metaEl = document.getElementById('desktop-stage-photos-meta');
            if (!stage || !photos || !mosaicHost) return;

            hideDesktopStagePanels('desktop-stage-photos');

            if (eyebrowEl) {
                eyebrowEl.textContent = plan.room
                    ? ('Photos · ' + plan.room)
                    : 'Photos · project';
            }
            if (titleEl) {
                titleEl.textContent = propertyData.name || 'Property photos';
            }
            if (metaEl) {
                const bits = [];
                if (plan.layout === 1) bits.push('1 photo');
                else if (plan.layout < 4) bits.push(plan.layout + ' photos');
                else bits.push(plan.total + ' photos');
                if (propertyData.location) bits.push(propertyData.location);
                metaEl.textContent = bits.join(' · ');
            }

            mosaicHost.innerHTML = '';
            const preview = createPropertyPicturesPreview(propertyData, plan, {
                desktop: true,
                omitFollowup: true
            });
            mosaicHost.appendChild(preview);
            revealPropertyPicturesPreview(preview);
        }

        function showPropertyPicturesPreview(propertyName, userText) {
            showTypingIndicator();
            const delay = 1800 + Math.random() * 800;
            const room = extractRoomFromPicturesRequest(userText || '');
            setTimeout(function() {
                hideTypingIndicator();
                const propertyData = resolvePropertyForPictures(propertyName);
                if (!propertyData) {
                    addBotMessage(room
                        ? 'Which project\'s ' + room + ' photos should I show? Try asking after you\'ve looked at a project, or say "Show project pictures of Opus".'
                        : 'Which project would you like to see pictures of? Try something like "Show project pictures of Opus".');
                    return;
                }

                lastMentionedProject = { ...propertyData };
                const plan = resolvePictureDisplayPlan(propertyData, room);
                const introText = buildPicturesIntroText(propertyData, plan);
                const followupText = buildPicturesFollowupText(plan);
                const useStagePhotos = isDesktopSplit();
                const msgId = generateMessageId();
                const message = {
                    id: msgId,
                    role: 'bot',
                    text: introText,
                    timestamp: Date.now(),
                    hasPicturesPreview: true
                };
                messages.push(message);
                triggerHapticFeedback('medium');

                const msgDiv = document.createElement('div');
                msgDiv.id = msgId;
                msgDiv.className = 'msg msg-bot';

                const botContent = document.createElement('div');
                botContent.className = 'bot-message-content';

                const botText = document.createElement('div');
                botText.className = 'bot-text';
                botContent.appendChild(botText);

                let preview = null;
                if (useStagePhotos) {
                    const followup = document.createElement('p');
                    followup.className = 'property-pictures-followup property-pictures-followup--chat';
                    followup.textContent = followupText;
                    followup.hidden = true;
                    botContent.appendChild(followup);
                    msgDiv._desktopFollowup = followup;
                } else {
                    preview = createPropertyPicturesPreview(propertyData, plan);
                    botContent.appendChild(preview);
                }

                msgDiv.appendChild(botContent);
                const stack = domCache.chatStack;
                if (stack) {
                    stack.appendChild(msgDiv);
                    requestAnimationFrame(function() {
                        scrollMessageIntoView(msgDiv);
                    });
                }

                streamTextIntoElement(botText, introText, STREAM_WORD_MS, function() {
                    if (useStagePhotos) {
                        if (msgDiv._desktopFollowup) msgDiv._desktopFollowup.hidden = false;
                        renderDesktopPhotoMosaic(propertyData, plan, introText);
                    } else if (preview) {
                        revealPropertyPicturesPreview(preview);
                    }
                    botContent.appendChild(createFeedbackButtons(msgId));
                });

                const chatInputEl = document.getElementById('chat-input');
                if (chatInputEl) {
                    chatInputEl.placeholder = 'Reply to Houzy';
                }
            }, delay);
        }
        
        // Detect if message is a greeting
        function isGreeting(text) {
            const normalized = text.trim().toLowerCase();
            const greetingWords = ['hi', 'hey', 'hello', 'hola', 'namaste', 'hey there', 'hi there', 'hello there'];
            return greetingWords.some(word => normalized === word || normalized.startsWith(word + ' '));
        }
        
        // Generate varied greeting responses
        // Track last greeting index to avoid repeats
        let lastGreetingIndex = -1;
        
        function getGreetingResponse() {
            const greetings = [
                "Hey! Try something like '2 BHK in Andheri under 50k' 🏠",
                "Hi! You can search 'Buy 3 BHK in Whitefield'",
                "Hello! Looking for 'Homes near HSR Layout'?",
                "Hey there! Try '1 BHK for rent in Koramangala under 25k'",
                "Hi! Search like 'Buy flat in Powai under 2 Cr'",
                "Hello! You can ask 'Show 2 BHK in Bandra for rent'",
                "Hey! Try '3 BHK in Indiranagar under 80k'",
                "Hi there! Ask me 'Flats in Gurgaon under 40k'",
                "Hello! Search '2 BHK to buy in Noida under 1 Cr'",
                "Hey! Try 'Rent 1 BHK in Malad under 30k'"
            ];
            
            // Pick random but avoid back-to-back repeats
            let index;
            do {
                index = Math.floor(Math.random() * greetings.length);
            } while (index === lastGreetingIndex && greetings.length > 1);
            
            lastGreetingIndex = index;
            return greetings[index];
        }
        
        // Check if message is a location-proximity phrase that needs location modal
        function isLocationProximityPhrase(text) {
            const normalized = text.toLowerCase().trim();
            const proximityPatterns = [
                /\b(around|near)\s*(me|metro)\b/i,
                /\bnearby\b/i,
                /\bclose\s*to\s*me\b/i,
                /\bproperties?\s*(around|near)\s*(me|metro)\b/i,
                /\bflats?\s*(around|near)\s*(me|metro)\b/i,
                /\bhomes?\s*(around|near)\s*(me|metro)\b/i
            ];
            
            return proximityPatterns.some(pattern => pattern.test(normalized));
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

        // Last property cards shown in chat – used for "show pictures of …" follow-ups
        let lastShownPropertyCards = [];
        let lastMentionedProject = null;
        
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

        const EXTENDED_GALLERY_IMAGES = [
            ...PROPERTY_IMAGE_POOL,
            'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&h=600&fit=crop&q=80',
            'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&h=600&fit=crop&q=80',
            'https://images.unsplash.com/photo-1502005229762-cf1b2da7c5d6?w=800&h=600&fit=crop&q=80',
            'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=800&h=600&fit=crop&q=80',
            'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&h=600&fit=crop&q=80',
            'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&h=600&fit=crop&q=80'
        ];

        const PROPERTY_PICTURE_PROJECTS = {
            'opus': {
                id: 'opus',
                name: 'Opus',
                location: 'Golf Course Road, Gurgaon',
                developer: 'DLF Limited',
                status: 'Ready to move',
                priceRange: '₹2.5 Cr – ₹3.5 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(0, 10)
            },
            'm3m solitude ralph estate': {
                id: 'm3m-solitude-ralph-estate',
                name: 'M3M Solitude Ralph Estate',
                location: 'Sector 33, Sohna, Gurgaon',
                developer: 'M3M India',
                status: 'Ready to move',
                priceRange: '₹3 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(0, 10)
            },
            'm3m solitude': {
                id: 'm3m-solitude-ralph-estate',
                name: 'M3M Solitude Ralph Estate',
                location: 'Sector 33, Sohna, Gurgaon',
                developer: 'M3M India',
                status: 'Ready to move',
                priceRange: '₹3 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(0, 10)
            },
            'luxury heights': {
                id: 'luxury-heights',
                name: 'Luxury Heights',
                location: 'Sector 44, Noida',
                developer: 'Godrej Properties',
                status: 'Under construction',
                priceRange: '₹3.2 Cr – ₹4.5 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(1, 11)
            },
            'green valley': {
                id: 'green-valley',
                name: 'Green Valley',
                location: 'Sector 62, Noida',
                developer: 'Prestige Group',
                status: 'New launch',
                priceRange: '₹2.8 Cr – ₹3.8 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(2, 12)
            },
            'dlf gardencity': {
                id: 'dlf-gardencity',
                name: 'DLF Gardencity',
                location: 'Sector 81, Gurgaon',
                developer: 'DLF Limited',
                status: 'Under construction',
                priceRange: '₹1.8 Cr – ₹2.5 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(0, 9)
            },
            'godrej nature plus': {
                id: 'godrej-nature-plus',
                name: 'Godrej Nature Plus',
                location: 'Sector 89, Gurgaon',
                developer: 'Godrej Properties',
                status: 'New launch',
                priceRange: '₹3.2 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(3, 11)
            },
            'prestige sunrise park': {
                id: 'prestige-sunrise-park',
                name: 'Prestige Sunrise Park',
                location: 'Electronic City, Bangalore',
                developer: 'Prestige Group',
                status: 'Ready to move',
                priceRange: '₹2.1 Cr – ₹3.0 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(4, 11)
            },
            'm3m golf estate': {
                id: 'm3m-golf-estate',
                name: 'M3M Golf Estate',
                location: 'Golf Course Extension, Gurgaon',
                developer: 'M3M India',
                status: 'Under construction',
                priceRange: '₹2.8 Cr – ₹4.2 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(1, 10)
            },
            'emaar palm heights': {
                id: 'emaar-palm-heights',
                name: 'Emaar Palm Heights',
                location: 'Sector 77, Gurgaon',
                developer: 'Emaar India',
                status: 'Ready to move',
                priceRange: '₹3.5 Cr – ₹4.8 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(2, 11)
            },
            'sobha city': {
                id: 'sobha-city',
                name: 'Sobha City',
                location: 'Sector 108, Gurgaon',
                developer: 'Sobha Limited',
                status: 'Under construction',
                priceRange: '₹1.9 Cr – ₹2.8 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(0, 8)
            },
            'sunset residency': {
                id: 'sunset-residency',
                name: 'Sunset Residency',
                location: 'Dwarka, New Delhi',
                developer: 'Raheja Developers',
                status: 'Ready to move',
                priceRange: '₹1.2 Cr – ₹1.9 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(0, 8)
            },
            'park view apartments': {
                id: 'park-view-apartments',
                name: 'Park View Apartments',
                location: 'Rohini, Delhi',
                developer: 'Ansal API',
                status: 'Ready to move',
                priceRange: '₹85 L – ₹1.4 Cr',
                isProject: true,
                gallery: EXTENDED_GALLERY_IMAGES.slice(2, 10)
            }
        };
        
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

        // Indian project names and price ranges for brochure card (Figma: Property 1=Brochure)
        const BROCHURE_PROJECT_NAMES = [
            'Godrej Nature Plus',
            'DLF Gardencity',
            'Prestige Sunrise Park',
            'Sobha Forest View',
            'Brigade Metropolis',
            'Mahindra Eden',
            'Lodha Codename Crown',
            'Tata Primanti',
            'M3M Capital',
            'Emaar Palm Heights',
            'Signature The Millennia'
        ];
        const BROCHURE_PRICE_RANGES = [
            '₹3.2 - ₹3.2 Cr',
            '₹1.8 - ₹2.5 Cr',
            '₹2.1 - ₹3.0 Cr',
            '₹1.5 - ₹2.2 Cr',
            '₹2.4 - ₹3.5 Cr',
            '₹1.9 - ₹2.8 Cr',
            '₹4.0 - ₹5.5 Cr',
            '₹1.2 - ₹1.9 Cr',
            '₹2.8 - ₹4.2 Cr',
            '₹3.5 - ₹4.8 Cr',
            '₹1.6 - ₹2.4 Cr'
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

        // "All cases" trigger: exact or fuzzy (Levenshtein <= 2, or tokens "all" + "case")
        function isAllCasesMessage(text) {
            if (!text || typeof text !== 'string') return false;
            const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
            const target = 'all cases';
            if (normalized === target) return true;
            const dist = levenshteinDistance(normalized, target);
            if (dist <= 2) return true;
            const tokens = normalized.split(/\s+/).filter(Boolean);
            const hasAll = tokens.some(t => t.includes('all') || 'all'.includes(t));
            const hasCase = tokens.some(t => t.includes('case') || 'case'.includes(t) || t === 'cases');
            if (hasAll && hasCase) return true;
            return false;
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
        
        // Check if conversation state is complete (lenient – fill sensible defaults for demos)
        function fillSearchDefaults(text) {
            const normalized = normalizeText(text || '');
            const hasPriceCue = /\b(k|lakh|lac|cr|crore|budget|under|between)\b|\b\d{2,}/i.test(normalized);
            const hasRentCue = /\brent|rental\b/i.test(normalized);
            const hasBuyCue = /\bbuy|purchase|sale|flat|apartment|villa|project\b/i.test(normalized);

            if (!conversationState.intent) {
                if (hasRentCue) conversationState.intent = 'rent';
                else if (hasBuyCue || hasPriceCue) conversationState.intent = 'buy';
                else conversationState.intent = 'buy';
            }
            if (!conversationState.bhk) {
                conversationState.bhk = 3;
            }
            if (!conversationState.price && !conversationState.priceMin) {
                if (conversationState.intent === 'rent') {
                    conversationState.price = 0.3; // ~30k in lakh units used elsewhere
                    conversationState.priceMin = 0.15;
                    conversationState.priceMax = 0.9;
                } else {
                    conversationState.price = 3;
                    conversationState.priceMin = 2;
                    conversationState.priceMax = 4;
                }
            }
            if (!conversationState.locality || conversationState.locality.length < 3) {
                conversationState.locality = conversationState.city || 'Gurgaon';
            }
        }

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
            
            // Demo-friendly: BHK + (price or locality) is enough to show cards
            if (hasBHK && (hasPrice || hasLocality)) {
                return true;
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
                
                // 3 second loading for bot reply (typing indicator + rotating text)
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
                }, 3000);
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
            let currentStep = 'phone'; // 'phone', 'otp', 'success'
            
            // Create the login bottom sheet HTML structure
            loginSheet.innerHTML = `
                <div class="login-bottom-sheet-overlay"></div>
                <div class="login-bottom-sheet-content">
                    <button class="login-close-btn" id="login-close-btn">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#767676" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"></line>
                            <line x1="6" y1="6" x2="18" y2="18"></line>
                        </svg>
                    </button>
                    
                    <!-- Phone Step – Figma Frame 2087324795 -->
                    <div class="login-step" id="login-step-phone">
                        <div class="login-frame3">
                            <!-- Header: image (local) + overlapping logo container + close -->
                            <div class="login-frame5">
                                <div class="login-frame2">
                                    <img src="assets/login/login-image.jpg" alt="" class="login-bg-image" onerror="this.style.display='none'">
                                    <div class="login-logo-container">
                                        <img src="assets/login/container.png" alt="" class="login-logo-inner" onerror="this.style.display='none'">
                                    </div>
                                </div>
                                <h2 class="login-heading">Login to contact seller</h2>
                            </div>
                            
                            <!-- Phone Input Field – Figma 328×48, +91 | placeholder -->
                            <div class="login-container2" id="login-phone-container">
                                <div class="login-country-selector" id="login-country-selector">
                                    <span class="login-country-code">+91</span>
                                </div>
                                <div class="login-phone-input-area" id="login-phone-input-area">
                                    <input type="tel" class="login-phone-input" id="login-phone-input" placeholder="Phone number" maxlength="10" inputmode="numeric" readonly tabindex="-1" aria-readonly="true">
                                </div>
                                <button class="login-clear-btn" id="login-clear-btn" style="display: none;" type="button" tabindex="-1">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                                        <line x1="18" y1="6" x2="6" y2="18"></line>
                                        <line x1="6" y1="6" x2="18" y2="18"></line>
                                    </svg>
                                </button>
                                <div class="login-cursor" id="login-cursor" style="display: none;"></div>
                            </div>
                        </div>
                        
                        <!-- Buttons Section (display only – close via X or overlay) -->
                        <div class="login-frame7">
                            <button type="button" class="login-continue-btn" id="login-continue-btn" tabindex="-1" aria-disabled="true">Continue</button>
                            
                            <div class="login-or-divider">
                                <div class="login-or-line"></div>
                                <span class="login-or-text">OR</span>
                                <div class="login-or-line"></div>
                            </div>
                            
                            <button type="button" class="login-whatsapp-btn" id="login-whatsapp-btn" tabindex="-1" aria-disabled="true">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="#5e23dc" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                                </svg>
                                <span>Continue with WhatsApp</span>
                            </button>
                        </div>
                    </div>
                    
                    <!-- OTP Step -->
                    <div class="login-step hidden" id="login-step-otp">
                        <div class="login-otp-title">Verify your number</div>
                        <div class="login-otp-subtitle" id="login-otp-subtitle">Enter the 4-digit code sent to +91 XXXXXXXXXX</div>
                        
                        <div class="login-otp-container" id="login-otp-container">
                            <input type="text" class="login-otp-input" maxlength="1" inputmode="numeric" data-index="0">
                            <input type="text" class="login-otp-input" maxlength="1" inputmode="numeric" data-index="1">
                            <input type="text" class="login-otp-input" maxlength="1" inputmode="numeric" data-index="2">
                            <input type="text" class="login-otp-input" maxlength="1" inputmode="numeric" data-index="3">
                        </div>
                        
                        <div class="login-otp-resend">
                            Didn't receive code? <button class="login-otp-resend-link" id="login-resend-otp">Resend</button>
                        </div>
                    </div>
                    
                    <!-- Success Step -->
                    <div class="login-step hidden" id="login-step-success">
                        <div class="login-success-container">
                            <div class="login-success-icon">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                                    <polyline points="20 6 9 17 4 12"></polyline>
                                </svg>
                            </div>
                            <div class="login-success-title">You're logged in!</div>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(loginSheet);
            document.body.style.overflow = 'hidden';
            
            // Smooth slide-up: force initial state to be painted, then add .active on next frame
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    loginSheet.classList.add('active');
                });
            });
            
            // Get references to elements
            const phoneInput = document.getElementById('login-phone-input');
            const phoneContainer = document.getElementById('login-phone-container');
            const clearBtn = document.getElementById('login-clear-btn');
            const cursor = document.getElementById('login-cursor');
            const continueBtn = document.getElementById('login-continue-btn');
            const whatsappBtn = document.getElementById('login-whatsapp-btn');
            const closeBtn = document.getElementById('login-close-btn');
            const overlay = loginSheet.querySelector('.login-bottom-sheet-overlay');
            
            // Step elements
            const stepPhone = document.getElementById('login-step-phone');
            const stepOtp = document.getElementById('login-step-otp');
            const stepSuccess = document.getElementById('login-step-success');
            const otpSubtitle = document.getElementById('login-otp-subtitle');
            const otpContainer = document.getElementById('login-otp-container');
            const otpInputs = otpContainer.querySelectorAll('.login-otp-input');
            const resendBtn = document.getElementById('login-resend-otp');
            
            // No typing: input is readonly; no input/focus/clear handlers attached.
            
            function stopCursorBlink() { /* no-op */ }
            
            // Switch to step function
            function switchToStep(step) {
                currentStep = step;
                
                // Hide all steps
                stepPhone.classList.add('hidden');
                stepOtp.classList.add('hidden');
                stepSuccess.classList.add('hidden');
                
                // Show target step with animation
                setTimeout(() => {
                    if (step === 'phone') {
                        stepPhone.classList.remove('hidden');
                    } else if (step === 'otp') {
                        stepOtp.classList.remove('hidden');
                        // Focus first OTP input
                        setTimeout(() => otpInputs[0].focus(), 100);
                    } else if (step === 'success') {
                        stepSuccess.classList.remove('hidden');
                    }
                }, 50);
            }
            
            // Generate dummy OTP
            function generateDummyOTP() {
                return Math.floor(1000 + Math.random() * 9000).toString();
            }
            
            // Auto-fill OTP with animation
            function autoFillOTP(otp) {
                const digits = otp.split('');
                let index = 0;
                
                function fillNext() {
                    if (index < digits.length && index < otpInputs.length) {
                        const input = otpInputs[index];
                        input.value = digits[index];
                        input.classList.add('filled');
                        index++;
                        
                        if (index < digits.length) {
                            setTimeout(fillNext, 150); // 150ms between each digit
                        } else {
                            // All digits filled - verify after short delay
                            setTimeout(verifyOTP, 400);
                        }
                    }
                }
                
                setTimeout(fillNext, 300); // Start after 300ms
            }
            
            // Verify OTP and show success
            function verifyOTP() {
                switchToStep('success');
                
                // Close after showing success
                setTimeout(() => {
                    closeLoginBottomSheet();
                }, 1200);
            }
            
            // OTP input handlers
            otpInputs.forEach((input, index) => {
                input.addEventListener('input', function(e) {
                    const value = e.target.value.replace(/\D/g, '');
                    e.target.value = value.slice(0, 1);
                    
                    if (value && index < otpInputs.length - 1) {
                        // Move to next input
                        otpInputs[index + 1].focus();
                    }
                    
                    if (value) {
                        input.classList.add('filled');
                    } else {
                        input.classList.remove('filled');
                    }
                    
                    // Check if all filled
                    const allFilled = Array.from(otpInputs).every(inp => inp.value.length === 1);
                    if (allFilled) {
                        setTimeout(verifyOTP, 300);
                    }
                });
                
                input.addEventListener('keydown', function(e) {
                    if (e.key === 'Backspace' && !input.value && index > 0) {
                        // Move to previous input on backspace
                        otpInputs[index - 1].focus();
                    }
                });
                
                input.addEventListener('focus', function() {
                    input.select();
                });
            });
            
            // Resend OTP handler
            resendBtn.addEventListener('click', function(e) {
                e.preventDefault();
                resendBtn.disabled = true;
                resendBtn.textContent = 'Sending...';
                
                setTimeout(() => {
                    resendBtn.textContent = 'Resend';
                    resendBtn.disabled = false;
                    
                    // Clear existing OTP
                    otpInputs.forEach(input => {
                        input.value = '';
                        input.classList.remove('filled');
                    });
                    
                    // Auto-fill new dummy OTP
                    const newOtp = generateDummyOTP();
                    autoFillOTP(newOtp);
                }, 1000);
            });
            
            // Continue / WhatsApp: no login flow – close only via X or overlay
            continueBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); });
            whatsappBtn.addEventListener('click', function(e) { e.preventDefault(); e.stopPropagation(); });
            
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
            
            // ========== KEYBOARD HANDLING FOR iOS ==========
            const sheetContent = loginSheet.querySelector('.login-bottom-sheet-content');
            let currentKeyboardHeight = 0;
            let keyboardAnimationFrame = null;
            
            // Get keyboard height using visualViewport API (iOS reliable method)
            function getKeyboardHeight() {
                if (window.visualViewport) {
                    const vv = window.visualViewport;
                    // iOS: keyboard height = difference between window.innerHeight and visualViewport
                    const keyboardHeight = window.innerHeight - vv.height - vv.offsetTop;
                    return Math.max(0, keyboardHeight);
                }
                return 0; // Fallback for browsers without visualViewport
            }
            
            // Apply keyboard offset to bottom sheet
            function applyKeyboardOffset(height) {
                if (keyboardAnimationFrame) {
                    cancelAnimationFrame(keyboardAnimationFrame);
                }
                
                keyboardAnimationFrame = requestAnimationFrame(() => {
                    const clampedHeight = Math.max(0, height);
                    
                    if (window.__CHAT_DEBUG__) {
                        console.log('[Login Keyboard] Height:', clampedHeight, 'px');
                    }
                    
                    if (clampedHeight > 0) {
                        // Keyboard is open - lift sheet above keyboard
                        sheetContent.style.transform = `translateY(-${clampedHeight}px)`;
                        sheetContent.style.transition = 'transform 0.25s ease-out';
                    } else {
                        // Keyboard is closed - reset position
                        sheetContent.style.transform = 'translateY(0)';
                        sheetContent.style.transition = 'transform 0.2s ease-out';
                    }
                    
                    currentKeyboardHeight = clampedHeight;
                });
            }
            
            // Ensure input is visible after keyboard opens
            function ensureInputVisible(inputElement) {
                if (!inputElement) return;
                
                setTimeout(() => {
                    // Scroll the input into view within the sheet content
                    inputElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            }
            
            // Throttled viewport resize handler
            let viewportResizeTimeout = null;
            function handleViewportResize() {
                if (viewportResizeTimeout) return;
                
                viewportResizeTimeout = setTimeout(() => {
                    viewportResizeTimeout = null;
                    const kbHeight = getKeyboardHeight();
                    
                    if (window.__CHAT_DEBUG__) {
                        console.log('[Login Keyboard] Viewport resize - kbHeight:', kbHeight);
                    }
                    
                    applyKeyboardOffset(kbHeight);
                }, 50);
            }
            
            // Attach visualViewport listeners (iOS)
            if (window.visualViewport) {
                window.visualViewport.addEventListener('resize', handleViewportResize);
                window.visualViewport.addEventListener('scroll', handleViewportResize);
                
                if (window.__CHAT_DEBUG__) {
                    console.log('[Login Keyboard] visualViewport listeners attached');
                }
            }
            
            // Enhanced focus handler for phone input
            const originalPhoneFocus = phoneInput.onfocus;
            phoneInput.addEventListener('focus', function(e) {
                if (window.__CHAT_DEBUG__) {
                    console.log('[Login Keyboard] Phone input focused');
                }
                
                // On iOS, keyboard takes time to open - poll for height changes
                let pollCount = 0;
                const pollKeyboard = setInterval(() => {
                    const kbHeight = getKeyboardHeight();
                    if (kbHeight > 50 || pollCount > 20) {
                        clearInterval(pollKeyboard);
                        applyKeyboardOffset(kbHeight);
                        ensureInputVisible(phoneInput);
                    }
                    pollCount++;
                }, 50);
            });
            
            // OTP inputs also need keyboard handling
            otpInputs.forEach(input => {
                input.addEventListener('focus', function() {
                    if (window.__CHAT_DEBUG__) {
                        console.log('[Login Keyboard] OTP input focused');
                    }
                    
                    let pollCount = 0;
                    const pollKeyboard = setInterval(() => {
                        const kbHeight = getKeyboardHeight();
                        if (kbHeight > 50 || pollCount > 20) {
                            clearInterval(pollKeyboard);
                            applyKeyboardOffset(kbHeight);
                            ensureInputVisible(input);
                        }
                        pollCount++;
                    }, 50);
                });
                
                input.addEventListener('blur', function() {
                    // Reset keyboard offset on blur (delay to allow for focus transfer between OTP inputs)
                    setTimeout(() => {
                        if (!document.activeElement || 
                            !loginSheet.contains(document.activeElement) || 
                            document.activeElement.tagName !== 'INPUT') {
                            if (window.__CHAT_DEBUG__) {
                                console.log('[Login Keyboard] OTP blur - resetting offset');
                            }
                            sheetContent.style.transform = 'translateY(0)';
                        }
                    }, 100);
                });
            });
            
            // Cleanup keyboard listeners
            function cleanupKeyboardListeners() {
                if (window.visualViewport) {
                    window.visualViewport.removeEventListener('resize', handleViewportResize);
                    window.visualViewport.removeEventListener('scroll', handleViewportResize);
                }
                if (keyboardAnimationFrame) {
                    cancelAnimationFrame(keyboardAnimationFrame);
                }
                if (viewportResizeTimeout) {
                    clearTimeout(viewportResizeTimeout);
                }
            }
            // ========== END KEYBOARD HANDLING ==========
            
            // Close function
            function closeLoginBottomSheet() {
                stopCursorBlink();
                cleanupKeyboardListeners();
                loginSheet.classList.remove('active');
                setTimeout(() => {
                    loginSheet.remove();
                    document.body.style.overflow = '';
                    showLoginClosedToast();
                }, 300);
            }
        }
        
        // Toast after closing login sheet – Figma Toast component: black, 328×44, 12px radius, white text, close.
        function showLoginClosedToast() {
            const existing = document.getElementById('login-closed-toast');
            if (existing) existing.remove();
            const toast = document.createElement('div');
            toast.id = 'login-closed-toast';
            toast.className = 'login-closed-toast';
            toast.setAttribute('role', 'status');
            const tickSvg = '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M10 1.5C12.2543 1.5 14.4167 2.3952 16.0107 3.98926C17.6048 5.58332 18.5 7.74566 18.5 10C18.5 11.6811 18.0014 13.3248 17.0674 14.7227C16.1335 16.1203 14.8059 17.2092 13.2529 17.8525C11.6998 18.4959 9.9906 18.6649 8.3418 18.3369C6.69296 18.0089 5.178 17.1995 3.98926 16.0107C2.80051 14.822 1.99106 13.307 1.66309 11.6582C1.33514 10.0094 1.50413 8.30021 2.14746 6.74707C2.79078 5.19411 3.87973 3.86655 5.27734 2.93262C6.67516 1.99863 8.31886 1.5 10 1.5Z" fill="#0F8458" stroke="black"/><path d="M13.8045 7.50776C13.8665 7.56967 13.9156 7.64318 13.9492 7.72411C13.9827 7.80503 14 7.89177 14 7.97937C14 8.06697 13.9827 8.15371 13.9492 8.23464C13.9156 8.31556 13.8665 8.38908 13.8045 8.45099L9.13835 13.1171C9.07644 13.1791 9.00293 13.2283 8.922 13.2618C8.84108 13.2954 8.75434 13.3126 8.66674 13.3126C8.57914 13.3126 8.4924 13.2954 8.41147 13.2618C8.33055 13.2283 8.25703 13.1791 8.19512 13.1171L6.19535 11.1174C6.07027 10.9923 6 10.8226 6 10.6457C6 10.4689 6.07027 10.2992 6.19535 10.1741C6.32043 10.049 6.49007 9.97878 6.66696 9.97878C6.84385 9.97878 7.0135 10.049 7.13858 10.1741L8.66674 11.7031L12.8613 7.50776C12.9232 7.44578 12.9967 7.39661 13.0776 7.36307C13.1585 7.32952 13.2453 7.31226 13.3329 7.31226C13.4205 7.31226 13.5072 7.32952 13.5881 7.36307C13.6691 7.39661 13.7426 7.44578 13.8045 7.50776Z" fill="white"/></svg>';
            toast.innerHTML = `
                <div class="login-toast-content">
                    <span class="login-toast-icon" aria-hidden="true">${tickSvg}</span>
                    <span class="login-toast-text">You have been logged in</span>
                </div>
                <div class="login-toast-right">
                    <div class="login-toast-divider"></div>
                    <button type="button" class="login-toast-close" aria-label="Close">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>
            `;
            document.body.appendChild(toast);
            const inputBar = document.querySelector('.chat-input-bar');
            const positionToast = () => {
                if (!inputBar) {
                    toast.style.bottom = 'calc(16px + 48px + env(safe-area-inset-bottom, 0px))';
                    return;
                }
                const rect = inputBar.getBoundingClientRect();
                toast.style.bottom = (window.innerHeight - rect.top + 16) + 'px';
            };
            positionToast();
            const onResize = () => positionToast();
            window.addEventListener('resize', onResize);
            requestAnimationFrame(() => {
                requestAnimationFrame(() => toast.classList.add('login-closed-toast-visible'));
            });
            const removeToast = () => {
                window.removeEventListener('resize', onResize);
                toast.remove();
            };
            const dismiss = () => {
                window.removeEventListener('resize', onResize);
                toast.classList.add('login-closed-toast-out');
                toast.addEventListener('transitionend', function onOutEnd(e) {
                    if (e.propertyName !== 'opacity') return;
                    toast.removeEventListener('transitionend', onOutEnd);
                    removeToast();
                }, { once: true });
            };
            const t = setTimeout(dismiss, 3000);
            toast.querySelector('.login-toast-close').addEventListener('click', (e) => {
                e.preventDefault();
                clearTimeout(t);
                dismiss();
            });
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
            // Generate 8-12 property cards based on search criteria (will be capped to 7 in carousel)
            const numCards = 8 + Math.floor(Math.random() * 5); // 8-12 cards
            const cards = [];
            
            // Create stable carousel ID based on search criteria for memoization
            // This ensures same search = same carouselId = same images (stable across re-renders)
            const searchKey = `${conversationState.intent || 'any'}-${conversationState.bhk || 'any'}-${conversationState.locality || 'any'}-${numCards}`;
            const carouselId = `carousel-${hashPropertyId(searchKey, '').toString(36)}`;
            
            // Track used image URLs for this carousel (selection session)
            const usedImageUrls = new Set();
            
            // Clean up old cache entries
            cleanupImageCache();
            
            // Property names – match the projects carousel style users see in chat
            const propertyNames = [
                'M3M Solitude Ralph Estate',
                'DLF The Camellias',
                'Godrej Aria',
                'Emaar Palm Heights',
                'Sobha City',
                'Prestige Sunrise Park',
                'Luxury Heights',
                'Green Valley'
            ];
            const developers = [
                'M3M India',
                'DLF Limited',
                'Godrej Properties',
                'Emaar India',
                'Sobha Limited',
                'Prestige Group',
                'Godrej Properties',
                'Prestige Group'
            ];
            const localities = [
                'Sector 33, Sohna, Gurgaon',
                'Golf Course Road, Gurgaon',
                'Sector 79, Gurgaon',
                'Sector 77, Gurgaon',
                'Sector 108, Gurgaon',
                'Electronic City, Bangalore',
                'Sector 44, Noida',
                'Sector 62, Noida'
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
                const developerName = developers[i % developers.length];
                const localityName = conversationState.locality
                    ? (conversationState.locality + (conversationState.city ? ', ' + conversationState.city : ''))
                    : localities[i % localities.length];
                
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
                
                // Full project gallery (8–10 photos) so "show pictures" can render 2×2 + See more
                const galleryImages = buildGalleryForProperty(propertyName, imageUrl);
                
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
                    developer: developerName,
                    image: imageUrl,
                    gallery: galleryImages,
                    price: price.value,
                    priceUnit: price.unit,
                    bhk: conversationState.bhk || 3,
                    locality: localityName,
                    type: conversationState.intent === 'rent' ? 'rent' : 'sale',
                    propertyType: propertyTypes[i % propertyTypes.length],
                    status: propertyStatuses[i % propertyStatuses.length],
                    builtUpArea: builtUpArea,
                    distance: distance
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
                
                // Only log in debug mode to keep demo console clean
                if (window.__CHAT_DEBUG__) {
                    console.error('[Image Selection] ❌ DUPLICATE MAIN IMAGES DETECTED in carousel:', {
                        carouselId,
                        totalMainImages: mainImageUrls.length,
                        uniqueMainImages: uniqueMainImages.size,
                        duplicateCount: mainImageUrls.length - uniqueMainImages.size,
                        duplicates: duplicateDetails,
                        mainImageUrls: mainImageUrls
                    });
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

        /** SRP Search screen – from Figma "Final" frame (1147:14005). Opened ONLY by the top SRP search bar. Not wired to AI bottom. */
        function openSrpSearch() {
            removeElementById('srp-search-screen');
            var screen = document.createElement('div');
            screen.id = 'srp-search-screen';
            screen.className = 'srp-search-screen';
            screen.setAttribute('aria-label', 'Search');
            var header = document.createElement('div');
            header.className = 'srp-search-header';
            var backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'srp-search-back';
            backBtn.setAttribute('aria-label', 'Back');
            backBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            var appRow = document.createElement('div');
            appRow.className = 'srp-search-app-row';
            appRow.innerHTML = '<span class="srp-search-buy-label">Buy</span><div class="srp-search-location"><span class="srp-search-location-text">Bangalore</span><svg class="srp-search-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg></div>';
            var searchBarWrap = document.createElement('div');
            searchBarWrap.className = 'srp-search-bar-wrap';
            var searchInput = document.createElement('input');
            searchInput.type = 'text';
            searchInput.className = 'srp-search-input';
            searchInput.placeholder = '2BHK in Bangalore';
            searchInput.setAttribute('autocomplete', 'off');
            var searchBarRight = document.createElement('div');
            searchBarRight.className = 'srp-search-bar-right';
            searchBarRight.innerHTML = '<span class="srp-search-bar-sep"></span><span class="srp-search-bar-dot" aria-hidden="true"></span>';
            searchBarWrap.appendChild(searchInput);
            searchBarWrap.appendChild(searchBarRight);
            header.appendChild(backBtn);
            header.appendChild(appRow);
            header.appendChild(searchBarWrap);
            screen.appendChild(header);
            var scroll = document.createElement('div');
            scroll.className = 'srp-search-scroll';
            var cardNoResults = document.createElement('div');
            cardNoResults.className = 'srp-search-card srp-search-card-no-results';
            cardNoResults.innerHTML = '<div class="srp-search-no-results-head"><span class="srp-search-card-title">No results found</span><div class="srp-search-no-results-logo"><img src="Bottom logo.png" alt="Houzy" class="srp-search-houzy-logo houzy-icon-bounce" onerror="this.src=\'chat-bot.png\'" width="40" height="40"></div></div><p class="srp-search-no-results-text">But I can help you find more relevant homes.</p><button type="button" class="srp-search-cta-primary srp-search-cta-use-houzy"><span class="srp-search-cta-label">Try Houzy</span></button>';
            scroll.appendChild(cardNoResults);
            var cardLocalities = document.createElement('div');
            cardLocalities.className = 'srp-search-card';
            cardLocalities.innerHTML = '<div class="srp-search-card-head"><span class="srp-search-card-title">Popular localities</span></div><div class="srp-search-localities"><div class="srp-search-loc-card"><span class="srp-search-loc-name">Kharadi</span><span class="srp-search-loc-price">₹30.2K/sq.ft.</span></div><div class="srp-search-loc-card"><span class="srp-search-loc-name">DLF Avenue</span><span class="srp-search-loc-price">₹30.2K/sq.ft.</span></div><div class="srp-search-loc-card"><span class="srp-search-loc-name">Hadaspur</span><span class="srp-search-loc-price">₹30.2K/sq.ft.</span></div></div>';
            scroll.appendChild(cardLocalities);
            screen.appendChild(scroll);
            backBtn.onclick = function() {
                screen.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                screen.style.transform = 'translateX(100%)';
                setTimeout(function() {
                    screen.remove();
                }, 300);
            };
            function openChatFromSearch() {
                backBtn.click();
                setTimeout(function() {
                    var chatScreen = document.getElementById('chat-screen');
                    var mainInput = document.getElementById('user-input') || document.getElementById('chat-input');
                    if (chatScreen) {
                        chatScreen.classList.add('active');
                        chatScreen.classList.add('chat-started');
                        if (typeof setChatOffsets === 'function') setChatOffsets();
                        document.body.style.overflow = 'hidden';
                    }
                    if (mainInput) setTimeout(function() { mainInput.focus(); }, 100);
                }, 320);
            }
            var useHouzyBtn = cardNoResults.querySelector('.srp-search-cta-use-houzy');
            if (useHouzyBtn) useHouzyBtn.onclick = openChatFromSearch;
            document.body.appendChild(screen);
            screen.style.transform = 'translateX(100%)';
            screen.style.transition = 'none';
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    screen.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                    screen.style.transform = 'translateX(0)';
                });
            });
            setTimeout(function() { searchInput.focus(); }, 320);
        }

        // All flows page (triggered by "all cases") - slides in from right, list UI
        function showAllFlowsPage() {
            removeElementById('all-flows-page');
            const page = document.createElement('div');
            page.id = 'all-flows-page';
            page.className = 'all-flows-page';
            page.setAttribute('aria-label', 'All flows');
            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'all-flows-back';
            backBtn.setAttribute('aria-label', 'Back');
            backBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            backBtn.onclick = function() {
                page.style.transform = 'translateX(100%)';
                page.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                setTimeout(() => {
                    page.remove();
                    document.body.style.overflow = '';
                }, 300);
            };
            const heading = document.createElement('h1');
            heading.className = 'all-flows-heading';
            heading.textContent = 'All flows';
            const list = document.createElement('div');
            list.className = 'all-flows-list';
            const rowIconSvg = '<svg class="all-flows-row-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#222" viewBox="0 0 256 256" aria-hidden="true"><path d="M128,24A104,104,0,1,0,232,128,104.11,104.11,0,0,0,128,24Zm0,192a88,88,0,1,1,88-88A88.1,88.1,0,0,1,128,216Zm45.66-109.66a8,8,0,0,1,0,11.32l-40,40a8,8,0,0,1-11.32,0l-40-40a8,8,0,0,1,11.32-11.32L128,140.69l34.34-34.35A8,8,0,0,1,173.66,106.34Z"></path></svg>';
            const categories = ['SRP flows'];
            const subCount = 5;
            categories.forEach((label) => {
                const item = document.createElement('div');
                item.className = 'all-flows-item';
                const row = document.createElement('button');
                row.type = 'button';
                row.className = 'all-flows-row';
                row.innerHTML = `<span class="all-flows-row-label">${label}</span>${rowIconSvg}`;
                const sub = document.createElement('div');
                sub.className = 'all-flows-sub';
                for (let i = 1; i <= subCount; i++) {
                    const subRow = document.createElement('button');
                    subRow.type = 'button';
                    subRow.className = 'all-flows-sub-row';
                    subRow.textContent = label === 'SRP flows' && i === 1 ? 'No results' : (label === 'SRP flows' && i === 2 ? 'Broad/Vague Search' : (label === 'SRP flows' && i === 3 ? 'Multiple Filter Changes' : (label === 'SRP flows' && i === 4 ? 'Passive scrolling' : (label === 'SRP flows' && i === 5 ? 'NP: Too many results' : 'Case ' + i))));
                    var srpProperties = [
                        { title: 'Sikka Karnam Greens', meta: '2, 3, 4 BHK Apartment', price: '₹35.4 L - ₹1.15 Cr' },
                        { title: 'DLF Gardencity', meta: '3, 4 BHK', price: '₹1.2 Cr - ₹2.1 Cr' },
                        { title: 'Sunil Apartment Home', meta: '2, 3, 4 BHK', price: '₹2.04 Cr - ₹3.06 Cr' },
                        { title: 'Emaar Palm Heights', meta: '3, 4 BHK Apartment', price: '₹2.5 Cr onwards' },
                        { title: 'Raheja Residency', meta: '2, 3 BHK', price: '₹85 L - ₹1.4 Cr' }
                    ];
                    subRow.onclick = function(e) {
                        e.stopPropagation();
                        if (label === 'SRP flows' && i === 1) {
                            removeElementById('all-flows-page');
                            showSRPCase1Page({ headlineText: 'Want to try opening up your search a bit?', empty: false, properties: srpProperties, srpContext: 'no-results' });
                        } else if (label === 'SRP flows' && i === 2) {
                            removeElementById('all-flows-page');
                            showSRPCase1Page({ headlineText: 'Want help narrowing this down?', empty: false, properties: srpProperties, srpContext: 'broad-search' });
                        } else if (label === 'SRP flows' && i === 3) {
                            removeElementById('all-flows-page');
                            showSRPCase1Page({ headlineText: 'I can help you discover properties faster', empty: false, properties: srpProperties, srpContext: 'filter-changes' });
                        } else if (label === 'SRP flows' && i === 4) {
                            removeElementById('all-flows-page');
                            var passiveProps = srpProperties.concat(srpProperties);
                            showSRPCase1Page({ headlineText: 'Looking for something specific?', empty: false, properties: passiveProps, srpContext: 'passive-scroll' });
                        } else if (label === 'SRP flows' && i === 5) {
                            removeElementById('all-flows-page');
                            var tooManyProps = srpProperties.concat(srpProperties);
                            showSRPCase1Page({ headlineText: 'Want me to shortlist the best ones?', empty: false, properties: tooManyProps, srpContext: 'too-many-results' });
                        } else if (window.__CHAT_DEBUG__) console.log('[All flows] Sub tapped:', label, 'Case', i);
                    };
                    sub.appendChild(subRow);
                }
                row.onclick = function() {
                    const isOpen = item.classList.toggle('is-open');
                    if (window.__CHAT_DEBUG__) console.log('[All flows] Row toggled:', label, isOpen ? 'open' : 'closed');
                };
                item.appendChild(row);
                item.appendChild(sub);
                item.classList.add('is-open');
                list.appendChild(item);
            });

            page.appendChild(backBtn);
            page.appendChild(heading);
            page.appendChild(list);
            document.body.appendChild(page);
            document.body.style.overflow = 'hidden';
            page.style.transform = 'translateX(100%)';
            page.style.transition = 'none';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    page.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                    page.style.transform = 'translateX(0)';
                });
            });
        }

        /**
         * Run a subtle shockwave from the bottom when the SRP bottom AI card appears (SRP only).
         * @param {HTMLElement} container - The SRP page element (e.g. srp-case-page or srp-page)
         */
        function runSrpAiShockwave(container) {
            if (!container || !container.appendChild) return;
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    var wrap = document.createElement('div');
                    wrap.className = 'srp-ai-shockwave';
                    wrap.setAttribute('aria-hidden', 'true');
                    var wave = document.createElement('div');
                    wave.className = 'srp-ai-shockwave-wave';
                    var grain = document.createElement('div');
                    grain.className = 'srp-ai-shockwave-grain';
                    wrap.appendChild(wave);
                    wrap.appendChild(grain);
                    container.appendChild(wrap);
                    var duration = 1600;
                    setTimeout(function() {
                        if (wrap.parentNode) wrap.remove();
                    }, duration);
                });
            });
        }

        /**
         * Show SRP Case page – pixel-perfect to Figma SRP. Reusable for no-properties (Case 1) or random SRP with cards.
         * @param {Object} options
         * @param {string} [options.headlineText] - Text above AI search bar
         * @param {boolean} [options.empty=true] - If true, show "No properties found" widget on top only
         * @param {Array} [options.properties] - Optional list of { title, meta, price, image } for cards (Unsplash used if image not provided)
         */
        function showSRPCase1Page(options) {
            options = options || {};
            const headlineText = options.headlineText || 'Want to try opening up your search a bit?';
            const empty = options.empty !== false;
            const properties = options.properties || [];
            const srpContext = options.srpContext || null; /* 'no-results' | 'broad-search' | 'filter-changes' | 'passive-scroll' | 'too-many-results' | 'sort-multiple' when from those flows */

            removeElementById('srp-case-1-page');
            const page = document.createElement('div');
            page.id = 'srp-case-1-page';
            page.className = 'srp-case-page';

            function closePage() {
                removeElementById('srp-sort-bottom-sheet');
                page.style.transform = 'translateX(100%)';
                page.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                setTimeout(function() {
                    page.remove();
                    delete document.body.dataset.returnToCase1;
                    /* SRP back → options page (All flows list) */
                    showAllFlowsPage();
                }, 300);
            }

            // Figma SRP: header 72px white, 16px padding, back + search (352px content width)
            const header = document.createElement('div');
            header.className = 'srp-case-header';
            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'srp-case-back';
            backBtn.setAttribute('aria-label', 'Back');
            backBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>';
            backBtn.onclick = closePage;
            const searchRow = document.createElement('div');
            searchRow.className = 'srp-case-search-row';
            const searchField = document.createElement('input');
            searchField.type = 'text';
            searchField.className = 'srp-case-search-field';
            searchField.placeholder = 'What are you looking for?';
            searchField.setAttribute('readonly', 'readonly');
            const searchWrap = document.createElement('div');
            searchWrap.className = 'srp-case-search-field-wrap';
            const searchIcon = document.createElement('span');
            searchIcon.className = 'srp-case-search-icon';
            searchIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#5e23dc" viewBox="0 0 256 256"><path d="M229.66,218.34l-50.07-50.06a88.11,88.11,0,1,0-11.31,11.31l50.06,50.07a8,8,0,0,0,11.32-11.32ZM40,112a72,72,0,1,1,72,72A72.08,72.08,0,0,1,40,112Z"></path></svg>';
            const sep = document.createElement('span');
            sep.className = 'srp-case-search-separator';
            const searchBtn = document.createElement('button');
            searchBtn.type = 'button';
            searchBtn.className = 'srp-case-search-btn';
            searchBtn.setAttribute('aria-label', 'Search');
            searchBtn.innerHTML = '<svg class="srp-case-search-btn-star" xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 256 256"><path d="M240,128a15.79,15.79,0,0,1-10.5,15l-63.44,23.07L143,229.5a16,16,0,0,1-30,0L89.94,166.06,26.5,143a16,16,0,0,1,0-30L89.94,89.94,113,26.5a16,16,0,0,1,30,0l23.07,63.44L229.5,113A15.79,15.79,0,0,1,240,128Z"></path></svg>';
            searchBtn.onclick = function() { openChatFromCase1(); };
            searchWrap.appendChild(searchField);
            searchWrap.appendChild(searchIcon);
            searchWrap.appendChild(sep);
            searchWrap.appendChild(searchBtn);
            searchRow.appendChild(backBtn);
            searchRow.appendChild(searchWrap);
            header.appendChild(searchRow);

            // TOP SRP search bar only (above filters): tap opens Figma Search screen. AI bottom (Ask Houzy pill/headline) is NOT wired here – it opens chat only.
            function openSearchFromTopBar(e) {
                if (e.target.closest('.srp-case-back') || e.target.closest('.srp-case-search-btn')) return;
                if (!e.target.closest('.srp-case-header')) return; // only header top bar, never AI bottom
                e.preventDefault();
                e.stopPropagation();
                openSrpSearch();
            }
            searchWrap.addEventListener('click', openSearchFromTopBar);
            searchField.addEventListener('click', openSearchFromTopBar);

            // Tabs: All, Projects, New launches, Owner, Ready to move – each with distinct icon
            const tabsRow = document.createElement('div');
            tabsRow.className = 'srp-case-tabs-row';
            const tabItems = [
                { label: 'All', icon: 'grid' },
                { label: 'Projects', icon: 'building' },
                { label: 'New launches', icon: 'star' },
                { label: 'Owner', icon: 'user' },
                { label: 'Ready to move', icon: 'check' }
            ];
            tabItems.forEach(function(item, i) {
                const tab = document.createElement('button');
                tab.type = 'button';
                tab.className = 'srp-case-tab' + (i === 0 ? ' active' : '');
                var iconSvg = getSRPTabIcon ? getSRPTabIcon(item.icon) : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
                tab.innerHTML = '<span class="srp-case-tab-icon">' + iconSvg + '</span><span class="srp-case-tab-label">' + item.label + '</span>';
                tabsRow.appendChild(tab);
            });
            header.appendChild(tabsRow);

            // Filters: Sort icon first, then Filters (3), Budget, BHK type, Property type
            const filtersRow = document.createElement('div');
            filtersRow.className = 'srp-case-filters-row';
            var sortIconSvg = '<svg class="srp-case-sort-icon-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true"><path d="M200,136a8,8,0,0,1-8,8H64a8,8,0,0,1,0-16H192A8,8,0,0,1,200,136Zm32-56H24a8,8,0,0,0,0,16H232a8,8,0,0,0,0-16Zm-80,96H104a8,8,0,0,0,0,16h48a8,8,0,0,0,0-16Z"></path></svg>';
            var sortBtn = document.createElement('button');
            sortBtn.type = 'button';
            sortBtn.className = 'srp-case-sort-btn';
            sortBtn.setAttribute('aria-label', 'Sort');
            sortBtn.innerHTML = sortIconSvg;
            filtersRow.appendChild(sortBtn);
            var arrowSvg = '<svg class="srp-case-filter-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>';
            const filterItems = [
                { label: 'Filters (3)', active: true },
                { label: 'Budget', active: false },
                { label: 'BHK type', active: false },
                { label: 'Property type', active: false }
            ];
            filterItems.forEach(function(f) {
                const pill = document.createElement('button');
                pill.type = 'button';
                pill.className = 'srp-case-filter-pill' + (f.active ? ' active' : '') + (f.clear ? ' clear' : '');
                pill.innerHTML = '<span>' + f.label + '</span>' + arrowSvg;
                filtersRow.appendChild(pill);
            });
            header.appendChild(filtersRow);

            const main = document.createElement('div');
            main.className = 'srp-case-main';

            if (srpContext === 'no-results') {
                // No-results only: AI widget above, Personalise card below (match Figma); no property cards
                var aiWidget = document.createElement('div');
                aiWidget.className = 'srp-search-card srp-search-card-no-results srp-case-no-results-ai-widget';
                aiWidget.innerHTML = '<div class="srp-search-no-results-head"><span class="srp-search-card-title">No results found</span><div class="srp-search-no-results-logo"><img src="Bottom logo.png" alt="Houzy" class="srp-search-houzy-logo houzy-icon-bounce" onerror="this.src=\'chat-bot.png\'" width="40" height="40"></div></div><p class="srp-search-no-results-text">But I can help you find more relevant homes.</p><button type="button" class="srp-search-cta-primary srp-search-cta-use-houzy"><span class="srp-search-cta-label">Try Houzy</span></button>';
                main.appendChild(aiWidget);
                var useHouzyWidgetBtn = aiWidget.querySelector('.srp-search-cta-use-houzy');
                if (useHouzyWidgetBtn) useHouzyWidgetBtn.addEventListener('click', openChatFromCase1);

                var personaliseWrap = document.createElement('div');
                personaliseWrap.className = 'srp-case-no-results-personalise';
                personaliseWrap.innerHTML = `
                    <div class="srp-case-no-results-figma-frame">
                        <h2 class="srp-case-no-results-headline">Personalise your home search journey!</h2>
                        <div class="srp-case-no-results-row">
                            <p class="srp-case-no-results-sub">Enhance your search experience with just 3 quick answers.</p>
                            <button type="button" class="srp-case-no-results-cta">
                                <span class="srp-case-no-results-cta-label">Let's begin</span>
                            </button>
                        </div>
                    </div>
                `;
                main.appendChild(personaliseWrap);
                var useHouzyBtn = personaliseWrap.querySelector('.srp-case-no-results-cta');
                if (useHouzyBtn) useHouzyBtn.addEventListener('click', openChatFromCase1);
            } else if (empty) {
                var noProps = document.createElement('div');
                noProps.className = 'srp-case-no-properties';
                noProps.innerHTML = `
                    <div class="srp-case-no-properties-icon" aria-hidden="true"></div>
                    <h2 class="srp-case-no-properties-headline">No properties found</h2>
                    <p class="srp-case-no-properties-sub">Try adjusting your filters or search</p>
                `;
                main.appendChild(noProps);
            }

            if (properties.length > 0 && srpContext !== 'no-results') {
                var cardsWrap = document.createElement('div');
                cardsWrap.className = 'srp-case-cards';
                var imgPool = ['HOUSE 1.jpg', 'HOUSE 2.jpg', 'HOUSE 3.jpg', 'HOUSE 4.jpg', 'HOUSE 5.jpg'];
                function pickRandomImg() { return imgPool[Math.floor(Math.random() * imgPool.length)]; }
                function imgUrl(path) { return encodeURI(path); }
                // Main listing cards – two images, Verified/RERA, 3D view, owner, View Number / Call
                for (var j = 0; j < Math.max(1, properties.length); j++) {
                    var p = properties[j] || properties[0];
                    var g1 = p.image ? encodeURI(p.image) : imgUrl(pickRandomImg());
                    var g2 = p.image ? encodeURI(p.image) : imgUrl(pickRandomImg());
                    var listing = document.createElement('div');
                    listing.className = 'srp-case-card listing';
                    listing.innerHTML = `
                        <div class="srp-case-gallery">
                            <div class="srp-case-gallery-img" style="background-image:url('${g1}')">
                                <span class="srp-case-badge left">Verified</span>
                                <span class="srp-case-badge right">RERA</span>
                                <span class="srp-case-gallery-counter">1/23</span>
                                <a href="#" class="srp-case-3d-link">3D view &gt;</a>
                            </div>
                            <div class="srp-case-gallery-img" style="background-image:url('${g2}')">
                                <button type="button" class="srp-case-gallery-fav" aria-label="Save"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg></button>
                                <span class="srp-case-listing-ago">1d ago</span>
                            </div>
                        </div>
                        <div class="srp-case-listing-body">
                            <p class="srp-case-listing-status">Ready to Move • Avg. Price/ sq.ft. ₹14k</p>
                            <p class="srp-case-listing-bhk">3 BHK Apartment</p>
                            <p class="srp-case-listing-price">₹2.85 Cr</p>
                            <p class="srp-case-listing-project">${p.title || 'Ariisto Bellanza Phase 1 Wing Apartments Phase II'}</p>
                            <p class="srp-case-listing-address">Sector 81, near Dwarka Expressway, New Gurgaon</p>
                            <div class="srp-case-owner-row">
                                <div class="srp-case-owner">
                                    <div class="srp-case-owner-avatar" style="background-image:url(https://i.pravatar.cc/80?img=12)"></div>
                                    <div>
                                        <p class="srp-case-owner-name">Yashsvir Singh</p>
                                        <p class="srp-case-owner-role">Owner</p>
                                    </div>
                                </div>
                                <div class="srp-case-owner-actions">
                                    <button type="button" class="srp-case-btn-view-number">View Number</button>
                                    <button type="button" class="srp-case-call-btn" aria-label="Call"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="#fff" viewBox="0 0 256 256"><path d="M231.88,175.08A56.26,56.26,0,0,1,176,224C96.6,224,32,159.4,32,80A56.26,56.26,0,0,1,80.92,24.12a16,16,0,0,1,16.62,9.52l21.12,47.15,0,.12A16,16,0,0,1,117.39,96c-.18.27-.37.52-.57.77L96,121.45c7.49,15.22,23.41,31,38.83,38.51l24.34-20.71a8.12,8.12,0,0,1,.75-.56,16,16,0,0,1,15.17-1.4l.13.06,47.11,21.11A16,16,0,0,1,231.88,175.08Z"></path></svg></button>
                                </div>
                            </div>
                        </div>
                    `;
                    cardsWrap.appendChild(listing);
                }
                main.appendChild(cardsWrap);
            }

            // Single container: nav and AI are two layers inside; height + opacity transition (no mount/unmount)
            const bottomWrap = document.createElement('div');
            bottomWrap.className = 'srp-case-bottom-wrap';

            // Figma Property 1=Bottom: 60px, white, #e8e8e8 border
            const navSvg = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#434343" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>';
            const initialBottom = document.createElement('div');
            initialBottom.className = 'srp-case-initial-bottom';
            initialBottom.innerHTML = `
                <div class="srp-case-nav-items">
                    <button type="button" class="srp-case-nav-item"><span class="srp-case-nav-icon">${navSvg}</span><span class="srp-case-nav-label">Suggestions</span></button>
                    <button type="button" class="srp-case-nav-item"><span class="srp-case-nav-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#434343" stroke-width="1.5"><path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/></svg></span><span class="srp-case-nav-label">Saved</span></button>
                    <button type="button" class="srp-case-nav-item"><span class="srp-case-nav-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#434343" stroke-width="1.5"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg></span><span class="srp-case-nav-label">Profile</span></button>
                    <button type="button" class="srp-case-nav-item"><span class="srp-case-nav-icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#434343" stroke-width="1.5"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"/></svg></span><span class="srp-case-nav-label">Project</span></button>
                </div>
            `;

            // Figma Property 1=AI bottom: only for non–no-results flows (no-results has no bottom AI)
            var aiBottom = null;
            if (srpContext !== 'no-results') {
                aiBottom = document.createElement('div');
                aiBottom.className = 'srp-case-ai-bottom';
                aiBottom.innerHTML = `
                    <div class="srp-case-ai-top-row">
                        <div class="srp-case-ai-headline case-page-headline-shimmer" data-text="${headlineText.replace(/"/g, '&quot;')}">${headlineText}</div>
                        <button type="button" class="srp-case-ai-close" aria-label="Close">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                        </button>
                    </div>
                    <div class="srp-case-ai-pill">
                        <div class="srp-case-ai-pill-inner">
                            <div class="srp-case-ai-logo" aria-hidden="true">
                                <img src="Bottom logo.png" alt="" width="20" height="20" class="srp-case-ai-logo-img" onerror="this.src='chat-bot.png'">
                            </div>
                            <span class="srp-case-ai-placeholder">Ask Houzy</span>
                        </div>
                    </div>
                `;
            }

            bottomWrap.appendChild(initialBottom);
            if (aiBottom) bottomWrap.appendChild(aiBottom);
            page.appendChild(header);
            page.appendChild(main);
            page.appendChild(bottomWrap);

            if (aiBottom) {
                var closeBtn = aiBottom.querySelector('.srp-case-ai-close');
                if (closeBtn) {
                    closeBtn.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        bottomWrap.classList.remove('is-ai-visible');
                    });
                }
            }

            // Click on search bar (pill or headline) → open AI chat; SRP stays visible behind chat. Back in chat returns here.
            function openChatFromCase1() {
                document.body.dataset.returnToCase1 = page.id;
                page.style.zIndex = '10001';
                var chatScreen = document.getElementById('chat-screen');
                var chatBackBtn = document.getElementById('chat-back-btn');
                if (chatScreen) {
                    chatScreen.classList.add('active');
                    chatScreen.classList.add('chat-started');
                    if (typeof setChatOffsets === 'function') setChatOffsets();
                    chatBackBtn.removeAttribute('disabled');
                    chatBackBtn.removeAttribute('tabindex');
                    document.body.style.overflow = 'hidden';
                }
                var mainInput = document.getElementById('user-input') || document.getElementById('chat-input');
                if (mainInput) setTimeout(function() { mainInput.focus(); }, 100);
                if (srpContext === 'no-results' && typeof addBotMessage === 'function') {
                    setTimeout(function() {
                        addBotMessage("Hmm, not many options here. Want me to suggest nearby areas or adjust filters to find more properties?", true);
                    }, 400);
                }
                if (srpContext === 'broad-search' && typeof addBotMessage === 'function') {
                    setTimeout(function() {
                        addBotMessage("Hey! Looks like you're exploring broadly. Tell me what matters most, budget, location, size? I'll find the right fit.", true);
                    }, 400);
                }
                if (srpContext === 'filter-changes' && typeof addBotMessage === 'function') {
                    setTimeout(function() {
                        addBotMessage("Looks like you're still searching for the right combo. Just tell me what you need, I'll set the filters for you.", true);
                    }, 400);
                }
                if (srpContext === 'passive-scroll' && typeof addBotMessage === 'function') {
                    setTimeout(function() {
                        addBotMessage("You've scrolled a lot but nothing clicked yet. What's missing? Tell me and I'll filter it down.", true);
                    }, 400);
                }
                if (srpContext === 'too-many-results' && typeof addBotMessage === 'function') {
                    setTimeout(function() {
                        addBotMessage("There's a lot here! Want me to shortlist the top 5 that actually match what you're looking for?", true);
                    }, 400);
                }
                if (srpContext === 'sort-multiple' && typeof addBotMessage === 'function') {
                    setTimeout(function() {
                        addBotMessage("Can't find the right order? Tell me your priority, price, size, new listings, I'll sort it for you.", true);
                    }, 400);
                }
            }
            if (aiBottom) {
                var pill = aiBottom.querySelector('.srp-case-ai-pill');
                var headline = aiBottom.querySelector('.srp-case-ai-headline');
                if (pill) pill.addEventListener('click', openChatFromCase1);
                if (headline) headline.addEventListener('click', openChatFromCase1);
            }

            document.body.appendChild(page);
            document.body.style.overflow = 'hidden';

            page.style.transform = 'translateX(100%)';
            page.style.transition = 'none';
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    page.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
                    page.style.transform = 'translateX(0)';
                });
            });

            if (srpContext === 'filter-changes') {
                var filterClickCount = 0;
                var filterPills = page.querySelectorAll('.srp-case-filter-pill');
                function maybeShowAiBottom() {
                    filterClickCount++;
                    if (filterClickCount >= 3) {
                        bottomWrap.classList.add('is-ai-visible');
                        runSrpAiShockwave(page);
                        filterPills.forEach(function(p) {
                            p.removeEventListener('click', onFilterClick);
                        });
                    }
                }
                function onFilterClick() { maybeShowAiBottom(); }
                filterPills.forEach(function(pill) {
                    pill.addEventListener('click', onFilterClick);
                });
            } else if (srpContext === 'sort-multiple') {
                if (sortBtn) {
                    sortBtn.addEventListener('click', function openSortSheet(e) {
                        if (e) { e.preventDefault(); e.stopPropagation(); }
                        removeElementById('srp-sort-bottom-sheet');
                        var overlay = document.createElement('div');
                        overlay.id = 'srp-sort-bottom-sheet';
                        overlay.className = 'srp-sort-bottom-sheet';
                        var sheetContent = document.createElement('div');
                        sheetContent.className = 'srp-sort-sheet-content';
                        var cta = document.createElement('button');
                        cta.type = 'button';
                        cta.className = 'srp-sort-sheet-cta';
                        cta.textContent = 'Click me 5 times';
                        var clickCount = 0;
                        cta.addEventListener('click', function() {
                            clickCount++;
                            if (clickCount >= 5) {
                                overlay.classList.remove('active');
                                overlay.style.transition = 'opacity 0.2s';
                                setTimeout(function() {
                                    overlay.remove();
                                    bottomWrap.classList.add('is-ai-visible');
                                    runSrpAiShockwave(page);
                                }, 200);
                            }
                        });
                        sheetContent.appendChild(cta);
                        var sheetOverlay = document.createElement('div');
                        sheetOverlay.className = 'srp-sort-sheet-overlay';
                        sheetOverlay.addEventListener('click', function() {
                            overlay.classList.remove('active');
                            setTimeout(function() { overlay.remove(); }, 200);
                        });
                        overlay.appendChild(sheetOverlay);
                        overlay.appendChild(sheetContent);
                        document.body.appendChild(overlay);
                        overlay.style.opacity = '0';
                        requestAnimationFrame(function() {
                            overlay.classList.add('active');
                            overlay.style.opacity = '1';
                        });
                    });
                }
            } else if (srpContext === 'passive-scroll') {
                var scrollDepthReached = 0;
                var mainEl = page.querySelector('.srp-case-main');
                function onPassiveScroll() {
                    if (!mainEl || scrollDepthReached >= 3) return;
                    var maxScroll = mainEl.scrollHeight - mainEl.clientHeight;
                    if (maxScroll <= 0) return;
                    var pct = mainEl.scrollTop / maxScroll;
                    if (pct >= 0.25) scrollDepthReached = Math.max(scrollDepthReached, 1);
                    if (pct >= 0.5) scrollDepthReached = Math.max(scrollDepthReached, 2);
                    if (pct >= 0.75) scrollDepthReached = Math.max(scrollDepthReached, 3);
                    if (scrollDepthReached >= 3) {
                        bottomWrap.classList.add('is-ai-visible');
                        runSrpAiShockwave(page);
                        mainEl.removeEventListener('scroll', onPassiveScroll);
                    }
                }
                if (mainEl) mainEl.addEventListener('scroll', onPassiveScroll, { passive: true });
            } else if (srpContext !== 'no-results') {
                var delayMs = 2000 + Math.random() * 1000;
                setTimeout(function() {
                    bottomWrap.classList.add('is-ai-visible');
                    runSrpAiShockwave(page);
                }, delayMs);
            }
        }
        
        // Houzy pill / star icon: open list view (All flows) so user can pick SRP or other flows
        window.__openSRPDirect = function() {
            showAllFlowsPage();
        };
        
        // Show Search Results Page (SRP) - Pixel-perfect Figma implementation (Monochrome)
        function showViewAllPage(allCards) {
            // Remove existing if any
            removeElementById('view-all-properties-page');
            
            const page = document.createElement('div');
            page.id = 'view-all-properties-page';
            page.className = 'srp-page';
            
            // ========== HEADER ==========
            const header = document.createElement('div');
            header.className = 'srp-header';
            
            // Back button
            const backBtn = document.createElement('button');
            backBtn.className = 'srp-back-btn';
            backBtn.innerHTML = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>`;
            backBtn.onclick = function() {
                page.remove();
                document.body.style.overflow = '';
            };
            
            // Search bar container
            const searchBar = document.createElement('div');
            searchBar.className = 'srp-search-bar';
            
            const searchInput = document.createElement('div');
            searchInput.className = 'srp-search-input-wrapper';
            searchInput.innerHTML = `
                <div class="srp-search-cursor"></div>
                <span class="srp-search-placeholder">What are you looking for?</span>
            `;
            
            const searchBtn = document.createElement('button');
            searchBtn.className = 'srp-search-btn';
            searchBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`;
            
            searchBar.appendChild(searchInput);
            searchBar.appendChild(searchBtn);
            // View-all SRP: only the TOP search bar (above filters) opens Figma Search. Sparkle/buttons unchanged.
            searchBar.addEventListener('click', function(e) {
                if (e.target.closest('.srp-search-btn')) return;
                e.preventDefault();
                e.stopPropagation();
                openSrpSearch();
            });
            searchInput.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                openSrpSearch();
            });
            header.appendChild(backBtn);
            header.appendChild(searchBar);
            
            // ========== INTEREST LED TABS ==========
            const tabsContainer = document.createElement('div');
            tabsContainer.className = 'srp-tabs-container';
            
            const tabs = document.createElement('div');
            tabs.className = 'srp-tabs';
            
            const tabItems = [
                { name: 'All', icon: 'grid', active: true },
                { name: 'Projects', icon: 'building' },
                { name: 'New launches', icon: 'star' },
                { name: 'Owner', icon: 'user' },
                { name: 'Ready to move', icon: 'check' },
                { name: 'Verified', icon: 'verified' }
            ];
            
            tabItems.forEach((tab) => {
                const tabBtn = document.createElement('button');
                tabBtn.className = 'srp-tab' + (tab.active ? ' active' : '');
                tabBtn.innerHTML = `
                    <div class="srp-tab-icon">${getSRPTabIcon(tab.icon)}</div>
                    <span class="srp-tab-label">${tab.name}</span>
                    ${tab.active ? '<div class="srp-tab-indicator"></div>' : ''}
                `;
                tabs.appendChild(tabBtn);
            });
            
            tabsContainer.appendChild(tabs);
            
            // ========== FILTERS ==========
            const filters = document.createElement('div');
            filters.className = 'srp-filters';
            
            const filterItems = [
                { label: 'Filters (3)', active: true },
                { label: 'Budget', dropdown: true },
                { label: 'BHK type', dropdown: true },
                { label: 'Property type', dropdown: true }
            ];
            
            filterItems.forEach((filter) => {
                const filterBtn = document.createElement('button');
                filterBtn.className = 'srp-filter-btn' + (filter.active ? ' active' : '');
                filterBtn.innerHTML = `
                    <span>${filter.label}</span>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                `;
                filters.appendChild(filterBtn);
            });
            
            // ========== PROPERTY LIST ==========
            const propertyList = document.createElement('div');
            propertyList.className = 'srp-property-list';
            
            // Generate sample properties (extended for longer scroll)
            const sampleProperties = generateSRPProperties(allCards);
            sampleProperties.forEach((prop, index) => {
                const card = createSRPPropertyCard(prop, index === 0);
                propertyList.appendChild(card);
            });
            
            // ========== STICKY HEADER WRAPPER ==========
            const stickyHeader = document.createElement('div');
            stickyHeader.className = 'srp-sticky-header';
            stickyHeader.appendChild(header);
            stickyHeader.appendChild(tabsContainer);
            stickyHeader.appendChild(filters);
            
            // ========== BOTTOM NAVIGATION CONTAINER (Nav + AI Chat Bar) ==========
            const bottomNavContainer = document.createElement('div');
            bottomNavContainer.className = 'srp-bottom-container';
            
            // Bottom Navigation
            const bottomNav = document.createElement('div');
            bottomNav.className = 'srp-bottom-nav';
            bottomNav.innerHTML = `
                <button class="srp-nav-item">
                    <div class="srp-nav-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/>
                        </svg>
                    </div>
                    <span class="srp-nav-label">Suggestions</span>
                </button>
                <button class="srp-nav-item">
                    <div class="srp-nav-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
                        </svg>
                    </div>
                    <span class="srp-nav-label">Saved</span>
                </button>
                <button class="srp-nav-item">
                    <div class="srp-nav-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
                        </svg>
                    </div>
                    <span class="srp-nav-label">Profile</span>
                </button>
            `;
            
            // AI Chat Bar
            const aiChatBar = document.createElement('div');
            aiChatBar.className = 'srp-ai-chat-bar';
            aiChatBar.innerHTML = `
                <button type="button" class="srp-ai-close" aria-label="Close">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
                <div class="ai-chat-pill">
                    <div class="ai-chat-glow"></div>
                    <div class="ai-chat-stroke"></div>
                    <div class="ai-chat-content">
                        <div class="ai-chat-icon">
                            <img src="Bottom logo.png" alt="AI" class="ai-chat-houze-icon" onerror="this.src='chat-bot.png'" />
                        </div>
                        <input type="text" class="ai-chat-input" placeholder="Ask Houzy" readonly />
                        <button class="ai-icon-btn ai-mic-btn" aria-label="Voice input">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                                <path d="M12 1a3 3 0 00-3 3v8a3 3 0 006 0V4a3 3 0 00-3-3z"/>
                                <path d="M19 10v2a7 7 0 01-14 0v-2"/>
                                <line x1="12" y1="19" x2="12" y2="23"/>
                                <line x1="8" y1="23" x2="16" y2="23"/>
                            </svg>
                        </button>
                        <button class="ai-send-btn" aria-label="Send">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <line x1="12" y1="19" x2="12" y2="5"/>
                                <polyline points="5 12 12 5 19 12"/>
                            </svg>
                        </button>
                    </div>
                </div>
            `;

            // Close AI bar and show nav again (SRP only)
            var srpAiClose = aiChatBar.querySelector('.srp-ai-close');
            if (srpAiClose) {
                srpAiClose.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    isAIChatActive = false;
                    bottomNavContainer.classList.remove('ai-active');
                });
            }

            // Clicking AI chat bar opens the chat
            aiChatBar.addEventListener('click', function(e) {
                if (!e.target.closest('.ai-send-btn')) {
                    // Close SRP and focus on chat input
                    page.remove();
                    document.body.style.overflow = '';
                    // Focus the main chat input
                    const mainInput = document.getElementById('user-input');
                    if (mainInput) {
                        setTimeout(() => mainInput.focus(), 100);
                    }
                }
            });
            
            bottomNavContainer.appendChild(bottomNav);
            bottomNavContainer.appendChild(aiChatBar);
            
            // Assemble page
            page.appendChild(stickyHeader);
            page.appendChild(propertyList);
            page.appendChild(bottomNavContainer);
            
            document.body.appendChild(page);
            document.body.style.overflow = 'hidden';
            
            // ========== SCROLL-BASED AI CHAT TAKEOVER (tabs stay visible always) ==========
            let isAIChatActive = false;
            let rafPending = false;
            const AI_ENTER_THRESHOLD = 0.8; // Show AI bar after 0.8x viewport (less scrolling needed)
            const AI_EXIT_THRESHOLD = 0.5;  // Hide AI bar when scrolling back above 0.5x viewport
            
            const handleScroll = () => {
                rafPending = false;
                const scrollTop = propertyList.scrollTop;
                const viewportHeight = window.innerHeight;
                const scrollRatio = scrollTop / viewportHeight;
                
                // AI Chat bar takeover with hysteresis (tabs no longer collapse)
                if (scrollRatio >= AI_ENTER_THRESHOLD && !isAIChatActive) {
                    isAIChatActive = true;
                    bottomNavContainer.classList.add('ai-active');
                    runSrpAiShockwave(page);
                } else if (scrollRatio < AI_EXIT_THRESHOLD && isAIChatActive) {
                    isAIChatActive = false;
                    bottomNavContainer.classList.remove('ai-active');
                }
            };
            
            propertyList.addEventListener('scroll', function() {
                if (!rafPending) {
                    rafPending = true;
                    requestAnimationFrame(handleScroll);
                }
            }, { passive: true });
        }
        
        // Get tab icon SVG for SRP
        function getSRPTabIcon(type) {
            const icons = {
                'grid': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="3" width="7" height="7" rx="1"></rect><rect x="14" y="14" width="7" height="7" rx="1"></rect><rect x="3" y="14" width="7" height="7" rx="1"></rect></svg>',
                'building': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 12v.01M9 15v.01M9 18v.01"></path></svg>',
                'star': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L9 9H2l6 5-2 8 6-4 6 4-2-8 6-5h-7L12 2z"></path></svg>',
                'user': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>',
                'check': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>',
                'verified': '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>'
            };
            return icons[type] || icons['grid'];
        }
        
        // Generate SRP properties from cards (extended for longer scroll)
        function generateSRPProperties(cards) {
            const properties = [];
            const locations = [
                'Dwarka, New Gurgaon', 
                'Sector 81, near Dwarka Expressway, New Gurgaon', 
                'Golf Course Road, Gurgaon', 
                'Sohna Road, Gurgaon',
                'Sector 67, Gurgaon',
                'MG Road, Gurgaon',
                'Sector 54, Golf Course Extension',
                'Sector 70A, Gurgaon'
            ];
            const projectNames = [
                'Sunil Apartment Housing', 
                'Ariisto Bellanza Phase 1 Wing Apartments Phase II', 
                'DLF The Camellias', 
                'M3M Golf Estate',
                'Godrej Aria',
                'Emaar Palm Heights',
                'Sobha City',
                'Vatika Seven Elements',
                'Ireo Victory Valley',
                'Bestech Park View Spa'
            ];
            const ownerNames = ['Yashvir Singh', 'Rahul Sharma', 'Priya Kapoor', 'Amit Verma', 'Neha Gupta', 'Vikram Chauhan', 'Sanjay Mehta', 'Pooja Reddy'];
            
            // Add sponsored property first
            properties.push({
                isSponsored: true,
                name: projectNames[0],
                bhk: '3 BHK Apartment',
                location: locations[0],
                priceRange: '₹2.04 Cr. - ₹3.06 Cr.',
                image: PROPERTY_IMAGE_POOL[0]
            });
            
            // Add 12 regular properties for longer scroll
            for (let i = 0; i < 12; i++) {
                const card = cards && cards[i % cards.length] ? cards[i % cards.length] : null;
                properties.push({
                    isSponsored: false,
                    name: projectNames[(i + 1) % projectNames.length],
                    bhk: `${2 + (i % 3)} BHK Apartment`,
                    location: locations[(i + 1) % locations.length],
                    price: `₹${(2.5 + (i % 5) * 0.35).toFixed(2)} Cr`,
                    avgPrice: `₹${12 + (i % 6) * 2}k`,
                    status: i % 3 === 0 ? 'Under Construction' : 'Ready to Move',
                    daysAgo: `${1 + (i % 7)}d ago`,
                    ownerName: ownerNames[i % ownerNames.length],
                    image: card ? card.image : PROPERTY_IMAGE_POOL[(i + 1) % PROPERTY_IMAGE_POOL.length],
                    gallery: card ? card.gallery : [PROPERTY_IMAGE_POOL[(i + 1) % PROPERTY_IMAGE_POOL.length], PROPERTY_IMAGE_POOL[(i + 2) % PROPERTY_IMAGE_POOL.length]]
                });
            }
            
            return properties;
        }
        
        // Create SRP property card - Pixel-perfect Figma implementation
        function createSRPPropertyCard(prop, isSponsored) {
            const card = document.createElement('div');
            card.className = 'srp-property-card' + (isSponsored ? ' sponsored' : '');
            
            if (isSponsored) {
                card.innerHTML = `
                    <div class="srp-card-sponsored-wrapper">
                        <div class="srp-card-sponsored-badge">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#656565" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
                            <span>Sponsored</span>
                        </div>
                        <div class="srp-card-sponsored-layout">
                            <div class="srp-card-sponsored-image">
                                <img src="${prop.image}" alt="${prop.name}" onerror="this.style.display='none'" />
                            </div>
                            <div class="srp-card-sponsored-info">
                                <div class="srp-card-sponsored-title">${prop.name}</div>
                                <div class="srp-card-sponsored-meta">
                                    <span>${prop.bhk}</span>
                                    <span>${prop.location}</span>
                                </div>
                                <div class="srp-card-sponsored-price">${prop.priceRange}</div>
                            </div>
                            <button class="srp-card-call-btn">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none">
                                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                </svg>
                            </button>
                        </div>
                        <div class="srp-card-know-more">
                            <span>Know more</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                        </div>
                    </div>
                `;
            } else {
                card.innerHTML = `
                    <div class="srp-card-gallery">
                        <div class="srp-card-gallery-main">
                            <img src="${prop.image}" alt="${prop.name}" />
                            <div class="srp-card-gallery-badges-top">
                                <div class="srp-badge verified">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                                    <span>Verified</span>
                                </div>
                                <div class="srp-badge rera">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
                                    <span>RERA</span>
                                </div>
                            </div>
                            <div class="srp-card-gallery-badges-bottom">
                                <div class="srp-badge count">1/23</div>
                                <div class="srp-badge threed">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path></svg>
                                    <span>3D view</span>
                                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>
                                </div>
                            </div>
                            <button class="srp-card-favorite">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#222" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                            </button>
                        </div>
                        <div class="srp-card-gallery-thumb">
                            <img src="${prop.gallery ? prop.gallery[1] : prop.image}" alt="" />
                            <div class="srp-badge days-ago">${prop.daysAgo}</div>
                        </div>
                    </div>
                    <div class="srp-card-info">
                        <div class="srp-card-status-row">
                            <span class="srp-card-status">${prop.status}</span>
                            <span class="srp-card-dot">•</span>
                            <span class="srp-card-avg-price">Avg. Price/ sq.ft. <strong>${prop.avgPrice}</strong></span>
                        </div>
                        <div class="srp-card-bhk">${prop.bhk}</div>
                        <div class="srp-card-price">${prop.price}</div>
                        <div class="srp-card-project">${prop.name}</div>
                        <div class="srp-card-location">${prop.location}</div>
                        <div class="srp-card-divider"></div>
                        <div class="srp-card-owner">
                            <div class="srp-card-owner-avatar">
                                <img src="https://ui-avatars.com/api/?name=${encodeURIComponent(prop.ownerName)}&background=f0f0f0&color=666&size=24" alt="" />
                            </div>
                            <div class="srp-card-owner-info">
                                <div class="srp-card-owner-name">${prop.ownerName}</div>
                                <div class="srp-card-owner-role">Owner</div>
                            </div>
                            <div class="srp-card-owner-actions">
                                <button class="srp-card-view-number">View Number</button>
                                <button class="srp-card-whatsapp">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#222"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                                </button>
                                <button class="srp-card-call">
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="white" stroke="none">
                                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            return card;
        }
        
        // Render property cards in horizontal scroll
        function renderPropertyCards(cards, allCards) {
            // Cap to max 7 cards in carousel
            const MAX_CAROUSEL_CARDS = 7;
            const displayCards = cards.slice(0, MAX_CAROUSEL_CARDS);
            const hasMoreCards = cards.length > MAX_CAROUSEL_CARDS || (allCards && allCards.length > MAX_CAROUSEL_CARDS);
            
            // Create wrapper for carousel + view all button
            const wrapper = document.createElement('div');
            wrapper.className = 'property-carousel-wrapper';
            wrapper.style.cssText = 'position: relative; width: 100%;';
            
            const carousel = document.createElement('div');
            carousel.className = 'property-carousel';
            carousel.style.pointerEvents = 'auto';
            
            // ============================================================================
            // END-OF-CAROUSEL ELASTIC PULL SYSTEM
            // Inline reveal zone after last card - expands during pull, collapses on release
            // Pull works by dragging on the last card itself
            // Cards never move - only the reveal zone expands
            // ============================================================================
            
            // Pull state
            let isOverscrolling = false;
            let rawPullDistance = 0;
            let startX = 0;
            let baseMaxScrollLeft = 0; // Max scroll before reveal zone expands
            let isArmed = false;
            let rafId = null;
            let originalScrollSnap = '';
            let isPulling = false;
            
            // Tuning constants
            const RAW_PULL_MAX = 220; // Max raw pull distance to track
            const PULL_THRESHOLD = 170; // Raw pull needed to arm
            const MAX_REVEAL_WIDTH = 120; // Max reveal zone width
            
            let isViewAllLoading = false;
            let viewAllLoadTimeout = null;
            
            // Strong resistance curve
            const applyResistance = (raw) => {
                return MAX_REVEAL_WIDTH * (1 - Math.exp(-raw / 100)) * 0.9;
            };
            
            // Create reveal zone (inline, after last card - width 0 at rest)
            const revealZone = document.createElement('div');
            revealZone.className = 'carousel-reveal-zone';
            
            const revealContent = document.createElement('div');
            revealContent.className = 'carousel-reveal-content';
            revealContent.innerHTML = `
                <svg class="overscroll-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polyline points="9 18 15 12 9 6"></polyline>
                </svg>
                <span class="overscroll-label">View more</span>
            `;
            revealZone.appendChild(revealContent);
            const spinnerEl = document.createElement('div');
            spinnerEl.className = 'carousel-reveal-spinner loader';
            spinnerEl.setAttribute('aria-hidden', 'true');
            revealZone.appendChild(spinnerEl);
            
            // Apply pull state using requestAnimationFrame
            const applyPullState = () => {
                if (!isPulling) return;
                
                // Apply resistance curve to get reveal width
                const revealWidth = applyResistance(rawPullDistance);
                const progress = Math.min(revealWidth / (MAX_REVEAL_WIDTH * 0.8), 1);
                isArmed = rawPullDistance >= PULL_THRESHOLD;
                
                // Expand reveal zone width (creates space after last card)
                revealZone.style.width = `${revealWidth}px`;
                revealZone.style.minWidth = `${revealWidth}px`;
                
                // Scroll to show the new space
                carousel.scrollLeft = baseMaxScrollLeft + revealWidth;
                
                // Gentle elastic vibe: view-all card becomes more opaque as you pull (Figma: same height as cards, last after cards)
                revealZone.style.opacity = progress.toString();
                revealContent.style.opacity = progress.toString();
                
                rafId = null;
            };
            
            const scheduleUpdate = () => {
                if (rafId === null) {
                    rafId = requestAnimationFrame(applyPullState);
                }
            };
            
            const resetReveal = (animated = true) => {
                if (animated) {
                    revealZone.style.transition = 'width 0.25s ease-out, min-width 0.25s ease-out, opacity 0.2s ease-out';
                    revealContent.style.transition = 'opacity 0.2s ease-out';
                }
                
                revealZone.style.width = '0';
                revealZone.style.minWidth = '0';
                revealZone.style.opacity = '0';
                revealContent.style.opacity = '0';
                
                if (animated) {
                    setTimeout(() => {
                        revealZone.style.transition = 'none';
                        revealContent.style.transition = 'none';
                    }, 250);
                }
            };
            
            // Touch/pointer handlers
            const handleTouchStart = (e) => {
                if (isViewAllLoading) return;
                // Calculate base max scroll (before reveal zone expands)
                // Exclude current reveal zone width
                const currentRevealWidth = parseFloat(revealZone.style.width) || 0;
                baseMaxScrollLeft = carousel.scrollWidth - carousel.clientWidth - currentRevealWidth;
                
                const touch = e.touches ? e.touches[0] : e;
                startX = touch.clientX;
                isOverscrolling = false;
                rawPullDistance = 0;
                isArmed = false;
                isPulling = false;
                
                // Store original scroll-snap and remove transitions for immediate response
                originalScrollSnap = carousel.style.scrollSnapType || '';
                revealZone.style.transition = 'none';
                revealContent.style.transition = 'none';
            };
            
            const handleTouchMove = (e) => {
                if (isViewAllLoading) return;
                if (startX === 0) return;
                
                const touch = e.touches ? e.touches[0] : e;
                const deltaX = startX - touch.clientX; // Positive = pulling left
                
                // Check if we're at or near the end (based on base scroll, not including reveal)
                const atEnd = carousel.scrollLeft >= baseMaxScrollLeft - 1;
                
                if (atEnd && deltaX > 5) {
                    // Start pull mode
                    if (!isPulling) {
                        isPulling = true;
                        isOverscrolling = true;
                        carousel.style.scrollSnapType = 'none';
                    }
                    
                    rawPullDistance = Math.min(deltaX, RAW_PULL_MAX);
                    scheduleUpdate();
                    
                    if (rawPullDistance > 10) {
                        e.preventDefault();
                    }
                } else if (isPulling && deltaX <= 0) {
                    // User scrolling back - exit pull mode
                    isPulling = false;
                    isOverscrolling = false;
                    rawPullDistance = 0;
                    isArmed = false;
                    
                    carousel.style.scrollSnapType = originalScrollSnap || '';
                    resetReveal(true);
                }
            };
            
            const handleTouchEnd = () => {
                if (rafId !== null) {
                    cancelAnimationFrame(rafId);
                    rafId = null;
                }
                
                if (isArmed && isPulling && !isViewAllLoading) {
                    isViewAllLoading = true;
                    if (viewAllLoadTimeout) clearTimeout(viewAllLoadTimeout);
                    revealZone.style.transition = 'none';
                    revealContent.style.transition = 'none';
                    revealZone.style.width = MAX_REVEAL_WIDTH + 'px';
                    revealZone.style.minWidth = MAX_REVEAL_WIDTH + 'px';
                    revealZone.style.opacity = '1';
                    revealContent.style.opacity = '1';
                    revealZone.classList.add('is-loading');
                    carousel.scrollLeft = baseMaxScrollLeft + MAX_REVEAL_WIDTH;
                    viewAllLoadTimeout = setTimeout(() => {
                        viewAllLoadTimeout = null;
                        isViewAllLoading = false;
                        revealZone.classList.remove('is-loading');
                        showViewAllPage(allCards || cards);
                    }, 2500);
                    carousel.style.scrollSnapType = originalScrollSnap || '';
                    isOverscrolling = false;
                    isPulling = false;
                    rawPullDistance = 0;
                    startX = 0;
                    isArmed = false;
                    return;
                }
                
                carousel.style.scrollSnapType = originalScrollSnap || '';
                resetReveal(true);
                
                isOverscrolling = false;
                isPulling = false;
                rawPullDistance = 0;
                startX = 0;
                isArmed = false;
            };
            
            // Attach touch/pointer events
            carousel.addEventListener('touchstart', handleTouchStart, { passive: true });
            carousel.addEventListener('touchmove', handleTouchMove, { passive: false });
            carousel.addEventListener('touchend', handleTouchEnd);
            carousel.addEventListener('touchcancel', handleTouchEnd);
            
            // Mouse support for testing
            carousel.addEventListener('mousedown', (e) => {
                handleTouchStart(e);
                
                const handleMouseMove = (e) => handleTouchMove(e);
                const handleMouseUp = () => {
                    handleTouchEnd();
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                };
                
                document.addEventListener('mousemove', handleMouseMove);
                document.addEventListener('mouseup', handleMouseUp);
            });
            
            /* Icons from local folder: address.svg and Area.svg (size) */
            const ADDRESS_ICON = 'assets/cards/address.svg';
            const SIZE_ICON = 'assets/cards/Area.svg';

            displayCards.forEach(card => {
                const cardElement = document.createElement('div');
                cardElement.className = 'property-card';
                cardElement.setAttribute('data-property-id', card.id);
                cardElement.style.pointerEvents = 'auto';
                
                // ----- Image block (262×160) + Shortlist overlay -----
                const imageWrapper = document.createElement('div');
                imageWrapper.className = 'property-card__imgwrap';
                
                const skeleton = document.createElement('div');
                skeleton.className = 'property-card__skeleton';
                imageWrapper.appendChild(skeleton);
                
                const image = document.createElement('img');
                image.src = card.image;
                image.alt = card.name;
                image.className = 'property-card__img property-card__img--loading';
                image.loading = 'eager';
                image.decoding = 'async';
                image.style.cursor = 'pointer';
                image.style.pointerEvents = 'auto';
                image.style.position = 'relative';
                image.style.zIndex = '1';
                
                image.onload = function() {
                    this.classList.remove('property-card__img--loading');
                    this.classList.add('property-card__img--loaded');
                    skeleton.classList.add('property-card__skeleton--hidden');
                };
                image.onerror = function() {
                    if (!this.dataset.failed) {
                        this.dataset.failed = '1';
                        this.src = PROPERTY_IMAGE_POOL[0];
                        this.onerror = null;
                    }
                };
                
                // Shortlist button – local SVGs: unfilled by default, filled when active
                const SHORTLIST_UNFILLED = 'assets/cards/shortlist-unfilled.svg';
                const SHORTLIST_FILLED = 'assets/cards/shortlist-filled.svg';
                const favoriteBtn = document.createElement('button');
                favoriteBtn.className = 'property-card-favorite';
                favoriteBtn.setAttribute('aria-label', 'Shortlist');
                const shortlistImg = document.createElement('img');
                shortlistImg.src = SHORTLIST_UNFILLED;
                shortlistImg.alt = '';
                shortlistImg.setAttribute('aria-hidden', 'true');
                shortlistImg.width = 32;
                shortlistImg.height = 32;
                favoriteBtn.appendChild(shortlistImg);
                favoriteBtn.onclick = function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    triggerHapticFeedback('subtle');
                    favoriteBtn.classList.toggle('active');
                    shortlistImg.src = favoriteBtn.classList.contains('active') ? SHORTLIST_FILLED : SHORTLIST_UNFILLED;
                    return false;
                };
                imageWrapper.appendChild(favoriteBtn);
                
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
                        overlay.remove();
                        document.body.style.overflow = '';
                        lastMentionedProject = cardToProjectPictureData(card);
                        openPropertyDetailPage(card, cardElement);
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
                
                // Image click → Housing split on d-web, PDP on mobile
                function handleImageClick(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    lastMentionedProject = cardToProjectPictureData(card);
                    openPropertyDetailPage(card, imageWrapper || image);
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
                    if (isDesktopLayout()) {
                        lastMentionedProject = cardToProjectPictureData(card);
                        openPropertyDetailPage(card, imageWrapper || cardElement);
                        return;
                    }
                    if (window.__CHAT_DEBUG__) console.log('✅ WRAPPER CLICKED - Opening gallery');
                    createGallery();
                }
                
                imageWrapper.onclick = wrapperClickHandler;
                imageWrapper.addEventListener('click', wrapperClickHandler, true);
                imageWrapper.addEventListener('click', wrapperClickHandler, false);
                
                imageWrapper.appendChild(image);
                
                // ----- Card body (Figma: badges, title, area, divider, location, price, CTA) -----
                const body = document.createElement('div');
                body.className = 'property-card__body';
                
                // Badges row: RERA + status
                const badges = document.createElement('div');
                badges.className = 'property-card__badges';
                const reraBadge = document.createElement('span');
                reraBadge.className = 'property-card__badge property-card__badge--rera';
                reraBadge.textContent = 'RERA';
                const statusBadge = document.createElement('span');
                statusBadge.className = 'property-card__badge property-card__badge--status';
                statusBadge.textContent = card.status || 'Ready to move';
                badges.appendChild(reraBadge);
                badges.appendChild(statusBadge);
                body.appendChild(badges);
                
                // Title block: "X BHK flat" + name
                const titleBlock = document.createElement('div');
                titleBlock.className = 'property-card__title-block';
                const titleLine1 = document.createElement('div');
                titleLine1.className = 'property-card__title-line1';
                titleLine1.textContent = `${card.bhk} BHK ${(card.propertyType || 'flat').toLowerCase()}`;
                const titleLine2 = document.createElement('div');
                titleLine2.className = 'property-card__title-line2';
                titleLine2.textContent = card.name || '';
                titleBlock.appendChild(titleLine1);
                titleBlock.appendChild(titleLine2);
                body.appendChild(titleBlock);
                
                // Area row – size icon + "Built up area: X sq.ft"
                const areaRow = document.createElement('div');
                areaRow.className = 'property-card__area-row';
                const areaIcon = document.createElement('img');
                areaIcon.src = SIZE_ICON;
                areaIcon.alt = '';
                areaIcon.setAttribute('aria-hidden', 'true');
                const areaText = document.createElement('span');
                areaText.textContent = `Built up area: ${(card.builtUpArea || 0).toLocaleString()} sq.ft`;
                areaRow.appendChild(areaIcon);
                areaRow.appendChild(areaText);
                body.appendChild(areaRow);
                
                // Divider
                const divider = document.createElement('div');
                divider.className = 'property-card__divider';
                body.appendChild(divider);
                
                // Location row – address icon + locality
                const locationRow = document.createElement('div');
                locationRow.className = 'property-card__location-row';
                let locationText = card.locality || 'Location';
                if (card.distance != null) {
                    const distanceText = card.distance < 1 ? `${Math.round(card.distance * 1000)}m away` : `${card.distance.toFixed(1)} km away`;
                    locationText = `${card.locality} • ${distanceText}`;
                }
                const locationIcon = document.createElement('img');
                locationIcon.src = ADDRESS_ICON;
                locationIcon.alt = '';
                locationIcon.setAttribute('aria-hidden', 'true');
                const locationSpan = document.createElement('span');
                locationSpan.textContent = locationText;
                locationRow.appendChild(locationIcon);
                locationRow.appendChild(locationSpan);
                body.appendChild(locationRow);
                
                // Price
                const price = document.createElement('div');
                price.className = 'property-card__price';
                const priceUnit = card.priceUnit || 'Cr';
                if (priceUnit === 'k') {
                    const priceNum = parseFloat(card.price);
                    price.textContent = priceNum >= 100000 ? `₹${(priceNum / 100000).toFixed(1)}L` : `₹${(priceNum / 1000).toFixed(0)}k`;
                } else {
                    price.textContent = `₹${card.price} ${priceUnit}`;
                }
                body.appendChild(price);
                
                // CTA row: Learn more (outline) + Contact (primary)
                const ctaSection = document.createElement('div');
                ctaSection.className = 'property-card__cta-section';
                const learnMoreBtn = document.createElement('button');
                learnMoreBtn.className = 'property-card__view-btn';
                learnMoreBtn.textContent = 'Learn more';
                learnMoreBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    lastMentionedProject = cardToProjectPictureData(card);
                    openPropertyDetailPage(card, cardElement);
                });
                const contactBtn = document.createElement('button');
                contactBtn.className = 'property-card__view-btn property-card__view-btn--primary';
                contactBtn.textContent = 'Contact';
                contactBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    showLoginBottomSheet();
                });
                ctaSection.appendChild(learnMoreBtn);
                ctaSection.appendChild(contactBtn);
                body.appendChild(ctaSection);
                
                // Make entire card clickable (except image) to open PDP / Housing split
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
                    e.preventDefault();
                    e.stopPropagation();
                    lastMentionedProject = cardToProjectPictureData(card);
                    openPropertyDetailPage(card, cardElement);
                });
                
                cardElement.appendChild(imageWrapper);
                cardElement.appendChild(body);
                carousel.appendChild(cardElement);
            });
            
            // Add reveal zone inside carousel (after all cards, width 0 at rest)
            carousel.appendChild(revealZone);
            
            // Add carousel to wrapper (no View all CTA)
            wrapper.appendChild(carousel);
            
            return wrapper;
        }
        
        // Open Property Detail Page as bottom sheet → expands to full page on scroll/drag
        function appendBotMessageSync(text, options) {
            const opts = options || {};
            const fullText = (text || '').trim();
            const msgId = generateMessageId();
            messages.push({ id: msgId, role: 'bot', text: fullText, timestamp: Date.now() });

            const msgDiv = document.createElement('div');
            msgDiv.id = msgId;
            msgDiv.className = 'msg msg-bot';

            const botContent = document.createElement('div');
            botContent.className = 'bot-message-content';

            const botText = document.createElement('div');
            botText.className = 'bot-text';
            botText.textContent = fullText;
            botContent.appendChild(botText);

            if (opts.withFeedback !== false) {
                botContent.appendChild(createFeedbackButtons(msgId));
            }

            msgDiv.appendChild(botContent);

            const stack = domCache.chatStack || document.getElementById('chat-stack');
            if (stack) {
                stack.appendChild(msgDiv);
                if (opts.scroll !== false) {
                    requestAnimationFrame(function() {
                        scrollMessageIntoView(msgDiv);
                    });
                }
            }
            return msgId;
        }

        function ensureChatStartedForPDP() {
            const chatScreenEl = document.getElementById('chat-screen');
            if (chatScreenEl && !chatScreenEl.classList.contains('chat-started')) {
                chatScreenEl.classList.add('chat-started');
                if (typeof setChatOffsets === 'function') setChatOffsets();
            }
            ensureDesktopComposerDocked();
            const chatInputEl = document.getElementById('chat-input');
            if (chatInputEl) chatInputEl.placeholder = 'Reply to Houzy';
            if (typeof updateSendButtonState === 'function') updateSendButtonState();
        }

        /**
         * Project context chip above a chat turn (mobile + desktop parity).
         * Shows reply-arrow + project name over the user list item.
         */
        function appendChatProjectContext(card) {
            const stack = domCache.chatStack || document.getElementById('chat-stack');
            if (!stack) return null;
            const projectName = (card && card.name) ? card.name : 'this project';
            const ctx = document.createElement('div');
            ctx.className = 'chat-project-context';
            ctx.innerHTML =
                '<img class="chat-project-context__icon" src="assets/figma/pdp/reply-arrow.svg" alt="" width="16" height="16">' +
                '<span class="chat-project-context__name"></span>';
            ctx.querySelector('.chat-project-context__name').textContent = projectName;
            stack.appendChild(ctx);
            return ctx;
        }

        function flushPDPConversationToChat(card, turns) {
            if (!turns || !turns.length) return;

            ensureChatStartedForPDP();
            // One project context chip over the flushed turn(s) — same as mobile Cancel
            appendChatProjectContext(card);

            turns.forEach(function(turn, index) {
                addUserMessage(turn.query);
                appendBotMessageSync(turn.answer, {
                    withFeedback: index === turns.length - 1,
                    scroll: index === turns.length - 1
                });
            });

            triggerHapticFeedback('subtle');
        }

        function openPropertyDetailPage(card, sourceEl) {
            removeElementById('property-detail-bottom-sheet');
            removeElementById('property-detail-fullpage');
            removeElementById('houzy-pdp-backdrop');
            lastMentionedProject = cardToProjectPictureData(card);

            const gallery = (card.gallery && card.gallery.length) ? card.gallery : [card.image];
            const photoCount = Math.max(gallery.length, 8);
            const priceUnit = card.priceUnit || 'Cr';
            let priceMain = '';
            let pricePerSqft = '₹15K / sq.ft.';
            if (priceUnit === 'k') {
                const priceNum = parseFloat(card.price);
                priceMain = priceNum >= 100000
                    ? '₹' + (priceNum / 100000).toFixed(1) + 'L'
                    : '₹' + (priceNum / 1000).toFixed(0) + 'k';
            } else {
                const base = parseFloat(card.price) || 2.25;
                priceMain = '₹' + base.toFixed(2) + ' Cr - ' + (base + 2).toFixed(2) + ' Cr';
            }
            const bhkLabel = card.bhk
                ? '(' + Math.max(2, card.bhk - 1) + ', ' + card.bhk + ', ' + (card.bhk + 1) + ' BHK Apartment & Villa)'
                : '(2, 3, 4 BHK Apartment & Villa)';
            const possessionYear = card.status === 'Ready to move' ? '2025' : '2028';
            const statusBadge = 'New Launch';
            const sellerName = card.sellerName || 'Krishna Kumar';
            const sellerRole = 'Seller';
            const desktopPDP = isDesktopLayout();

            const backdrop = document.createElement('div');
            backdrop.id = 'houzy-pdp-backdrop';
            backdrop.className = 'houzy-pdp-backdrop';

            const overlay = document.createElement('div');
            overlay.id = 'property-detail-fullpage';
            overlay.className = 'houzy-pdp' + (desktopPDP ? ' houzy-pdp--desktop' : '');
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');
            overlay.setAttribute('aria-label', card.name + ' details');

            let isExpanded = !!desktopPDP;
            let isClosing = false;
            let askTimer = null;
            let suggestExpandTimer = null;
            let setBottomStickyMode = function() {};
            const pdpTurns = [];
            let askState = 'idle'; // idle | thinking | answer
            let lastAskQuery = '';
            let bottomStickyMode = desktopPDP ? 'suggest' : 'compact'; // compact | suggest
            function restoreDesktopStageAfterPDP() {
                // Cancel on desktop closes the 50:50 split and returns to full-width chat
                if (desktopPDP) {
                    exitDesktopSplit();
                    return;
                }
                const housing = document.getElementById('desktop-stage-housing');
                const mosaic = document.getElementById('desktop-stage-photos-mosaic');
                const listings = document.getElementById('desktop-stage-listings');
                if (housing && housing.querySelector('.desktop-housing')) {
                    hideDesktopStagePanels('desktop-stage-housing');
                } else if (mosaic && mosaic.children.length) {
                    hideDesktopStagePanels('desktop-stage-photos');
                } else if (listings && listings.querySelector('.desktop-listing-card')) {
                    hideDesktopStagePanels('desktop-stage-listings');
                } else {
                    hideDesktopStagePanels('desktop-stage-empty');
                }
            }

            function getPDPAnswer(query) {
                const projectLabel = card.name || 'this project';
                const possessionYr = card.status === 'Ready to move' ? '2025' : '2028';
                const AMENITIES_ANSWER =
                    'This project offers a thoughtfully curated range of amenities designed for comfort, convenience, and recreation. Residents can enjoy a swimming pool, a fully equipped gymnasium, a modern clubhouse, landscaped gardens, a children\'s play area, a jogging and cycling track, indoor games, a multipurpose hall, 24×7 security with CCTV surveillance, power backup, covered parking, and high-speed elevators.';
                const q = (query || '').toLowerCase();
                if (/picture|photo|gallery|image/.test(q)) {
                    return 'Here are the latest project visuals for ' + projectLabel + '. Tap the hero image or “See all photos” anytime to browse the full gallery.';
                }
                if (/park/.test(q)) {
                    return projectLabel + ' offers covered parking for residents, with visitor parking available nearby. Exact allotment depends on the configuration you choose.';
                }
                if (/possess|ready|handover|completion/.test(q)) {
                    return projectLabel + ' is targeted for possession by ' + possessionYr + '. Timelines can vary by tower — I can help you compare ready-to-move vs under-construction options.';
                }
                return AMENITIES_ANSWER;
            }

            function returnToParentChat() {
                if (isClosing) return;
                if (askTimer) {
                    clearTimeout(askTimer);
                    askTimer = null;
                }
                if (suggestExpandTimer) {
                    clearTimeout(suggestExpandTimer);
                    suggestExpandTimer = null;
                }
                // Finish in-flight ask so Cancel still retains full context
                if (askState === 'thinking' && lastAskQuery) {
                    pdpTurns.push({
                        query: lastAskQuery,
                        answer: getPDPAnswer(lastAskQuery)
                    });
                }
                // Parent chat context appears only on Cancel/Close (mobile + desktop parity)
                const turns = pdpTurns.slice();
                if (turns.length) {
                    flushPDPConversationToChat(card, turns);
                }
                closePDPFullPage();
            }

            function closePDPFullPage() {
                if (isClosing) return;
                isClosing = true;
                if (askTimer) {
                    clearTimeout(askTimer);
                    askTimer = null;
                }
                if (suggestExpandTimer) {
                    clearTimeout(suggestExpandTimer);
                    suggestExpandTimer = null;
                }
                overlay.classList.add('houzy-pdp--closing');
                backdrop.classList.add('houzy-pdp-backdrop--closing');
                setTimeout(function() {
                    overlay.remove();
                    backdrop.remove();
                    document.body.style.overflow = '';
                    if (desktopPDP) restoreDesktopStageAfterPDP();
                }, desktopPDP ? 240 : 420);
            }

            function getPeekTranslateY() {
                const vh = window.innerHeight || 700;
                const peek = Math.min(vh * 0.82, 720);
                return Math.max(0, vh - peek);
            }

            function clearSheetInlineTransform() {
                overlay.style.transition = '';
                overlay.style.transform = '';
            }

            function expandToFullPage() {
                if (desktopPDP) {
                    isExpanded = true;
                    setBottomStickyMode('suggest');
                    return;
                }
                if (isExpanded || isClosing) return;
                isExpanded = true;
                clearSheetInlineTransform();
                overlay.classList.add('houzy-pdp--expanding');
                // Double rAF so the browser applies peek styles before animating to expanded
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        overlay.classList.add('houzy-pdp--expanded');
                        backdrop.classList.add('houzy-pdp-backdrop--dimmed');
                    });
                });
                window.setTimeout(function() {
                    overlay.classList.remove('houzy-pdp--expanding');
                }, 500);
                setBottomStickyMode('suggest');
                updateStickyTopNav();
                triggerHapticFeedback('subtle');
            }

            function collapseToSheet() {
                if (desktopPDP) return;
                if (!isExpanded || isClosing) return;
                isExpanded = false;
                clearSheetInlineTransform();
                overlay.classList.add('houzy-pdp--expanding');
                overlay.classList.remove('houzy-pdp--expanded');
                backdrop.classList.remove('houzy-pdp-backdrop--dimmed');
                stickyTop.classList.remove('houzy-pdp__topnav--visible');
                stickyTop.setAttribute('aria-hidden', 'true');
                window.setTimeout(function() {
                    overlay.classList.remove('houzy-pdp--expanding');
                }, 500);
                setBottomStickyMode('compact');
            }

            const grabber = document.createElement('div');
            grabber.className = 'houzy-pdp__grabber';
            grabber.innerHTML = '<div class="houzy-pdp__handle" aria-hidden="true"></div>';

            const scroll = document.createElement('div');
            scroll.className = 'houzy-pdp__scroll';

            // —— Hero ——
            const hero = document.createElement('div');
            hero.className = 'houzy-pdp__hero';
            const heroImg = document.createElement('img');
            heroImg.className = 'houzy-pdp__hero-img';
            heroImg.src = card.image;
            heroImg.alt = card.name;
            heroImg.loading = 'eager';
            heroImg.onerror = function() {
                if (!this.dataset.failed) {
                    this.dataset.failed = '1';
                    this.src = PROPERTY_IMAGE_POOL[0];
                }
            };
            hero.appendChild(heroImg);

            let isShortlisted = false;

            function shareProperty(e) {
                if (e) e.stopPropagation();
                if (navigator.share) {
                    navigator.share({
                        title: card.name,
                        text: card.name + ' – ' + (card.locality || ''),
                        url: window.location.href
                    }).catch(function() {});
                }
            }

            function syncShortlistUI() {
                if (heartBtn) {
                    heartBtn.classList.toggle('is-active', isShortlisted);
                    const img = heartBtn.querySelector('img');
                    if (img) img.src = isShortlisted ? 'assets/figma/pdp/heart-filled.svg' : 'assets/figma/pdp/heart.svg';
                }
                if (stickyHeartBtn) {
                    stickyHeartBtn.classList.toggle('is-active', isShortlisted);
                    const img = stickyHeartBtn.querySelector('img');
                    if (img) img.src = isShortlisted ? 'assets/figma/pdp/heart-filled.svg' : 'assets/figma/pdp/heart.svg';
                }
            }

            function toggleShortlist(e) {
                if (e) e.stopPropagation();
                isShortlisted = !isShortlisted;
                syncShortlistUI();
                triggerHapticFeedback('subtle');
            }

            const heroTop = document.createElement('div');
            heroTop.className = 'houzy-pdp__hero-top';

            const backBtn = document.createElement('button');
            backBtn.type = 'button';
            backBtn.className = 'houzy-pdp__icon-btn';
            backBtn.setAttribute('aria-label', 'Close');
            backBtn.innerHTML = '<img src="assets/figma/pdp/back.svg" alt="" width="16" height="16">';
            backBtn.onclick = function(e) {
                e.stopPropagation();
                returnToParentChat();
            };

            const heroActions = document.createElement('div');
            heroActions.className = 'houzy-pdp__hero-actions';
            const heartBtn = document.createElement('button');
            heartBtn.type = 'button';
            heartBtn.className = 'houzy-pdp__icon-btn';
            heartBtn.setAttribute('aria-label', 'Shortlist');
            heartBtn.innerHTML = '<img src="assets/figma/pdp/heart.svg" alt="" width="16" height="16">';
            heartBtn.onclick = toggleShortlist;
            const shareBtn = document.createElement('button');
            shareBtn.type = 'button';
            shareBtn.className = 'houzy-pdp__icon-btn';
            shareBtn.setAttribute('aria-label', 'Share');
            shareBtn.innerHTML = '<img src="assets/figma/pdp/share.svg" alt="" width="16" height="16">';
            shareBtn.onclick = shareProperty;
            const callBtn = document.createElement('button');
            callBtn.type = 'button';
            callBtn.className = 'houzy-pdp__icon-btn houzy-pdp__icon-btn--brand';
            callBtn.setAttribute('aria-label', 'Call');
            callBtn.innerHTML = '<img src="assets/figma/pdp/call.svg" alt="" width="16" height="16">';
            callBtn.onclick = function(e) {
                e.stopPropagation();
                showLoginBottomSheet();
            };
            // Order: share, fav, call — right-aligned via .houzy-pdp__hero-actions
            heroActions.appendChild(shareBtn);
            heroActions.appendChild(heartBtn);
            heroActions.appendChild(callBtn);
            // Desktop: mobile hero chrome (heart/share/call) but no close over the image
            if (!desktopPDP) {
                heroTop.appendChild(backBtn);
            }
            heroTop.appendChild(heroActions);

            // Sticky top bar
            const stickyTop = document.createElement('div');
            stickyTop.className = 'houzy-pdp__topnav' + (desktopPDP ? ' houzy-pdp__topnav--desktop houzy-pdp__topnav--close-only' : '');
            stickyTop.setAttribute('aria-hidden', 'true');

            const stickyClose = document.createElement('button');
            stickyClose.type = 'button';
            stickyClose.className = 'houzy-pdp__topnav-close';
            stickyClose.setAttribute('aria-label', 'Close');
            stickyClose.innerHTML = '<img src="assets/figma/pdp/close.svg" alt="" width="20" height="20">';
            stickyClose.onclick = function(e) {
                e.stopPropagation();
                returnToParentChat();
            };

            const stickyInfo = document.createElement('div');
            stickyInfo.className = 'houzy-pdp__topnav-info';
            stickyInfo.innerHTML =
                '<p class="houzy-pdp__topnav-title"></p>' +
                '<p class="houzy-pdp__topnav-price"></p>';
            stickyInfo.querySelector('.houzy-pdp__topnav-title').textContent = card.name;
            stickyInfo.querySelector('.houzy-pdp__topnav-price').textContent = priceMain;

            const stickyActions = document.createElement('div');
            stickyActions.className = 'houzy-pdp__topnav-actions';
            const stickyHeartBtn = document.createElement('button');
            stickyHeartBtn.type = 'button';
            stickyHeartBtn.className = 'houzy-pdp__topnav-btn houzy-pdp__topnav-btn--fav';
            stickyHeartBtn.setAttribute('aria-label', 'Shortlist');
            stickyHeartBtn.innerHTML = '<img src="assets/figma/pdp/heart.svg" alt="" width="16" height="16">';
            stickyHeartBtn.onclick = toggleShortlist;
            const stickyShareBtn = document.createElement('button');
            stickyShareBtn.type = 'button';
            stickyShareBtn.className = 'houzy-pdp__topnav-btn';
            stickyShareBtn.setAttribute('aria-label', 'Share');
            stickyShareBtn.innerHTML = '<img src="assets/figma/pdp/share-sticky.svg" alt="" width="16" height="16">';
            stickyShareBtn.onclick = shareProperty;
            stickyActions.appendChild(stickyHeartBtn);
            stickyActions.appendChild(stickyShareBtn);

            if (desktopPDP) {
                // Desktop: white strip with close only (top right)
                stickyTop.appendChild(stickyClose);
            } else {
                // Mobile scroll sticky: close left + title/price + actions
                stickyTop.appendChild(stickyClose);
                stickyTop.appendChild(stickyInfo);
                stickyTop.appendChild(stickyActions);
            }

            function updateStickyTopNav() {
                if (desktopPDP) {
                    stickyTop.classList.add('houzy-pdp__topnav--visible');
                    stickyTop.setAttribute('aria-hidden', 'false');
                    return;
                }
                const heroH = hero.offsetHeight || 280;
                const show = isExpanded && scroll.scrollTop > Math.max(120, heroH * 0.55);
                stickyTop.classList.toggle('houzy-pdp__topnav--visible', show);
                stickyTop.setAttribute('aria-hidden', show ? 'false' : 'true');
            }

            const heroBottom = document.createElement('div');
            heroBottom.className = 'houzy-pdp__hero-bottom';
            const countBadge = document.createElement('div');
            countBadge.className = 'houzy-pdp__count-badge';
            countBadge.innerHTML = '<span>1/' + photoCount + '</span><span class="houzy-pdp__dots" aria-hidden="true"><i class="is-active"></i><i></i><i></i><i></i><i></i></span>';
            const tagBadge = document.createElement('div');
            tagBadge.className = 'houzy-pdp__tag-badge';
            tagBadge.textContent = 'Elevation';
            heroBottom.appendChild(countBadge);
            heroBottom.appendChild(tagBadge);

            hero.appendChild(heroTop);
            hero.appendChild(heroBottom);
            hero.addEventListener('click', function(e) {
                if (e.target.closest('button')) return;
                openPropertyGallery(card, 0);
            });

            // —— Project info ——
            const info = document.createElement('div');
            info.className = 'houzy-pdp__info';

            const badges = document.createElement('div');
            badges.className = 'houzy-pdp__badges';
            badges.innerHTML =
                '<span class="houzy-pdp__badge houzy-pdp__badge--launch"><img src="assets/figma/pdp/new-launch.svg" alt="" width="12" height="12">' + statusBadge + '</span>' +
                '<span class="houzy-pdp__badge houzy-pdp__badge--rera"><img src="assets/figma/pdp/rera.svg" alt="" width="12" height="12">RERA</span>' +
                '<span class="houzy-pdp__badge">Possession by <strong>' + possessionYear + '</strong></span>';

            const titleRow = document.createElement('div');
            titleRow.className = 'houzy-pdp__title-row';
            const titleBlock = document.createElement('div');
            titleBlock.className = 'houzy-pdp__title-block';
            const title = document.createElement('h1');
            title.className = 'houzy-pdp__title';
            title.textContent = card.name;
            const loc = document.createElement('p');
            loc.className = 'houzy-pdp__location';
            loc.textContent = card.locality || 'India';
            titleBlock.appendChild(title);
            titleBlock.appendChild(loc);

            const mapBtn = document.createElement('button');
            mapBtn.type = 'button';
            mapBtn.className = 'houzy-pdp__map';
            mapBtn.innerHTML = '<span class="houzy-pdp__map-icon"><img src="assets/figma/pdp/location-pin.svg" alt="" width="16" height="16"></span><span>View Map</span>';
            mapBtn.onclick = function() {
                const q = encodeURIComponent((card.name || '') + ' ' + (card.locality || ''));
                window.open('https://maps.google.com/?q=' + q, '_blank');
            };
            titleRow.appendChild(titleBlock);
            titleRow.appendChild(mapBtn);

            const priceRow = document.createElement('div');
            priceRow.className = 'houzy-pdp__price-row';
            priceRow.innerHTML =
                '<p class="houzy-pdp__price">' + priceMain + ' <span>(' + pricePerSqft + ')</span>' +
                '<img src="assets/figma/pdp/info.svg" alt="" width="16" height="16"></p>' +
                '<p class="houzy-pdp__bhk">' + bhkLabel + '</p>';

            const seller = document.createElement('div');
            seller.className = 'houzy-pdp__seller';
            seller.innerHTML =
                '<div class="houzy-pdp__seller-left">' +
                    '<img class="houzy-pdp__seller-avatar" src="https://ui-avatars.com/api/?name=' + encodeURIComponent(sellerName) + '&background=f0f0f0&color=666&size=64" alt="">' +
                    '<div class="houzy-pdp__seller-meta">' +
                        '<button type="button" class="houzy-pdp__seller-name">' + sellerName + ' <span aria-hidden="true">›</span></button>' +
                        '<span class="houzy-pdp__seller-role">' + sellerRole + '</span>' +
                    '</div>' +
                '</div>';
            const viewPhoneBtn = document.createElement('button');
            viewPhoneBtn.type = 'button';
            viewPhoneBtn.className = 'houzy-pdp__view-phone';
            viewPhoneBtn.textContent = 'View phone';
            viewPhoneBtn.onclick = function() {
                showLoginBottomSheet();
            };
            seller.appendChild(viewPhoneBtn);

            info.appendChild(badges);
            info.appendChild(titleRow);
            info.appendChild(priceRow);
            info.appendChild(seller);

            const more = document.createElement('div');
            more.className = 'houzy-pdp__more';
            more.innerHTML =
                '<h2 class="houzy-pdp__section-title">About this project</h2>' +
                '<p class="houzy-pdp__about">This ' + (card.propertyType || 'apartment').toLowerCase() +
                ' is ' + (card.status || 'ready to move').toLowerCase() +
                ' and offers ' + (card.bhk || 3) + ' bedrooms with a built-up area of ' +
                ((card.builtUpArea || 1800).toLocaleString()) + ' sq.ft. Located in ' +
                (card.locality || 'a prime locality') + '.</p>' +
                '<h2 class="houzy-pdp__section-title">Floor Plan &amp; Pricing</h2>' +
                '<p class="houzy-pdp__about">Browse layouts and pricing for available configurations. Tap See all photos to explore the full project gallery.</p>' +
                '<button type="button" class="houzy-pdp__see-photos">See all photos ›</button>';
            const seePhotos = more.querySelector('.houzy-pdp__see-photos');
            seePhotos.onclick = function() { openPropertyGallery(card, 0); };

            scroll.appendChild(hero);
            scroll.appendChild(info);
            scroll.appendChild(more);

            // Figma Bottom navigation: start Ask-only → swap to pills on full PDP
            const sticky = document.createElement('div');
            sticky.className = 'houzy-pdp__sticky houzy-pdp__sticky--compact';

            const projectLabel = card.name || 'this project';
            const pdpPills = [
                { label: 'What amenities are there?', query: 'What amenities are there?', icon: true },
                { label: 'Is parking available nearby?', query: 'Is parking available nearby?' },
                { label: 'Show project pictures', query: 'Show project pictures of ' + projectLabel },
                { label: 'When is possession?', query: 'When is possession?' }
            ];

            const thinkingRow = document.createElement('div');
            thinkingRow.className = 'houzy-pdp__thinking';
            thinkingRow.hidden = true;
            thinkingRow.innerHTML =
                '<div class="houzy-pdp__thinking-left">' +
                    '<img class="houzy-pdp__thinking-sparkle" src="assets/figma/pdp/sparkle.svg" alt="" width="16" height="16">' +
                    '<span>Thinking...</span>' +
                '</div>' +
                '<button type="button" class="houzy-pdp__sheet-close" aria-label="Cancel">×</button>';

            const answerPanel = document.createElement('div');
            answerPanel.className = 'houzy-pdp__answer';
            answerPanel.hidden = true;
            answerPanel.innerHTML =
                '<button type="button" class="houzy-pdp__sheet-close houzy-pdp__answer-close" aria-label="Close answer">×</button>' +
                '<p class="houzy-pdp__answer-text"></p>';
            const answerTextEl = answerPanel.querySelector('.houzy-pdp__answer-text');

            function applyBottomStickyMode() {
                const compact = bottomStickyMode === 'compact' && askState === 'idle';
                const suggest = bottomStickyMode === 'suggest' && askState === 'idle';
                sticky.classList.toggle('houzy-pdp__sticky--compact', compact);
                sticky.classList.toggle('houzy-pdp__sticky--suggest', suggest || askState !== 'idle');
                if (pillsRow) {
                    pillsRow.classList.toggle('is-suppressed', askState !== 'idle');
                    pillsRow.setAttribute('aria-hidden', (suggest || desktopPDP) && askState === 'idle' ? 'false' : 'true');
                }
                if (askInput && askState === 'idle') {
                    askInput.placeholder = compact ? 'Reply to Houzy' : 'Ask Houzy anything';
                }
            }

            setBottomStickyMode = function(mode) {
                if (mode !== 'compact' && mode !== 'suggest') return;
                bottomStickyMode = mode;
                applyBottomStickyMode();
            };

            function scheduleSuggestExpand(delayMs) {
                if (suggestExpandTimer) {
                    clearTimeout(suggestExpandTimer);
                    suggestExpandTimer = null;
                }
                suggestExpandTimer = setTimeout(function() {
                    suggestExpandTimer = null;
                    if (askState !== 'idle' || isClosing) return;
                    setBottomStickyMode('suggest');
                    triggerHapticFeedback('subtle');
                }, typeof delayMs === 'number' ? delayMs : 520);
            }

            function setAskIdle(options) {
                const fromResponse = !!(options && options.fromResponse);
                askState = 'idle';
                if (askTimer) {
                    clearTimeout(askTimer);
                    askTimer = null;
                }
                if (suggestExpandTimer) {
                    clearTimeout(suggestExpandTimer);
                    suggestExpandTimer = null;
                }

                sticky.classList.remove('houzy-pdp__sticky--thinking', 'houzy-pdp__sticky--answer');
                thinkingRow.hidden = true;

                if (fromResponse && !answerPanel.hidden) {
                    answerPanel.classList.add('houzy-pdp__answer--out');
                    window.setTimeout(function() {
                        answerPanel.hidden = true;
                        answerPanel.classList.remove('houzy-pdp__answer--out');
                    }, 280);
                } else {
                    answerPanel.hidden = true;
                    answerPanel.classList.remove('houzy-pdp__answer--out');
                }

                askInput.value = '';
                askInput.readOnly = false;
                askSend.disabled = true;
                askSend.classList.remove('is-ready');

                // State 0: compact Reply to Houzy only
                bottomStickyMode = 'compact';
                applyBottomStickyMode();

                // Then smoothly expand to suggestion pills
                if (fromResponse || isExpanded) {
                    scheduleSuggestExpand(fromResponse ? 480 : 520);
                }
            }

            function setAskThinking(query) {
                askState = 'thinking';
                lastAskQuery = query;
                if (suggestExpandTimer) {
                    clearTimeout(suggestExpandTimer);
                    suggestExpandTimer = null;
                }
                sticky.classList.add('houzy-pdp__sticky--thinking');
                sticky.classList.remove('houzy-pdp__sticky--answer', 'houzy-pdp__sticky--compact');
                sticky.classList.add('houzy-pdp__sticky--suggest');
                thinkingRow.hidden = false;
                answerPanel.hidden = true;
                answerPanel.classList.remove('houzy-pdp__answer--out');
                pillsRow.classList.add('is-suppressed');
                askInput.value = query;
                askInput.readOnly = true;
                askInput.placeholder = 'Ask Houzy anything';
                askSend.disabled = false;
                askSend.classList.add('is-ready');
                expandToFullPage();
                triggerHapticFeedback('subtle');
            }

            function setAskAnswer(query) {
                askState = 'answer';
                if (suggestExpandTimer) {
                    clearTimeout(suggestExpandTimer);
                    suggestExpandTimer = null;
                }
                const answer = getPDPAnswer(query);
                pdpTurns.push({ query: query, answer: answer });
                sticky.classList.remove('houzy-pdp__sticky--thinking', 'houzy-pdp__sticky--compact');
                sticky.classList.add('houzy-pdp__sticky--answer', 'houzy-pdp__sticky--suggest');
                thinkingRow.hidden = true;
                // Right panel: pills → thinking → response (context flushes to parent chat on Cancel)
                answerPanel.hidden = false;
                answerPanel.classList.remove('houzy-pdp__answer--out');
                answerTextEl.textContent = answer;
                pillsRow.classList.add('is-suppressed');
                askInput.value = '';
                askInput.readOnly = false;
                askInput.placeholder = 'Ask Houzy anything';
                askSend.disabled = true;
                askSend.classList.remove('is-ready');
                expandToFullPage();
                if (scroll.scrollTop < 80) {
                    scroll.scrollTop = 0;
                    updateStickyTopNav();
                }
                triggerHapticFeedback('medium');

                if (/picture|photo|gallery|image/.test((query || '').toLowerCase())) {
                    setTimeout(function() {
                        if (askState === 'answer') openPropertyGallery(card, 0);
                    }, 900);
                }
            }

            function askFromPDP(query) {
                const q = (query || '').trim();
                if (!q || askState === 'thinking') return;
                setAskThinking(q);
                if (askTimer) clearTimeout(askTimer);
                askTimer = setTimeout(function() {
                    askTimer = null;
                    if (askState !== 'thinking') return;
                    setAskAnswer(q);
                }, 1200);
            }

            thinkingRow.querySelector('.houzy-pdp__sheet-close').onclick = function(e) {
                e.stopPropagation();
                setAskIdle({ fromResponse: true });
            };
            answerPanel.querySelector('.houzy-pdp__answer-close').onclick = function(e) {
                e.stopPropagation();
                setAskIdle({ fromResponse: true });
            };

            const pillsRow = document.createElement('div');
            pillsRow.className = 'houzy-pdp__pills';
            pillsRow.setAttribute('role', 'list');
            pillsRow.setAttribute('aria-hidden', 'true');
            pdpPills.forEach(function(pill) {
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'houzy-pdp__pill';
                btn.setAttribute('role', 'listitem');
                if (pill.icon) {
                    btn.innerHTML = '<img src="assets/figma/pdp/reply-arrow.svg" alt="" width="16" height="16"><span></span>';
                    btn.querySelector('span').textContent = pill.label;
                } else {
                    btn.textContent = pill.label;
                }
                btn.onclick = function(e) {
                    e.stopPropagation();
                    askFromPDP(pill.query);
                };
                pillsRow.appendChild(btn);
            });

            const askBar = document.createElement('form');
            askBar.className = 'houzy-pdp__ask';
            askBar.setAttribute('autocomplete', 'off');
            askBar.innerHTML =
                '<input type="text" class="houzy-pdp__ask-input" placeholder="Ask Houzy anything" aria-label="Ask Houzy anything" enterkeyhint="send">' +
                '<button type="submit" class="houzy-pdp__ask-send" aria-label="Send" disabled>' +
                    '<span class="houzy-pdp__ask-send-bg" aria-hidden="true"></span>' +
                    '<img src="assets/figma/pdp/send-icon.svg" alt="" width="18" height="18">' +
                '</button>';
            const askInput = askBar.querySelector('.houzy-pdp__ask-input');
            const askSend = askBar.querySelector('.houzy-pdp__ask-send');
            askInput.addEventListener('input', function() {
                if (askState === 'thinking') return;
                const has = askInput.value.trim().length > 0;
                askSend.disabled = !has;
                askSend.classList.toggle('is-ready', has);
            });
            askBar.addEventListener('submit', function(e) {
                e.preventDefault();
                if (askState === 'thinking') return;
                const q = askInput.value.trim() || lastAskQuery;
                if (!q) return;
                askFromPDP(q);
            });

            sticky.appendChild(thinkingRow);
            sticky.appendChild(answerPanel);
            sticky.appendChild(pillsRow);
            sticky.appendChild(askBar);
            applyBottomStickyMode();

            overlay.appendChild(stickyTop);
            overlay.appendChild(grabber);
            overlay.appendChild(scroll);
            overlay.appendChild(sticky);

            // Any upward scroll / swipe expands sheet → full page (stays full until closed)
            scroll.addEventListener('scroll', function() {
                if (scroll.scrollTop > 2) {
                    expandToFullPage();
                }
                updateStickyTopNav();
            }, { passive: true });

            scroll.addEventListener('wheel', function(e) {
                if (!isExpanded && e.deltaY > 0) {
                    expandToFullPage();
                }
            }, { passive: true });

            let sheetTouchY = 0;
            scroll.addEventListener('touchstart', function(e) {
                sheetTouchY = e.touches[0].clientY;
            }, { passive: true });
            scroll.addEventListener('touchmove', function(e) {
                if (isExpanded || isClosing) return;
                const dy = sheetTouchY - e.touches[0].clientY;
                // Finger moving up → expand to full page
                if (dy > 12) {
                    clearSheetInlineTransform();
                    expandToFullPage();
                }
            }, { passive: true });

            // Drag handle / sheet gesture — follow finger with translateY (same axis as CSS snap)
            let dragStartY = 0;
            let dragDelta = 0;
            let dragging = false;

            function onDragStart(clientY) {
                dragging = true;
                dragStartY = clientY;
                dragDelta = 0;
                overlay.style.transition = 'none';
            }

            function onDragMove(clientY) {
                if (!dragging) return;
                dragDelta = clientY - dragStartY;
                const vh = window.innerHeight || 700;
                if (!isExpanded) {
                    const peekY = getPeekTranslateY();
                    // Up shrinks offset toward 0 (fullscreen); down grows toward dismiss
                    const nextY = Math.max(0, Math.min(vh * 0.92, peekY + dragDelta));
                    overlay.style.transform = 'translate3d(0, ' + nextY + 'px, 0)';
                } else if (dragDelta > 0 && scroll.scrollTop <= 0) {
                    overlay.style.transform = 'translate3d(0, ' + Math.min(dragDelta, vh * 0.85) + 'px, 0)';
                }
            }

            function onDragEnd() {
                if (!dragging) return;
                dragging = false;
                clearSheetInlineTransform();

                if (dragDelta < -28) {
                    expandToFullPage();
                } else if (dragDelta > 110 && scroll.scrollTop <= 0) {
                    closePDPFullPage();
                } else if (dragDelta > 64 && isExpanded && scroll.scrollTop <= 0) {
                    collapseToSheet();
                }
            }

            backdrop.addEventListener('click', closePDPFullPage);

            if (!desktopPDP) {
                grabber.addEventListener('touchstart', function(e) {
                    onDragStart(e.touches[0].clientY);
                }, { passive: true });
                grabber.addEventListener('touchmove', function(e) {
                    onDragMove(e.touches[0].clientY);
                }, { passive: true });
                grabber.addEventListener('touchend', onDragEnd);
                grabber.addEventListener('mousedown', function(e) {
                    onDragStart(e.clientY);
                    function move(ev) { onDragMove(ev.clientY); }
                    function up() {
                        onDragEnd();
                        window.removeEventListener('mousemove', move);
                        window.removeEventListener('mouseup', up);
                    }
                    window.addEventListener('mousemove', move);
                    window.addEventListener('mouseup', up);
                });
            }

            if (desktopPDP) {
                const settleGhost = animateCardIntoDesktopSplit(sourceEl);
                enterDesktopSplit();
                const existing = document.getElementById('property-detail-fullpage');
                if (existing && existing !== overlay) existing.remove();
                const pdpHost = document.getElementById('desktop-stage-pdp');
                hideDesktopStagePanels('desktop-stage-pdp');
                if (pdpHost) {
                    pdpHost.innerHTML = '';
                    pdpHost.appendChild(overlay);
                } else {
                    document.body.appendChild(overlay);
                }
                if (settleGhost && heroImg) {
                    heroImg.style.opacity = '0';
                    overlay.classList.add('houzy-pdp--morphing');
                }
                // Parent-chat context is flushed only when user hits Cancel/Close
                // Double rAF: layout in 50% stage, then open + ghost → settled hero rect.
                requestAnimationFrame(function() {
                    requestAnimationFrame(function() {
                        overlay.classList.add('houzy-pdp--open', 'houzy-pdp--expanded');
                        if (typeof settleGhost === 'function') {
                            settleGhost(heroImg);
                        } else if (heroImg) {
                            heroImg.style.opacity = '';
                        }
                    });
                });
                setBottomStickyMode('suggest');
                stickyTop.classList.add('houzy-pdp__topnav--visible');
                stickyTop.setAttribute('aria-hidden', 'false');
            } else {
                document.body.appendChild(backdrop);
                document.body.appendChild(overlay);
                document.body.style.overflow = 'hidden';
                requestAnimationFrame(function() {
                    backdrop.classList.add('houzy-pdp-backdrop--open');
                    overlay.classList.add('houzy-pdp--open');
                });
            }
            triggerHapticFeedback('medium');
        }
        
        // Open property gallery in fullscreen
        function openPropertyGallery(card, startIndex) {
            const initialIndex = typeof startIndex === 'number' && startIndex >= 0 ? startIndex : 0;
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
            showImage(initialIndex);
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
            
            const delay = 3000; // 3 second loading per bot reply
            
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
                
                // Add text (no bubble – ChatGPT-style, streamed)
                const botText = document.createElement('div');
                botText.className = 'bot-text';

                // Create brochure component – layout matches Figma "Property 1=Brochure"
                const randomCoverImage = getRandomItem(PROPERTY_IMAGE_POOL);
                const projectName = getRandomItem(BROCHURE_PROJECT_NAMES);
                const priceRange = getRandomItem(BROCHURE_PRICE_RANGES);
                const developerName = getRandomItem(INDIAN_DEVELOPER_NAMES);
                
                const brochureComponent = document.createElement('div');
                brochureComponent.className = 'brochure-card';
                
                // Image wrapper (249×160 in Figma)
                const brochureImageWrapper = document.createElement('div');
                brochureImageWrapper.className = 'brochure-card__image-wrapper';
                const coverImg = document.createElement('img');
                coverImg.src = randomCoverImage;
                coverImg.alt = projectName;
                coverImg.className = 'brochure-card__image';
                coverImg.loading = 'eager';
                coverImg.decoding = 'async';
                coverImg.onerror = function() {
                    if (!this.dataset.failed) {
                        this.dataset.failed = '1';
                        this.src = PROPERTY_IMAGE_POOL[0];
                    } else {
                        this.style.display = 'none';
                        this.parentElement.style.backgroundColor = '#f2f2f2';
                    }
                };
                brochureImageWrapper.appendChild(coverImg);
                
                // Card body: title, divider, price, CTA (Figma)
                const brochureBody = document.createElement('div');
                brochureBody.className = 'brochure-card__body';
                
                const brochureTitle = document.createElement('div');
                brochureTitle.className = 'brochure-card__title';
                brochureTitle.textContent = projectName;
                
                const brochureDivider = document.createElement('div');
                brochureDivider.className = 'brochure-card__divider';
                
                const brochurePrice = document.createElement('div');
                brochurePrice.className = 'brochure-card__price';
                brochurePrice.textContent = priceRange;
                
                const brochureCta = document.createElement('button');
                brochureCta.type = 'button';
                brochureCta.className = 'brochure-card__cta';
                brochureCta.textContent = 'View brochure';
                
                brochureBody.appendChild(brochureTitle);
                brochureBody.appendChild(brochureDivider);
                brochureBody.appendChild(brochurePrice);
                brochureBody.appendChild(brochureCta);
                
                brochureComponent.appendChild(brochureImageWrapper);
                brochureComponent.appendChild(brochureBody);
                
                brochureComponent.onclick = function(e) {
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
                streamTextIntoElement(botText, message.text, STREAM_WORD_MS, function() {
                    botContent.appendChild(createFeedbackButtons(msgId));
                });
                
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
        function renderDesktopListings(cards) {
            if (!isDesktopLayout()) return;
            enterDesktopSplit();
            const stage = document.getElementById('desktop-stage');
            const listings = document.getElementById('desktop-stage-listings');
            const grid = document.getElementById('desktop-stage-grid');
            const meta = document.getElementById('desktop-stage-listings-meta');
            if (!stage || !grid || !listings) return;

            hideDesktopStagePanels('desktop-stage-listings');
            const photosMosaic = document.getElementById('desktop-stage-photos-mosaic');
            if (photosMosaic) photosMosaic.innerHTML = '';
            grid.innerHTML = '';
            if (meta) {
                meta.textContent = cards.length
                    ? cards.length + ' matches · open a card or continue on Housing.com'
                    : '';
            }

            cards.slice(0, 12).forEach(function(card) {
                const tile = document.createElement('button');
                tile.type = 'button';
                tile.className = 'desktop-listing-card';
                tile.setAttribute('aria-label', (card.name || 'Property') + ' details');
                const priceLabel = card.priceUnit === 'k'
                    ? ('₹' + card.price)
                    : ('₹' + card.price + ' ' + (card.priceUnit || 'Cr'));
                tile.innerHTML =
                    '<div class="desktop-listing-card__media">' +
                        '<img src="" alt="" loading="lazy">' +
                    '</div>' +
                    '<div class="desktop-listing-card__body">' +
                        '<p class="desktop-listing-card__name"></p>' +
                        '<p class="desktop-listing-card__loc"></p>' +
                        '<p class="desktop-listing-card__price"></p>' +
                        '<p class="desktop-listing-card__meta"></p>' +
                    '</div>';
                const img = tile.querySelector('img');
                img.src = card.image || (typeof PROPERTY_IMAGE_POOL !== 'undefined' ? PROPERTY_IMAGE_POOL[0] : '');
                img.alt = card.name || '';
                img.onerror = function() {
                    if (!this.dataset.failed && typeof PROPERTY_IMAGE_POOL !== 'undefined') {
                        this.dataset.failed = '1';
                        this.src = PROPERTY_IMAGE_POOL[0];
                    }
                };
                tile.querySelector('.desktop-listing-card__name').textContent = card.name || 'Property';
                tile.querySelector('.desktop-listing-card__loc').textContent = card.locality || '';
                tile.querySelector('.desktop-listing-card__price').textContent = priceLabel;
                tile.querySelector('.desktop-listing-card__meta').textContent =
                    (card.bhk ? card.bhk + ' BHK' : '') +
                    (card.status ? ' · ' + card.status : '');
                tile.addEventListener('click', function() {
                    lastMentionedProject = cardToProjectPictureData(card);
                    openPropertyDetailPage(card, tile);
                });
                grid.appendChild(tile);
            });
        }

        window.__houzyDesktop = {
            syncListings: function() {
                if (lastShownPropertyCards && lastShownPropertyCards.length && isDesktopSplit()) {
                    renderDesktopListings(lastShownPropertyCards);
                }
            }
        };

        function showPropertyCards() {
            // Show typing indicator first
            showTypingIndicator();
            
            // Generate cards
            const cards = generatePropertyCards();
            lastShownPropertyCards = cards;
            if (cards.length > 0) {
                lastMentionedProject = cardToProjectPictureData(cards[0]);
            }
            
            // Add delay before showing properties (realistic processing time)
            const delay = 1800 + Math.random() * 1000; // 1800-2800ms delay
            
                setTimeout(() => {
                // Hide typing indicator
                hideTypingIndicator();
                
                const carousel = renderPropertyCards(cards, cards);
                
                // Create bot message with cards
                const msgId = generateMessageId();
                const displayedCount = Math.min(cards.length, 7);
                const message = {
                    id: msgId,
                    role: 'bot',
                    text: cards.length > 7 
                        ? `Great! I found ${cards.length} properties matching your criteria. Here are the top ${displayedCount}.`
                        : `Great! I found ${cards.length} properties matching your criteria.`,
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
                
                // Add text (no bubble – ChatGPT-style, streamed)
                const botText = document.createElement('div');
                botText.className = 'bot-text';

                botContent.appendChild(botText);
                botContent.appendChild(carousel);
                streamTextIntoElement(botText, message.text, STREAM_WORD_MS, function() {
                    botContent.appendChild(createPropertyCardsFeedbackRow());
                    const chatInputEl = document.getElementById('chat-input');
                    if (chatInputEl) {
                        chatInputEl.placeholder = 'Reply to Houzy';
                    }
                });
                
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

                // d-web stays full-width here; split opens only on Housing.com handoff
            }, delay);
            
            return 'loading';
        }
        
        // Create feedback row: thumbs up, thumbs down, copy (assets/feedback/*.svg – active state = fill black)
        function createFeedbackButtons(messageId) {
            const feedbackContainer = document.createElement('div');
            feedbackContainer.className = 'feedback-buttons';
            feedbackContainer.dataset.messageId = messageId;
            
            const thumbUpPath = 'M30.625 5.0075C30.4842 4.84795 30.3111 4.72019 30.1171 4.63269C29.9231 4.54519 29.7128 4.49996 29.5 4.5H26V3.5C26 2.83696 25.7366 2.20107 25.2678 1.73223C24.7989 1.26339 24.163 1 23.5 1C23.4071 0.999934 23.316 1.02574 23.237 1.07454C23.158 1.12333 23.0941 1.19318 23.0525 1.27625L20.6912 6H18C17.7348 6 17.4804 6.10536 17.2929 6.29289C17.1054 6.48043 17 6.73478 17 7V12.5C17 12.7652 17.1054 13.0196 17.2929 13.2071C17.4804 13.3946 17.7348 13.5 18 13.5H28.75C29.1154 13.5001 29.4684 13.3668 29.7425 13.1252C30.0166 12.8835 30.1931 12.5501 30.2388 12.1875L30.9888 6.1875C31.0153 5.97626 30.9966 5.76179 30.9339 5.55833C30.8712 5.35488 30.7659 5.16711 30.625 5.0075ZM18 7H20.5V12.5H18V7ZM29.9963 6.0625L29.2463 12.0625C29.231 12.1834 29.1722 12.2945 29.0808 12.3751C28.9895 12.4556 28.8718 12.5 28.75 12.5H21.5V6.61812L23.7944 2.02875C24.1344 2.09681 24.4404 2.2806 24.6602 2.54884C24.88 2.81708 25.0001 3.1532 25 3.5V5C25 5.13261 25.0527 5.25979 25.1464 5.35355C25.2402 5.44732 25.3674 5.5 25.5 5.5H29.5C29.571 5.49998 29.6411 5.51505 29.7058 5.54423C29.7704 5.5734 29.8282 5.61601 29.8751 5.66922C29.9221 5.72242 29.9571 5.78501 29.978 5.85282C29.9989 5.92063 30.0051 5.9921 29.9963 6.0625Z';
            const thumbDownPath = 'M58.9888 9.8125L58.2388 3.8125C58.1931 3.44993 58.0166 3.1165 57.7425 2.87483C57.4684 2.63316 57.1154 2.49987 56.75 2.5H46C45.7348 2.5 45.4804 2.60536 45.2929 2.79289C45.1054 2.98043 45 3.23478 45 3.5V9C45 9.26522 45.1054 9.51957 45.2929 9.70711C45.4804 9.89464 45.7348 10 46 10H48.6912L51.0525 14.7238C51.0941 14.8068 51.158 14.8767 51.237 14.9255C51.316 14.9743 51.4071 15.0001 51.5 15C52.163 15 52.7989 14.7366 53.2678 14.2678C53.7366 13.7989 54 13.163 54 12.5V11.5H57.5C57.7129 11.5001 57.9233 11.4548 58.1173 11.3673C58.3113 11.2798 58.4845 11.152 58.6253 10.9923C58.7662 10.8327 58.8714 10.645 58.9341 10.4415C58.9967 10.2381 59.0154 10.0237 58.9888 9.8125ZM48.5 9H46V3.5H48.5V9ZM57.875 10.3306C57.8284 10.3842 57.7708 10.4271 57.706 10.4564C57.6413 10.4856 57.571 10.5005 57.5 10.5H53.5C53.3674 10.5 53.2402 10.5527 53.1464 10.6464C53.0527 10.7402 53 10.8674 53 11V12.5C53.0001 12.8468 52.88 13.1829 52.6602 13.4512C52.4404 13.7194 52.1344 13.9032 51.7944 13.9712L49.5 9.38188V3.5H56.75C56.8718 3.49996 56.9895 3.54439 57.0808 3.62494C57.1722 3.7055 57.231 3.81664 57.2463 3.9375L57.9963 9.9375C58.0056 10.0079 57.9996 10.0795 57.9787 10.1473C57.9578 10.2152 57.9224 10.2777 57.875 10.3306Z';
            const copyPath = 'M85.5 2H77.5C77.3674 2 77.2402 2.05268 77.1464 2.14645C77.0527 2.24021 77 2.36739 77 2.5V5H74.5C74.3674 5 74.2402 5.05268 74.1464 5.14645C74.0527 5.24021 74 5.36739 74 5.5V13.5C74 13.6326 74.0527 13.7598 74.1464 13.8536C74.2402 13.9473 74.3674 14 74.5 14H82.5C82.6326 14 82.7598 13.9473 82.8536 13.8536C82.9473 13.7598 83 13.6326 83 13.5V11H85.5C85.6326 11 85.7598 10.9473 85.8536 10.8536C85.9473 10.7598 86 10.6326 86 10.5V2.5C86 2.36739 85.9473 2.24021 85.8536 2.14645C85.7598 2.05268 85.6326 2 85.5 2ZM82 13H75V6H82V13ZM85 10H83V5.5C83 5.36739 82.9473 5.24021 82.8536 5.14645C82.7598 5.05268 82.6326 5 82.5 5H78V3H85V10Z';
            
            const thumbsUpBtn = document.createElement('button');
            thumbsUpBtn.className = 'feedback-btn feedback-btn-up';
            thumbsUpBtn.setAttribute('aria-label', 'Thumbs up');
            thumbsUpBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="17 1 15 13"><path fill="currentColor" d="${thumbUpPath}"/></svg>`;
            
            const thumbsDownBtn = document.createElement('button');
            thumbsDownBtn.className = 'feedback-btn feedback-btn-down';
            thumbsDownBtn.setAttribute('aria-label', 'Thumbs down');
            thumbsDownBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="45 2 15 13"><path fill="currentColor" d="${thumbDownPath}"/></svg>`;
            
            const copyBtn = document.createElement('button');
            copyBtn.className = 'feedback-btn feedback-btn-copy';
            copyBtn.setAttribute('aria-label', 'Copy');
            copyBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="74 2 14 12"><path fill="currentColor" d="${copyPath}"/></svg>`;
            
            let selectedFeedback = null;
            const handleFeedback = (type) => {
                triggerHapticFeedback('subtle');
                if (selectedFeedback === type) {
                    selectedFeedback = null;
                    thumbsUpBtn.classList.remove('active');
                    thumbsDownBtn.classList.remove('active');
                } else {
                    selectedFeedback = type;
                    thumbsUpBtn.classList.toggle('active', type === 'up');
                    thumbsDownBtn.classList.toggle('active', type === 'down');
                    showFeedbackToast();
                }
            };
            
            thumbsUpBtn.addEventListener('click', (e) => { e.stopPropagation(); handleFeedback('up'); });
            thumbsDownBtn.addEventListener('click', (e) => { e.stopPropagation(); handleFeedback('down'); });
            
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerHapticFeedback('subtle');
                const msgEl = document.getElementById(messageId);
                const content = msgEl && msgEl.querySelector('.bot-message-content');
                if (!content) return;
                const clone = content.cloneNode(true);
                const fb = clone.querySelector('.feedback-buttons');
                if (fb) fb.remove();
                const text = clone.textContent.trim();
                if (text && navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(text).then(() => showFeedbackToast('Copied to clipboard')).catch(() => {});
                }
            });
            
            feedbackContainer.appendChild(thumbsUpBtn);
            feedbackContainer.appendChild(thumbsDownBtn);
            feedbackContainer.appendChild(copyBtn);
            return feedbackContainer;
        }
        
        // Feedback row for property cards: thumbs up, thumbs down, share (same thumb icons, share instead of copy)
        function createPropertyCardsFeedbackRow() {
            const feedbackContainer = document.createElement('div');
            feedbackContainer.className = 'feedback-buttons';
            
            const thumbUpPath = 'M30.625 5.0075C30.4842 4.84795 30.3111 4.72019 30.1171 4.63269C29.9231 4.54519 29.7128 4.49996 29.5 4.5H26V3.5C26 2.83696 25.7366 2.20107 25.2678 1.73223C24.7989 1.26339 24.163 1 23.5 1C23.4071 0.999934 23.316 1.02574 23.237 1.07454C23.158 1.12333 23.0941 1.19318 23.0525 1.27625L20.6912 6H18C17.7348 6 17.4804 6.10536 17.2929 6.29289C17.1054 6.48043 17 6.73478 17 7V12.5C17 12.7652 17.1054 13.0196 17.2929 13.2071C17.4804 13.3946 17.7348 13.5 18 13.5H28.75C29.1154 13.5001 29.4684 13.3668 29.7425 13.1252C30.0166 12.8835 30.1931 12.5501 30.2388 12.1875L30.9888 6.1875C31.0153 5.97626 30.9966 5.76179 30.9339 5.55833C30.8712 5.35488 30.7659 5.16711 30.625 5.0075ZM18 7H20.5V12.5H18V7ZM29.9963 6.0625L29.2463 12.0625C29.231 12.1834 29.1722 12.2945 29.0808 12.3751C28.9895 12.4556 28.8718 12.5 28.75 12.5H21.5V6.61812L23.7944 2.02875C24.1344 2.09681 24.4404 2.2806 24.6602 2.54884C24.88 2.81708 25.0001 3.1532 25 3.5V5C25 5.13261 25.0527 5.25979 25.1464 5.35355C25.2402 5.44732 25.3674 5.5 25.5 5.5H29.5C29.571 5.49998 29.6411 5.51505 29.7058 5.54423C29.7704 5.5734 29.8282 5.61601 29.8751 5.66922C29.9221 5.72242 29.9571 5.78501 29.978 5.85282C29.9989 5.92063 30.0051 5.9921 29.9963 6.0625Z';
            const thumbDownPath = 'M58.9888 9.8125L58.2388 3.8125C58.1931 3.44993 58.0166 3.1165 57.7425 2.87483C57.4684 2.63316 57.1154 2.49987 56.75 2.5H46C45.7348 2.5 45.4804 2.60536 45.2929 2.79289C45.1054 2.98043 45 3.23478 45 3.5V9C45 9.26522 45.1054 9.51957 45.2929 9.70711C45.4804 9.89464 45.7348 10 46 10H48.6912L51.0525 14.7238C51.0941 14.8068 51.158 14.8767 51.237 14.9255C51.316 14.9743 51.4071 15.0001 51.5 15C52.163 15 52.7989 14.7366 53.2678 14.2678C53.7366 13.7989 54 13.163 54 12.5V11.5H57.5C57.7129 11.5001 57.9233 11.4548 58.1173 11.3673C58.3113 11.2798 58.4845 11.152 58.6253 10.9923C58.7662 10.8327 58.8714 10.645 58.9341 10.4415C58.9967 10.2381 59.0154 10.0237 58.9888 9.8125ZM48.5 9H46V3.5H48.5V9ZM57.875 10.3306C57.8284 10.3842 57.7708 10.4271 57.706 10.4564C57.6413 10.4856 57.571 10.5005 57.5 10.5H53.5C53.3674 10.5 53.2402 10.5527 53.1464 10.6464C53.0527 10.7402 53 10.8674 53 11V12.5C53.0001 12.8468 52.88 13.1829 52.6602 13.4512C52.4404 13.7194 52.1344 13.9032 51.7944 13.9712L49.5 9.38188V3.5H56.75C56.8718 3.49996 56.9895 3.54439 57.0808 3.62494C57.1722 3.7055 57.231 3.81664 57.2463 3.9375L57.9963 9.9375C58.0056 10.0079 57.9996 10.0795 57.9787 10.1473C57.9578 10.2152 57.9224 10.2777 57.875 10.3306Z';
            const shareSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>';
            
            const thumbsUpBtn = document.createElement('button');
            thumbsUpBtn.className = 'feedback-btn feedback-btn-up';
            thumbsUpBtn.setAttribute('aria-label', 'Thumbs up');
            thumbsUpBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="17 1 15 13"><path fill="currentColor" d="${thumbUpPath}"/></svg>`;
            
            const thumbsDownBtn = document.createElement('button');
            thumbsDownBtn.className = 'feedback-btn feedback-btn-down';
            thumbsDownBtn.setAttribute('aria-label', 'Thumbs down');
            thumbsDownBtn.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="45 2 15 13"><path fill="currentColor" d="${thumbDownPath}"/></svg>`;
            
            const shareBtn = document.createElement('button');
            shareBtn.className = 'feedback-btn feedback-btn-share';
            shareBtn.setAttribute('aria-label', 'Share');
            shareBtn.innerHTML = shareSvg;
            
            let selectedFeedback = null;
            const handleFeedback = (type) => {
                triggerHapticFeedback('subtle');
                if (selectedFeedback === type) {
                    selectedFeedback = null;
                    thumbsUpBtn.classList.remove('active');
                    thumbsDownBtn.classList.remove('active');
                } else {
                    selectedFeedback = type;
                    thumbsUpBtn.classList.toggle('active', type === 'up');
                    thumbsDownBtn.classList.toggle('active', type === 'down');
                    showFeedbackToast();
                }
            };
            
            thumbsUpBtn.addEventListener('click', (e) => { e.stopPropagation(); handleFeedback('up'); });
            thumbsDownBtn.addEventListener('click', (e) => { e.stopPropagation(); handleFeedback('down'); });
            shareBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                triggerHapticFeedback('subtle');
                if (navigator.share) {
                    navigator.share({
                        title: 'Properties',
                        text: 'Check out these properties',
                        url: window.location.href
                    }).then(() => showFeedbackToast('Link shared')).catch(() => {});
                } else if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(window.location.href);
                    showFeedbackToast('Link copied');
                }
            });
            
            feedbackContainer.appendChild(thumbsUpBtn);
            feedbackContainer.appendChild(thumbsDownBtn);
            feedbackContainer.appendChild(shareBtn);
            return feedbackContainer;
        }
        
        // Show minimal toast notification for feedback
        function showFeedbackToast(message) {
            const existingToast = document.querySelector('.feedback-toast');
            if (existingToast) existingToast.remove();
            const toast = document.createElement('div');
            toast.className = 'feedback-toast';
            toast.textContent = message || 'Thanks for sharing feedback';
            
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
        
        // Clear property-search pattern: message obviously asks for properties (e.g. "3bhk rohini 30k rent")
        // When true, always treat as handled so we never show fallback/out-of-scope for repeat or similar queries
        function isClearPropertySearch(normalized) {
            const hasBhk = /\b(\d+)\s*(bhk|bhks|bedroom|bedrooms|bed room|br|beds?|room)\b|\b(bhk|bedroom)\s*(\d+)\b/i.test(normalized);
            const hasRentBuy = /\b(rent|rental|buy|purchase|sale)\b/i.test(normalized);
            const hasPriceLike = /\b\d+\s*(k|thousand|lakh|lac|cr|crore|lak)\b|\b\d{4,6}\b/i.test(normalized);
            const hasLocalityLike = /\b(rohini|andheri|koramangala|indiranagar|malad|gurgaon|noida|delhi|mumbai|bangalore|pune|hyderabad|chennai|locality|area|sector|phase)\b/i.test(normalized) ||
                (/\b[a-z]{4,}\b/i.test(normalized) && (hasBhk || hasRentBuy)); // word that could be locality + property context
            if (hasBhk && (hasRentBuy || hasPriceLike || hasLocalityLike)) return true;
            if (hasRentBuy && (hasPriceLike || hasLocalityLike)) return true;
            if (hasPriceLike && hasLocalityLike) return true;
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
                    if (window.__CHAT_DEBUG__) console.log('[Intent] Unhandled: Non-housing topic detected - will trigger fallback', {
                        normalized,
                        text
                    });
                }
                return false; // Not handled - will trigger fallback
            }
            
            // INTENT CHECK 0b: Clear property search (e.g. "3bhk rohini 30k rent") – always handled, never fallback
            // Ensures repeat or similar messages always show properties, not out-of-scope
            if (isClearPropertySearch(normalized)) {
                if (window.__CHAT_DEBUG__) console.log('[Intent] Handled: Clear property search – will show properties');
                return true;
            }
            
            // INTENT CHECK 1: Greeting (handled)
            if (isGreeting(text)) {
                if (window.__CHAT_DEBUG__) console.log('[Intent] Handled: Greeting');
                return true;
            }
            
            // INTENT CHECK 2: Brochure request (handled) – includes typo "bruchire"
            const isBrochureRequest = /show.*brochure|brochure.*show|view.*brochure|brochure.*view|download.*brochure|brochure.*download|bruchire/i.test(normalized) ||
                fuzzyMatchWord(text, 'show brochure', 0.7) ||
                fuzzyMatchWord(text, 'brochure', 0.7) ||
                fuzzyMatchWord(text, 'bruchire', 0.8);
            if (isBrochureRequest) {
                if (window.__CHAT_DEBUG__) console.log('[Intent] Handled: Brochure request');
                return true;
            }

            // INTENT CHECK 2b: Property / project pictures request
            if (isPropertyPicturesRequest(text)) {
                if (window.__CHAT_DEBUG__) console.log('[Intent] Handled: Property pictures request');
                return true;
            }
            
            // INTENT CHECK 3: Strict housing-related check
            // Only consider it handled if it's clearly about properties/homes
            if (isHousingRelated(text, normalized, updates)) {
                if (window.__CHAT_DEBUG__) {
                        if (window.__CHAT_DEBUG__) console.log('[Intent] Handled: Housing-related message', {
                        intent: !!updates.intent,
                        bhk: !!updates.bhk,
                        price: !!(updates.price || updates.priceMin || updates.priceMax),
                        locality: !!updates.locality,
                        location: !!updates.useLocation
                    });
                }
                return true;
            }
            
            // INTENT CHECK 4: Location proximity phrases (handled)
            // Check for location-related requests that trigger location modal
            if (isLocationProximityPhrase(text)) {
                if (window.__CHAT_DEBUG__) console.log('[Intent] Handled: Location proximity phrase');
                return true;
            }
            
            // Message does NOT match any handled intent - will trigger fallback
            if (window.__CHAT_DEBUG__) {
                if (window.__CHAT_DEBUG__) console.log('[Intent] Unhandled: No matching intent found - will trigger fallback', {
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
                } else if (isAllCasesMessage(text)) {
                    // PATH: "All cases" → open All flows page (slide in from right)
                    if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to All flows page');
                    showAllFlowsPage();
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
                
                    // Check for location proximity phrases (around me, near me, near metro, etc.)
                    if (isLocationProximityPhrase(text)) {
                        if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to location modal');
                        conversationState.useLocation = true;
                        showLocationPermissionDialog();
                        return;
                    }
                
                    // Check for brochure request (includes typo "bruchire")
                    const isBrochureRequest = /show.*brochure|brochure.*show|view.*brochure|brochure.*view|download.*brochure|brochure.*download|bruchire/i.test(normalized) ||
                        fuzzyMatchWord(text, 'show brochure', 0.7) ||
                        fuzzyMatchWord(text, 'brochure', 0.7) ||
                        fuzzyMatchWord(text, 'bruchire', 0.8);
                    
                    if (isBrochureRequest) {
                        if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to brochure flow');
                        showBrochureMessage();
                    return;
                }

                    // Property / room pictures – adaptive mosaic (1 / 2 / 3 / 4+)
                    if (isPropertyPicturesRequest(text)) {
                        if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to property pictures preview');
                        const propertyName = extractPropertyNameFromPicturesRequest(text);
                        showPropertyPicturesPreview(propertyName, text);
                        return;
                    }
                
                    // "Tell me about [place]" – show locality info card (Figma Case 1 structure)
                    const tellMeAboutMatch = normalized.match(/tell me about\s+(.+)/i);
                    if (tellMeAboutMatch && tellMeAboutMatch[1]) {
                        const placeName = tellMeAboutMatch[1].trim();
                        if (placeName.length >= 2) {
                            if (window.__CHAT_DEBUG__) console.log('[Intent] Routing to locality info card', { placeName });
                            showLocalityInfoCard(placeName);
                            return;
                        }
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

                    // Clear searches (or nearly complete ones) get defaults so cards always appear
                    if (isClearPropertySearch(normalized) || conversationState.bhk) {
                        fillSearchDefaults(text);
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
                            fillSearchDefaults(text);
                            conversationState.isComplete = true;
                            showPropertyCards();
                        }
                    }
                }
            }, 300);
        }
        
        // Update send button filled/unfilled state (Figma: Input field Default vs Fill)
        function updateSendButtonState() {
            const icon = document.getElementById('chat-send-btn-icon');
            const hasText = (chatInput.value || '').trim().length > 0;
            if (icon) {
                icon.src = hasText ? 'assets/input/send-enabled.svg' : 'assets/input/send-disabled.svg';
            }
            chatSendBtn.disabled = !hasText;
        }

        updateSendButtonState();
        chatInput.addEventListener('input', updateSendButtonState);
        chatInput.addEventListener('change', updateSendButtonState);

        // Basic send button handler — this is when floating pills / intro dismiss
        chatSendBtn.addEventListener('click', () => {
            const text = chatInput.value.trim();
            if (!text) return;
            
            // Clear input
            chatInput.value = '';
            updateSendButtonState();
            
            // Hide intro + floating pills; dock Ask Houzy to sticky footer (desktop)
            if (chatScreen && !chatScreen.classList.contains('chat-started')) {
                chatScreen.classList.add('chat-started');
                if (typeof setChatOffsets === 'function') setChatOffsets();
            }
            ensureDesktopComposerDocked();
            
            // Handle the message
            handleUserMessage(text);
        });
        
        // Enter key handler
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                chatSendBtn.click();
            }
        });
        
        // Pill click: fill Ask Houzy — pills stay until Send is clicked
        document.body.addEventListener('click', function pillClickDelegated(e) {
            const pill = e.target && e.target.closest('.chat-pill');
            if (!pill) return;
            if (!pill.closest('#chat-intro') && !pill.closest('#chipsRail') && !pill.closest('.chips-tracks-wrapper')) {
                return;
            }
            const text = pill.textContent.trim();
            if (!text) return;
            e.preventDefault();
            e.stopPropagation();
            chatInput.value = text;
            updateSendButtonState();
            chatInput.focus();
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

    // Houzy bottom-nav tooltip; dismiss with X for this visit only — shows again on refresh
    (function initHouzyNavTooltip() {
        var tip = document.getElementById('houzy-nav-tooltip');
        var closeBtn = document.getElementById('houzy-nav-tooltip-close');
        if (!tip || !closeBtn) return;

        /** Keep tooltip in viewport when centered on Houzy slot (caret stays over icon via CSS absolute). */
        function nudgeHouzyTooltipIntoViewport() {
            if (tip.hasAttribute('hidden')) return;
            tip.style.setProperty('--houzy-tip-nudge', '0px');
            void tip.offsetWidth;
            var r = tip.getBoundingClientRect();
            var pad = 12;
            var nudge = 0;
            if (r.left < pad) nudge = pad - r.left;
            else if (r.right > window.innerWidth - pad) nudge = window.innerWidth - pad - r.right;
            if (nudge) tip.style.setProperty('--houzy-tip-nudge', nudge + 'px');
        }

        function dismiss() {
            tip.classList.remove('houzy-nav-tooltip--enter');
            tip.setAttribute('hidden', '');
            tip.setAttribute('aria-hidden', 'true');
            tip.style.removeProperty('--houzy-tip-nudge');
        }

        function shouldShow() {
            var chat = document.getElementById('chat-screen');
            if (chat && chat.classList.contains('active')) return false;
            return true;
        }

        function show() {
            if (!shouldShow()) return;
            tip.removeAttribute('hidden');
            tip.setAttribute('aria-hidden', 'false');
            tip.classList.remove('houzy-nav-tooltip--enter');
            void tip.offsetWidth;
            requestAnimationFrame(function() {
                requestAnimationFrame(function() {
                    nudgeHouzyTooltipIntoViewport();
                    tip.classList.add('houzy-nav-tooltip--enter');
                    requestAnimationFrame(function() {
                        nudgeHouzyTooltipIntoViewport();
                    });
                    setTimeout(nudgeHouzyTooltipIntoViewport, 120);
                });
            });
        }

        closeBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            dismiss();
        });

        window.addEventListener('resize', debounce(nudgeHouzyTooltipIntoViewport, 120));
        window.addEventListener('orientationchange', function() {
            setTimeout(nudgeHouzyTooltipIntoViewport, 200);
        });

        show();
    })();
});

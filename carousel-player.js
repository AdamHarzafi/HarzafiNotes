// Controllo unificato in stile Apple: timeline, autoplay e pausa.
window.setupHarzafiCarousel = ({ trackId, itemSelector, playerId, edgeContainerId = null, label = null, pauseOnFocus = false, onlyWhenOverflow = false, skipRepeatedPositions = false }) => {
    const track = document.getElementById(trackId);
    const player = document.getElementById(playerId);
    const edgeContainer = edgeContainerId ? document.getElementById(edgeContainerId) : null;
    if (!track || !player) return;

    const items = Array.from(track.querySelectorAll(itemSelector));
    const steps = Array.from(player.querySelectorAll('.carousel-timeline-step'));
    const toggle = player.querySelector('.carousel-play-toggle');
    if (!items.length || items.length !== steps.length || !toggle) return;

    const duration = parseFloat(getComputedStyle(player).getPropertyValue('--carousel-duration')) || 6500;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reducedMotion = motionPreference.matches;
    const playerName = label || (playerId.includes('features') ? 'funzionalità' : 'riquadri di supporto');
    player.hidden = false;
    let activeIndex = 0;
    let cycleTimer = null;
    let scrollTimer = null;
    let programmaticScroll = false;
    let isPaused = reducedMotion;
    let isCarouselVisible = false;

    const maxScroll = () => Math.max(0, track.scrollWidth - track.clientWidth);
    const targetForIndex = (index) => {
        const firstOffset = items[0].offsetLeft;
        return Math.min(maxScroll(), Math.max(0, items[index].offsetLeft - firstOffset));
    };

    const updateEdges = () => {
        if (!edgeContainer) return;
        const current = Math.max(0, track.scrollLeft);
        const maximum = maxScroll();
        edgeContainer.classList.toggle('can-scroll-left', current > 8);
        edgeContainer.classList.toggle('can-scroll-right', current < maximum - 8);
    };

    const syncToggle = () => {
        player.hidden = onlyWhenOverflow && maxScroll() <= 2;
        player.classList.toggle('is-paused', isPaused || !isCarouselVisible || document.hidden);
        toggle.setAttribute('aria-pressed', isPaused ? 'true' : 'false');
        toggle.setAttribute('aria-label', isPaused
            ? `Riprendi il carosello delle ${playerName}`
            : `Metti in pausa il carosello delle ${playerName}`);
    };

    const syncSteps = (restartProgress = false) => {
        steps.forEach((step, index) => {
            const isActive = index === activeIndex;
            step.classList.toggle('is-active', isActive);
            step.setAttribute('aria-current', isActive ? 'true' : 'false');
        });

        if (restartProgress) {
            const activeStep = steps[activeIndex];
            activeStep.classList.remove('is-active');
            void activeStep.offsetWidth;
            activeStep.classList.add('is-active');
        }
    };

    const scheduleNext = () => {
        clearTimeout(cycleTimer);
        if (isPaused || !isCarouselVisible || document.hidden || items.length < 2 || (onlyWhenOverflow && maxScroll() <= 2)) return;
        cycleTimer = setTimeout(() => {
            let nextIndex = (activeIndex + 1) % items.length;
            // At the end of a multi-card viewport, do not wait twice on the same view.
            if (skipRepeatedPositions) {
                while (nextIndex !== activeIndex && Math.abs(targetForIndex(nextIndex) - targetForIndex(activeIndex)) < 2) {
                    nextIndex = (nextIndex + 1) % items.length;
                }
            }
            goTo(nextIndex);
        }, duration);
    };

    const goTo = (index, behavior = 'smooth') => {
        activeIndex = Math.max(0, Math.min(items.length - 1, index));
        if (reducedMotion) behavior = 'auto';
        programmaticScroll = true;
        track.scrollTo({ left: targetForIndex(activeIndex), behavior });
        syncSteps(true);
        scheduleNext();
        window.setTimeout(() => { programmaticScroll = false; }, behavior === 'smooth' ? 750 : 0);
    };

    const updateFromManualScroll = () => {
        if (programmaticScroll) return;
        const current = Math.max(0, track.scrollLeft);
        let nearestIndex = 0;
        let nearestDistance = Infinity;
        items.forEach((item, index) => {
            const distance = Math.abs(targetForIndex(index) - current);
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestIndex = index;
            }
        });
        if (nearestIndex !== activeIndex) {
            activeIndex = nearestIndex;
            syncSteps(true);
        }
        scheduleNext();
    };

    steps.forEach((step, index) => step.addEventListener('click', () => goTo(index)));

    toggle.addEventListener('click', () => {
        isPaused = !isPaused;
        clearTimeout(cycleTimer);
        syncToggle();
        if (!isPaused) {
            syncSteps(true);
            scheduleNext();
        }
    });

    track.addEventListener('pointerdown', () => { programmaticScroll = false; }, { passive: true });
    track.addEventListener('wheel', () => { programmaticScroll = false; }, { passive: true });
    track.addEventListener('scroll', () => {
        updateEdges();
        clearTimeout(scrollTimer);
        scrollTimer = setTimeout(updateFromManualScroll, 140);
    }, { passive: true });
    track.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        goTo(activeIndex + (event.key === 'ArrowRight' ? 1 : -1));
    });

    // Reading with the keyboard must not move a focused link away.
    if (pauseOnFocus) track.addEventListener('focusin', () => {
        isPaused = true;
        clearTimeout(cycleTimer);
        syncToggle();
    });
    motionPreference.addEventListener('change', (event) => {
        reducedMotion = event.matches;
        if (reducedMotion) {
            isPaused = true;
            clearTimeout(cycleTimer);
            syncToggle();
        }
    });

    window.addEventListener('resize', () => {
        track.scrollTo({ left: targetForIndex(activeIndex), behavior: 'auto' });
        updateEdges();
        syncToggle();
        scheduleNext();
    }, { passive: true });
    document.addEventListener('visibilitychange', () => {
        clearTimeout(cycleTimer);
        syncToggle();
        if (!document.hidden) scheduleNext();
    });

    if ('IntersectionObserver' in window) {
        const carouselVisibilityObserver = new IntersectionObserver((entries) => {
            const nextVisibility = entries.some(entry => entry.isIntersecting);
            if (nextVisibility === isCarouselVisible) return;

            isCarouselVisible = nextVisibility;
            clearTimeout(cycleTimer);
            syncToggle();

            if (isCarouselVisible && !isPaused) {
                syncSteps(true);
                scheduleNext();
            }
        }, { threshold: 0.35 });
        carouselVisibilityObserver.observe(edgeContainer || track);
    } else {
        isCarouselVisible = true;
    }

    syncToggle();
    syncSteps(true);
    updateEdges();
    scheduleNext();
    return {
        pause() {
            isPaused = true;
            clearTimeout(cycleTimer);
            syncToggle();
        }
    };
};

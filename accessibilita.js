function initAccessibilita() {
    const observerOptions = { root: null, rootMargin: '0px', threshold: 0.15 };
    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => { 
            if (entry.isIntersecting) { 
                entry.target.classList.add('active'); 
                observer.unobserve(entry.target); 
            } 
        });
    }, observerOptions);
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));

    const trackerText = document.getElementById("dynamic-counter-tracker");
    const consent = localStorage.getItem('harzafi_cookie_consent');
    let isAnalyticsAllowed = false;
    try { if (consent) isAnalyticsAllowed = JSON.parse(consent).analytics; } catch(e){}

    if (trackerText) {
        if (consent && !isAnalyticsAllowed) {
            trackerText.innerText = "Non tracciato";
        } else {
            const getUrl = 'https://firestore.googleapis.com/v1/projects/harzafi---fsl/databases/(default)/documents/statistiche/visualizzazioni';
            
            const fetchCountOnly = () => {
                fetch(getUrl)
                .then(res => res.json())
                .then(data => {
                    if (data && data.fields && data.fields.count) {
                        trackerText.innerText = data.fields.count.integerValue;
                    } else {
                        trackerText.innerText = "Non disponibile";
                    }
                }).catch(() => { trackerText.innerText = "Non disponibile"; });
            };

            if (!sessionStorage.getItem('view_counted')) {
                const commitUrl = 'https://firestore.googleapis.com/v1/projects/harzafi---fsl/databases/(default)/documents:commit';
                
                const payload = {
                    writes:[{
                        transform: {
                            document: "projects/harzafi---fsl/databases/(default)/documents/statistiche/visualizzazioni",
                            fieldTransforms:[{
                                fieldPath: "count",
                                increment: { integerValue: "1" }
                            }]
                        }
                    }]
                };

                sessionStorage.setItem('view_counted', 'true');
fetch(commitUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)})
.then(res => {
    if (!res.ok) throw new Error("Write blocked or failed");
    return res.json();
})
.then(data => {
    try {
        trackerText.innerText = data.writeResults[0].transformResults[0].integerValue;
    } catch(e) { fetchCountOnly(); }
})
.catch(() => {
    sessionStorage.removeItem('view_counted');
    fetchCountOnly();
});
            } else {
                fetchCountOnly();
            }
        }
    }

    // GESTIONE SCROLL NAVBAR SPOSTATA QUI
    const navbar = document.querySelector('.navbar-wrapper');
    if (navbar) {
        let isScrolled = false;
        window.addEventListener('scroll', () => {
            const shouldBeScrolled = window.scrollY > 40;
            if (shouldBeScrolled !== isScrolled) {
                isScrolled = shouldBeScrolled;
                if (isScrolled) { navbar.classList.add('scrolled'); } 
                else { navbar.classList.remove('scrolled'); }
            }
        }, { passive: true });
    }

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    function setupAccessCarousel(trackId, playerId) {
        const track = document.getElementById(trackId);
        const player = document.getElementById(playerId);
        if (!track || !player) return;

        const cards = Array.from(track.querySelectorAll('.access-info-card'));
        const steps = Array.from(player.querySelectorAll('.carousel-timeline-step'));
        const toggle = player.querySelector('.carousel-play-toggle');
        const duration = Number.parseInt(getComputedStyle(player).getPropertyValue('--carousel-duration'), 10) || 6500;
        let activeIndex = 0;
        let timer = null;
        let isVisible = false;
        let pausedByUser = reducedMotion.matches;
        let ignoreScrollUntil = 0;
        let scrollSettleTimer = null;

        const restartProgress = (step) => {
            step.classList.remove('is-active');
            void step.offsetWidth;
            step.classList.add('is-active');
        };

        const updateToggle = () => {
            player.classList.toggle('is-paused', pausedByUser);
            toggle.setAttribute('aria-pressed', String(pausedByUser));
            toggle.setAttribute('aria-label', pausedByUser ? 'Riprendi il carosello' : 'Metti in pausa il carosello');
        };

        const canPlay = () => (
            !pausedByUser &&
            isVisible &&
            !document.hidden &&
            !document.body.classList.contains('access-modal-open')
        );

        const clearTimer = () => {
            if (timer !== null) window.clearTimeout(timer);
            timer = null;
        };

        const scheduleNext = () => {
            clearTimer();
            if (!canPlay()) return;
            timer = window.setTimeout(() => {
                selectCard((activeIndex + 1) % cards.length, true, true);
            }, duration);
        };

        const selectCard = (nextIndex, shouldScroll, resetProgress) => {
            activeIndex = (nextIndex + cards.length) % cards.length;
            cards.forEach((card, index) => card.classList.toggle('is-current', index === activeIndex));
            steps.forEach((step, index) => {
                const isActive = index === activeIndex;
                step.setAttribute('aria-current', String(isActive));
                if (isActive && resetProgress) restartProgress(step);
                else step.classList.toggle('is-active', isActive);
            });

            if (shouldScroll) {
                ignoreScrollUntil = performance.now() + 750;
                const target = cards[activeIndex];
                track.scrollTo({
                    left: target.offsetLeft - track.offsetLeft,
                    behavior: reducedMotion.matches ? 'auto' : 'smooth'
                });
            }
            scheduleNext();
        };

        steps.forEach((step, index) => {
            step.addEventListener('click', () => selectCard(index, true, true));
        });

        toggle.addEventListener('click', () => {
            pausedByUser = !pausedByUser;
            updateToggle();
            if (pausedByUser) clearTimer();
            else selectCard(activeIndex, false, true);
        });

        track.addEventListener('scroll', () => {
            if (performance.now() < ignoreScrollUntil) return;
            window.clearTimeout(scrollSettleTimer);
            scrollSettleTimer = window.setTimeout(() => {
                const left = track.scrollLeft;
                const nearestIndex = cards.reduce((nearest, card, index) => {
                    const cardLeft = card.offsetLeft - track.offsetLeft;
                    const nearestLeft = cards[nearest].offsetLeft - track.offsetLeft;
                    return Math.abs(cardLeft - left) < Math.abs(nearestLeft - left) ? index : nearest;
                }, 0);
                if (nearestIndex !== activeIndex) selectCard(nearestIndex, false, true);
            }, 100);
        }, { passive: true });

        const visibilityObserver = new IntersectionObserver((entries) => {
            isVisible = entries[0].isIntersecting;
            if (isVisible) scheduleNext();
            else clearTimer();
        }, { threshold: 0.3 });
        visibilityObserver.observe(track);

        document.addEventListener('visibilitychange', scheduleNext);
        document.addEventListener('accessmodalchange', scheduleNext);
        reducedMotion.addEventListener?.('change', (event) => {
            if (event.matches) pausedByUser = true;
            updateToggle();
            scheduleNext();
        });

        updateToggle();
        selectCard(0, false, true);
    }

    setupAccessCarousel('access-features-track', 'access-features-player');
    setupAccessCarousel('access-standards-track', 'access-standards-player');

    const modal = document.getElementById('access-detail-modal');
    const modalPanel = modal?.querySelector('.access-modal-panel');
    const modalScroll = modal?.querySelector('.access-modal-scroll');
    const modalClose = modal?.querySelector('.access-modal-close');
    const modalEyebrow = document.getElementById('access-modal-eyebrow');
    const modalTitle = document.getElementById('access-modal-title');
    const modalContent = document.getElementById('access-modal-content');
    let lastModalTrigger = null;

    const closeAccessModal = () => {
        if (!modal?.classList.contains('is-open')) return;
        modal.classList.remove('is-open');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('access-modal-open');
        document.dispatchEvent(new CustomEvent('accessmodalchange'));
        window.requestAnimationFrame(() => lastModalTrigger?.focus());
    };

    const openAccessModal = (trigger) => {
        const template = document.getElementById(trigger.dataset.accessDetail);
        if (!(template instanceof HTMLTemplateElement) || !modal || !modalTitle || !modalContent || !modalEyebrow) return;

        lastModalTrigger = trigger;
        modalEyebrow.textContent = trigger.dataset.modalEyebrow || '';
        modalTitle.textContent = trigger.dataset.modalTitle || '';
        modalContent.replaceChildren(template.content.cloneNode(true));
        modalScroll.scrollTop = 0;
        modal.setAttribute('aria-hidden', 'false');
        modal.classList.add('is-open');
        document.body.classList.add('access-modal-open');
        document.dispatchEvent(new CustomEvent('accessmodalchange'));
        window.requestAnimationFrame(() => modalClose.focus());
    };

    document.querySelectorAll('[data-access-detail]').forEach((button) => {
        button.addEventListener('click', () => openAccessModal(button));
    });

    modalClose?.addEventListener('click', closeAccessModal);
    modal?.addEventListener('click', (event) => {
        if (event.target === modal) closeAccessModal();
    });

    modal?.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            closeAccessModal();
            return;
        }
        if (event.key !== 'Tab') return;
        const focusable = Array.from(modalPanel.querySelectorAll('button, a[href], [tabindex]:not([tabindex="-1"])'))
            .filter((element) => !element.hasAttribute('disabled'));
        if (!focusable.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
        }
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAccessibilita);
} else {
    initAccessibilita();
}

// The account page uses the same player as the homepage, without its login code.
window.setupHarzafiCarousel({
    trackId: 'account-cards',
    itemSelector: '.account-card',
    playerId: 'account-carousel-player',
    edgeContainerId: 'account-carousel-shell',
    label: 'schede account',
    pauseOnFocus: true,
    onlyWhenOverflow: true,
    skipRepeatedPositions: true
});

(() => {
    const track = document.getElementById('account-values-track');
    const controls = document.querySelector('.account-values-controls');
    const previous = document.getElementById('values-prev');
    const next = document.getElementById('values-next');
    if (!track || !controls || !previous || !next) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => {
        const maximum = Math.max(0, track.scrollWidth - track.clientWidth);
        previous.disabled = track.scrollLeft <= 2;
        next.disabled = track.scrollLeft >= maximum - 2;
    };
    const move = (direction) => {
        const cards = track.querySelectorAll('.account-value');
        const distance = cards.length > 1
            ? cards[1].offsetLeft - cards[0].offsetLeft
            : track.clientWidth;
        track.scrollBy({ left: direction * distance, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    };
    previous.addEventListener('click', () => move(-1));
    next.addEventListener('click', () => move(1));
    track.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        move(event.key === 'ArrowRight' ? 1 : -1);
    });
    track.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync, { passive: true });
    controls.hidden = false;
    sync();
})();

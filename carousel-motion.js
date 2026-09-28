// Shared reveal for homepage, account and accessibility players.
(() => {
    if (!('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            entry.target.classList.toggle('is-player-visible', entry.isIntersecting);
        });
    }, { rootMargin: '-64px 0px -48px 0px', threshold: 0 });

    document.querySelectorAll('.carousel-player').forEach(player => {
        // Observe the stationary wrapper, not the expanding capsule.
        player.classList.add('has-scroll-reveal');
        observer.observe(player);
    });
})();

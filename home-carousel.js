// I due gruppi di funzionalità condividono il player Apple usato da Harzafi.
(() => {
    if (typeof window.setupHarzafiCarousel !== 'function') return;

    [
        {
            trackId: 'notes-core-cards',
            itemSelector: '.notes-feature-card',
            playerId: 'notes-core-cards-player',
            edgeContainerId: 'notes-core-cards-shell',
            label: 'funzionalità principali'
        },
        {
            trackId: 'notes-extra-cards',
            itemSelector: '.notes-feature-card',
            playerId: 'notes-extra-cards-player',
            edgeContainerId: 'notes-extra-cards-shell',
            label: 'funzionalità aggiuntive'
        }
    ].forEach(carousel => window.setupHarzafiCarousel({
        ...carousel,
        pauseOnFocus: true,
        onlyWhenOverflow: true,
        skipRepeatedPositions: true
    }));
})();

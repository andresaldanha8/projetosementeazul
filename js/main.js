document.addEventListener('DOMContentLoaded', function() {
    // Navegação independente dos patrocinadores.
    const sponsorsSection = document.getElementById('patrocinadores');
    if (sponsorsSection) {
        const track = sponsorsSection.querySelector('.sponsors-track');
        const previous = sponsorsSection.querySelector('.sponsors-prev');
        const next = sponsorsSection.querySelector('.sponsors-next');

        if (track && previous && next) {
            const updateSponsorsControls = () => {
                previous.disabled = track.scrollLeft <= 1;
                next.disabled = track.scrollLeft >= track.scrollWidth - track.clientWidth - 1;
            };
            const scrollSponsors = (direction) => {
                const card = track.querySelector('.sponsors-card');
                if (!card) return;
                const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
                track.scrollBy({
                    left: direction * (card.getBoundingClientRect().width + gap),
                    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
                });
            };

            previous.addEventListener('click', () => scrollSponsors(-1));
            next.addEventListener('click', () => scrollSponsors(1));
            track.addEventListener('scroll', updateSponsorsControls, { passive: true });
            window.addEventListener('resize', updateSponsorsControls);
            updateSponsorsControls();
        }
    }

    // Menu hambúrguer
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            hamburger.classList.toggle('open');
    });

    // Scroll suave
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                    e.preventDefault();
                    document.querySelector(this.getAttribute('href')).scrollIntoView({
                            behavior: 'smooth'
                    });
                    navLinks.classList.remove('active');
            });
    });

    // Galeria mobile: impedir scroll vertical ao arrastar horizontalmente
    const galleryCarousel = document.querySelector('.gallery-carousel');
    let startX = 0;
    let scrollLeft = 0;
    let isDown = false;

    if (window.innerWidth <= 600 && galleryCarousel) {
        galleryCarousel.addEventListener('touchstart', (e) => {
            isDown = true;
            startX = e.touches[0].pageX - galleryCarousel.offsetLeft;
            scrollLeft = galleryCarousel.scrollLeft;
        });
        galleryCarousel.addEventListener('touchmove', (e) => {
            if (!isDown) return;
            e.preventDefault();
            const x = e.touches[0].pageX - galleryCarousel.offsetLeft;
            const walk = (x - startX) * 1.2;
            galleryCarousel.scrollLeft = scrollLeft - walk;
        }, { passive: false });
        galleryCarousel.addEventListener('touchend', () => {
            isDown = false;
        });
    }

    // Galeria mobile: setas avançam de 2 em 2
    const leftBtn = document.querySelector('.gallery-arrow.left');
    const rightBtn = document.querySelector('.gallery-arrow.right');
    const images = document.querySelectorAll('.gallery-carousel img');
    let currentIndex = 0;
    let visible = window.innerWidth <= 600 ? 2 : 5;

    function updateCarousel() {
        images.forEach((img, i) => {
            if (i >= currentIndex && i < currentIndex + visible) {
                img.classList.add('active');
            } else {
                img.classList.remove('active');
            }
        });
    }
    updateCarousel();
    if (leftBtn && rightBtn) {
        leftBtn.onclick = () => {
            if (currentIndex > 0) {
                currentIndex -= 2;
                if (currentIndex < 0) currentIndex = 0;
                updateCarousel();
            }
        };
        rightBtn.onclick = () => {
            if (currentIndex < images.length - visible) {
                currentIndex += 2;
                if (currentIndex > images.length - visible) currentIndex = images.length - visible;
                updateCarousel();
            }
        };
    }
    // Efeito de ampliar e centralizar imagem ao clicar
    const galleryOverlay = document.getElementById('galleryOverlay');
    const galleryOverlayImg = document.getElementById('galleryOverlayImg');
    const galleryOverlayClose = document.getElementById('galleryOverlayClose');
    if (galleryOverlay && galleryOverlayImg && images.length) {
        images.forEach(img => {
            img.addEventListener('click', function(e) {
                galleryOverlayImg.src = this.src;
                galleryOverlay.classList.remove('hidden');
                document.body.style.overflow = 'hidden';
            });
        });
        galleryOverlay.addEventListener('click', function(e) {
            if (e.target === galleryOverlay) {
                galleryOverlay.classList.add('hidden');
                galleryOverlayImg.src = '';
                document.body.style.overflow = '';
            }
        });
        if (galleryOverlayClose) {
            galleryOverlayClose.addEventListener('click', function() {
                galleryOverlay.classList.add('hidden');
                galleryOverlayImg.src = '';
                document.body.style.overflow = '';
            });
        }
    }
});

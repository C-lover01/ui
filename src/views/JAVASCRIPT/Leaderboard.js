// Expand or collapse ranks 8 to 12 with smooth slide animation
const fullStandingsBtn = document.getElementById("fullStandingsBtn");
const moreRankings = document.getElementById("moreRankings");

if (fullStandingsBtn && moreRankings) {
    // Remove the HTML 'hidden' attribute so CSS transitions can animate the height
    moreRankings.removeAttribute("hidden");

    fullStandingsBtn.addEventListener("click", function () {
        const isOpen = moreRankings.classList.toggle("open");

        if (isOpen) {
            fullStandingsBtn.innerHTML = 'Show Less <span>↑</span>';
            fullStandingsBtn.setAttribute('aria-expanded', 'true');
            // Smoothly glide into view
            setTimeout(() => {
                moreRankings.scrollIntoView({ behavior: "smooth", block: "nearest" });
            }, 120);
        } else {
            fullStandingsBtn.innerHTML = 'View More Rankings <span>↓</span>';
            fullStandingsBtn.setAttribute('aria-expanded', 'false');
            // Smoothly glide back to the button as it collapses
            fullStandingsBtn.scrollIntoView({ behavior: "smooth", block: "center" });
        }
    });
}
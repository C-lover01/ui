// Scanner.js — DevFest Bacolod 2026 Camera QR Code Scanner, Feed Search & Connected Matrix Logic

document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const video = document.getElementById('scannerVideo');
    const cameraSelect = document.getElementById('cameraSelect');
    const overlay = document.getElementById('cameraStatusOverlay');
    const statusText = document.getElementById('cameraStatusText');
    const simScanBtn = document.getElementById('simScanBtn');
    const simScanBtnFooter = document.getElementById('simScanBtnFooter');
    const banner = document.getElementById('scanSuccessBanner');
    const bannerText = document.getElementById('scanSuccessText');
    const scansList = document.getElementById('scansList');
    const emptyFeedMessage = document.getElementById('emptyFeedMessage');
    const resetEmptyFilterBtn = document.getElementById('resetEmptyFilterBtn');

    // Search and Filter Elements
    const searchInput = document.getElementById('scanSearchInput');
    const filterSelect = document.getElementById('feedFilterSelect');
    const autoOption = document.getElementById('autoFilterOption');
    const activeFilterTag = document.getElementById('activeFilterTag');
    const activeFilterLabel = document.getElementById('activeFilterLabel');
    const clearFilterBtn = document.getElementById('clearFilterBtn');

    // Camera Toggle Elements
    const toggleCamBtn = document.getElementById('toggleCameraBtn');
    const camIconOn = document.getElementById('camIconOn');
    const camIconOff = document.getElementById('camIconOff');
    const camToggleText = document.getElementById('camToggleText');

    // Manual Modal Elements
    const manualBtn = document.getElementById('manualEntryBtn');
    const modal = document.getElementById('manualModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    const manualForm = document.getElementById('manualScanForm');
    const manualAttendeePointsInput = document.getElementById('manualAttendeePoints');

    // Point Matrix Dynamic Elements
    const totalScansCounter = document.getElementById('totalScansCounter');
    const tierProgressBar = document.getElementById('tierProgressBar');
    const tierProgressLabel = document.getElementById('tierProgressLabel');
    const nextTierLabel = document.getElementById('nextTierLabel');

    // 4 Tier Cards & Badges
    const tierCards = [
        document.getElementById('tierCard1'),
        document.getElementById('tierCard2'),
        document.getElementById('tierCard3'),
        document.getElementById('tierCard4')
    ];
    const activeBadges = [
        document.getElementById('activeBadge1'),
        document.getElementById('activeBadge2'),
        document.getElementById('activeBadge3'),
        document.getElementById('activeBadge4')
    ];
    const filterBadges = [
        document.getElementById('filterBadge1'),
        document.getElementById('filterBadge2'),
        document.getElementById('filterBadge3'),
        document.getElementById('filterBadge4')
    ];

    const tierPointsList = [100, 85, 65, 45];

    // --- State ---
    let totalScansCount = 1; // Initial count matching Kurt Satumbaga
    let currentStream = null;
    let isCameraActive = true;
    let lastScannedCode = null;
    let scanTimeout = null;
    let barcodeDetector = null;
    let detectInterval = null;

    // --- Color Code Helpers (Scanner Based) ---
    // Green: 100 PTS | Yellow: 85 PTS | Blue: 65 PTS | Red: 45 PTS
    function getPointsBadgeClass(points) {
        if (points >= 100) return 'points-badge-100'; // Green
        if (points >= 85) return 'points-badge-85';   // Yellow
        if (points >= 65) return 'points-badge-65';   // Blue
        return 'points-badge-45';                      // Red
    }

    // --- Audio Feedback (Synthesizer Beep) ---
    function playBeep() {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.14);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.15);
        } catch (e) {
            // Audio policy interaction fallback
        }
    }

    function showOverlay(message) {
        if (statusText) statusText.textContent = message;
        if (overlay) {
            overlay.hidden = false;
            overlay.style.display = 'flex';
        }
    }

    function hideOverlay() {
        if (overlay) {
            overlay.hidden = true;
            overlay.style.display = 'none';
        }
    }

    // --- Camera Handling ---
    async function updateCameraList() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return;
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoInputs = devices.filter(d => d.kind === 'videoinput');
            if (videoInputs.length > 0 && cameraSelect) {
                const currentDeviceId = currentStream 
                    ? currentStream.getVideoTracks()[0]?.getSettings()?.deviceId 
                    : null;

                cameraSelect.innerHTML = '';
                videoInputs.forEach((device, index) => {
                    const opt = document.createElement('option');
                    opt.value = device.deviceId;
                    opt.textContent = device.label || `Camera ${index + 1}`;
                    if (currentDeviceId && device.deviceId === currentDeviceId) {
                        opt.selected = true;
                    }
                    cameraSelect.appendChild(opt);
                });
            }
        } catch (err) {
            console.warn('Could not list cameras:', err);
        }
    }

    async function startCamera(deviceId = null) {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            showOverlay('Camera API is not supported in this browser or environment.');
            return;
        }

        if (currentStream) {
            currentStream.getTracks().forEach(t => t.stop());
            currentStream = null;
        }

        const constraints = {
            video: deviceId
                ? { deviceId: { exact: deviceId }, width: { ideal: 1280 } }
                : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
            audio: false
        };

        try {
            showOverlay('Requesting camera permission...');
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            if (video) {
                video.muted = true;
                video.srcObject = currentStream;
                video.onloadedmetadata = () => {
                    video.play().catch(e => console.warn('Autoplay error:', e));
                    hideOverlay();
                };
            }
            isCameraActive = true;
            updateToggleBtnUI(true);
            await updateCameraList();
            startBarcodeDetection();
        } catch (err) {
            console.error('Camera access error:', err);
            isCameraActive = false;
            updateToggleBtnUI(false);
            if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                showOverlay('Camera blocked. Please allow camera permissions in your browser bar.');
            } else {
                showOverlay('Camera unavailable: Please use Simulated Scan or Manual Entry.');
            }
        }
    }

    function stopCamera() {
        if (currentStream) {
            currentStream.getTracks().forEach(t => t.stop());
            currentStream = null;
        }
        if (detectInterval) {
            clearInterval(detectInterval);
            detectInterval = null;
        }
        if (video) video.srcObject = null;
        isCameraActive = false;
        updateToggleBtnUI(false);
        showOverlay('Camera is currently turned off.');
    }

    function updateToggleBtnUI(active) {
        if (!toggleCamBtn) return;
        if (active) {
            toggleCamBtn.classList.remove('is-off');
            if (camIconOn) camIconOn.hidden = false;
            if (camIconOff) camIconOff.hidden = true;
            if (camToggleText) camToggleText.textContent = 'Turn Off Camera';
        } else {
            toggleCamBtn.classList.add('is-off');
            if (camIconOn) camIconOn.hidden = true;
            if (camIconOff) camIconOff.hidden = false;
            if (camToggleText) camToggleText.textContent = 'Turn On Camera';
        }
    }

    if (toggleCamBtn) {
        toggleCamBtn.addEventListener('click', () => {
            if (isCameraActive) {
                stopCamera();
            } else {
                startCamera(cameraSelect ? cameraSelect.value || null : null);
            }
        });
    }

    if (cameraSelect) {
        cameraSelect.addEventListener('change', () => {
            if (cameraSelect.value) startCamera(cameraSelect.value);
        });
    }

    function startBarcodeDetection() {
        if (!('BarcodeDetector' in window)) return;
        if (detectInterval) clearInterval(detectInterval);

        try {
            barcodeDetector = new BarcodeDetector({ formats: ['qr_code'] });
            detectInterval = setInterval(async () => {
                if (video && video.readyState >= 2 && isCameraActive) {
                    try {
                        const barcodes = await barcodeDetector.detect(video);
                        if (barcodes.length > 0) {
                            handleScanResult(barcodes[0].rawValue);
                        }
                    } catch (e) {}
                }
            }, 300);
        } catch (e) {
            console.warn('BarcodeDetector error:', e);
        }
    }

    // --- Automatic Point Allocation Matrix Progress ---
    function updateMatrixProgress() {
        if (totalScansCounter) {
            totalScansCounter.textContent = totalScansCount;
        }

        let activeIndex = 0;
        let percentage = 0;
        let currentTierText = '';
        let nextTierText = '';
        let currentTierPoints = 100;

        if (totalScansCount <= 10) {
            activeIndex = 0;
            currentTierPoints = 100;
            percentage = Math.min(100, Math.round((totalScansCount / 10) * 100));
            currentTierText = `Current Tier Progress (${totalScansCount}/10 Visits)`;
            nextTierText = 'Next Tier: 11-50 Visits (85 PTS · Yellow)';
        } else if (totalScansCount <= 50) {
            activeIndex = 1;
            currentTierPoints = 85;
            const inTier = totalScansCount - 10;
            percentage = Math.min(100, Math.round((inTier / 40) * 100));
            currentTierText = `Current Tier Progress (${totalScansCount}/50 Visits)`;
            nextTierText = 'Next Tier: 51-90 Visits (65 PTS · Blue)';
        } else if (totalScansCount <= 90) {
            activeIndex = 2;
            currentTierPoints = 65;
            const inTier = totalScansCount - 50;
            percentage = Math.min(100, Math.round((inTier / 40) * 100));
            currentTierText = `Current Tier Progress (${totalScansCount}/90 Visits)`;
            nextTierText = 'Next Tier: 91+ Visits (45 PTS · Red)';
        } else {
            activeIndex = 3;
            currentTierPoints = 45;
            percentage = 100;
            currentTierText = `Max Tier Active (${totalScansCount} Visits)`;
            nextTierText = 'Standard Visit Active (45 PTS · Red)';
        }

        if (tierProgressBar) {
            tierProgressBar.style.width = `${Math.max(6, percentage)}%`;
        }

        if (tierProgressLabel) tierProgressLabel.textContent = currentTierText;
        if (nextTierLabel) nextTierLabel.textContent = nextTierText;

        // Dynamically update the "Auto" filter option text
        if (autoOption) {
            autoOption.textContent = `Auto: Current Tier (${currentTierPoints} PTS)`;
        }

        // Automatic tier cards UI styling
        tierCards.forEach((card, idx) => {
            if (card) {
                if (idx === activeIndex) {
                    card.classList.add('tier-active');
                } else {
                    card.classList.remove('tier-active');
                }
            }
        });

        activeBadges.forEach((badge, idx) => {
            if (badge) badge.hidden = (idx !== activeIndex);
        });

        if (manualAttendeePointsInput) {
            manualAttendeePointsInput.value = currentTierPoints;
        }

        // If currently set to "auto" filter, automatically re-run filter for the new active tier
        if (filterSelect && filterSelect.value === 'auto') {
            filterFeed();
        }
    }

    function getCurrentTierPoints() {
        if (totalScansCount <= 10) return 100;
        if (totalScansCount <= 50) return 85;
        if (totalScansCount <= 90) return 65;
        return 45;
    }

    // ============================================================
    // CONNECTED & AUTOMATIC FILTER
    // ============================================================
    function applyFilter(filterVal) {
        if (filterSelect) filterSelect.value = filterVal;

        if (activeFilterTag && activeFilterLabel) {
            if (filterVal === 'all') {
                activeFilterTag.hidden = true;
            } else if (filterVal === 'auto') {
                activeFilterTag.hidden = false;
                activeFilterLabel.textContent = `Auto Filter (${getCurrentTierPoints()} PTS)`;
            } else {
                activeFilterTag.hidden = false;
                activeFilterLabel.textContent = `Filtered: ${filterVal} PTS`;
            }
        }

        // Highlight matching tier card in the Point Allocation Matrix
        const activeTarget = (filterVal === 'auto') ? String(getCurrentTierPoints()) : filterVal;
        tierCards.forEach((card, idx) => {
            if (!card) return;
            const cardPoints = String(tierPointsList[idx]);
            const isSelected = (activeTarget === cardPoints);

            if (isSelected) {
                card.classList.add('tier-filtered');
            } else {
                card.classList.remove('tier-filtered');
            }

            if (filterBadges[idx]) {
                filterBadges[idx].hidden = !isSelected;
            }
        });

        filterFeed();
    }

    // Tier cards click: convenience toggle
    tierCards.forEach((card, idx) => {
        if (!card) return;
        const tierPoints = String(tierPointsList[idx]);
        card.addEventListener('click', () => {
            const currentFilter = filterSelect ? filterSelect.value : 'all';
            applyFilter(currentFilter === tierPoints ? 'all' : tierPoints);
        });
    });

    if (clearFilterBtn) {
        clearFilterBtn.addEventListener('click', () => applyFilter('all'));
    }

    if (resetEmptyFilterBtn) {
        resetEmptyFilterBtn.addEventListener('click', () => {
            applyFilter('all');
            if (searchInput) {
                searchInput.value = '';
                filterFeed();
            }
        });
    }

    // When dropdown changes, it automatically filters immediately
    if (filterSelect) {
        filterSelect.addEventListener('change', () => applyFilter(filterSelect.value));
    }

    // --- Search & Filter Logic on Feed List ---
    function filterFeed() {
        if (!scansList) return;
        const query = searchInput ? searchInput.value.toLowerCase().trim() : '';
        const filterVal = filterSelect ? filterSelect.value : 'all';
        const items = scansList.querySelectorAll('.scan-item');
        let visibleCount = 0;

        let targetPoints = null;
        if (filterVal === 'auto') {
            targetPoints = getCurrentTierPoints();
        } else if (filterVal !== 'all') {
            targetPoints = parseInt(filterVal, 10);
        }

        items.forEach(item => {
            const name = (item.dataset.name || '').toLowerCase();
            const id = (item.dataset.id || '').toLowerCase();
            const points = parseInt(item.dataset.points, 10) || 0;

            const matchesQuery = !query || name.includes(query) || id.includes(query);
            let matchesFilter = (targetPoints === null) || (points === targetPoints);

            if (matchesQuery && matchesFilter) {
                item.style.display = 'flex';
                visibleCount++;
            } else {
                item.style.display = 'none';
            }
        });

        if (emptyFeedMessage) {
            emptyFeedMessage.hidden = (visibleCount > 0);
        }
    }

    if (searchInput) searchInput.addEventListener('input', filterFeed);

    function handleScanResult(code) {
        if (!code || lastScannedCode === code) return;
        lastScannedCode = code;

        playBeep();
        let attendeeId = code.trim();
        let name = 'DevFest Visitor';
        if (attendeeId.toLowerCase().includes('attendee')) {
            name = `Attendee ${attendeeId.replace(/\D/g, '') || 'Badge'}`;
        }

        const pointsToAward = getCurrentTierPoints();
        addScanToFeed(attendeeId, name, pointsToAward);

        if (bannerText && banner) {
            bannerText.textContent = `✓ ${name} Scanned (+${pointsToAward} PTS)`;
            banner.hidden = false;
        }

        clearTimeout(scanTimeout);
        scanTimeout = setTimeout(() => {
            if (banner) banner.hidden = true;
            lastScannedCode = null;
        }, 3200);
    }

    // --- Add Attendee to Recent Scans Feed with COLOR-CODED BADGE ---
    function addScanToFeed(attendeeId, name, points) {
        if (!scansList) return;
        const now = new Date();
        const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const badgeColorClass = getPointsBadgeClass(points);

        const article = document.createElement('article');
        article.className = 'scan-item scan-item-new';
        article.dataset.id = attendeeId;
        article.dataset.name = name;
        article.dataset.points = String(points);

        article.innerHTML = `
            <div class="attendee-info">
                <div class="attendee-avatar">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
                        <circle cx="12" cy="8" r="4"></circle>
                        <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"></path>
                    </svg>
                </div>
                <div class="attendee-details">
                    <strong class="attendee-name">${escapeHtml(name)}</strong>
                    <span class="attendee-sub">ID: ${escapeHtml(attendeeId)} · ${time}</span>
                </div>
            </div>
            <span class="points-badge ${badgeColorClass}">+${points} PTS</span>
        `;

        scansList.prepend(article);
        totalScansCount++;
        updateMatrixProgress();
        filterFeed();
    }

    function escapeHtml(str) {
        return str.replace(/[&<>"']/g, m => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[m]);
    }

    // Sample pool for simulate scan
    const sampleAttendees = [
        { id: 'Attendee012', name: 'Maria Clara Santos' },
        { id: 'Attendee045', name: 'Joshua James Lim' },
        { id: 'Attendee078', name: 'Alyssa Nicole Tan' },
        { id: 'Attendee103', name: 'Christian Dave Perez' },
        { id: 'Attendee150', name: 'Bea Patricia Gomez' },
        { id: 'Attendee210', name: 'John Gabriel Ramos' },
        { id: 'Attendee288', name: 'Andrea Mae Flores' },
        { id: 'Attendee340', name: 'Rafael Carlos Diaz' }
    ];
    let sampleIndex = 0;

    function triggerSimulateScan() {
        const sample = sampleAttendees[sampleIndex % sampleAttendees.length];
        sampleIndex++;

        playBeep();
        const pointsToAward = getCurrentTierPoints();
        addScanToFeed(sample.id, sample.name, pointsToAward);

        if (bannerText && banner) {
            bannerText.textContent = `✓ ${sample.name} Scanned (+${pointsToAward} PTS)`;
            banner.hidden = false;
            clearTimeout(scanTimeout);
            scanTimeout = setTimeout(() => { banner.hidden = true; }, 3000);
        }
    }

    if (simScanBtn) simScanBtn.addEventListener('click', triggerSimulateScan);
    if (simScanBtnFooter) simScanBtnFooter.addEventListener('click', triggerSimulateScan);

    // --- Manual Entry Modal ---
    if (manualBtn && modal) {
        manualBtn.addEventListener('click', () => {
            modal.hidden = false;
            if (manualAttendeePointsInput) manualAttendeePointsInput.value = getCurrentTierPoints();
            const idInput = document.getElementById('manualAttendeeId');
            if (idInput) idInput.focus();
        });
    }

    const closeModal = () => {
        if (modal) modal.hidden = true;
        if (manualForm) manualForm.reset();
    };

    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    if (manualForm) {
        manualForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const idInput = document.getElementById('manualAttendeeId');
            const nameInput = document.getElementById('manualAttendeeName');
            const pointsInput = document.getElementById('manualAttendeePoints');

            const id = idInput ? idInput.value.trim() : '';
            const name = nameInput ? nameInput.value.trim() : '';
            const points = pointsInput ? parseInt(pointsInput.value, 10) || getCurrentTierPoints() : getCurrentTierPoints();

            if (!id) return;

            playBeep();
            const displayName = name || `Attendee (${id})`;
            addScanToFeed(id, displayName, points);

            if (bannerText && banner) {
                bannerText.textContent = `✓ ${displayName} Awarded (+${points} PTS)`;
                banner.hidden = false;
                setTimeout(() => { banner.hidden = true; }, 3000);
            }

            closeModal();
        });
    }

    // Initialize initial item badge color
    const initialItemBadge = document.querySelector('.scan-item .points-badge');
    if (initialItemBadge) {
        initialItemBadge.className = 'points-badge points-badge-100';
    }

    updateMatrixProgress();
    startCamera();
});
// State Management
let appState = {
    releases: [],
    categories: {},
    filteredReleases: [],
    selectedCategory: 'all',
    searchTerm: '',
    sortOrder: 'desc', // 'desc' (newest first) or 'asc' (oldest first)
    selectedRelease: null,
    tweetText: '',
    selectedTags: new Set(['#BigQuery', '#GoogleCloud']),
    lastFetched: null
};

// Constant Tag presets and dynamic keywords
const GENERAL_TAGS = ['#BigQuery', '#GoogleCloud', '#GCP', '#DataEng', '#CloudComputing'];
const KEYWORD_TAGS = {
    'gemini': '#GenerativeAI',
    'ai': '#ArtificialIntelligence',
    'embedding': '#VectorSearch',
    'vector': '#VectorSearch',
    'sql': '#SQL',
    'studio': '#BigQueryStudio',
    'security': '#InfoSec',
    'iam': '#CloudSecurity',
    'quota': '#CloudOps',
    'table': '#DataPlatform',
    'partition': '#DataPerformance'
};

// Circle progress ring calculation
const CIRCUMFERENCE = 88; // 2 * pi * r (r=14)

// Elements
const el = {
    feedLoader: document.getElementById('feed-loader'),
    feedError: document.getElementById('feed-error'),
    feedEmpty: document.getElementById('feed-empty'),
    errorMessage: document.getElementById('error-message'),
    releasesContainer: document.getElementById('releases-container'),
    categoryPills: document.getElementById('category-pills'),
    searchInput: document.getElementById('search-input'),
    clearSearch: document.getElementById('clear-search'),
    refreshBtn: document.getElementById('refresh-btn'),
    refreshIcon: document.getElementById('refresh-icon'),
    retryBtn: document.getElementById('retry-btn'),
    resetFiltersBtn: document.getElementById('reset-filters-btn'),
    
    // Stats
    statTotal: document.getElementById('stat-total'),
    statFeatures: document.getElementById('stat-features'),
    statAnnouncements: document.getElementById('stat-announcements'),
    statIssues: document.getElementById('stat-issues'),
    metricsCards: document.querySelectorAll('.metric-card'),
    
    // sorting & count
    feedCountText: document.getElementById('feed-count-text'),
    sortDescBtn: document.getElementById('sort-desc-btn'),
    sortAscBtn: document.getElementById('sort-asc-btn'),
    
    // Composer
    composerEmpty: document.getElementById('composer-empty'),
    composerActive: document.getElementById('composer-active'),
    selectedCardDate: document.getElementById('selected-card-date'),
    selectedCardBadge: document.getElementById('selected-card-badge'),
    tweetTextarea: document.getElementById('tweet-textarea'),
    hashtagPills: document.getElementById('hashtag-pills'),
    charCounter: document.getElementById('char-counter'),
    progressCircle: document.getElementById('progress-circle'),
    copyTweetBtn: document.getElementById('copy-tweet-btn'),
    shareTweetBtn: document.getElementById('share-tweet-btn'),
    
    // Toast
    toast: document.getElementById('toast-notification'),
    toastMessage: document.getElementById('toast-message'),
    
    // Footer sync
    lastUpdatedText: document.getElementById('last-updated-text')
};

// Event Listeners initialization
function initEvents() {
    el.refreshBtn.addEventListener('click', () => fetchReleases(true));
    el.retryBtn.addEventListener('click', () => fetchReleases(true));
    el.resetFiltersBtn.addEventListener('click', resetFilters);
    
    // Search with simple debounce
    let searchTimeout;
    el.searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        appState.searchTerm = e.target.value.trim().toLowerCase();
        
        if (appState.searchTerm.length > 0) {
            el.clearSearch.style.display = 'block';
        } else {
            el.clearSearch.style.display = 'none';
        }
        
        searchTimeout = setTimeout(applyFiltersAndRender, 200);
    });
    
    el.clearSearch.addEventListener('click', () => {
        el.searchInput.value = '';
        appState.searchTerm = '';
        el.clearSearch.style.display = 'none';
        applyFiltersAndRender();
    });
    
    // Metric cards filtering
    el.metricsCards.forEach(card => {
        card.addEventListener('click', () => {
            const filterType = card.getAttribute('data-filter');
            
            // Set active visual state
            el.metricsCards.forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            if (filterType === 'all') {
                appState.selectedCategory = 'all';
            } else if (filterType === 'issues') {
                // Issues filter matches Issue, Deprecated, Fixed, Change
                appState.selectedCategory = 'issues-fixes';
            } else {
                appState.selectedCategory = filterType;
            }
            
            // Sync category pills selection
            updatePillsSelection();
            applyFiltersAndRender();
        });
    });
    
    // Sort Toggles
    el.sortDescBtn.addEventListener('click', () => {
        if (appState.sortOrder !== 'desc') {
            appState.sortOrder = 'desc';
            el.sortDescBtn.classList.add('active');
            el.sortAscBtn.classList.remove('active');
            applyFiltersAndRender();
        }
    });
    
    el.sortAscBtn.addEventListener('click', () => {
        if (appState.sortOrder !== 'asc') {
            appState.sortOrder = 'asc';
            el.sortAscBtn.classList.add('active');
            el.sortDescBtn.classList.remove('active');
            applyFiltersAndRender();
        }
    });
    
    // Composer elements
    el.tweetTextarea.addEventListener('input', (e) => {
        appState.tweetText = e.target.value;
        updateCharCount();
    });
    
    el.copyTweetBtn.addEventListener('click', copyTweetToClipboard);
    el.shareTweetBtn.addEventListener('click', postOnTwitter);
}

// Fetch releases from Python API
async function fetchReleases(force = false) {
    showLoader();
    try {
        const url = `/api/releases${force ? '?force=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Unknown server error');
        }
        
        appState.releases = data.releases;
        appState.categories = data.stats.categories;
        appState.lastFetched = data.last_fetched_time;
        
        // Update stats UI
        renderStats(data.stats);
        
        // Render left sidebar category pills
        renderCategoryPills();
        
        // Render core feed
        applyFiltersAndRender();
        
        // Update Sync UI Text
        updateSyncTimeText();
        
        hideLoader();
    } catch (error) {
        console.error('Error fetching release notes:', error);
        showError(error.message);
    }
}

// Render overall stats counter widgets
function renderStats(stats) {
    el.statTotal.textContent = stats.total || 0;
    el.statFeatures.textContent = stats.categories['Feature'] || 0;
    el.statAnnouncements.textContent = stats.categories['Announcement'] || 0;
    
    // Group issues: Issue, Deprecated, Fixed, Change
    const issuesCount = 
        (stats.categories['Issue'] || 0) + 
        (stats.categories['Deprecated'] || 0) + 
        (stats.categories['Fixed'] || 0) + 
        (stats.categories['Change'] || 0);
        
    el.statIssues.textContent = issuesCount;
}

// Generate the category list with count badges in the sidebar
function renderCategoryPills() {
    el.categoryPills.innerHTML = '';
    
    // Create 'All' pill
    const allPill = document.createElement('li');
    allPill.id = 'pill-all';
    allPill.className = appState.selectedCategory === 'all' ? 'active' : '';
    allPill.innerHTML = `
        <span>All Updates</span>
        <span class="pill-count">${appState.releases.length}</span>
    `;
    allPill.addEventListener('click', () => selectCategory('all'));
    el.categoryPills.appendChild(allPill);
    
    // Create specific pills sorted by frequency
    const sortedCategories = Object.entries(appState.categories)
        .sort((a, b) => b[1] - a[1]);
        
    sortedCategories.forEach(([catName, count]) => {
        const pill = document.createElement('li');
        pill.id = `pill-${catName.toLowerCase()}`;
        pill.className = appState.selectedCategory === catName ? 'active' : '';
        pill.innerHTML = `
            <span>${catName}</span>
            <span class="pill-count">${count}</span>
        `;
        pill.addEventListener('click', () => selectCategory(catName));
        el.categoryPills.appendChild(pill);
    });
}

// Trigger selection from sidebar category filter
function selectCategory(cat) {
    appState.selectedCategory = cat;
    updatePillsSelection();
    
    // Highlight metrics widgets accordingly if category matches
    el.metricsCards.forEach(c => c.classList.remove('active'));
    if (cat === 'all') {
        document.getElementById('metric-total').classList.add('active');
    } else if (cat === 'Feature') {
        document.getElementById('metric-features').classList.add('active');
    } else if (cat === 'Announcement') {
        document.getElementById('metric-announcements').classList.add('active');
    } else if (['Issue', 'Deprecated', 'Fixed', 'Change'].includes(cat)) {
        document.getElementById('metric-issues').classList.add('active');
    }
    
    applyFiltersAndRender();
}

// Visually sync sidebar pill active states
function updatePillsSelection() {
    const pills = el.categoryPills.querySelectorAll('li');
    pills.forEach(pill => {
        const id = pill.id;
        if (appState.selectedCategory === 'all' && id === 'pill-all') {
            pill.classList.add('active');
        } else if (appState.selectedCategory === 'issues-fixes' && id === 'pill-issue') {
            // map issues aggregate filter
            pill.classList.add('active');
        } else if (id === `pill-${appState.selectedCategory.toLowerCase()}`) {
            pill.classList.add('active');
        } else {
            pill.classList.remove('active');
        }
    });
}

// Core filtering and sorting of release note records
function applyFiltersAndRender() {
    let filtered = [...appState.releases];
    
    // 1. Filter by Category
    if (appState.selectedCategory !== 'all') {
        if (appState.selectedCategory === 'issues-fixes') {
            filtered = filtered.filter(item => 
                ['Issue', 'Deprecated', 'Fixed', 'Change'].includes(item.category)
            );
        } else {
            filtered = filtered.filter(item => item.category === appState.selectedCategory);
        }
    }
    
    // 2. Filter by Search Query
    if (appState.searchTerm) {
        filtered = filtered.filter(item => 
            item.text.toLowerCase().includes(appState.searchTerm) ||
            item.category.toLowerCase().includes(appState.searchTerm) ||
            item.date.toLowerCase().includes(appState.searchTerm)
        );
    }
    
    // 3. Sort Results
    filtered.sort((a, b) => {
        const dateA = new Date(a.updated);
        const dateB = new Date(b.updated);
        return appState.sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });
    
    appState.filteredReleases = filtered;
    
    // Render
    renderReleaseCards();
    
    // Update showing status
    const catName = appState.selectedCategory === 'all' ? 'all categories' : 
                    appState.selectedCategory === 'issues-fixes' ? 'Issues & Fixes' : appState.selectedCategory;
    el.feedCountText.innerHTML = `Showing <strong>${filtered.length}</strong> updates under <em>${catName}</em>`;
}

// Inject cards into UI
function renderReleaseCards() {
    el.releasesContainer.innerHTML = '';
    
    if (appState.filteredReleases.length === 0) {
        el.feedEmpty.style.display = 'flex';
        return;
    }
    el.feedEmpty.style.display = 'none';
    
    appState.filteredReleases.forEach(item => {
        const card = document.createElement('article');
        card.className = `release-card cat-${item.category.toLowerCase()}`;
        if (appState.selectedRelease && appState.selectedRelease.id === item.id) {
            card.classList.add('selected');
        }
        
        // Short snippet of HTML content for visual representation
        card.innerHTML = `
            <div class="card-header">
                <span class="card-date"><i class="fa-regular fa-calendar-days" style="margin-right: 6px;"></i>${item.date}</span>
                <span class="badge ${getBadgeClass(item.category)}">${item.category}</span>
            </div>
            <div class="card-body">
                ${item.html}
            </div>
            <div class="card-footer">
                <a href="${item.link}" target="_blank" class="card-link">
                    <span>View Docs</span>
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </a>
                <button class="draft-tweet-btn" onclick="event.stopPropagation(); selectForTweet('${item.id}')">
                    <i class="fa-solid fa-paper-plane"></i>
                    <span>Draft Tweet</span>
                </button>
            </div>
        `;
        
        // Clicking card selects it for X posting
        card.addEventListener('click', () => {
            selectForTweet(item.id);
        });
        
        el.releasesContainer.appendChild(card);
    });
}

// Helper to determine CSS class for category tag labels
function getBadgeClass(cat) {
    const list = {
        'Feature': 'feature',
        'Announcement': 'announcement',
        'Issue': 'issue',
        'Deprecated': 'deprecated',
        'Fixed': 'fixed',
        'Change': 'change'
    };
    return list[cat] || 'general';
}

// Select a release card, highlighting it and loading the X composer panel
function selectForTweet(itemId) {
    const item = appState.releases.find(r => r.id === itemId);
    if (!item) return;
    
    appState.selectedRelease = item;
    
    // Highlight active card
    const cards = el.releasesContainer.querySelectorAll('.release-card');
    cards.forEach(card => card.classList.remove('selected'));
    
    // Re-render feed items to ensure correct state styling, or query card directly
    applyFiltersAndRender();
    
    // Populate hashtags dynamically
    generateHashtags(item.text);
    
    // Build initial tweet text draft
    draftInitialTweet(item);
    
    // Toggle composer view
    el.composerEmpty.style.display = 'none';
    el.composerActive.style.display = 'flex';
    
    // Animate panels if required (sliding effect on desktop)
    el.selectedCardDate.textContent = item.date;
    el.selectedCardBadge.className = `badge ${getBadgeClass(item.category)}`;
    el.selectedCardBadge.textContent = item.category;
    
    // Focus textarea
    el.tweetTextarea.focus();
}

// Intelligently parse text and suggest hashtag pills
function generateHashtags(text) {
    appState.selectedTags = new Set(['#BigQuery', '#GoogleCloud']); // Default tags
    const normalizedText = text.toLowerCase();
    
    // Check for custom keywords in text contents
    Object.entries(KEYWORD_TAGS).forEach(([keyword, hashtag]) => {
        if (normalizedText.includes(keyword)) {
            appState.selectedTags.add(hashtag);
        }
    });
    
    // Render tag pills
    el.hashtagPills.innerHTML = '';
    
    // Show a selection of general + matched tags (up to 6)
    const combinedTags = Array.from(new Set([...Array.from(appState.selectedTags), ...GENERAL_TAGS])).slice(0, 6);
    
    combinedTags.forEach(tag => {
        const pill = document.createElement('span');
        pill.className = `tag-pill ${appState.selectedTags.has(tag) ? 'selected' : ''}`;
        pill.textContent = tag;
        
        pill.addEventListener('click', () => {
            if (appState.selectedTags.has(tag)) {
                // Cannot deselect base ones easily unless they click, let them do it
                appState.selectedTags.delete(tag);
                pill.classList.remove('selected');
            } else {
                appState.selectedTags.add(tag);
                pill.classList.add('selected');
            }
            updateTweetTextFromTags();
        });
        
        el.hashtagPills.appendChild(pill);
    });
}

// Assemble initial draft based on update metadata and text content
function draftInitialTweet(item) {
    const header = `🚀 BigQuery Update (${item.date} - ${item.category}):\n`;
    const footer = `\n\n${Array.from(appState.selectedTags).join(' ')}`;
    
    // Calculate space left for description
    const headerFooterLen = header.length + footer.length;
    const maxDescLen = 280 - headerFooterLen - 5; // buffer for padding
    
    let descriptionText = item.text;
    if (descriptionText.length > maxDescLen) {
        descriptionText = descriptionText.slice(0, maxDescLen) + '...';
    }
    
    appState.tweetText = `${header}${descriptionText}${footer}`;
    el.tweetTextarea.value = appState.tweetText;
    updateCharCount();
}

// Recalculate full draft string when user clicks hashtag pills
function updateTweetTextFromTags() {
    if (!appState.selectedRelease) return;
    
    // Get text lines from current textarea text to preserve user modifications
    const lines = el.tweetTextarea.value.split('\n');
    let userMainText = '';
    
    if (lines.length > 1) {
        // Strip the first line (title) and the last non-empty line (usually tags)
        const contentLines = lines.slice(1);
        // Find the last line that matches tags
        let tagLineIdx = -1;
        for (let i = contentLines.length - 1; i >= 0; i--) {
            if (contentLines[i].trim().startsWith('#') || contentLines[i].trim() === '') {
                tagLineIdx = i;
            } else {
                break;
            }
        }
        
        if (tagLineIdx !== -1) {
            userMainText = contentLines.slice(0, tagLineIdx).join('\n');
        } else {
            userMainText = contentLines.join('\n');
        }
    } else {
        userMainText = el.tweetTextarea.value;
    }
    
    const header = `🚀 BigQuery Update (${appState.selectedRelease.date} - ${appState.selectedRelease.category}):\n`;
    const footer = `\n\n${Array.from(appState.selectedTags).join(' ')}`;
    
    // Merge back, keeping user edited description if possible
    appState.tweetText = `${header}${userMainText.trim()}${footer}`;
    el.tweetTextarea.value = appState.tweetText;
    updateCharCount();
}

// Circular progress tracker and numerical visualizer
function updateCharCount() {
    const charCount = el.tweetTextarea.value.length;
    const remaining = 280 - charCount;
    
    el.charCounter.textContent = remaining;
    
    // Update SVG Circle Progress
    const percent = Math.min(charCount / 280, 1);
    const strokeOffset = CIRCUMFERENCE - percent * CIRCUMFERENCE;
    el.progressCircle.style.strokeDashoffset = strokeOffset;
    
    // Progress styles (green -> yellow -> red)
    el.progressCircle.className.baseVal = "progress-ring__circle";
    el.charCounter.style.color = 'var(--text-secondary)';
    
    if (remaining <= 30 && remaining > 0) {
        el.progressCircle.classList.add('warn');
        el.charCounter.style.color = 'var(--color-deprecated)';
    } else if (remaining <= 0) {
        el.progressCircle.classList.add('danger');
        el.charCounter.style.color = 'var(--color-issue)';
    }
    
    // Enable/disable Post Button
    if (charCount > 280 || charCount === 0) {
        el.shareTweetBtn.disabled = true;
    } else {
        el.shareTweetBtn.disabled = false;
    }
}

// Copy Tweet content to clipboard
function copyTweetToClipboard() {
    const textToCopy = el.tweetTextarea.value;
    navigator.clipboard.writeText(textToCopy).then(() => {
        showToast("Draft copied to clipboard!");
    }).catch(err => {
        console.error('Failed to copy text: ', err);
        showToast("Failed to copy. Please manually select and copy.", true);
    });
}

// Fire X Web Intent redirecting users to twitter posting tab
function postOnTwitter() {
    const textToShare = el.tweetTextarea.value;
    const encodedText = encodeURIComponent(textToShare);
    const xUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
    window.open(xUrl, '_blank');
}

// General UI State transitions
function showLoader() {
    el.feedLoader.style.display = 'flex';
    el.feedError.style.display = 'none';
    el.releasesContainer.style.display = 'none';
    el.refreshIcon.classList.add('spinning');
    el.refreshBtn.disabled = true;
}

function hideLoader() {
    el.feedLoader.style.display = 'none';
    el.releasesContainer.style.display = 'flex';
    el.refreshIcon.classList.remove('spinning');
    el.refreshBtn.disabled = false;
}

function showError(msg) {
    el.feedLoader.style.display = 'none';
    el.releasesContainer.style.display = 'none';
    el.feedError.style.display = 'flex';
    el.errorMessage.textContent = msg;
    el.refreshIcon.classList.remove('spinning');
    el.refreshBtn.disabled = false;
}

function resetFilters() {
    el.searchInput.value = '';
    appState.searchTerm = '';
    el.clearSearch.style.display = 'none';
    selectCategory('all');
}

// Show feedback toasts
function showToast(message, isError = false) {
    el.toastMessage.textContent = message;
    el.toast.className = 'toast show';
    
    if (isError) {
        el.toast.style.borderColor = 'var(--color-issue)';
        el.toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-xmark toast-icon';
        el.toast.querySelector('.toast-icon').style.color = 'var(--color-issue)';
    } else {
        el.toast.style.borderColor = 'var(--color-feature)';
        el.toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-check toast-icon';
        el.toast.querySelector('.toast-icon').style.color = 'var(--color-feature)';
    }
    
    setTimeout(() => {
        el.toast.classList.remove('show');
    }, 2500);
}

// Convert ISO date strings to human readable text
function updateSyncTimeText() {
    if (!appState.lastFetched) {
        el.lastUpdatedText.textContent = "Never updated";
        return;
    }
    
    const fetchDate = new Date(appState.lastFetched);
    const now = new Date();
    const diffMs = now - fetchDate;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) {
        el.lastUpdatedText.textContent = "Synced just now";
    } else if (diffMins === 1) {
        el.lastUpdatedText.textContent = "Synced 1 minute ago";
    } else {
        el.lastUpdatedText.textContent = `Synced ${diffMins} minutes ago`;
    }
}

// Setup a passive refresh checker to update sync time text
setInterval(updateSyncTimeText, 30000);

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    
    // Set dasharray directly in script to ensure animation works
    el.progressCircle.style.strokeDasharray = CIRCUMFERENCE;
    el.progressCircle.style.strokeDashoffset = CIRCUMFERENCE;
    
    fetchReleases();
});

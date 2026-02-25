import React, { useState, useEffect, useMemo } from 'react';
import PressReleaseList from './components/PressReleaseList';
import Pagination from './components/pagination';
import './App.css';
import SearchFiltersPanel from './components/SearchFiltersPanel';
import PressReleaseModal from './components/PressReleaseModal';
import { hasAnyQueryMatch } from './utils/highlight';

const FEATURED_CATEGORIES = [
  {
    id: 'lab-research',
    title: 'Laboratory Research',
    revealText: "Cutting-edge research shaping tomorrow's therapeutic breakthroughs",
    image:
      'https://images.unsplash.com/photo-1532187863486-abf9dbad1b69?auto=format&fit=crop&w=1200&q=80',
    keywords: ['research', 'breakthrough', 'discovery', 'laboratory', 'preclinical', 'pipeline'],
  },
  {
    id: 'drug-development',
    title: 'Drug Development',
    revealText: 'Innovative medications bringing new treatment options to patients worldwide',
    image:
      'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?auto=format&fit=crop&w=1200&q=80',
    keywords: ['drug', 'medication', 'therapy', 'treatment', 'approval', 'dose', 'phase'],
  },
  {
    id: 'medical-technology',
    title: 'Medical Technology',
    revealText: 'Advances in diagnostics and devices transforming modern healthcare systems',
    image:
      'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?auto=format&fit=crop&w=1200&q=80',
    keywords: [
      'diagnostic',
      'diagnostics',
      'device',
      'devices',
      'technology',
      'platform',
      'testing',
      'screening',
      'digital',
      'biomarker',
      'imaging',
      'detection',
      'test',
      'fda approval',
      'regulatory approval',
      'ai',
      'software',
    ],
  },
];

function App() {
  const SAVED_FILTERS_KEY = 'press_saved_filters_v1';

  const [pressReleases, setPressReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('relevance');
  const [filters, setFilters] = useState({
    query: '',
    company: [],
    startDate: '',
    endDate: ''
  });
  const [recentSearches, setRecentSearches] = useState([]);
  const [savedFilters, setSavedFilters] = useState([]);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [filterConfig, setFilterConfig] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedRelease, setSelectedRelease] = useState(null);
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeFeaturedCategory, setActiveFeaturedCategory] = useState('');

  const itemsPerPage = 6;

  useEffect(() => {
    try {
      const storedSaved = JSON.parse(localStorage.getItem(SAVED_FILTERS_KEY) || '[]');
      setSavedFilters(Array.isArray(storedSaved) ? storedSaved : []);
    } catch (error) {
      console.error('Error loading local preferences:', error);
    } finally {
      setPrefsLoaded(true);
    }

    fetchInitialData();
  }, []);

  useEffect(() => {
    if (!prefsLoaded) return;
    localStorage.setItem(SAVED_FILTERS_KEY, JSON.stringify(savedFilters));
  }, [savedFilters, prefsLoaded]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/initial-data');
      const data = await response.json();

      const releases = data?.data?.releases || [];
      const config = data?.data?.filter_config || null;

      setPressReleases(releases);
      setFilteredReleases(releases);
      setFilterConfig(config);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching initial data:', error);
    } finally {
      setLoading(false);
    }
  };

  const addRecentSearch = (queryText) => {
    const normalized = (queryText || '').trim();
    if (!normalized) return;

    setRecentSearches((prev) => {
      const next = [normalized, ...prev.filter((item) => item.toLowerCase() !== normalized.toLowerCase())];
      return next.slice(0, 6);
    });
  };

  const handleApplyFilter = async (overrideFilters = filters) => {
    try {
      setLoading(true);
      let url = 'http://localhost:8000/api/query-press-releases?';
      const appliedFilters = overrideFilters && typeof overrideFilters.preventDefault === 'function'
        ? filters
        : {
            query: overrideFilters?.query || '',
            company: Array.isArray(overrideFilters?.company) ? overrideFilters.company : [],
            startDate: overrideFilters?.startDate || '',
            endDate: overrideFilters?.endDate || '',
          };
      
      if (appliedFilters.query) {
        url += `query=${encodeURIComponent(appliedFilters.query)}&`;
      }
      if (appliedFilters.company.length > 0) {
        appliedFilters.company.forEach(c => {
          url += `company=${encodeURIComponent(c)}&`;
        });
      }
      if (appliedFilters.startDate) {
        url += `start_date=${appliedFilters.startDate}&`;
      }
      if (appliedFilters.endDate) {
        url += `end_date=${appliedFilters.endDate}&`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setFilteredReleases(data?.data || []);
      addRecentSearch(appliedFilters.query);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error applying filter:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenRelease = async (release, match = null) => {
    setSelectedRelease(release);
    setSelectedMatch(match);
    setShowModal(true);
    setDetailLoading(true);

    try {
      if (!release?.url) {
        setDetailLoading(false);
        return;
      }
      const response = await fetch(`http://localhost:8000/api/press-releases/detail?url=${encodeURIComponent(release.url)}`);
      const data = await response.json();
      if (data?.data) {
        setSelectedRelease({
          ...release,
          ...data.data,
          matches: data.data.matches || release.matches || [],
          summary: data.data.summary || release.summary || '',
          description: data.data.description || release.description || '',
        });
      }
    } catch (error) {
      console.error('Error fetching release details:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedRelease(null);
    setSelectedMatch(null);
    setDetailLoading(false);
  };

  const handleSaveCurrentFilters = (nameOverride = '') => {
    const name = (nameOverride || '').trim() || window.prompt('Name this filter preset:') || '';
    const trimmedName = name.trim();
    if (!trimmedName) return;

    const preset = {
      id: `${Date.now()}`,
      name: trimmedName,
      filters,
    };

    setSavedFilters((prev) => {
      const withoutSameName = prev.filter((item) => item.name.toLowerCase() !== trimmedName.toLowerCase());
      return [preset, ...withoutSameName].slice(0, 10);
    });
  };

  const handleApplySavedFilter = (presetId) => {
    const preset = savedFilters.find((item) => item.id === presetId);
    if (!preset) return;

    const nextFilters = {
      query: preset.filters?.query || '',
      company: preset.filters?.company || [],
      startDate: preset.filters?.startDate || '',
      endDate: preset.filters?.endDate || '',
    };

    setFilters(nextFilters);
    handleApplyFilter(nextFilters);
  };

  const handleDeleteSavedFilter = (presetId) => {
    const presetToDelete = savedFilters.find((item) => item.id === presetId);
    const queryToRemove = (presetToDelete?.filters?.query || '').trim().toLowerCase();

    setSavedFilters((prev) => prev.filter((item) => item.id !== presetId));

    if (queryToRemove) {
      setRecentSearches((prev) => prev.filter((term) => term.trim().toLowerCase() !== queryToRemove));
    }
  };

  const handleUseRecentSearch = (queryText) => {
    const nextFilters = { ...filters, query: queryText };
    setFilters(nextFilters);
    handleApplyFilter(nextFilters);
  };

  const handleDeleteRecentSearch = (queryText) => {
    const normalized = (queryText || '').trim().toLowerCase();
    if (!normalized) return;
    setRecentSearches((prev) => prev.filter((term) => term.trim().toLowerCase() !== normalized));
  };

  const handleResetFilter = () => {
    setFilters({
      query: '',
      company: [],
      startDate: '',
      endDate: ''
    });
    setFilteredReleases(pressReleases);
    setCurrentPage(1);
  };

  const sortedReleases = useMemo(() => {
    const normalizedQuery = (filters.query || '').trim();
    const list = normalizedQuery
      ? filteredReleases.filter((release) => {
          const fields = [
            release?.title,
            release?.company,
            release?.summary,
            release?.description,
            ...(Array.isArray(release?.matches) ? release.matches.map((match) => match?.plain_text || '') : []),
          ];

          return fields.some((value) => hasAnyQueryMatch(value || '', normalizedQuery));
        })
      : [...filteredReleases];

    switch (sortBy) {
      case 'newest':
        list.sort((a, b) => new Date(b.published_date) - new Date(a.published_date));
        break;
      case 'oldest':
        list.sort((a, b) => new Date(a.published_date) - new Date(b.published_date));
        break;
      case 'company':
        list.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
        break;
      case 'title':
        list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
        break;
      default:
        break;
    }

    const activeCategory = FEATURED_CATEGORIES.find((item) => item.id === activeFeaturedCategory);
    if (!activeCategory) {
      return list;
    }

    const categoryMatches = list.filter((release) => {
      const haystack = [
        release?.title,
        release?.company,
        release?.summary,
        release?.description,
        ...(Array.isArray(release?.matches)
          ? release.matches.flatMap((match) => [match?.plain_text || '', match?.field_label || '', match?.field || ''])
          : []),
      ]
        .join(' ')
        .toLowerCase();

      return activeCategory.keywords.some((keyword) => {
        const normalizedKeyword = keyword.toLowerCase().trim();
        if (!normalizedKeyword) return false;
        if (normalizedKeyword.includes(' ')) {
          return haystack.includes(normalizedKeyword);
        }
        const keywordRegex = new RegExp(`\\b${normalizedKeyword.replace(/[.*+?^${}()|[\\]\\]/g, '\\\\$&')}\\b`, 'i');
        return keywordRegex.test(haystack);
      });
    });

    if (categoryMatches.length > 0) {
      return categoryMatches;
    }

    return list;
  }, [filteredReleases, sortBy, activeFeaturedCategory]);

  const handleExportCsv = () => {
    if (!sortedReleases.length) return;

    const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

    const headers = ['Title', 'Company', 'Published Date', 'URL', 'Top Match Preview'];
    const rows = sortedReleases.map((item) => [
      item.title,
      item.company,
      item.published_date,
      item.url,
      item.matches?.[0]?.plain_text || '',
    ]);

    const csvText = [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvText], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `press-releases-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(sortedReleases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReleases = sortedReleases.slice(startIndex, startIndex + itemsPerPage);
  const endIndex = Math.min(startIndex + itemsPerPage, sortedReleases.length);

  const todayLabel = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  const activeCategoryTitle = FEATURED_CATEGORIES.find((item) => item.id === activeFeaturedCategory)?.title;

  return (
    <div className="app-shell min-vh-100">
      <nav className="top-nav sticky-top">
        <div className="container-fluid nav-wrap">
          <div className="nav-brand-wrap">
            <span className="brand-icon" aria-hidden="true">
              <i className="bi bi-file-earmark-text"></i>
            </span>
            <span className="brand-title">Press Releases</span>
          </div>
        </div>
      </nav>

      <div className="container py-4 py-lg-5">
        <div className="mb-4 mb-lg-5">
          <h1 className="page-title mb-2">
            <i className="bi bi-stars me-2"></i>
            Discover Pharma News
          </h1>
          <p className="page-subtitle mb-0">
            Search and explore the latest pharmaceutical press releases, FDA approvals, and clinical trial announcements
          </p>
        </div>

        <section className="featured-wrap mb-5">
          <h2 className="section-title">Featured Stories with Reveal Effect</h2>
          <p className="section-subtitle">Hover over the cards below to reveal hidden content with a smooth circular mask transition</p>

          <div className="featured-grid">
            {FEATURED_CATEGORIES.map((story) => (
              <article
                key={story.id}
                className={`featured-card ${activeFeaturedCategory === story.id ? 'is-active' : ''}`}
                style={{ backgroundImage: `url(${story.image})` }}
                role="button"
                tabIndex={0}
                onClick={() => {
                  setActiveFeaturedCategory((prev) => (prev === story.id ? '' : story.id));
                  setCurrentPage(1);
                  document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    setActiveFeaturedCategory((prev) => (prev === story.id ? '' : story.id));
                    setCurrentPage(1);
                    document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
              >
                <div className="featured-overlay" aria-hidden="true"></div>
                <div className="featured-reveal">
                  <p className="featured-reveal-text">{story.revealText}</p>
                </div>
                <h3 className="featured-title">{story.title}</h3>
              </article>
            ))}
          </div>

          {!!activeCategoryTitle && (
            <div className="mt-3 d-flex align-items-center gap-2 small">
              <span className="text-muted">Category:</span>
              <span className="badge text-bg-primary">{activeCategoryTitle}</span>
              <button
                type="button"
                className="btn btn-sm btn-light border"
                onClick={() => {
                  setActiveFeaturedCategory('');
                  setCurrentPage(1);
                }}
              >
                Clear
              </button>
            </div>
          )}
        </section>

      <SearchFiltersPanel
        filterConfig={filterConfig}
        filters={filters}
        setFilters={setFilters}
        onApply={handleApplyFilter}
        onReset={handleResetFilter}
        onSavePreset={handleSaveCurrentFilters}
        onApplyPreset={handleApplySavedFilter}
        onDeletePreset={handleDeleteSavedFilter}
        savedFilters={savedFilters}
        recentSearches={recentSearches}
        onUseRecentSearch={handleUseRecentSearch}
        onDeleteRecentSearch={handleDeleteRecentSearch}
        loading={loading}
        sortBy={sortBy}
        onSortChange={(value) => {
          setSortBy(value);
          setCurrentPage(1);
        }}
        onExportCsv={handleExportCsv}
        hasResults={sortedReleases.length > 0}
      />

        {/* Loading State */}
        {loading && (
          <div className="text-center py-5">
            <div className="spinner-border text-primary" role="status">
              <span className="visually-hidden">Loading...</span>
            </div>
          </div>
        )}

        {/* Results Count */}
        {!loading && (
          <div className="mb-4" id="results-section">
            <p className="results-summary mb-1">Found <span className="count">{sortedReleases.length}</span> results</p>
            <p className="results-range mb-0">Showing {sortedReleases.length ? `${startIndex + 1}-${endIndex}` : '0-0'} of {sortedReleases.length}</p>
          </div>
        )}

        {/* Press Release List */}
        {!loading && sortedReleases.length > 0 && (
          <>
            <PressReleaseList
              releases={paginatedReleases}
              onOpenRelease={handleOpenRelease}
              searchQuery={filters.query}
            />

            {/* Pagination */}
            {totalPages > 1 && (
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            )}
          </>
        )}

        {/* No Results */}
        {!loading && sortedReleases.length === 0 && (
          <div className="alert alert-info text-center" role="alert">
            <i className="bi bi-info-circle me-2"></i>No press releases found
          </div>
        )}

        <PressReleaseModal
          show={showModal}
          release={selectedRelease}
          matchTarget={selectedMatch}
          searchQuery={filters.query}
          loading={detailLoading}
          onClose={handleCloseModal}
        />
      </div>
    </div>
  );
}

export default App;
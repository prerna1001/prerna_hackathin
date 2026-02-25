import React, { useState, useEffect, useMemo } from 'react';
import PressReleaseList from './components/PressReleaseList';
import Pagination from './components/pagination';
import './App.css';
import SearchFiltersPanel from './components/SearchFiltersPanel';
import PressReleaseModal from './components/PressReleaseModal';

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
        setSelectedRelease(data.data);
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

  const handleSaveCurrentFilters = () => {
    const name = window.prompt('Name this filter preset:');
    if (!name || !name.trim()) return;

    const trimmedName = name.trim();
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
    const list = [...filteredReleases];

    switch (sortBy) {
      case 'newest':
        return list.sort((a, b) => new Date(b.published_date) - new Date(a.published_date));
      case 'oldest':
        return list.sort((a, b) => new Date(a.published_date) - new Date(b.published_date));
      case 'company':
        return list.sort((a, b) => (a.company || '').localeCompare(b.company || ''));
      case 'title':
        return list.sort((a, b) => (a.title || '').localeCompare(b.title || ''));
      default:
        return list;
    }
  }, [filteredReleases, sortBy]);

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

  return (
    <div className="app-shell min-vh-100">
      <nav className="navbar navbar-dark top-nav sticky-top">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            <i className="bi bi-newspaper me-2"></i>Press Releases
          </span>
        </div>
      </nav>

      <div className="container py-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="display-4 fw-bold text-primary mb-2 page-title">Press Releases</h1>
          <p className="lead page-subtitle">Explore pharmaceutical press releases from leading companies</p>
        </div>

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
        loading={loading}
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
          <div className="mb-4 d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
            <p className="results-summary mb-0">
              Found <span className="fw-bold count">{sortedReleases.length}</span> results
            </p>

            <div className="results-toolbar d-flex flex-wrap align-items-center gap-2">
              <select
                className="form-select form-select-sm"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                aria-label="Sort results"
              >
                <option value="relevance">Sort: Relevance</option>
                <option value="newest">Sort: Newest First</option>
                <option value="oldest">Sort: Oldest First</option>
                <option value="company">Sort: Company A-Z</option>
                <option value="title">Sort: Title A-Z</option>
              </select>

              <button
                type="button"
                className="btn btn-sm btn-outline-primary"
                onClick={handleExportCsv}
                disabled={!sortedReleases.length}
              >
                <i className="bi bi-download me-1"></i>Export CSV
              </button>
            </div>
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
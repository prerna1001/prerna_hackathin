import React, { useState, useEffect } from 'react';
import FilterPanel from './components/FilterPanel';
import PressReleaseList from './components/PressReleaseList';
import Pagination from './components/pagination';
import './App.css';
import SearchBar from './components/SearchBar';
function App() {
  const [pressReleases, setPressReleases] = useState([]);
  const [filteredReleases, setFilteredReleases] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchMode, setSearchMode] = useState(false);
  const [filters, setFilters] = useState({
    company: [],
    title: '',
    startDate: '',
    endDate: ''
  });
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(false);

  const itemsPerPage = 6;

  useEffect(() => {
    fetchAllReleases();
    fetchCompanies();
  }, []);

  const fetchAllReleases = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:8000/api/press-releases');
      const data = await response.json();
      setPressReleases(data.data);
      setFilteredReleases(data.data);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error fetching releases:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
  try {
    const response = await fetch('http://localhost:8000/api/press-releases');
    const data = await response.json();
    
    // Extract unique company names
    const uniqueCompanies = [...new Set(data.data.map(item => item.company))].filter(c => c);
    console.log('Unique companies:', uniqueCompanies);
    
    setCompanies(uniqueCompanies);
  } catch (error) {
    console.error('Error fetching companies:', error);
  }
};

  const handleApplyFilter = async () => {
    try {
      setLoading(true);
      let url = 'http://localhost:8000/api/filter-press-releases?';
      
      if (filters.company.length > 0) {
        filters.company.forEach(c => {
          url += `company=${c}&`;
        });
      }
      if (filters.title) {
        url += `title=${filters.title}&`;
      }
      if (filters.startDate) {
        url += `start_date=${filters.startDate}&`;
      }
      if (filters.endDate) {
        url += `end_date=${filters.endDate}&`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setFilteredReleases(data.data);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error applying filter:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async (query, company) => {
    try {
      setLoading(true);
      setSearchMode(true);
      let url = `http://localhost:8000/api/search?q=${encodeURIComponent(query)}`;
      
      if (company) {
        url += `&company=${encodeURIComponent(company)}`;
      }

      const response = await fetch(url);
      const data = await response.json();
      setFilteredReleases(data.data);
      setCurrentPage(1);
    } catch (error) {
      console.error('Error searching:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClearSearch = () => {
    setSearchMode(false);
    setFilteredReleases(pressReleases);
    setCurrentPage(1);
  };
    const handleResetFilter = () => {
      setFilters({
        company: [],
        title: '',
        startDate: '',
        endDate: ''
      });
      setFilteredReleases(pressReleases);
      setCurrentPage(1);
    };

  const totalPages = Math.ceil(filteredReleases.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedReleases = filteredReleases.slice(startIndex, startIndex + itemsPerPage);

  return (
    <div className="bg-light min-vh-100">
      <nav className="navbar navbar-dark bg-primary sticky-top">
        <div className="container-fluid">
          <span className="navbar-brand mb-0 h1">
            <i className="bi bi-newspaper me-2"></i>Press Releases
          </span>
        </div>
      </nav>

      <div className="container py-5">
        {/* Header */}
        <div className="mb-5">
          <h1 className="display-4 fw-bold text-primary mb-2">Press Releases</h1>
          <p className="text-muted lead">Explore pharmaceutical press releases from leading companies</p>
        </div>

      {/* Search Bar */}
      <SearchBar onSearch={handleSearch} onClear={handleClearSearch} />

      {/* Filter Panel - only show when not in search mode */}
      {!searchMode && (
        <FilterPanel
          filters={filters}
          setFilters={setFilters}
          companies={companies}
          onApplyFilter={handleApplyFilter}
          onResetFilter={handleResetFilter}
        />
      )}

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
          <div className="mb-4">
            <p className="text-muted">
              Found <span className="fw-bold text-primary">{filteredReleases.length}</span> results
            </p>
          </div>
        )}

        {/* Press Release List */}
        {!loading && filteredReleases.length > 0 && (
          <>
            <PressReleaseList releases={paginatedReleases} />

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
        {!loading && filteredReleases.length === 0 && (
          <div className="alert alert-info text-center" role="alert">
            <i className="bi bi-info-circle me-2"></i>No press releases found
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
import React, { useState } from 'react';

function SearchBar({ onSearch, onClear }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      onSearch(searchQuery, companyFilter);
    }
  };

  const handleClear = () => {
    setSearchQuery('');
    setCompanyFilter('');
    onClear();
  };

  return (
    <div className="card shadow-sm mb-4">
      <div className="card-body">
        <h5 className="card-title mb-3">
          <i className="bi bi-search me-2"></i>Smart Search
        </h5>
        <form onSubmit={handleSearch}>
          <div className="row g-3">
            <div className="col-md-8">
              <input
                type="text"
                className="form-control form-control-lg"
                placeholder="Search titles and content... (e.g., cancer, therapy, FDA approval)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="col-md-4">
              <select
                className="form-select form-select-lg"
                value={companyFilter}
                onChange={(e) => setCompanyFilter(e.target.value)}
              >
                <option value="">All Companies</option>
                <option value="AstraZeneca">AstraZeneca</option>
                <option value="novonordisk">Novo Nordisk</option>
              </select>
            </div>
            <div className="col-12">
              <button
                type="submit"
                className="btn btn-primary btn-lg me-2"
                disabled={!searchQuery.trim()}
              >
                <i className="bi bi-search me-2"></i>Search
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary btn-lg"
                onClick={handleClear}
              >
                <i className="bi bi-x-circle me-2"></i>Clear
              </button>
            </div>
          </div>
        </form>
        <small className="text-muted d-block mt-2">
          <i className="bi bi-info-circle me-1"></i>
          Powered by Elasticsearch - results ranked by relevance
        </small>
      </div>
    </div>
  );
}

export default SearchBar;
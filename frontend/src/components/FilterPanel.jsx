import React, { useState } from 'react';

function FilterPanel({ filters, setFilters, companies, onApplyFilter, onResetFilter }) {
  const [showDropdown, setShowDropdown] = useState(false);

  const handleCompanyToggle = (company) => {
    const updated = filters.company.includes(company)
      ? filters.company.filter(c => c !== company)
      : [...filters.company, company];
    setFilters({ ...filters, company: updated });
  };

  return (
    <div className="card shadow-sm mb-5">
      <div className="card-body">
        <h5 className="card-title fw-bold mb-4">
          <i className="bi bi-funnel me-2"></i>Filters
        </h5>
        
        <div className="row g-3 mb-4">
          {/* Company Filter */}
          <div className="col-md-3">
            <div className="dropdown">
              <button
                className="btn btn-primary w-100 dropdown-toggle"
                type="button"
                onClick={() => setShowDropdown(!showDropdown)}
              >
                <i className="bi bi-building me-2"></i>Company
              </button>

              {showDropdown && (
  <div className="dropdown-menu show w-100 p-3" style={{
    display: 'block', 
    position: 'absolute', 
    top: '100%', 
    left: 0, 
    zIndex: 1050,
    minWidth: '200px',
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '0.375rem',
    boxShadow: '0 0.5rem 1rem rgba(0,0,0,0.15)'
  }}>
    {companies.length > 0 ? (
      companies.map(company => (
        <div key={company} className="form-check mb-2">
          <input
            type="checkbox"
            className="form-check-input"
            id={`company-${company}`}
            checked={filters.company.includes(company)}
            onChange={() => handleCompanyToggle(company)}
          />
          <label className="form-check-label" htmlFor={`company-${company}`}>
            {company}
          </label>
        </div>
      ))
    ) : (
      <p className="text-muted small">No companies available</p>
    )}
  </div>
)}
            </div>
          </div>

          {/* Title Search */}
          <div className="col-md-3">
            <input
              type="text"
              className="form-control"
              placeholder="Search by title..."
              value={filters.title}
              onChange={(e) => setFilters({ ...filters, title: e.target.value })}
            />
          </div>

          {/* Start Date */}
          <div className="col-md-3">
            <input
              type="date"
              className="form-control"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>

          {/* End Date */}
          <div className="col-md-3">
            <input
              type="date"
              className="form-control"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="d-flex gap-2">
          <button
            onClick={onApplyFilter}
            className="btn btn-success"
          >
            <i className="bi bi-check-circle me-2"></i>Apply Filter
          </button>
          <button
            onClick={onResetFilter}
            className="btn btn-secondary"
          >
            <i className="bi bi-arrow-clockwise me-2"></i>Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default FilterPanel;
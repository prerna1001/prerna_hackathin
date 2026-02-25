import React, { useState } from 'react';

function SearchFiltersPanel({
  filterConfig,
  filters,
  setFilters,
  onApply,
  onReset,
  onSavePreset,
  onApplyPreset,
  onDeletePreset,
  savedFilters,
  recentSearches,
  onUseRecentSearch,
  onDeleteRecentSearch,
  loading,
  sortBy,
  onSortChange,
  onExportCsv,
  hasResults,
}) {
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState('');
  const [presetName, setPresetName] = useState('');

  const fields = filterConfig?.fields || [];
  const companyOptions = filterConfig?.options?.companies || [];
  const dateRange = filterConfig?.options?.date_range || {};

  const isEnabled = (key) => fields.some((field) => field.key === key && field.enabled);
  const getLabel = (key, fallback) => fields.find((field) => field.key === key)?.label || fallback;
  const getPlaceholder = (key, fallback) => fields.find((field) => field.key === key)?.placeholder || fallback;

  const toggleCompany = (company) => {
    const selected = filters.company || [];
    const next = selected.includes(company)
      ? selected.filter((item) => item !== company)
      : [...selected, company];
    setFilters({ ...filters, company: next });
  };

  return (
    <div className="card shadow-sm mb-4 search-panel">
      <div className="card-body">
        <h5 className="card-title panel-title mb-4">
          <i className="bi bi-funnel me-2"></i>Search & Filters
        </h5>

        <div className="row g-3">
          {isEnabled('query') && (
            <div className="col-12">
              <label className="form-label fw-semibold">{getLabel('query', 'Search')}</label>
              <input
                type="text"
                className="form-control"
                placeholder={getPlaceholder('query', 'e.g., FDA approval, clinical trial...')}
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              />
            </div>
          )}

          {isEnabled('company') && (
            <div className="col-12">
              <label className="form-label fw-semibold">{getLabel('company', 'Company')}</label>
              <div className="dropdown position-relative">
                <button
                  className="btn btn-light border w-100 text-start d-flex justify-content-between align-items-center company-picker"
                  type="button"
                  onClick={() => setShowCompanyDropdown((prev) => !prev)}
                >
                  <span>
                    {filters.company.length > 0
                      ? `${filters.company.length} selected`
                      : getPlaceholder('company', 'Select companies...')}
                  </span>
                  <i className="bi bi-chevron-down"></i>
                </button>

                {showCompanyDropdown && (
                  <div
                    className="dropdown-menu show w-100 p-3"
                    style={{ maxHeight: 220, overflowY: 'auto' }}
                  >
                    {companyOptions.length > 0 ? (
                      companyOptions.map((company) => (
                        <div key={company} className="form-check mb-2">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`company-${company}`}
                            checked={filters.company.includes(company)}
                            onChange={() => toggleCompany(company)}
                          />
                          <label className="form-check-label" htmlFor={`company-${company}`}>
                            {company}
                          </label>
                        </div>
                      ))
                    ) : (
                      <small className="text-muted">No company options available</small>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {(isEnabled('start_date') || isEnabled('end_date')) && (
            <>
              {isEnabled('start_date') && (
                <div className="col-md-6">
                  <label className="form-label fw-semibold">{getLabel('start_date', 'Start Date')}</label>
                  <input
                    type="date"
                    className="form-control"
                    min={dateRange.min || undefined}
                    max={dateRange.max || undefined}
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                  />
                </div>
              )}

              {isEnabled('end_date') && (
                <div className="col-md-6">
                  <label className="form-label fw-semibold">{getLabel('end_date', 'End Date')}</label>
                  <input
                    type="date"
                    className="form-control"
                    min={dateRange.min || undefined}
                    max={dateRange.max || undefined}
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                  />
                </div>
              )}
            </>
          )}

          <div className="col-12 d-flex gap-2 align-items-end">
            <button className="btn btn-primary grow btn-view" onClick={() => onApply()} disabled={loading}>
              Apply
            </button>
            <button className="btn btn-light border btn-reset" onClick={onReset} disabled={loading}>
              <i className="bi bi-arrow-counterclockwise me-1"></i>Reset
            </button>
          </div>
        </div>

        <hr className="my-4" />

        <div className="saved-presets-section">
          <p className="small fw-semibold text-muted mb-2">Saved Presets</p>
          <div className="row g-2 mb-2">
            <div className="col-12 col-lg-11">
              <input
                type="text"
                className="form-control"
                placeholder="Preset name..."
                aria-label="Preset name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
              />
            </div>
            <div className="col-12 col-lg-1">
              <button
                type="button"
                className="btn btn-dark w-100"
                onClick={() => {
                  onSavePreset(presetName);
                  setPresetName('');
                }}
                disabled={loading}
                aria-label="Save preset"
              >
                <i className="bi bi-floppy"></i>
              </button>
            </div>
          </div>

          <div className="preset-control d-flex gap-2 align-items-center mb-3">
            <select
              className="form-select"
              value={selectedPresetId}
              onChange={(e) => setSelectedPresetId(e.target.value)}
              aria-label="Select saved filter preset"
            >
              <option value="">Select preset...</option>
              {(savedFilters || []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-light border"
              onClick={() => selectedPresetId && onApplyPreset(selectedPresetId)}
              disabled={!selectedPresetId || loading}
              aria-label="Apply selected preset"
            >
              <i className="bi bi-check2"></i>
            </button>
            <button
              type="button"
              className="btn btn-light border"
              onClick={() => {
                if (!selectedPresetId) return;
                onDeletePreset(selectedPresetId);
                setSelectedPresetId('');
              }}
              disabled={!selectedPresetId || loading}
              aria-label="Delete selected preset"
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>

          <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-2 sort-row">
            <div className="d-flex gap-2 align-items-center grow sort-controls">
              <label className="small fw-semibold text-muted mb-0 sort-label" htmlFor="sort-by-select">Sort By</label>
              <select
                id="sort-by-select"
                className="form-select"
                value={sortBy}
                onChange={(e) => onSortChange(e.target.value)}
                aria-label="Sort results"
              >
                <option value="relevance">Relevance</option>
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="company">Company A-Z</option>
                <option value="title">Title A-Z</option>
              </select>
            </div>

            <button
              type="button"
              className="btn btn-success csv-btn"
              onClick={onExportCsv}
              disabled={!hasResults}
            >
              <i className="bi bi-download me-1"></i>CSV
            </button>
          </div>

          {!!(recentSearches || []).length && (
            <div className="mt-4">
              <p className="small fw-semibold text-muted mb-2">Recent Searches</p>
              <div className="d-flex flex-wrap gap-2">
                {recentSearches.map((term, index) => (
                  <div
                    key={`${term}-${index}`}
                    className="btn btn-sm btn-light border recent-search-chip"
                    role="group"
                    aria-label={`Recent search ${term}`}
                  >
                    <button
                      type="button"
                      className="recent-search-action"
                      onClick={() => onUseRecentSearch(term)}
                    >
                      {term}
                    </button>
                    <button
                      type="button"
                      className="recent-search-remove"
                      onClick={() => onDeleteRecentSearch?.(term)}
                      aria-label={`Remove ${term}`}
                    >
                      <i className="bi bi-x"></i>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default SearchFiltersPanel;

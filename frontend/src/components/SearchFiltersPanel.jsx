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
  loading,
}) {
  const [showCompanyDropdown, setShowCompanyDropdown] = useState(false);
  const [selectedPresetId, setSelectedPresetId] = useState('');

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
        <h5 className="card-title mb-3">
          <i className="bi bi-search me-2"></i>Search & Filters
        </h5>

        <div className="row g-3">
          {isEnabled('query') && (
            <div className="col-md-4">
              <label className="form-label fw-semibold">{getLabel('query', 'Search')}</label>
              <input
                type="text"
                className="form-control"
                placeholder={getPlaceholder('query', 'Search by title or content...')}
                value={filters.query}
                onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              />
            </div>
          )}

          {isEnabled('company') && (
            <div className="col-md-3">
              <label className="form-label fw-semibold">{getLabel('company', 'Company')}</label>
              <div className="dropdown position-relative">
                <button
                  className="btn btn-outline-primary w-100 dropdown-toggle"
                  type="button"
                  onClick={() => setShowCompanyDropdown((prev) => !prev)}
                >
                  {filters.company.length > 0
                    ? `${filters.company.length} selected`
                    : `Select ${getLabel('company', 'Company')}`}
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

          {isEnabled('start_date') && (
            <div className="col-md-2">
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
            <div className="col-md-2">
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

          <div className="col-md-1 d-flex align-items-end">
            <button className="btn btn-primary w-100 btn-view" onClick={() => onApply()} disabled={loading}>
              Apply
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="d-flex flex-wrap align-items-center gap-2">
            <button className="btn btn-outline-secondary btn-sm btn-view" onClick={onReset} disabled={loading}>
              Reset Filters
            </button>

            <button className="btn btn-outline-primary btn-sm btn-view" onClick={onSavePreset} disabled={loading}>
              <i className="bi bi-bookmark-plus me-1"></i>Save Preset
            </button>

            <div className="preset-control d-flex gap-2 align-items-center">
              <select
                className="form-select form-select-sm"
                value={selectedPresetId}
                onChange={(e) => setSelectedPresetId(e.target.value)}
                aria-label="Select saved filter preset"
              >
                <option value="">Saved presets</option>
                {(savedFilters || []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="btn btn-sm btn-primary preset-apply-btn"
                onClick={() => selectedPresetId && onApplyPreset(selectedPresetId)}
                disabled={!selectedPresetId || loading}
              >
                <i className="bi bi-check2-circle me-1"></i>Apply Preset
              </button>

              <button
                type="button"
                className="btn btn-sm btn-outline-danger preset-delete-btn"
                onClick={() => {
                  if (!selectedPresetId) return;
                  onDeletePreset(selectedPresetId);
                  setSelectedPresetId('');
                }}
                disabled={!selectedPresetId || loading}
              >
                <i className="bi bi-trash"></i>
              </button>
            </div>
          </div>

          {!!(recentSearches || []).length && (
            <div className="mt-3">
              <p className="small text-muted mb-2">Recent searches</p>
              <div className="d-flex flex-wrap gap-2">
                {recentSearches.map((term, index) => (
                  <button
                    key={`${term}-${index}`}
                    type="button"
                    className="btn btn-sm btn-light border recent-search-chip"
                    onClick={() => onUseRecentSearch(term)}
                  >
                    {term}
                  </button>
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

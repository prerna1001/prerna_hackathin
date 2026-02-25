import React from 'react';

function PressReleaseCard({ release, onOpen, searchQuery }) {
  const displayTitle = (release?.title || '').trim() || 'Untitled press release';

  const handleCardClick = (match = null) => {
    onOpen(release, match);
  };

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const getHighlightTerms = () => {
    const query = (searchQuery || '').trim();
    if (!query) return [];
    const words = query
      .split(/\s+/)
      .map((item) => item.trim())
      .filter((item) => item.length > 1);

    const combined = [query, ...words];
    const deduped = [];
    const seen = new Set();
    for (const term of combined) {
      const key = term.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        deduped.push(term);
      }
    }
    return deduped.sort((a, b) => b.length - a.length);
  };

  const highlightSnippet = (text) => {
    const terms = getHighlightTerms();
    if (!text || terms.length === 0) return text;

    const pattern = terms.map((term) => escapeRegExp(term)).join('|');
    if (!pattern) return text;

    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      const isMatch = terms.some((term) => part.toLowerCase() === term.toLowerCase());
      if (isMatch) {
        return <mark key={`m-${idx}`}>{part}</mark>;
      }
      return <React.Fragment key={`t-${idx}`}>{part}</React.Fragment>;
    });
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div
      onClick={handleCardClick}
      className="card h-100 shadow-sm release-card"
    >
      <div className="card-body d-flex flex-column release-card-body">
        <button
          type="button"
          className="release-card-fab"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
          aria-label="Open press release"
        >
          <i className="bi bi-arrow-up-right"></i>
        </button>

        <h6 className="card-title fw-bold text-primary mb-3 flex-grow-1">
          {displayTitle}
        </h6>

        <p className="card-text text-muted small mb-3">
          <i className="bi bi-calendar-event me-2"></i>
          {formatDate(release.published_date)}
        </p>

        {release.matches && release.matches.length > 0 && (
          <div className="mb-3">
            <p className="small text-muted mb-2">
              <i className="bi bi-search me-1"></i>Matched in press release:
            </p>
            {release.matches.slice(0, 2).map((match, index) => (
              <button
                key={`${match.field}-${index}`}
                type="button"
                className="btn btn-sm btn-light border w-100 text-start mb-2 match-chip"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCardClick(match);
                }}
              >
                <span className="badge text-bg-secondary me-2">{match.field_label}</span>
                <span>{highlightSnippet(match.plain_text || 'No preview available')}</span>
              </button>
            ))}
          </div>
        )}

        <button
          className="btn btn-outline-primary btn-sm btn-view"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
        >
          <i className="bi bi-file-text me-1"></i>View Full Text
        </button>
      </div>
    </div>
  );
}

export default PressReleaseCard;
import React from 'react';
import {
  extractContextSnippet,
  getBestMatchSnippet,
  hasAnyQueryMatch,
  highlightTextNodes,
} from '../utils/highlight';

function PressReleaseCard({ release, onOpen, searchQuery }) {
  const displayTitle = (release?.title || '').trim() || 'Untitled press release';
  const companyLabel = (release?.company || 'Unknown').trim();

  const handleCardClick = (match = null) => {
    onOpen(release, match);
  };

  const highlightSnippet = (text, keyPrefix) => highlightTextNodes(text, searchQuery, keyPrefix);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  const matchSnippet = getBestMatchSnippet(release?.matches, searchQuery);
  const summary = String(release?.summary || '').trim();
  const description = String(release?.description || '').trim();
  const titleSource = String(release?.title || '').trim();

  const queryMatchedFallback = [summary, description, titleSource].find((candidate) =>
    hasAnyQueryMatch(candidate, searchQuery)
  );

  const excerptSource =
    matchSnippet ||
    queryMatchedFallback ||
    summary ||
    description ||
    'Open this press release to read full details and source information.';

  const excerpt = extractContextSnippet(excerptSource, searchQuery, 140);

  return (
    <div
      onClick={handleCardClick}
      className="card h-100 shadow-sm release-card"
    >
      <div className="card-body d-flex flex-column release-card-body">
        <div className="mb-3">
          <span className="badge release-company-badge">{companyLabel}</span>
        </div>

        <h6 className="card-title fw-bold mb-3 release-title">
          {highlightSnippet(displayTitle, 'title')}
        </h6>

        <p className="card-text text-muted small mb-2">
          <i className="bi bi-calendar-event me-2"></i>
          {formatDate(release.published_date)}
        </p>

        <p className="card-text text-muted mb-4 release-excerpt">{highlightSnippet(excerpt, 'excerpt')}</p>

        <button
          className="btn btn-primary btn-view w-100"
          onClick={(e) => {
            e.stopPropagation();
            handleCardClick();
          }}
        >
          View Full Text
        </button>
      </div>
    </div>
  );
}

export default PressReleaseCard;
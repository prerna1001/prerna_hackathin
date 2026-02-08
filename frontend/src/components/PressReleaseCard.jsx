import React from 'react';

function PressReleaseCard({ release }) {
  const handleCardClick = () => {
    if (release.url) {
      window.open(release.url, '_blank');
    } else {
      alert('No URL available for this press release');
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <div
      onClick={handleCardClick}
      className="card h-100 shadow-sm hover-shadow cursor-pointer"
      style={{ cursor: 'pointer', transition: 'all 0.3s' }}
      onMouseOver={(e) => e.currentTarget.classList.add('shadow')}
      onMouseOut={(e) => e.currentTarget.classList.remove('shadow')}
    >
      <div className="card-body d-flex flex-column">
        <h6 className="card-title fw-bold text-primary mb-3 flex-grow-1">
          {release.title}
        </h6>

        <p className="card-text text-muted small mb-3">
          <i className="bi bi-calendar-event me-2"></i>
          {formatDate(release.published_date)}
        </p>

        {release.url ? (
          <a href={release.url} target="_blank" rel="noopener noreferrer" className="btn btn-outline-primary btn-sm">
            <i className="bi bi-arrow-up-right me-1"></i>Read More
          </a>
        ) : (
          <p className="text-muted small">No URL available</p>
        )}
      </div>
    </div>
  );
}

export default PressReleaseCard;
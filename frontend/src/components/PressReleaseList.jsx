import React from 'react';
import PressReleaseCard from './PressReleaseCard';

function PressReleaseList({ releases, onOpenRelease, searchQuery }) {
  return (
    <div className="row g-4 mb-5">
      {releases.map((release, index) => (
        <div
          key={release.url || `${release.title}-${index}`}
          className="col-md-6 col-lg-4 release-card-col"
          style={{ '--stagger-index': index }}
        >
          <PressReleaseCard release={release} onOpen={onOpenRelease} searchQuery={searchQuery} />
        </div>
      ))}
    </div>
  );
}

export default PressReleaseList;
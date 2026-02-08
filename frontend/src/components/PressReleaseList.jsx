import React from 'react';
import PressReleaseCard from './PressReleaseCard';

function PressReleaseList({ releases }) {
  return (
    <div className="row g-4 mb-5">
      {releases.map(release => (
        <div key={release.id} className="col-md-6 col-lg-4">
          <PressReleaseCard release={release} />
        </div>
      ))}
    </div>
  );
}

export default PressReleaseList;
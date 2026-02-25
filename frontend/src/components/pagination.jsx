import React from 'react';

function Pagination({ currentPage, totalPages, onPageChange }) {
  const pages = [];
  const maxPagesToShow = totalPages;

  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);

  if (endPage - startPage + 1 < maxPagesToShow) {
    startPage = Math.max(1, endPage - maxPagesToShow + 1);
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(i);
  }

  return (
    <nav className="d-flex justify-content-center mt-5 pagination-wrap" aria-label="Page navigation">
      <ul className="pagination align-items-center">
        <li className={`page-item ${currentPage === 1 ? 'disabled' : ''}`}>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="page-link"
          >
            <i className="bi bi-chevron-left me-1"></i>Previous
          </button>
        </li>

        {startPage > 1 && (
          <>
            <li className="page-item">
              <button onClick={() => onPageChange(1)} className="page-link">1</button>
            </li>
            {startPage > 2 && <li className="page-item disabled"><span className="page-link">…</span></li>}
          </>
        )}

        {pages.map(page => (
          <li key={page} className={`page-item ${currentPage === page ? 'active' : ''}`}>
            <button onClick={() => onPageChange(page)} className="page-link">
              {page}
            </button>
          </li>
        ))}

        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <li className="page-item disabled"><span className="page-link">…</span></li>}
            <li className="page-item">
              <button onClick={() => onPageChange(totalPages)} className="page-link">{totalPages}</button>
            </li>
          </>
        )}

        <li className={`page-item ${currentPage === totalPages ? 'disabled' : ''}`}>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="page-link"
          >
            Next <i className="bi bi-chevron-right ms-1"></i>
          </button>
        </li>
      </ul>
    </nav>
  );
}

export default Pagination;
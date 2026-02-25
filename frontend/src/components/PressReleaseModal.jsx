import React, { useEffect, useMemo, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

function PressReleaseModal({ show, release, matchTarget, searchQuery, loading, onClose }) {
  const closeButtonRef = useRef(null);
  const modalBodyRef = useRef(null);
  const modalContentRef = useRef(null);

  const normalizeForMatch = (value) =>
    (value || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();

  useEffect(() => {
    if (!show) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    setTimeout(() => closeButtonRef.current?.focus(), 0);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [show, onClose]);

  const normalizeTitle = (title) => {
    if (!title) return 'Press Release';
    return title
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normalizeRawText = (text) => {
    if (!text) return '';

    const noisePatterns = [
      /^weblink$/i,
      /^[.,;:!\-–—]+$/,
      /^and connect with us on$/i,
      /^x(\s*\(formerly twitter\))?$/i,
      /^facebook$/i,
      /^instagram$/i,
      /^youtube$/i,
      /^linkedin$/i,
      /^[®©™]$/,
      /^\d{1,2}$/,
    ];

    return text
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .map((line) => line.replace(/^([a-z])\s+([A-Z])/, '$2'))
      .map((line) => line.replace(/\s+[\d]+$/, ''))
      .filter((line) => line && !noisePatterns.some((pattern) => pattern.test(line)))
      .join('\n');
  };

  const buildStructuredBlocks = (text) => {
    const lines = normalizeRawText(text)
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

    const blocks = [];
    let paragraphBuffer = '';

    const flushParagraph = () => {
      const paragraph = paragraphBuffer.trim();
      if (paragraph) {
        blocks.push({ type: 'paragraph', text: paragraph });
      }
      paragraphBuffer = '';
    };

    const isHeadingLike = (line) => {
      if (!line || line.length > 70) return false;
      if (line.endsWith(':')) return true;
      const words = line.split(/\s+/).length;
      if (words > 10) return false;
      const onlyHeadingChars = /^[A-Z0-9®&(),\-\s]+$/.test(line);
      return onlyHeadingChars && line === line.toUpperCase();
    };

    for (const line of lines) {
      if (isHeadingLike(line)) {
        flushParagraph();
        blocks.push({ type: 'heading', text: line.replace(/:$/, '') });
        continue;
      }

      if (!paragraphBuffer) {
        paragraphBuffer = line;
      } else {
        const shouldStartNewParagraph =
          /[.!?]$/.test(paragraphBuffer) && paragraphBuffer.length > 240;

        if (shouldStartNewParagraph) {
          flushParagraph();
          paragraphBuffer = line;
        } else {
          paragraphBuffer += ` ${line}`;
        }
      }
    }

    flushParagraph();
    return blocks;
  };

  const renderTextWithLinks = (text) => {
    const parts = text.split(/(https?:\/\/[^\s]+)/g);
    return parts.map((part, index) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={`${part}-${index}`} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        );
      }
      return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
    });
  };

  const formattedPublishedDate = useMemo(() => {
    if (!release?.published_date) return null;
    return new Date(release.published_date).toLocaleDateString();
  }, [release?.published_date]);

  const structuredBlocks = buildStructuredBlocks(release?.full_text || '');

  const highlightTerms = useMemo(() => {
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
  }, [searchQuery]);

  const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const highlightTextPart = (text, keyPrefix) => {
    if (!highlightTerms.length) return text;

    const pattern = highlightTerms.map((term) => escapeRegExp(term)).join('|');
    if (!pattern) return text;

    const regex = new RegExp(`(${pattern})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, idx) => {
      const isMatch = highlightTerms.some((term) => part.toLowerCase() === term.toLowerCase());
      if (isMatch) {
        return <mark key={`${keyPrefix}-m-${idx}`}>{part}</mark>;
      }
      return <React.Fragment key={`${keyPrefix}-t-${idx}`}>{part}</React.Fragment>;
    });
  };

  const renderSearchText = (text) => {
    if (!highlightTerms.length) {
      return renderTextWithLinks(text);
    }

    const urlPattern = /(https?:\/\/[^\s]+)/g;
    const parts = text.split(urlPattern);

    return parts.map((part, idx) => {
      if (/^https?:\/\//.test(part)) {
        return (
          <a key={`u-${idx}`} href={part} target="_blank" rel="noopener noreferrer">
            {part}
          </a>
        );
      }
      return <React.Fragment key={`p-${idx}`}>{highlightTextPart(part, `h-${idx}`)}</React.Fragment>;
    });
  };

  useEffect(() => {
    if (!show || loading || !matchTarget?.plain_text || !modalBodyRef.current) return;

    const targetText = normalizeForMatch(matchTarget.plain_text);
    if (!targetText) return;

    const matchField = normalizeForMatch(matchTarget.field || matchTarget.field_label || '');
    if (matchField.includes('title')) {
      const titleNode = modalContentRef.current?.querySelector('[data-match-title]');
      if (titleNode) {
        titleNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    const targetWords = targetText
      .split(' ')
      .filter(Boolean)
      .slice(0, 10)
      .join(' ');

    const paragraphs = modalBodyRef.current.querySelectorAll('[data-paragraph-index]');
    let targetNode = null;

    paragraphs.forEach((node) => {
      if (targetNode) return;
      const text = normalizeForMatch(node.textContent || '');
      if (text.includes(targetWords || targetText) || targetText.includes(text.slice(0, 80))) {
        targetNode = node;
      }
    });

    if (targetNode) {
      targetNode.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const firstMark = modalBodyRef.current.querySelector('mark');
    if (firstMark) {
      firstMark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [show, loading, matchTarget, release?.full_text]);

  return (
    <AnimatePresence>
      {show && (
        <>
          <motion.div
            className="modal-backdrop show"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />

          <button className="press-modal-backdrop-hitbox" onClick={onClose} aria-label="Close modal" />

          <div className="press-modal-shell" role="dialog" aria-modal="true" aria-label="Press release details">
            <motion.div
              className="press-modal-dialog"
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.98 }}
              transition={{ duration: 0.22 }}
            >
              <div
                ref={modalContentRef}
                className="press-modal-content"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="press-modal-header">
                  <div className="w-100">
                    <h4 className="press-modal-title" data-match-title>
                      {highlightTextPart(normalizeTitle(release?.title), 'title')}
                    </h4>
                    <div className="d-flex flex-wrap gap-2 text-muted small">
                      {release?.company && (
                        <span className="badge text-bg-light border">Company: {release.company}</span>
                      )}
                      {formattedPublishedDate && (
                        <span className="badge text-bg-light border">Published: {formattedPublishedDate}</span>
                      )}
                    </div>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    className="btn-close"
                    aria-label="Close"
                    onClick={onClose}
                  ></button>
                </div>

                <div className="modal-body press-modal-body" ref={modalBodyRef}>
                  {loading ? (
                    <div className="text-center py-5">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                    </div>
                  ) : structuredBlocks.length > 0 ? (
                    <div className="press-modal-content-text">
                      {structuredBlocks.map((block, index) =>
                        block.type === 'heading' ? (
                          <h6 key={`${block.type}-${index}`} className="fw-bold mt-4 mb-2 text-uppercase">
                            {block.text}
                          </h6>
                        ) : (
                          <p
                            key={`${block.type}-${index}`}
                            data-paragraph-index={index}
                            className="mb-3 lh-lg"
                          >
                            {renderSearchText(block.text)}
                          </p>
                        )
                      )}
                    </div>
                  ) : (
                    <p className="mb-0">No full text available for this press release.</p>
                  )}
                </div>

                <div className="press-modal-footer">
                  {release?.url && (
                    <a
                      href={release.url}
                      className="btn btn-outline-primary"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Read on source site
                    </a>
                  )}
                  <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

export default PressReleaseModal;

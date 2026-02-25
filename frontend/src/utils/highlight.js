import React from 'react';

const normalizeTextForSearch = (value) => {
  if (!value) return '';
  return String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/[\u2018\u2019]/g, "'")
    .toLowerCase();
};

const normalizeTextForHighlight = (value) => {
  if (!value) return '';
  const input = String(value).normalize('NFKD');
  let output = '';

  for (let i = 0; i < input.length; i += 1) {
    const code = input.codePointAt(i);
    if (code === 0x00a0) {
      output += ' ';
    } else if (code === 0x2013 || code === 0x2014) {
      output += '-';
    } else if (code === 0x2018 || code === 0x2019) {
      output += "'";
    } else {
      output += input[i];
    }
    if (code && code > 0xffff) {
      i += 1;
    }
  }

  return output;
};

const tokenize = (value) => {
  const input = String(value || '');
  const tokens = [];
  const segmenter = new Intl.Segmenter('en', { granularity: 'word' });

  for (const part of segmenter.segment(input)) {
    if (part.isWordLike) {
      tokens.push(part.segment);
    }
  }

  return tokens;
};

const getHighlightTerms = (query) => {
  const trimmed = String(query || '').trim();
  if (!trimmed) return [];

  const words = tokenize(trimmed)
    .map((item) => item.trim())
    .filter((item) => item.length > 1);

  const combined = [trimmed, ...words];
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

const expandTermVariants = (term) => {
  const value = String(term || '').trim();
  if (value.length < 3) return [value];

  const variants = new Set([value]);
  if (value.endsWith('s')) {
    variants.add(value.slice(0, -1));
  } else {
    variants.add(`${value}s`);
  }

  return Array.from(variants).filter((item) => item.length > 1);
};

const getNormalizedTerms = (query) =>
  getHighlightTerms(query)
    .flatMap((term) => expandTermVariants(normalizeTextForSearch(term)))
    .filter((term) => term.length > 1);

const extractContextSnippet = (text, query, maxLength = 220) => {
  const source = String(text || '')
    .split('\n').join(' ')
    .split('\t').join(' ')
    .trim();
  if (!source) return source;

  const normalizedLower = normalizeTextForSearch(source);
  const terms = getNormalizedTerms(query);

  let firstIndex = -1;
  for (const term of terms) {
    const idx = normalizedLower.indexOf(term);
    if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
      firstIndex = idx;
    }
  }

  if (firstIndex === -1) {
    return source.slice(0, maxLength);
  }

  const beforeWindow = Math.floor(maxLength * 0.4);
  let start = Math.max(0, firstIndex - beforeWindow);
  let end = Math.min(source.length, start + maxLength);

  if (end - start < maxLength) {
    start = Math.max(0, end - maxLength);
  }

  const prefix = start > 0 ? '…' : '';
  const suffix = end < source.length ? '…' : '';
  return `${prefix}${source.slice(start, end).trim()}${suffix}`;
};

const hasAnyQueryMatch = (text, query) => {
  const normalizedText = normalizeTextForSearch(text);
  if (!normalizedText) return false;

  const terms = getNormalizedTerms(query);
  if (terms.length === 0) return false;

  for (const term of terms) {
    if (normalizedText.includes(term)) return true;
  }

  return false;
};

const getBestMatchSnippet = (matches, query) => {
  const terms = getNormalizedTerms(query);
  if (!Array.isArray(matches) || matches.length === 0 || terms.length === 0) return '';

  let bestText = '';
  let bestScore = -1;

  for (const match of matches) {
    const candidate = String(match?.plain_text || '').trim();
    if (!candidate) continue;

    const normalizedCandidate = normalizeTextForSearch(candidate);
    let score = 0;

    for (const term of terms) {
      if (normalizedCandidate.includes(term)) {
        score += term.length;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestText = candidate;
    }
  }

  return bestScore > 0 ? bestText : '';
};

const buildRanges = (source, terms) => {
  const ranges = [];
  if (!source || terms.length === 0) return ranges;

  for (const term of terms) {
    if (!term) continue;
    let startIndex = 0;

    while (startIndex < source.length) {
      const matchIndex = source.indexOf(term, startIndex);
      if (matchIndex === -1) break;

      const endIndex = matchIndex + term.length;
      ranges.push([matchIndex, endIndex]);
      startIndex = endIndex;
    }
  }

  if (ranges.length === 0) return ranges;

  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0]];

  for (let i = 1; i < ranges.length; i += 1) {
    const [start, end] = ranges[i];
    const last = merged[merged.length - 1];

    if (start <= last[1]) {
      last[1] = Math.max(last[1], end);
    } else {
      merged.push([start, end]);
    }
  }

  return merged;
};

const highlightTextNodes = (text, query, keyPrefix = 'h') => {
  if (!text) return text;

  const terms = getNormalizedTerms(query);

  if (terms.length === 0) return text;

  const normalizedLower = normalizeTextForSearch(text);
  const ranges = buildRanges(normalizedLower, terms);

  if (ranges.length === 0) return text;

  const nodes = [];
  let cursor = 0;

  ranges.forEach(([start, end], index) => {
    if (start > cursor) {
      nodes.push(
        <React.Fragment key={`${keyPrefix}-t-${index}-${cursor}`}>
          {text.slice(cursor, start)}
        </React.Fragment>
      );
    }

    nodes.push(
      <mark key={`${keyPrefix}-m-${index}-${start}`}>
        {text.slice(start, end)}
      </mark>
    );

    cursor = end;
  });

  if (cursor < text.length) {
    nodes.push(
      <React.Fragment key={`${keyPrefix}-t-tail-${cursor}`}>
        {text.slice(cursor)}
      </React.Fragment>
    );
  }

  return nodes;
};

export {
  highlightTextNodes,
  normalizeTextForHighlight,
  hasAnyQueryMatch,
  getBestMatchSnippet,
  extractContextSnippet,
};

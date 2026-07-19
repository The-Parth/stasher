'use client';
import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import type { Stash, StashSection, StashLink } from '@/lib/types';

interface SearchResult {
  type: 'link' | 'section';
  label: string;
  subtitle: string; // URL for links, link count for sections
  breadcrumb: string[];
  sectionPath: string[]; // path to navigate to
  link?: StashLink;
}

interface SearchBarProps {
  stash: Stash;
  onNavigateToSection: (path: string[]) => void;
  onNavigateToLink: (sectionPath: string[], link: StashLink) => void;
}

function collectResults(
  sections: StashSection[],
  parentPath: string[],
  breadcrumb: string[],
  query: string
): SearchResult[] {
  const results: SearchResult[] = [];
  const q = query.toLowerCase();

  for (const section of sections) {
    const myPath = [...parentPath, section.id];
    const myBreadcrumb = [...breadcrumb, section.title];

    // Match section title/description
    if (
      section.title.toLowerCase().includes(q) ||
      section.description.toLowerCase().includes(q)
    ) {
      results.push({
        type: 'section',
        label: section.title,
        subtitle: `${section.links.length} link${section.links.length !== 1 ? 's' : ''} · ${section.children.length} section${section.children.length !== 1 ? 's' : ''}`,
        breadcrumb: myBreadcrumb,
        sectionPath: myPath,
      });
    }

    // Match links inside this section
    for (const link of section.links) {
      const displayLabel = link.label || (() => { try { return new URL(link.url).hostname; } catch { return link.url; } })();
      if (
        displayLabel.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        link.previewText.toLowerCase().includes(q)
      ) {
        results.push({
          type: 'link',
          label: displayLabel,
          subtitle: link.url,
          breadcrumb: myBreadcrumb,
          sectionPath: myPath,
          link,
        });
      }
    }

    // Recurse into children
    results.push(...collectResults(section.children, myPath, myBreadcrumb, query));
  }

  return results;
}

export default function SearchBar({ stash, onNavigateToSection, onNavigateToLink }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.toLowerCase();

    // Search root-level links too
    const rootResults: SearchResult[] = [];
    for (const link of stash.links) {
      const displayLabel = link.label || (() => { try { return new URL(link.url).hostname; } catch { return link.url; } })();
      if (
        displayLabel.toLowerCase().includes(q) ||
        link.url.toLowerCase().includes(q) ||
        link.previewText.toLowerCase().includes(q)
      ) {
        rootResults.push({
          type: 'link',
          label: displayLabel,
          subtitle: link.url,
          breadcrumb: ['Root'],
          sectionPath: [],
          link,
        });
      }
    }

    const sectionResults = collectResults(stash.sections, [], [], query);
    return [...rootResults, ...sectionResults].slice(0, 20); // cap at 20
  }, [query, stash]);

  // Reset selection when results change
  useEffect(() => { setSelectedIndex(0); }, [results]);

  // Close on click outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleSelect = useCallback((result: SearchResult) => {
    if (result.type === 'section') {
      onNavigateToSection(result.sectionPath);
    } else if (result.link) {
      onNavigateToLink(result.sectionPath, result.link);
    }
    setQuery('');
    setFocused(false);
    inputRef.current?.blur();
  }, [onNavigateToSection, onNavigateToLink]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!results.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) handleSelect(results[selectedIndex]);
    } else if (e.key === 'Escape') {
      setFocused(false);
      inputRef.current?.blur();
    }
  };

  const showResults = focused && query.trim().length > 0;

  return (
    <div className="search-bar-container" ref={containerRef}>
      <div className="search-bar">
        <svg className="search-bar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          className="search-bar-input"
          placeholder="Search links & sections…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onKeyDown={handleKeyDown}
          aria-label="Search stash"
          id="stash-search-input"
        />
        {query && (
          <button
            className="btn-icon"
            onClick={() => { setQuery(''); inputRef.current?.focus(); }}
            aria-label="Clear search"
            style={{ padding: '2px' }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showResults && (
        <div className="search-results" role="listbox">
          {results.length === 0 ? (
            <div className="search-empty">No results for &quot;{query}&quot;</div>
          ) : (
            results.map((result, i) => (
              <button
                key={`${result.type}-${result.sectionPath.join('/')}-${result.link?.id || result.label}-${i}`}
                className={`search-result-item${i === selectedIndex ? ' selected' : ''}`}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(i)}
                role="option"
                aria-selected={i === selectedIndex}
              >
                <span className="search-result-type">
                  {result.type === 'section' ? (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                    </svg>
                  ) : (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  )}
                </span>
                <div className="search-result-content">
                  <div className="search-result-label">{result.label}</div>
                  <div className="search-result-meta">
                    {result.breadcrumb.length > 0 && (
                      <span className="search-result-breadcrumb">
                        {result.breadcrumb.join(' › ')}
                      </span>
                    )}
                    {result.type === 'link' && (
                      <span className="search-result-url">{result.subtitle}</span>
                    )}
                    {result.type === 'section' && (
                      <span className="search-result-subtitle">{result.subtitle}</span>
                    )}
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

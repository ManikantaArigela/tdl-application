import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

// Raw HTML is intentionally disabled: react-markdown escapes it by default, so
// AI output or pasted content can never inject markup into the app.
const MARKDOWN_COMPONENTS = {
  a: ({ node: _node, children, ...props }) => (
    <a {...props} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  ),
};

export default function MarkdownPreview({ content }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
      {content}
    </ReactMarkdown>
  );
}

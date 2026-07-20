'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useI18n } from '@/lib/i18n';

interface ExportPanelProps {
  content: string;
}

function markdownToHtml(md: string): string {
  let html = md;
  // Escape HTML entities first (excluding already-wrapped tags)
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // Code blocks (must be before other transforms)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m, _lang, code) => {
    return `<pre><code>${code}</code></pre>`;
  });
  // Horizontal rules
  html = html.replace(/^---\s*$/gm, '<hr>');
  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
  // Bold / italic
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Strikethrough
  html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  // Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  // Unordered lists (wrap consecutive <li> in <ul>)
  html = html.replace(/((?:^<li>.*$[\r\n]*)+)/gm, '<ul>$1</ul>');
  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:^<li>.*$[\r\n]*)+)(?!(?:<\/li>))/gm, (_m) => {
    if (_m.includes('<ul>')) return _m;
    return '<ol>' + _m + '</ol>';
  });
  // Tables: simple pipe table support
  html = html.replace(/^\|(.+)\|$/gm, (match) => {
    const cells = match.slice(1, -1).split('|').map(c => c.trim());
    if (cells.every(c => /^[-:\s]+$/.test(c))) return ''; // skip separator row
    return '<tr>' + cells.map(c => `<td>${c}</td>`).join('') + '</tr>';
  });
  html = html.replace(/<tr>.*<\/tr>/g, (match) => {
    return '<table>' + match + '</table>';
  });
  // Remove consecutive duplicated table tags
  html = html.replace(/<\/table>\s*<table>/g, '');
  // Paragraphs: wrap non-tag lines
  html = html
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      // Already wrapped or block-level
      if (/^<(h[1-6]|ul|ol|li|blockquote|pre|table|tr|td|hr|div|img)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
  return html;
}

function markdownToPlainText(md: string): string {
  let text = md;
  text = text.replace(/^#{1,6}\s+/gm, '');
  text = text.replace(/\*\*(.+?)\*\*/g, '$1');
  text = text.replace(/\*(.+?)\*/g, '$1');
  text = text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  text = text.replace(/```[\s\S]*?```/g, (match) => match.replace(/```\w*\n?/, '').replace(/```$/, ''));
  text = text.replace(/`([^`]+)`/g, '$1');
  text = text.replace(/^> /gm, '');
  text = text.replace(/^- /gm, '• ');
  return text.trim();
}

export function ExportPanel({ content }: ExportPanelProps) {
  const { t } = useI18n();
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  }, []);

  const copyToClipboard = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        showToast(`${label} ${t.copied}!`);
      } catch {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showToast(`${label} ${t.copied}!`);
      }
    },
    [showToast, t.copied]
  );

  const handleCopyMarkdown = useCallback(() => {
    copyToClipboard(content, 'Markdown');
  }, [content, copyToClipboard]);

  const handleCopyHtml = useCallback(() => {
    const html = markdownToHtml(content);
    copyToClipboard(html, 'HTML');
  }, [content, copyToClipboard]);

  const handleCopyText = useCallback(() => {
    const text = markdownToPlainText(content);
    copyToClipboard(text, 'Text');
  }, [content, copyToClipboard]);

  const handleDownloadMd = useCallback(() => {
    const firstLine = content.split('\n').find((l) => l.trim()) || 'article';
    const filename = firstLine.replace(/^#+\s*/, '').replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 50) + '.md';
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t.downloadMd);
  }, [content, showToast, t.downloadMd]);

  const handleDownloadHtml = useCallback(() => {
    const html = markdownToHtml(content);
    const firstLine = content.split('\n').find((l) => l.trim()) || '文章';
    const title = firstLine.replace(/^#+\s*/, '').slice(0, 100);
    const filename = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff]/g, '_').slice(0, 50) + '.html';
    const fullHtml = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{
    max-width:820px;margin:0 auto;padding:40px 24px 80px;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans CJK SC",sans-serif;
    font-size:16px;line-height:1.8;color:#1a1a2e;background:#fafafa
  }
  h1{font-size:2em;font-weight:700;margin:1.5em 0 0.5em;padding-bottom:0.3em;border-bottom:2px solid #e8e8e8}
  h2{font-size:1.5em;font-weight:600;margin:1.4em 0 0.4em;padding-bottom:0.2em;border-bottom:1px solid #eee}
  h3{font-size:1.25em;font-weight:600;margin:1.2em 0 0.3em}
  p{margin:0.8em 0}
  a{color:#0c8ce9;text-decoration:none}
  a:hover{text-decoration:underline}
  img{max-width:100%;height:auto;border-radius:6px;margin:1em 0}
  pre{background:#1e1e2e;color:#cdd6f4;padding:16px 20px;border-radius:8px;overflow-x:auto;font-size:14px;line-height:1.5;margin:1em 0}
  code{font-family:"SFMono-Regular",Consolas,"Liberation Mono",Menlo,monospace;font-size:0.9em}
  p code,li code{background:#e8e8ee;padding:2px 6px;border-radius:4px;color:#d63384}
  pre code{background:none;padding:0;font-size:inherit;color:inherit}
  blockquote{border-left:4px solid #0c8ce9;margin:1em 0;padding:8px 16px;background:#f0f4ff;border-radius:0 6px 6px 0;color:#444}
  blockquote p{margin:0}
  ul,ol{margin:0.6em 0;padding-left:1.5em}
  li{margin:0.3em 0}
  table{width:100%;border-collapse:collapse;margin:1em 0;font-size:0.9em}
  th,td{border:1px solid #ddd;padding:8px 12px;text-align:left}
  th{background:#f5f5f5;font-weight:600}
  tr:nth-child(even){background:#fafafa}
  hr{border:none;border-top:2px solid #eee;margin:2em 0}
  del{color:#999}
  @media(prefers-color-scheme:dark){
    body{background:#0d1117;color:#c9d1d9}
    h1{border-bottom-color:#21262d}
    h2{border-bottom-color:#21262d}
    a{color:#58a6ff}
    blockquote{background:#161b22;border-left-color:#58a6ff;color:#8b949e}
    pre{background:#161b22}
    p code,li code{background:#21262d;color:#f9819a}
    th{background:#161b22}
    th,td{border-color:#30363d}
    tr:nth-child(even){background:#0d1117}
    hr{border-top-color:#21262d}
  }
</style>
</head>
<body>
${html}
</body>
</html>`;
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(t.downloadHtml);
  }, [content, showToast, t.downloadHtml]);

  return (
    <Card className="mt-4 relative">
      {toast && (
        <div className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-1.5 text-xs text-white shadow-lg dark:bg-gray-100 dark:text-gray-900 animate-fade-in z-10">
          {toast}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 p-4">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">{t.export}:</span>
        <Button variant="outline" size="sm" onClick={handleCopyMarkdown}>
          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
          {t.copyMarkdown}
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyHtml}>
          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          {t.copyHtml}
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopyText}>
          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {t.copyText}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadMd}>
          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          {t.downloadMd}
        </Button>
        <Button variant="outline" size="sm" onClick={handleDownloadHtml}>
          <svg className="mr-1.5 h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
          </svg>
          {t.downloadHtml}
        </Button>
      </div>
    </Card>
  );
}

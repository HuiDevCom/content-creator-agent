/**
 * Share — EdgeOne Makers Node Function
 * File path cloud-functions/share/index.ts maps to POST /share
 *
 * Actions:
 *   POST /share { content, title? } → { id, url } — create a share link
 *   POST /share { action: "get", id }  → { title, html } — retrieve published content
 *
 * The GET /share/:id route is handled by Next.js app/share/[id]/route.ts.
 */
import { createLogger } from '../_logger';

const logger = createLogger('share');

function generateId(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
    let id = '';
    for (let i = 0; i < 8; i++) {
        id += chars[Math.floor(Math.random() * chars.length)];
    }
    return id;
}

function markdownToHtml(md: string): string {
    let html = md
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_m: string, _lang: string, code: string) => {
        return `<pre><code>${code}</code></pre>`;
    });
    html = html.replace(/^---\s*$/gm, '<hr>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/~~(.+?)~~/g, '<del>$1</del>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    html = html.replace(/^> (.+)$/gm, '<blockquote><p>$1</p></blockquote>');
    html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
    html = html.replace(/((?:^<li>.*$[\r\n]*)+)/gm, '<ul>$1</ul>');
    html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');
    html = html
        .split('\n\n')
        .map((block) => {
            const trimmed = block.trim();
            if (!trimmed) return '';
            if (/^<(h[1-6]|ul|ol|li|blockquote|pre|table|tr|td|hr|div|img)/.test(trimmed)) return trimmed;
            return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
        })
        .join('\n');
    return html;
}

function buildHtmlPage(title: string, bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{max-width:820px;margin:0 auto;padding:40px 24px 80px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Noto Sans CJK SC",sans-serif;font-size:16px;line-height:1.8;color:#1a1a2e;background:#fafafa}
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
  hr{border:none;border-top:2px solid #eee;margin:2em 0}
  @media(prefers-color-scheme:dark){
    body{background:#0d1117;color:#c9d1d9}
    h1{border-bottom-color:#21262d} h2{border-bottom-color:#21262d}
    a{color:#58a6ff}
    blockquote{background:#161b22;border-left-color:#58a6ff;color:#8b949e}
    pre{background:#161b22}
    p code,li code{background:#21262d;color:#f9819a}
    hr{border-top-color:#21262d}
  }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

function createResponse(data: any, status = 200) {
    return new Response(JSON.stringify(data), {
        status,
        headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    });
}

export async function onRequest(context: any) {
    const method = context.request?.method || 'GET';
    const store = context.agent?.store ?? null;

    // Only handle POST—GET /share/:id is served by Next.js route
    if (method === 'POST') {
        const body: Record<string, any> = context.request?.body ?? {};

        // Action: get — retrieve published content by id
        if (body.action === 'get') {
            const { id } = body;
            if (!id) return createResponse({ error: 'Missing id' }, 400);
            if (!store) return createResponse({ error: 'Store not available' }, 503);
            try {
                const messages = await store.getMessages({ conversationId: `published-${id}`, limit: 1, order: 'desc' });
                if (messages.length === 0) return createResponse({ error: 'Not found' }, 404);
                const data = typeof messages[0].content === 'string'
                    ? JSON.parse(messages[0].content)
                    : messages[0].content;
                return createResponse({ title: data.title, html: data.html });
            } catch (e: any) {
                const msg = e?.message || String(e);
                logger.error(msg);
                return createResponse({ error: msg }, 500);
            }
        }

        const { content, title: inputTitle } = body;

        if (!content) {
            return createResponse({ error: 'Missing content' }, 400);
        }

        if (!store) {
            return createResponse({ error: 'Store not available' }, 503);
        }

        try {
            const id = generateId();
            const firstLine = (content as string).split('\n').find((l: string) => l.trim()) || 'Article';
            const title = inputTitle || firstLine.replace(/^#+\s*/, '').slice(0, 100);
            const html = markdownToHtml(content);

            await store.appendMessage({
                conversationId: `published-${id}`,
                role: 'system',
                content: JSON.stringify({ title, html, createdAt: new Date().toISOString() }),
                metadata: { type: 'published', id },
            });

            const shareUrl = `/share/${id}`;
            logger.log('Published:', id, title);

            return createResponse({ success: true, id, url: shareUrl });
        } catch (e: any) {
            const msg = e?.message || String(e);
            logger.error(msg);
            return createResponse({ error: msg }, 500);
        }
    }

    return createResponse({ error: 'Method not allowed' }, 405);
}
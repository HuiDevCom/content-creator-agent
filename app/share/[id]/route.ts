/**
 * GET /share/[id] — serves a published HTML page
 *
 * This route acts as a bridge: the cloud function at /share
 * handles sub-path routing that EdgeOne does not support, so
 * we use a standard Next.js dynamic route and fetch the
 * published content from the cloud function via internal POST.
 */
import { NextRequest, NextResponse } from 'next/server';

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
  footer{text-align:center;padding:2em 0;color:#888;font-size:14px}
  footer a{color:#888;text-decoration:none}
  footer a:hover{color:#555;text-decoration:underline}
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
<footer><hr><p>© 2026 <a href="https://content-creator.agent.huidev.com/">内容创作 Agent</a></p></footer>
</body>
</html>`;
}

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const { id } = await params;

    if (!id || id.length < 3) {
        return new NextResponse('Not found', { status: 404 });
    }

    try {
        // Fetch published content via internal POST to the cloud function
        const url = new URL(_request.url);
        const res = await fetch(`${url.origin}/share`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get', id }),
        });

        if (!res.ok) {
            if (res.status === 404) {
                return new NextResponse('Not found', { status: 404 });
            }
            return new NextResponse('Internal error', { status: 500 });
        }

        const data = await res.json();
        const html = buildHtmlPage(data.title || 'Shared Article', data.html);

        return new NextResponse(html, {
            status: 200,
            headers: { 'Content-Type': 'text/html; charset=UTF-8' },
        });
    } catch {
        return new NextResponse('Internal error', { status: 500 });
    }
}

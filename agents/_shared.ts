/**
 * Shared utilities for all agent endpoints.
 * Centralizes model initialization, environment config, and SSE helpers.
 */
import { initChatModel, tool } from 'langchain';
import { z } from 'zod';

type Model = Awaited<ReturnType<typeof initChatModel>>;

const DEFAULT_MODEL = '@makers/deepseek-v4-flash';

export interface AgentEnv {
    AI_GATEWAY_API_KEY: string;
    AI_GATEWAY_BASE_URL: string;
    AI_GATEWAY_MODEL?: string;
    SEARCH_PROVIDER?: string;
    KIMI_API_KEY?: string;
}

/** Extract and validate required environment variables. */
export function getAgentEnv(contextEnv: Record<string, string | undefined> | undefined): AgentEnv {
    const source = contextEnv ?? {};
    const required = ['AI_GATEWAY_API_KEY', 'AI_GATEWAY_BASE_URL'] as const;
    const missing = required.filter((k) => !source[k]?.trim());
    if (missing.length) throw new Error(`Missing environment variables: ${missing.join(', ')}`);
    return {
        AI_GATEWAY_API_KEY: source.AI_GATEWAY_API_KEY!,
        AI_GATEWAY_BASE_URL: source.AI_GATEWAY_BASE_URL!,
        AI_GATEWAY_MODEL: source.AI_GATEWAY_MODEL,
        SEARCH_PROVIDER: source.SEARCH_PROVIDER,
        KIMI_API_KEY: source.KIMI_API_KEY,
    };
}

/** Initialize a chat model. Caches per base URL to avoid re-initialization. */
const modelCache = new Map<string, Model>();

export async function createModel(env: AgentEnv, options?: { timeout?: number }): Promise<Model> {
    const modelName = env.AI_GATEWAY_MODEL || DEFAULT_MODEL;
    const cacheKey = `${modelName}:${env.AI_GATEWAY_BASE_URL}`;

    if (modelCache.has(cacheKey)) {
        return modelCache.get(cacheKey)!;
    }

    const model = await initChatModel(modelName, {
        modelProvider: 'openai',
        apiKey: env.AI_GATEWAY_API_KEY,
        configuration: {
            baseURL: env.AI_GATEWAY_BASE_URL,
        },
        timeout: options?.timeout ?? 300_000,
    });

    modelCache.set(cacheKey, model);
    return model;
}

/** Create a logger with a consistent prefix. */
export function createLogger(name: string) {
    return {
        log(...args: unknown[]) { console.log(`[${name}]`, ...args); },
        error(...args: unknown[]) { console.error(`[${name}]`, ...args); },
    };
}

// ─── SSE Helpers ───

export function sseEvent(data: Record<string, unknown>): string {
    return `data: ${JSON.stringify(data)}\n\n`;
}

export function createSSEResponse(
    generator: AsyncGenerator<string> | ((signal?: AbortSignal) => AsyncGenerator<string>),
    signal?: AbortSignal
): Response {
    const encoder = new TextEncoder();
    const readable = new ReadableStream({
        async start(controller) {
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(sseEvent({ type: 'ping', ts: Date.now() })));
                } catch {}
            }, 5_000);
            try {
                const it = typeof generator === 'function' ? generator(signal) : generator;
                for await (const chunk of it) {
                    if (signal?.aborted) break;
                    controller.enqueue(encoder.encode(chunk));
                }
            } catch (e) {
                const error = e as Error;
                if (error.name !== 'AbortError' && !signal?.aborted) {
                    controller.enqueue(encoder.encode(sseEvent({ type: 'error_message', content: error.message })));
                }
            } finally {
                clearInterval(heartbeat);
                controller.close();
            }
        },
        cancel() {},
    });

    return new Response(readable, {
        status: 200,
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    });
}

// ─── Web Search ───

const KIMI_DEFAULT_BASE_URL = 'https://api.moonshot.cn';

/**
 * Search the web via Kimi's built-in $web_search function.
 * Uses the standard tool_calls round-trip: Kimi generates search params,
 * we echo them back, and Kimi executes the search internally.
 */
async function searchWithKimi(query: string, apiKey: string): Promise<string> {
    const url = `${KIMI_DEFAULT_BASE_URL}/v1/chat/completions`;
    const messages: any[] = [
        { role: 'user', content: `请搜索以下内容并返回搜索结果摘要：${query}` },
    ];
    const tools = [{ type: 'builtin_function', function: { name: '$web_search' } }];

    try {
        // First call: model generates search params
        const res1 = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({ model: 'kimi-k3', messages, tools, max_tokens: 32768 }),
        });
        if (!res1.ok) {
            const errBody = await res1.text();
            throw new Error(`Kimi API error (${res1.status}): ${errBody.slice(0, 200)}`);
        }

        const data1 = await res1.json();
        const choice1 = data1.choices?.[0];
        if (!choice1) throw new Error('No response from Kimi API');

        if (choice1.finish_reason === 'tool_calls') {
            messages.push(choice1.message);
            for (const tc of choice1.message.tool_calls || []) {
                messages.push({
                    role: 'tool',
                    tool_call_id: tc.id,
                    name: tc.function.name,
                    content: tc.function.arguments,
                });
            }

            // Second call: Kimi executes search and returns results
            const res2 = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${apiKey}`,
                },
                body: JSON.stringify({ model: 'kimi-k3', messages, tools, max_tokens: 32768 }),
            });
            if (!res2.ok) {
                const errBody = await res2.text();
                throw new Error(`Kimi API error (${res2.status}): ${errBody.slice(0, 200)}`);
            }

            const data2 = await res2.json();
            return data2.choices?.[0]?.message?.content || 'No search results found.';
        }

        return choice1.message?.content || 'No search results found.';
    } catch (e) {
        const error = e as Error;
        return `[Search error] ${error.message}`;
    }
}

/**
 * Resolve tools array for agent usage.
 *
 * - When SEARCH_PROVIDER=kimi: replaces the platform's web_search tool
 *   with a custom tool that calls Kimi's $web_search API.
 * - Otherwise (default): uses the platform's built-in tools as-is.
 */
export function resolveTools(contextTools: any, env: AgentEnv): any[] {
    const platformTools = contextTools?.toLangChainTools?.(tool) ?? [];
    const searchProvider = env.SEARCH_PROVIDER || 'wsa';

    if (searchProvider === 'kimi') {
        const kimiApiKey = env.KIMI_API_KEY;
        if (!kimiApiKey) {
            throw new Error('KIMI_API_KEY is required when SEARCH_PROVIDER=kimi');
        }

        const kimiSearchTool = tool(
            async ({ query }: { query: string }) => {
                return await searchWithKimi(query, kimiApiKey);
            },
            {
                name: 'web_search',
                description: 'Search the web for current information',
                schema: z.object({ query: z.string().describe('The search query') }),
            },
        );

        // Replace the platform's web_search with our Kimi-based one
        const filtered = platformTools.filter((t: any) => t.name !== 'web_search');
        return [...filtered, kimiSearchTool];
    }

    return platformTools;
}
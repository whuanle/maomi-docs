import { NextRequest, NextResponse } from "next/server";
import { searchDocs } from "@/lib/search";
import {
  checkMcpRateLimit,
  createRateLimitHeaders,
  extractClientIp,
  runSearchTask,
  ServerBusyError,
} from "@/lib/server-protection";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SERVER_INFO = {
  name: "maomi-docs-mcp",
  version: "1.0.0",
};
const MCP_PROTOCOL_VERSION = "2025-06-18";
const SEARCH_TOOL_NAME = "search_docs";

export async function GET() {
  return NextResponse.json(
    {
      name: SERVER_INFO.name,
      version: SERVER_INFO.version,
      protocolVersion: MCP_PROTOCOL_VERSION,
      endpoint: "/mcp",
      auth: process.env.MCP_AUTH_TOKEN ? "bearer" : "optional",
      tools: [SEARCH_TOOL_NAME],
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export async function POST(request: NextRequest) {
  const authError = validateAuth(request);
  if (authError) {
    return authError;
  }

  const clientIp = extractClientIp(request.headers);
  const rateLimit = checkMcpRateLimit(clientIp);

  if (!rateLimit.allowed) {
    return createJsonRpcErrorResponse(
      null,
      -32002,
      "Rate limit exceeded",
      429,
      {
        retryAfterSeconds: rateLimit.retryAfterSeconds,
      },
      createRateLimitHeaders(rateLimit),
    );
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return createJsonRpcErrorResponse(null, -32700, "Parse error", 400, undefined, createRateLimitHeaders(rateLimit));
  }

  if (Array.isArray(body)) {
    return createJsonRpcErrorResponse(null, -32600, "Batch requests are not supported", 400, undefined, createRateLimitHeaders(rateLimit));
  }

  if (!isJsonRpcRequest(body)) {
    return createJsonRpcErrorResponse(null, -32600, "Invalid request", 400, undefined, createRateLimitHeaders(rateLimit));
  }

  const requestId = body.id ?? null;
  const rateLimitHeaders = createRateLimitHeaders(rateLimit);

  try {
    switch (body.method) {
      case "initialize":
        return createJsonRpcResultResponse(
          requestId,
          {
            protocolVersion: MCP_PROTOCOL_VERSION,
            capabilities: {
              tools: {
                listChanged: false,
              },
            },
            serverInfo: SERVER_INFO,
          },
          rateLimitHeaders,
        );
      case "notifications/initialized":
        return new NextResponse(null, {
          status: 202,
          headers: {
            ...rateLimitHeaders,
            "Cache-Control": "no-store",
          },
        });
      case "ping":
        return createJsonRpcResultResponse(requestId, {}, rateLimitHeaders);
      case "tools/list":
        return createJsonRpcResultResponse(
          requestId,
          {
            tools: [createSearchToolDefinition()],
          },
          rateLimitHeaders,
        );
      case "tools/call":
        return await handleToolCall(requestId, body.params, rateLimitHeaders);
      default:
        return createJsonRpcErrorResponse(
          requestId,
          -32601,
          `Method not found: ${body.method}`,
          404,
          undefined,
          rateLimitHeaders,
        );
    }
  } catch (error) {
    if (error instanceof ServerBusyError) {
      return createJsonRpcErrorResponse(
        requestId,
        -32001,
        "Search server is busy, try again later",
        503,
        undefined,
        rateLimitHeaders,
      );
    }

    console.error("MCP request error:", error);
    return createJsonRpcErrorResponse(
      requestId,
      -32603,
      "Internal error",
      500,
      undefined,
      rateLimitHeaders,
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, POST, OPTIONS",
      "Cache-Control": "no-store",
    },
  });
}

async function handleToolCall(
  requestId: string | number | null,
  params: unknown,
  rateLimitHeaders: Record<string, string>,
) {
  const toolCall = params as {
    name?: unknown;
    arguments?: unknown;
    args?: unknown;
  };

  if (toolCall?.name !== SEARCH_TOOL_NAME) {
    return createJsonRpcErrorResponse(
      requestId,
      -32602,
      `Unsupported tool: ${String(toolCall?.name ?? "")}`,
      400,
      undefined,
      rateLimitHeaders,
    );
  }

  const rawArguments =
    toolCall.arguments && typeof toolCall.arguments === "object"
      ? (toolCall.arguments as Record<string, unknown>)
      : toolCall.args && typeof toolCall.args === "object"
        ? (toolCall.args as Record<string, unknown>)
        : null;

  const query = typeof rawArguments?.query === "string" ? rawArguments.query.trim() : "";
  const locale = typeof rawArguments?.locale === "string" ? rawArguments.locale.trim() || "zh" : "zh";
  const limitValue = typeof rawArguments?.limit === "number" ? rawArguments.limit : Number(rawArguments?.limit);
  const limit = Number.isFinite(limitValue) ? Math.min(Math.max(Math.trunc(limitValue), 1), 20) : 8;

  if (!query) {
    return createJsonRpcErrorResponse(
      requestId,
      -32602,
      "Missing required argument: query",
      400,
      undefined,
      rateLimitHeaders,
    );
  }

  if (query.length > 200) {
    return createJsonRpcErrorResponse(
      requestId,
      -32602,
      "Query is too long",
      400,
      undefined,
      rateLimitHeaders,
    );
  }

  const results = await runSearchTask(() => searchDocs({ query, locale, limit }));

  return createJsonRpcResultResponse(
    requestId,
    {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query,
              locale,
              count: results.length,
              results,
            },
            null,
            2,
          ),
        },
      ],
      structuredContent: {
        query,
        locale,
        count: results.length,
        results,
      },
    },
    rateLimitHeaders,
  );
}

function validateAuth(request: NextRequest) {
  const token = process.env.MCP_AUTH_TOKEN;
  if (!token) {
    return null;
  }

  const authorization = request.headers.get("authorization");
  if (authorization === `Bearer ${token}`) {
    return null;
  }

  return NextResponse.json(
    {
      jsonrpc: "2.0",
      error: {
        code: -32003,
        message: "Unauthorized",
      },
      id: null,
    },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": 'Bearer realm="mcp"',
      },
    },
  );
}

function createSearchToolDefinition() {
  return {
    name: SEARCH_TOOL_NAME,
    title: "Search documentation",
    description: "Search the mounted docs content and return the most relevant documents.",
    inputSchema: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "Keyword or phrase to search for.",
        },
        locale: {
          type: "string",
          description: "Locale code, default is zh.",
          default: "zh",
        },
        limit: {
          type: "integer",
          description: "Maximum number of results to return, 1-20.",
          minimum: 1,
          maximum: 20,
          default: 8,
        },
      },
      required: ["query"],
      additionalProperties: false,
    },
  };
}

function isJsonRpcRequest(value: unknown): value is {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: unknown;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return record.jsonrpc === "2.0" && typeof record.method === "string";
}

function createJsonRpcResultResponse(
  id: string | number | null,
  result: unknown,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      result,
    },
    {
      headers: {
        ...headers,
        "Cache-Control": "no-store",
      },
    },
  );
}

function createJsonRpcErrorResponse(
  id: string | number | null,
  code: number,
  message: string,
  status: number,
  data?: unknown,
  headers?: Record<string, string>,
) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data === undefined ? {} : { data }),
      },
    },
    {
      status,
      headers: {
        ...headers,
        "Cache-Control": "no-store",
      },
    },
  );
}
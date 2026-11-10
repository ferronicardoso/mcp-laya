#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import type { Request, Response } from 'express';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from './config.js';
import { LayaEngine, type DecisionEngine } from './engine.js';
import * as handlers from './handlers.js';
import type { OptionInput } from './questions.js';
import { toText, toError } from './toolResult.js';

const TEXT_PROP = {
  type: 'string',
  description: 'The text to evaluate (email, ticket, message, document...). Any of 100+ languages (multilingual checkpoint).',
};

const OPTIONS_PROP = {
  type: 'array',
  description:
    'Options to choose from (2 to 100, ideally under 20). Each is a string key, or { key, description } — descriptions improve accuracy.',
  items: {
    anyOf: [
      { type: 'string' },
      {
        type: 'object',
        properties: { key: { type: 'string' }, description: { type: 'string' } },
        required: ['key'],
      },
    ],
  },
};

const LEVELS_PROP = {
  type: 'array',
  description: 'Description of each level of the scale, lowest level first (2 to 10 levels).',
  items: { type: 'string' },
};

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
export function createServer(engine: DecisionEngine): Server {
  const server = new Server(
    { name: 'mcp-laya', version: '1.0.0' },
    { capabilities: { tools: {} } }
  );

  // -------------------------------------------------------------------------
  // Tool definitions
  // -------------------------------------------------------------------------
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'laya_choice',
        description:
          'Classifies a text into exactly one of the given options using the local Laya decision model (single forward pass, no text generation). Returns the chosen option and the probability of each option. Good for routing, triage, intent and category classification.',
        inputSchema: {
          type: 'object',
          properties: {
            text: TEXT_PROP,
            question: { type: 'string', description: 'The question to answer about the text (e.g. "Which team should handle this?")' },
            options: OPTIONS_PROP,
          },
          required: ['text', 'question', 'options'],
        },
      },
      {
        name: 'laya_noul',
        description:
          'Answers a yes/no question about a text and returns the probability that the statement is true. Phrase it as a short declarative statement about the text (e.g. "The customer asks about prices.") rather than an abstract question ("Does the customer show interest in buying?"): in tests the question form missed clear positives. May still under-report true; treat values near 0.5 as inconclusive.',
        inputSchema: {
          type: 'object',
          properties: {
            text: TEXT_PROP,
            question: { type: 'string', description: 'The yes/no question about the text' },
          },
          required: ['text', 'question'],
        },
      },
      {
        name: 'laya_score',
        description:
          'Rates a text on an ordinal scale you define (e.g. urgency, sentiment) and returns the expected level plus the probability of each level. This is the weakest decision type: it is biased against the first (lowest) level and picked "critical" for a text saying "no rush". Prefer laya_choice with named levels (e.g. urgent / can wait); use this only for a relative ranking via the fractional `score`, and validate on your own data.',
        inputSchema: {
          type: 'object',
          properties: {
            text: TEXT_PROP,
            question: { type: 'string', description: 'What is being rated (e.g. "How urgent is this request?")' },
            levels: LEVELS_PROP,
          },
          required: ['text', 'question', 'levels'],
        },
      },
      {
        name: 'laya_predict',
        description:
          'Answers several choice / score / yes-no questions about the same text in one call (cheaper than separate calls). Each question has a type and its own options or levels.',
        inputSchema: {
          type: 'object',
          properties: {
            text: TEXT_PROP,
            questions: {
              type: 'array',
              description: 'Questions to answer (1 to 20).',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', description: 'Identifier used as the key of the answer (default: q1, q2, ...)' },
                  type: { type: 'string', enum: ['choice', 'score', 'noul'] },
                  question: { type: 'string' },
                  options: OPTIONS_PROP,
                  levels: LEVELS_PROP,
                },
                required: ['type', 'question'],
              },
            },
          },
          required: ['text', 'questions'],
        },
      },
      {
        name: 'laya_status',
        description:
          'Returns information about the loaded Laya model (directory, whether it is loaded, token limits, calibration caveat).',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  // -------------------------------------------------------------------------
  // Tool implementation
  // -------------------------------------------------------------------------
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = (request.params ?? {}) as {
      name: string;
      arguments?: Record<string, unknown>;
    };
    const params = args ?? {};

    try {
      switch (name) {
        case 'laya_choice':
          return toText(
            await handlers.layaChoice(
              engine,
              params as { text: string; question: string; options: OptionInput[] }
            )
          );

        case 'laya_noul':
          return toText(await handlers.layaNoul(engine, params as { text: string; question: string }));

        case 'laya_score':
          return toText(
            await handlers.layaScore(engine, params as { text: string; question: string; levels: string[] })
          );

        case 'laya_predict':
          return toText(await handlers.layaPredict(engine, params as { text: string; questions: unknown }));

        case 'laya_status':
          return toText(await handlers.layaStatus(engine));

        default:
          return toError(`Unknown tool: ${name}`);
      }
    } catch (error) {
      return toError(error instanceof Error ? error.message : String(error));
    }
  });

  return server;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const MCP_TRANSPORT = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase();

async function startHttpServer(engine: DecisionEngine) {
  const port = Number.parseInt(process.env.MCP_HTTP_PORT ?? '3005', 10);
  const host = process.env.MCP_HTTP_HOST ?? '0.0.0.0';
  const app = createMcpExpressApp({ host });

  app.post('/mcp', async (req: Request, res: Response) => {
    // One MCP Server per request, but a single shared engine (the model is loaded once).
    const server = createServer(engine);
    try {
      const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
      res.on('close', () => {
        transport.close();
        server.close();
      });
    } catch (error) {
      console.error('Error handling MCP request:', error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  const methodNotAllowedBody = JSON.stringify({
    jsonrpc: '2.0',
    error: { code: -32000, message: 'Method not allowed.' },
    id: null,
  });
  app.get('/mcp', (_req: Request, res: Response) => {
    res.writeHead(405).end(methodNotAllowedBody);
  });
  app.delete('/mcp', (_req: Request, res: Response) => {
    res.writeHead(405).end(methodNotAllowedBody);
  });

  app.listen(port, host, () => {
    console.error(`mcp-laya: MCP HTTP server listening on http://${host}:${port}/mcp`);
  });
}

async function main() {
  const config = loadConfig();
  const engine = new LayaEngine(config);

  if (config.preload) {
    await engine.load();
    console.error('mcp-laya: model loaded');
  }

  if (MCP_TRANSPORT === 'http') {
    await startHttpServer(engine);
    return;
  }
  const transport = new StdioServerTransport();
  await createServer(engine).connect(transport);
}

// Compare real paths: when launched through a symlink (npm bin, linked repos folder),
// `process.argv[1]` keeps the link path while `import.meta.url` is already resolved.
function isEntryPoint(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return false;
  }
}

if (isEntryPoint()) {
  main().catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
}

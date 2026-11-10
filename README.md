# MCP Server for Laya

[![Docker Publish](https://github.com/ferronicardoso/mcp-laya/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/ferronicardoso/mcp-laya/actions/workflows/docker-publish.yml)
[![GHCR](https://img.shields.io/badge/ghcr.io-mcp--laya-2496ED?logo=docker&logoColor=white)](https://github.com/ferronicardoso/mcp-laya/pkgs/container/mcp-laya)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white)](package.json)

An MCP server that exposes [Laya](https://github.com/NandhaKishorM/laya) — a non-autoregressive "System 1" decision model — to MCP clients (Claude Desktop, Claude Code, Codex CLI, VS Code Copilot, Cursor, and compatible hosts).

Give it a text and a typed question; it answers in **a single forward pass**, with probabilities. No text generation, no prompt, no output parsing.

## Features

- Typed decisions over text: choice between options, yes/no, and ordinal score
- 100+ languages (multilingual checkpoint)
- Local inference on CPU through [`laya-ts`](https://github.com/NandhaKishorM/laya/tree/main/laya-ts) and ONNX Runtime — no Python at runtime and no inference API: the text is processed in-process (see the telemetry note in [Security Notes](#security-notes))
- Several questions about the same text in one call
- stdio and Streamable HTTP transports

Typical uses: ticket/email routing, intent and category classification, triage, moderation, yes/no checks over text.

## Available Tools

| Tool | Description |
|---|---|
| `laya_choice` | Picks exactly one of N options (2–100, ideally < 20); returns the choice and every option's probability. Optional `checkStability` re-asks with the options reordered/relabeled and flags answers that flip |
| `laya_noul` | Yes/no check phrased as a statement; returns the probability that it is true |
| `laya_score` | Ordinal scale you define (2–10 levels); returns expected level and per-level probabilities. Weakest type — prefer `laya_choice` with named levels |
| `laya_predict` | Several choice/score/yes-no questions about the same text in one call (cheaper than separate calls) |
| `laya_status` | Model directory, load state, token limits and the calibration caveat |

Options of a choice may be plain strings or `{ "key": "...", "description": "..." }` — descriptions improve accuracy.

Example (`laya_choice`):

```json
{
  "text": "O produto chegou quebrado e ninguém me responde há uma semana.",
  "question": "Qual setor deve responder?",
  "options": [
    { "key": "logística", "description": "entrega e avarias" },
    { "key": "financeiro", "description": "cobranças" },
    "suporte"
  ]
}
```

```json
{
  "type": "choice",
  "choice": "logística",
  "probabilities": { "logística": 0.8821, "financeiro": 0.0007, "suporte": 0.1172 },
  "confidence": 0.8821,
  "usage": { "truncated": false, "stateTokens": 13, "droppedTokens": 0 }
}
```

### Checking stability (`checkStability`)

A choice can depend on the order in which the options are listed. In testing, a thank-you note was rated "urgent" (79%) with `urgente` listed last, and "can wait" (63%) with the order reversed. With `checkStability: true` (on `laya_choice` or `laya_predict`) the server re-asks every choice question with reordered and relabeled options (laya-ts' `OptionStabilityHook`, `fast` variants, ~3x the compute) and adds:

```json
"stability": {
  "stable": false,
  "agreement": 0,
  "score": 0.35,
  "variants": 3,
  "distinctChoices": ["pode esperar", "urgente"],
  "variantChoices": { "original": "urgente", "reversed": "pode esperar", "letters_reversed": "pode esperar" }
}
```

plus a warning when the answer flips. `stable` is true only if every arrangement gives the same choice. `score` and `agreement` are raw signals, **not calibrated probabilities**: no accept/escalate thresholds are applied. Recommended for urgency/priority-style choices; it does not fix answers that are consistently wrong (e.g. a department that is confidently misread in every order).

If the text exceeds the model's token budget (about 1,024 tokens), `usage.truncated` is `true` and a warning is returned.

## Know the limits

These come from the checkpoint itself (see its model card) and from manual tests; the MCP surfaces them rather than hiding them:

- **Answers can depend on option order**, especially for urgency/priority choices: use `checkStability` (see above) and treat an unstable answer as unreliable.
- **Probabilities are uncalibrated** (temperature 1.0) and over-confident. Use them to rank options or to set a review threshold validated on your own data (for example, send to a human when the top probability is below ~0.6), not as true likelihoods.
- **`noul` can under-report "true"**, and wording matters. In a quick test, "Does the customer show interest in buying?" scored 0.10 on a clear price inquiry, while the declarative "The customer asks about prices." scored 0.92. Phrase `noul` as a short statement about the text and treat values near 0.5 as inconclusive.
- **`score` is the weakest decision type** and has a measured bias against the first level: a text saying "no rush" was rated "critical" (62%) with only 2% on the lowest level. For urgency, sentiment and similar scales, prefer `laya_choice` with named levels (e.g. `urgent` / `can wait`), which got both test cases right. The fractional `score` is still usable as a relative ranking.
- **A choice returns one option only**: a text with two topics (e.g. an access problem and a strange invoice) gets a single, often very confident, label.
- **Keep choices under ~20 options.** The server accepts up to 100 but warns above 20.
- Low-resource languages (e.g. Swahili, Tamil, Amharic) are weak.
- The observations above come from a handful of manual tests, not a benchmark. Validate on labelled data of your own before relying on any threshold.

## Requirements

- Node.js 18+
- The ONNX export of a Laya checkpoint (one-time preparation, next section)
- ~1.3 GB of disk for the multilingual ONNX export. Cold load takes ~5 s; a 3-question prediction takes ~0.6 s on CPU.

## Preparing the model

`laya-ts` does **not** read the Hugging Face `model.safetensors` directly; it needs a split ONNX export (`encoder.onnx` + `head.onnx`). Do this once per checkpoint. Python is needed **only for this step**, not at runtime.

> Use the **multilingual** checkpoint for anything that is not English. The English one (root of `convaiinnovations/laya`) collapses outside English while staying confident.

**Bash (Linux/macOS/WSL):**

```bash
# 1. Get the Laya repository (it contains the export script and the Python package)
git clone --depth 1 https://github.com/NandhaKishorM/laya ~/laya-src

# 2. Python environment (outside this repo; CPU torch is enough)
python3 -m venv ~/venvs/laya-export
source ~/venvs/laya-export/bin/activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install "numpy<2.4" transformers huggingface_hub onnx onnxruntime onnxscript safetensors
pip install --no-deps ~/laya-src

# 3. Export (downloads the weights from Hugging Face by itself, ~650 MB)
USE_TF=0 python ~/laya-src/laya-ts/scripts/export_onnx.py \
  --repo convaiinnovations/laya --subfolder multilingual \
  --out-dir ~/models/laya-onnx/multilingual
```

**PowerShell:**

```powershell
git clone --depth 1 https://github.com/NandhaKishorM/laya $HOME\laya-src

python -m venv $HOME\venvs\laya-export
& $HOME\venvs\laya-export\Scripts\Activate.ps1
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install "numpy<2.4" transformers huggingface_hub onnx onnxruntime onnxscript safetensors
pip install --no-deps $HOME\laya-src

$env:USE_TF = "0"
python $HOME\laya-src\laya-ts\scripts\export_onnx.py `
  --repo convaiinnovations/laya --subfolder multilingual `
  --out-dir C:\models\laya-onnx\multilingual
```

The script verifies that PyTorch and ONNX outputs match (within 1e-4) before writing anything. The result is a directory with:

```text
encoder.onnx  encoder.onnx.data  head.onnx  head.onnx.data
tokenizer.json  rl_agent_config.json
```

Point `LAYA_MODEL_DIR` at that directory.

**Already cloned the Hugging Face repository?** Use `--model-dir <path to the multilingual/ folder>` instead of `--repo ... --subfolder ...`. Beware: without a working `git-lfs`, `model.safetensors` is a ~134-byte text pointer, not the weights — run `git lfs pull`, or just let `--repo` download it.

## Configuration

| Variable | Required | Default | Description |
|---|---|---|---|
| `LAYA_MODEL_DIR` | Yes | — | Directory with the ONNX export (see above). Validated at startup |
| `LAYA_NUM_THREADS` | No | runtime default | ONNX Runtime CPU threads |
| `LAYA_PRELOAD` | No | `false` | Load the model at startup instead of on the first call |
| `MCP_TRANSPORT` | No | `stdio` | Transport mode: `stdio` (default, for `npx`/Claude Desktop/VS Code) or `http` (Streamable HTTP, for Docker/remote clients) |
| `MCP_HTTP_PORT` | No | `3005` | HTTP server port (only used when `MCP_TRANSPORT=http`) |
| `MCP_HTTP_HOST` | No | `0.0.0.0` | HTTP server bind address (only used when `MCP_TRANSPORT=http`) |

The model is loaded lazily on the first call (unless `LAYA_PRELOAD=true`) and shared by all requests; predictions run one at a time.

## Usage

### Run directly from GitHub

```bash
LAYA_MODEL_DIR=~/models/laya-onnx/multilingual npx github:ferronicardoso/mcp-laya
```

> **Why `ONNXRUNTIME_NODE_INSTALL=skip`?** On its first install `npx` runs the `postinstall` of `onnxruntime-node`, which downloads ~280 MB of CUDA libraries that this CPU-only server never uses. On a cold cache that pushes the first start past the 30 s connection timeout of MCP clients (measured: ~33 s without it, ~15 s with it). The variable only matters while the package is being installed; later starts take ~2 s.

### Claude Code (CLI)

```bash
claude mcp add laya --scope user -- npx -y github:ferronicardoso/mcp-laya
```

`--scope` controls where the server registration is stored:

| Scope | Stored in | Visible to |
|---|---|---|
| `local` (default) | project-local, untracked | only you, only in this project |
| `project` | `.mcp.json` at the project root | anyone who clones the repo (commit it to share) |
| `user` | your global Claude Code config | you, across every project |

The model directory is passed with an `--env` flag before the `--`:

**Bash (Linux/macOS/WSL):**

```bash
claude mcp add laya --scope user \
  --env LAYA_MODEL_DIR=/home/you/models/laya-onnx/multilingual \
  --env ONNXRUNTIME_NODE_INSTALL=skip \
  -- npx -y github:ferronicardoso/mcp-laya
```

**PowerShell:**

```powershell
claude mcp add laya --scope user `
  --env LAYA_MODEL_DIR=C:\models\laya-onnx\multilingual `
  --env ONNXRUNTIME_NODE_INSTALL=skip `
  -- npx -y github:ferronicardoso/mcp-laya
```

To use a local clone instead of `npx` (see [Local Development](#local-development)), replace the command after `--` with `node /path/to/mcp-laya/dist/index.js`.

### Codex CLI

**Bash (Linux/macOS/WSL):**

```bash
codex mcp add laya \
  --env LAYA_MODEL_DIR=/home/you/models/laya-onnx/multilingual \
  --env ONNXRUNTIME_NODE_INSTALL=skip \
  npx -- -y github:ferronicardoso/mcp-laya
```

**PowerShell:**

```powershell
codex mcp add laya `
  --env LAYA_MODEL_DIR=C:\models\laya-onnx\multilingual `
  --env ONNXRUNTIME_NODE_INSTALL=skip `
  npx -- -y github:ferronicardoso/mcp-laya
```

This registers the server in `~/.codex/config.toml`. To remove it, run `codex mcp remove laya`.

### Claude Desktop configuration

`%APPDATA%\Claude\claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "laya": {
      "command": "npx",
      "args": ["github:ferronicardoso/mcp-laya"],
      "env": {
        "LAYA_MODEL_DIR": "C:\\models\\laya-onnx\\multilingual",
        "ONNXRUNTIME_NODE_INSTALL": "skip"
      }
    }
  }
}
```

### VS Code MCP configuration

`.vscode/mcp.json`:

```json
{
  "servers": {
    "laya": {
      "command": "npx",
      "args": ["github:ferronicardoso/mcp-laya"],
      "env": {
        "LAYA_MODEL_DIR": "/home/you/models/laya-onnx/multilingual",
        "ONNXRUNTIME_NODE_INSTALL": "skip"
      }
    }
  }
}
```

### Run with Docker (HTTP transport)

The image runs in Streamable HTTP mode by default, for use as a remote MCP endpoint (e.g. from n8n's MCP Client Tool node or any Streamable HTTP-compatible client). It is Debian-based (ONNX Runtime ships no musl/alpine binaries) and does **not** contain the model: mount the ONNX export as a volume, and `LAYA_MODEL_DIR` must point to the path *inside* the container (the image already defaults it to `/models`).

**Bash (Linux/macOS/WSL):**

```bash
docker run -d --name mcp-laya \
  -p 3005:3005 \
  -v ~/models/laya-onnx/multilingual:/models:ro \
  ghcr.io/ferronicardoso/mcp-laya:latest
```

**PowerShell:**

```powershell
docker run -d --name mcp-laya `
  -p 3005:3005 `
  -v "C:\models\laya-onnx\multilingual:/models:ro" `
  ghcr.io/ferronicardoso/mcp-laya:latest
```

The MCP endpoint is then available at `http://localhost:3005/mcp`. To register it:

```bash
claude mcp add --transport http laya http://localhost:3005/mcp
```

The container runs as the non-root `node` user (uid 1000), so the mounted model files must be readable by it. The image is ~430 MB: it is CPU-only and drops the GPU/other-OS binaries that `onnxruntime-node` bundles. It also ships no CA certificates, which (incidentally) keeps the ONNX Runtime telemetry module from uploading — see [Security Notes](#security-notes) before adding `ca-certificates`.

To build the image locally instead, run `docker build -t mcp-laya .` in the repository root and use `mcp-laya` as the image name above.

## Local Development

```bash
git clone https://github.com/ferronicardoso/mcp-laya
cd mcp-laya
npm install
npm run build
```

Start the compiled server:

**Bash (Linux/macOS/WSL):**

```bash
LAYA_MODEL_DIR=~/models/laya-onnx/multilingual npm start
```

**PowerShell:**

```powershell
$env:LAYA_MODEL_DIR = "C:\models\laya-onnx\multilingual"
npm start
```

Run the tests (the integration test with the real model runs only when `LAYA_MODEL_DIR` is set):

```bash
npm test
```

```text
src/
├── index.ts       # MCP server, tool schemas, stdio/HTTP bootstrap
├── config.ts      # env validation
├── engine.ts      # lazy model loading + serialized predictions (laya-ts)
├── handlers.ts    # tool logic and output formatting
├── questions.ts   # input validation -> Laya question definitions
└── toolResult.ts
vendor/laya-ts/            # compiled laya-ts (see below)
```

### About `vendor/laya-ts`

`laya-ts` is not published on npm, so its compiled build (Laya repository commit `b8a0f09`, `laya-ts` 0.1.0, Apache-2.0) is vendored in `vendor/laya-ts/` and imported by relative path from `src/engine.ts`. It is deliberately **not** an npm dependency: a `file:` dependency cannot be resolved when the package itself is installed from GitHub (`npx github:...`). Its only runtime dependency, `onnxruntime-node`, is declared in this project's `package.json`.

To update it:

```bash
git clone --depth 1 https://github.com/NandhaKishorM/laya /tmp/laya-src
cd /tmp/laya-src/laya-ts && npm ci && npm run build && npm pack
rm -rf /path/to/mcp-laya/vendor/laya-ts && mkdir -p /path/to/mcp-laya/vendor/laya-ts
tar -xzf laya-ts-*.tgz -C /path/to/mcp-laya/vendor/laya-ts --strip-components=1 --exclude=package/README.md --exclude=package/scripts
```

If `laya-ts` is published to npm in the future, add it as a regular dependency, change the import in `src/engine.ts` and drop `vendor/`.

## Build and Commit Workflow

This repository intentionally tracks `dist/` to support `npx github:user/repo` usage.

The project uses a Husky `pre-commit` hook (install it with `npm run hooks:install`) to:
1. build TypeScript (`npm run build`)
2. stage generated artifacts (`git add dist`)

Manual fallback:

```bash
npm run build
git add dist
```

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `LAYA_MODEL_DIR ... is missing: encoder.onnx, ...` | The directory is not the ONNX export (e.g. it is the raw Hugging Face download). Run the export in [Preparing the model](#preparing-the-model) |
| Export fails or weights look empty; `model.safetensors` is ~134 bytes | `git-lfs` was not working when the Hugging Face repo was cloned, so the file is a pointer. Use `--repo` (downloads the weights) or run `git lfs pull` |
| Client shows `CONNECTION_CLOSED` | Run the server by hand to see the startup error: `LAYA_MODEL_DIR=... node dist/index.js`. A configuration error is printed to the terminal |
| `connection timed out after 30000ms` right after registering via `npx` | First `npx` run is installing (slow). Add `ONNXRUNTIME_NODE_INSTALL=skip` to the registration, or warm the cache once in a terminal (`LAYA_MODEL_DIR=... npx -y github:ferronicardoso/mcp-laya`, then `Ctrl+C`) and reconnect. As a last resort start the client with a larger `MCP_TIMEOUT` (ms) |
| First call takes a few seconds | The model loads lazily on the first call (~5 s). Set `LAYA_PRELOAD=true` to load at startup |
| Answer comes with a truncation warning | The text exceeds the model's token budget; only the beginning was evaluated. Split the text or shorten it |

## Security Notes

- `LAYA_MODEL_DIR` must point to a real directory with the ONNX export — the server refuses to start otherwise. Model files are never committed to this repository.
- Texts are processed in-process by the ONNX model; this server's own code makes no network calls. **Telemetry caveat:** the ONNX Runtime native library bundled with `onnxruntime-node` contains a Microsoft telemetry module (`OneDsTelemetry`, endpoint `mobile.events.data.microsoft.com`) that cannot be switched off from JavaScript. Whether it sends anything in your environment, and exactly what, has **not** been verified here (in the Docker image it logs that uploads are unavailable because the image has no CA bundle). If this matters for your data, run the server without outbound network access, or block that host (e.g. `docker run --add-host mobile.events.data.microsoft.com:127.0.0.1 ...`, or an `/etc/hosts` entry).
- The HTTP transport has **no authentication** and binds to `0.0.0.0` by default. Bind to `127.0.0.1` (`MCP_HTTP_HOST`) or put it behind a reverse proxy with authentication before exposing it beyond your machine.
- Inputs are validated before reaching the model (text up to 200,000 characters, up to 20 questions per call, 2–100 options per choice).
- Probabilities are uncalibrated; do not use them as the only basis for automated actions with real consequences (see [Know the limits](#know-the-limits)).

## License

[MIT](LICENSE) © Raphael Augusto Ferroni Cardoso

`laya-ts` and Laya are Apache-2.0; the checkpoints have their own terms on the Hugging Face model page.

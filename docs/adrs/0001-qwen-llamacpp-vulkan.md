# ADR 0001: Qwen VL embeddings via llama.cpp Vulkan

## Status

Accepted (2026-09-02)

## Context

v1 needs fused text+image bookmark vectors, local-only, on Arc B580. Jina-clip-v2 is a separate vector space (two towers, CC BY-NC). Ollama `/api/embed` is text-only. Official llama.cpp `llama-server` with Qwen3-VL-Embedding-2B GGUF, `--embedding --pooling last --embd-normalize 2`, 256 image tokens, matches torch search well enough (image cosine ~0.97).

## Decision

Ship one embed backend: Qwen3-VL-Embedding-2B through official Vulkan `llama-server`. Drop Jina from v1. The app process owns sqlite and HTTP; it spawns `llama-server` as a child.

## Consequences

Install must fetch or locate a pinned Vulkan `llama-server` and GGUF+mmproj (default Q4_K_M + mmproj Q8_0). Embed uses on-disk stills (all photos, or a video/gif poster). Host prompt cache is capped at 8192 MiB (`--cache-ram 8192`). `-c` is shared across `-np` embed slots; slot context is `c / np` (8192 each, 4 slots).

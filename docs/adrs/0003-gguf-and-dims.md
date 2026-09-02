# ADR 0003: GGUF quant and stored vector size

## Status

Accepted (2026-09-02)

## Context

Q8_0 + mmproj F16 (~2.6G) was the bench pair. Search cost is not driven by 2048-d. Vision cosine is sensitive to mmproj quant; language-tower Q4 is the usual size win.

## Decision

Default weights: **Q4_K_M** text GGUF + **Q8_0** mmproj (~1.55G). Pair is configurable.

Store the **full 2048-d** embedding in sqlite. Search uses that vector. 512-d slice is not the default store.

## Consequences

First-run disk is ~1.55G plus llama-server. A Q4 mmproj remains opt-in only; we have no cosine numbers for it. Changing quant later requires re-embed.

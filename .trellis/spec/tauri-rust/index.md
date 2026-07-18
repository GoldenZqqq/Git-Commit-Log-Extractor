# Tauri Rust Development Guidelines

> Rust backend guidelines for GitPulse.

## Overview

Rust owns local Git scanning, commit extraction, report rendering/export, optional AI integration, diagnostics, and secure storage. `src-tauri/src/lib.rs` exposes Tauri commands as thin transport wrappers around domain modules.

## Guidelines Index

| Guide | Description | Status |
|-------|-------------|--------|
| [Command Boundaries](./command-boundaries.md) | Tauri command and module ownership | Filled |
| [Report History Storage](./report-history-storage.md) | Versioned local history, migration, recovery, and IPC contract | Filled |
| [Configuration Profiles](./config-profile-io.md) | Versioned shareable config and bounded file I/O contract | Filled |
| [Project Retrospective Attribution](./project-retrospective.md) | Structured project attribution, history compatibility, and retrospective projection | Filled |
| [Quality Guidelines](./quality-guidelines.md) | Rust verification and safety rules | Filled |
| [Desktop Quality Gates](../frontend/desktop-quality-gates.md) | Real Windows WebView startup and IPC smoke contract | Filled |

## Pre-Development Checklist

- [ ] Decide whether the change belongs in `git_ops`, `commit_pipeline`, `report`, `ai`, diagnostics, secure storage, or a Tauri command wrapper.
- [ ] Check `src-tauri/src/models.rs` for request/response shape changes and mirror them in `src/model.ts`.
- [ ] Preserve local-first behavior and AI failure fallback.
- [ ] Keep user-facing Rust errors in Chinese.
- [ ] For report-history work, follow `report-history-storage.md`; do not write report bodies back to WebView localStorage.
- [ ] For project retrospective work, follow `project-retrospective.md`; generate attribution before persistence and never parse Markdown identity.
- [ ] For configuration-profile work, follow `config-profile-io.md`; keep schema validation in one frontend owner and file I/O bounded in Rust.

## Quality Check

- [ ] `cd src-tauri && cargo check` passes for Rust changes.
- [ ] `cd src-tauri && cargo test` passes when behavior changes.
- [ ] Cross-layer payload changes are covered by frontend builders/validators.
- [ ] No plain persisted secrets are introduced.

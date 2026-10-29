# UML Generator

Repository retrieval and C# analysis are implemented. The generator reads pinned GitHub snapshots and exports declarations, references, calls, structured bodies, test annotations and diagnostics. Diagram extraction and viewer JSON output remain placeholders.

Open `Uml.Generator.sln` in Visual Studio or `Uml.Generator.code-workspace` in VS Code.

```text
Uml.Generator/
├── projects/garage/             Example .uml configuration and .umlignore
├── src/Uml.Generator/
│   ├── Program.cs              Entry point
│   ├── Configuration/          Configuration contracts
│   ├── Repository/             Implemented: read-only GitHub snapshots and verified cache
│   ├── Analysis/               Implemented: Roslyn analysis of verified snapshot bytes
│   │   ├── Input/              Verified source reader and explicit compilation options
│   │   ├── CSharp/             Declarations, symbols, relationships and structured bodies
│   │   ├── Tests/              Test discovery and UML comment annotations
│   │   └── Models/             Plain code facts; no Roslyn objects or layout
│   ├── Extraction/
│   │   ├── Class/              Structural diagram extraction
│   │   ├── Interaction/        Shared sequence/communication extraction
│   │   └── Activity/           Activity/control-flow extraction
│   ├── Output/                 Analysis JSON export; viewer output remains a placeholder
│   └── Application/            Pipeline coordination
├── tests/Uml.Generator.Tests/   Repository, authentication and analysis tests
├── .cache/snapshots/            Downloaded snapshots; ignored by Git
└── output/                     Generated drafts; ignored by Git
```

## Intended flow

GitHub revision → pinned commit snapshot → analysed code → type-specific extractors → validated viewer JSON.

- Repository retrieval resolves a branch or PR to one commit before fetching configured files.
- Analysis models describe code facts; they contain no layout or colours.
- Each diagram family has its own extractor.
- Sequence and communication share an interaction definition.
- Symbol identity and code fingerprints are separate.
- Tests may supply use-case and diagram annotations, with external configuration as an alternative.

## Read a repository snapshot

```powershell
dotnet run --project src/Uml.Generator -- snapshot --config projects/garage/.uml
```

Configuration paths resolve from this generator workspace. The snapshot command reads `version`, `source`, `sources` and `ignoreFile`. The analysis command additionally reads `analysis`; diagram/output configuration remains reserved for later layers.

Supported revision selectors inside `source.revision`:

```json
{ "kind": "branch", "name": "main" }
```

```json
{ "kind": "commit", "sha": "17dccad67c15168995d38148bda57cb59afc3a36" }
```

```json
{ "kind": "pull-request", "number": 17 }
```

The PR number above is illustrative. PR inputs use the head commit and its source repository, including forks; they do not use a merge preview or the PR diff alone. The resolved commit and tree are fixed before files are selected.

## Input rules

- `sources.include` and `sources.tests` select repository-relative files using `/`, `*` and `**`. Matching is case-sensitive.
- `.umlignore` supports comments, folder patterns, a leading `/` for root anchoring, and ordered `!` exceptions. It is a documented Git-style subset; escaping, character classes and `?` are rejected. It does not read `.gitignore`.
- Exceptions can restore an ignored file only within the original source/test allowlist.
- `.git`, `.vs`, `bin`, `obj`, `node_modules` and `.cache` path components are always excluded.
- Unmatched input patterns, empty selections, selected symlinks/submodules, truncated trees and excessive sizes fail with an error. Submodule repositories are never expanded.
- Defaults: 500 files, 2 MB per file, 20 MB total. Git tree metadata is listed, but only selected blob contents are downloaded.

Pattern evaluation uses Microsoft's [file globbing library](https://learn.microsoft.com/en-us/dotnet/core/extensions/file-globbing) against filenames in memory, without scanning local application folders.

## Analyse a snapshot

Fetch or reuse the configured GitHub revision, then export code facts:

```powershell
dotnet run --project src/Uml.Generator -- analyze --config projects/garage/.uml
```

To analyse an existing snapshot entirely offline, supply its cache directory name:

```powershell
dotnet run --project src/Uml.Generator -- analyze --config projects/garage/.uml --snapshot 06d3c43c4f94dfb142dde4f307ad3d18c64d9655d465748e52514ba551272ece
```

Offline mode verifies the manifest identity and every blob and requires the configured repository to match. A configured exact commit must also match. A branch or PR is not refreshed or revalidated online in this mode: the report identifies the historical pinned commit. The source selection is the snapshot's recorded file list; current input filters do not change an existing snapshot. Compilation groups select within that list and must account for every C# file.

The report is `output/analysis/<snapshot-identity>/analysis.json`. It contains schema/fingerprint versions, compiler/runtime versions, snapshot provenance, explicit compilation options, types, members, methods, source spans, type relationships, body operations, call resolution, tests, annotations and diagnostics. Re-running replaces that snapshot's report atomically; incomplete writes do not replace a previous report. It is an intermediate analysis document, not a viewer diagram document.

Configure `analysis.compilations` in `.uml` with `id`, `include`, `references` (other compilation IDs), `languageVersion`, `defines`, `globalUsings` and optional `nullable` (default `disable`). The Garage example explicitly separates Vehicle, Garage and Garage.Tests. Sources belong to exactly one group. Overlapping/unassigned sources, empty groups, unknown references and reference cycles fail. Without an analysis section, all selected C# sources form one `source` compilation; this does not reconstruct original project boundaries.

Roslyn reads syntax and resolves symbols in memory. Only the running .NET runtime's trusted framework metadata and configured in-memory compilation references are supplied. The analyser never runs MSBuild, restores packages, loads repository DLLs, executes source generators or tests, or reads a local Garage project. Package dependencies and generated sources absent from the snapshot remain unresolved. Compiler errors are exported with available facts; `IncompleteCompilations` in the command summary identifies affected groups.

See [the analysis contracts and limitations](src/Uml.Generator/Analysis/README.md) before interpreting call or test data.

## Snapshot format and safety

The cache is `.cache/snapshots/<selection-hash>/`. Each snapshot has `manifest.json` and opaque `<git-blob-sha>.blob` files. Original repository paths live in the manifest, rather than being used as local write paths. Identical blobs are downloaded once.

The manifest records requested and content repositories, commit/tree IDs, selected file paths, test classification, byte lengths, Git blob IDs and SHA-256 content hashes. The reader verifies downloads against the pinned tree and verifies cached files before reuse. Snapshot files are marked read-only. Failed or cancelled downloads do not publish an incomplete snapshot; prior snapshots remain intact.

`SnapshotStore.ReadFileAsync` provides verified bytes to the future analyser. The repository layer does not parse, build, restore, execute or modify downloaded code. It never opens your local Garage checkout and performs GitHub GET requests only. No Git subprocesses, pushes or pull-request modifications exist in this layer.

Cache paths containing directory/file links are rejected. Snapshots are passive data: Git executable modes are not applied, submodules/links are not followed, and Git LFS pointers are retained as committed blob data rather than expanded through another service.

## Authentication

Connect a dedicated fine-grained token using the local setup screen:

```powershell
dotnet run --project src/Uml.Generator -- login --config projects/garage/.uml
```

Open `http://127.0.0.1:4182`. On GitHub, choose **Only select repositories**, select **Garage-v2**, and grant **Contents: read** and **Pull requests: read**. Metadata read access is implicit. Do not add write permissions. The setup screen provides a GitHub link with read permission defaults; repository selection still happens on GitHub. See [GitHub's fine-grained token guide](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens).

Click **Connect securely** and paste the token into the password field of the native Windows prompt. The backend checks GitHub identity and repository visibility, then saves the dedicated connection in Windows Credential Manager. This check does not inspect the token's complete permission grant: the read-only restriction must be selected on GitHub. Removing the connection deletes this app's local saved credential; revocation happens on GitHub.

The browser receives no token, and has no credential input or browser credential storage. Mutation requests to the loopback setup server require its session header and same origin. Existing GitHub CLI/OAuth credentials are never reused, and anonymous fallback is disabled. A dedicated `UML_GITHUB_TOKEN` process environment variable is an optional backend-only alternative; classic PATs and OAuth tokens are rejected. Saved per-repository credentials take precedence. Do not put credentials in `.uml`, command-line arguments, chat or frontend code. Tokens are not written to manifests or printed by the command.

The client cannot reduce permissions on an existing token; its implementation only sends GET requests. Redirects are disabled by the command. Commit pinning and blob verification provide snapshot consistency; signed-commit enforcement and branch protection policies are not implemented. A production hosted service would use a GitHub App with installation credentials instead of this personal Windows connection. See GitHub's [tree API](https://docs.github.com/en/rest/git/trees) for content-read permission and truncation behavior.

## Build and tests

Requires .NET SDK 10. Dependencies are pinned by project references and `packages.lock.json` files.

```powershell
dotnet build Uml.Generator.sln -m:1
dotnet test Uml.Generator.sln -m:1
```

Repository tests use fake HTTP responses and isolated generator-cache directories. They do not require GitHub credentials or read/write a local Garage checkout. They cover pinning, PR forks, filters, limits, integrity, cancellation, cache reuse and passive storage. Live repository verification is a separate manual check.

Configuration, caches and output belong to this product. Accepted diagrams stay in the viewer product. The next milestone is extracting diagram definitions from the analysis records.

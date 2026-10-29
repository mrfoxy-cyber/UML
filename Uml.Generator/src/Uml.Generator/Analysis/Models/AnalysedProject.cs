using Uml.Generator.Repository;

namespace Uml.Generator.Analysis.Models;

public sealed record AnalysedProject(
    int Version,
    int FingerprintVersion,
    string CompilerVersion,
    string FrameworkVersion,
    SnapshotManifest Snapshot,
    IReadOnlyList<AnalysedCompilation> Compilations);

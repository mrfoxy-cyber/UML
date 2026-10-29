using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.Text;
using Microsoft.Extensions.FileSystemGlobbing;
using Uml.Generator.Analysis.Input;

namespace Uml.Generator.Analysis.CSharp;

internal sealed class CompilationBuilder
{
    public IReadOnlyDictionary<string, CSharpCompilation> Build(
        IReadOnlyDictionary<string, SourceText> sources, AnalysisOptions options, CancellationToken cancellationToken)
    {
        if (options.Compilations.Count == 0) throw new InvalidDataException("Configure at least one analysis compilation.");
        var groups = new Dictionary<string, Input.CompilationOptions>(StringComparer.Ordinal);
        foreach (var group in options.Compilations)
        {
            if (string.IsNullOrWhiteSpace(group.Id) || group.Id.Length > 80 || group.Id.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not '-' and not '_') || !groups.TryAdd(group.Id, group))
                throw new InvalidDataException("Compilation IDs must be unique names containing letters, digits, - or _.");
        }
        var completed = new Dictionary<string, CSharpCompilation>(StringComparer.Ordinal);
        var visiting = new HashSet<string>(StringComparer.Ordinal);
        var owners = new Dictionary<string, string>(StringComparer.Ordinal);
        var framework = FrameworkReferences();

        CSharpCompilation BuildGroup(string id)
        {
            cancellationToken.ThrowIfCancellationRequested();
            if (completed.TryGetValue(id, out var existing)) return existing;
            if (!groups.TryGetValue(id, out var group)) throw new InvalidDataException("Unknown compilation reference: " + id);
            if (!visiting.Add(id)) throw new InvalidDataException("Compilation references contain a cycle at " + id);
            var matcher = new Matcher(StringComparison.Ordinal);
            if (group.Include.Count == 0) throw new InvalidDataException("Compilation needs include patterns: " + id);
            foreach (var pattern in group.Include)
            {
                if (string.IsNullOrWhiteSpace(pattern) || pattern.StartsWith('/') || pattern.Contains('\\') || pattern.Split('/').Contains(".."))
                    throw new InvalidDataException("Compilation patterns must be repository-relative.");
                matcher.AddInclude(pattern);
            }
            var files = matcher.Match(sources.Keys).Files.Select(file => file.Path).Order(StringComparer.Ordinal).ToArray();
            if (files.Length == 0) throw new InvalidDataException("Compilation matches no snapshot source files: " + id);
            if (!LanguageVersionFacts.TryParse(group.LanguageVersion, out var language))
                throw new InvalidDataException("Unsupported C# language version: " + group.LanguageVersion);
            if (group.Defines.Any(value => !SyntaxFacts.IsValidIdentifier(value)))
                throw new InvalidDataException("Conditional symbols must be C# identifiers.");
            var parseOptions = new CSharpParseOptions(language, preprocessorSymbols: group.Defines);
            var trees = new List<SyntaxTree>();
            foreach (var file in files)
            {
                if (!owners.TryAdd(file, id)) throw new InvalidDataException("Source belongs to multiple compilations: " + file);
                trees.Add(CSharpSyntaxTree.ParseText(sources[file], parseOptions, file, cancellationToken));
            }
            if (group.GlobalUsings.Count > 0)
            {
                foreach (var name in group.GlobalUsings)
                    if (name.Split('.').Any(part => !SyntaxFacts.IsValidIdentifier(part)))
                        throw new InvalidDataException("Global usings must be namespace names.");
                trees.Add(CSharpSyntaxTree.ParseText(string.Join("\n", group.GlobalUsings.Select(name => "global using " + name + ";")),
                    parseOptions, "<configured-global-usings>"));
            }
            var references = framework.Concat(group.References.Select(reference => (MetadataReference)BuildGroup(reference).ToMetadataReference()));
            if (!Enum.TryParse<NullableContextOptions>(group.Nullable, ignoreCase: true, out var nullable))
                throw new InvalidDataException("Nullable context must be enable, disable, annotations or warnings.");
            var hasEntryPoint = trees.Any(tree => tree.GetRoot(cancellationToken).ChildNodes().Any(node => node is Microsoft.CodeAnalysis.CSharp.Syntax.GlobalStatementSyntax));
            var compilation = CSharpCompilation.Create("uml_" + id, trees, references,
                new CSharpCompilationOptions(hasEntryPoint ? OutputKind.ConsoleApplication : OutputKind.DynamicallyLinkedLibrary,
                    nullableContextOptions: nullable));
            completed.Add(id, compilation);
            visiting.Remove(id);
            return compilation;
        }

        foreach (var id in groups.Keys) BuildGroup(id);
        var omitted = sources.Keys.Where(file => !owners.ContainsKey(file)).ToArray();
        if (omitted.Length > 0) throw new InvalidDataException("Snapshot sources have no analysis compilation: " + string.Join(", ", omitted.Take(5)));
        return completed;
    }

    private static MetadataReference[] FrameworkReferences()
    {
        // Metadata only, from the installed runtime. Never load repository DLLs or run MSBuild.
        var directory = Path.GetDirectoryName(typeof(object).Assembly.Location)!;
        var trusted = AppContext.GetData("TRUSTED_PLATFORM_ASSEMBLIES") as string
            ?? throw new PlatformNotSupportedException("The installed runtime does not expose trusted framework metadata.");
        return trusted.Split(Path.PathSeparator)
            .Where(path => Path.GetDirectoryName(path)!.Equals(directory, StringComparison.OrdinalIgnoreCase)).Order(StringComparer.Ordinal)
            .Select(path => (MetadataReference)MetadataReference.CreateFromFile(path)).ToArray();
    }
}

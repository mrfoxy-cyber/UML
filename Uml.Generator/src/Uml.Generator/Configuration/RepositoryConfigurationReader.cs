using System.Text.Json;
using Uml.Generator.Repository;

namespace Uml.Generator.Configuration;

/// <summary>Reads only the repository/input portion of the .uml configuration.</summary>
public static class RepositoryConfigurationReader
{
    public static SnapshotRequest Load(string configPath, string generatorWorkspace)
    {
        var workspace = Path.GetFullPath(generatorWorkspace);
        var path = Path.GetFullPath(configPath, workspace);
        if (!path.StartsWith(workspace + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new ArgumentException("Keep the .uml configuration inside the generator workspace.");
        }

        SnapshotCachePaths.EnsureNoLinks(path);
        if (new FileInfo(path).Length > 64 * 1024)
        {
            throw new InvalidDataException("Configuration exceeds the 64 KB limit.");
        }

        using var document = JsonDocument.Parse(File.ReadAllText(path), new JsonDocumentOptions { MaxDepth = 32 });
        var root = document.RootElement;
        if (root.GetProperty("version").GetInt32() != 1)
        {
            throw new InvalidDataException("Only generator configuration version 1 is supported.");
        }

        var source = root.GetProperty("source");
        if (source.GetProperty("provider").GetString() != "github")
        {
            throw new InvalidDataException("The repository layer accepts GitHub sources only, not local source folders.");
        }

        var repository = GitHubRepository.Parse(source.GetProperty("repository").GetString() ?? "");
        var revision = ReadRevision(source.GetProperty("revision"));
        var sources = root.GetProperty("sources");
        var include = ReadPatterns(sources, "include");
        var tests = ReadPatterns(sources, "tests");
        var ignoreRules = ReadIgnoreRules(root, Path.GetDirectoryName(path)!);
        return new SnapshotRequest(repository, revision, include, tests, ignoreRules);
    }

    private static RepositoryRevision ReadRevision(JsonElement revision)
    {
        return revision.GetProperty("kind").GetString() switch
        {
            "branch" => new BranchRevision(revision.GetProperty("name").GetString() ?? ""),
            "commit" => new CommitRevision(revision.GetProperty("sha").GetString() ?? ""),
            "pull-request" => new PullRequestRevision(revision.GetProperty("number").GetInt32()),
            _ => throw new InvalidDataException("Revision kind must be branch, commit or pull-request.")
        };
    }

    private static string[] ReadPatterns(JsonElement sources, string name)
    {
        if (!sources.TryGetProperty(name, out var values)) return [];
        return values.EnumerateArray().Select(value => value.GetString()
            ?? throw new InvalidDataException("Input patterns must be strings.")).ToArray();
    }

    private static string[] ReadIgnoreRules(JsonElement root, string configDirectory)
    {
        if (!root.TryGetProperty("ignoreFile", out var value)) return [];
        var name = value.GetString() ?? throw new InvalidDataException("ignoreFile must be a relative path.");
        var path = Path.GetFullPath(name, configDirectory);
        if (!path.StartsWith(configDirectory + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException("The ignore file must stay inside its configuration directory.");
        }

        SnapshotCachePaths.EnsureNoLinks(path);
        if (new FileInfo(path).Length > 64 * 1024)
        {
            throw new InvalidDataException("Ignore file exceeds the 64 KB limit.");
        }

        return File.ReadAllLines(path);
    }
}

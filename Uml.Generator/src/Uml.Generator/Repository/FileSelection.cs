using Microsoft.Extensions.FileSystemGlobbing;

namespace Uml.Generator.Repository;

internal sealed class FileSelection
{
    private static readonly HashSet<string> BlockedDirectories = new(StringComparer.OrdinalIgnoreCase)
    {
        ".git", ".vs", "bin", "obj", "node_modules", ".cache"
    };

    private readonly Matcher application = new(StringComparison.Ordinal);
    private readonly Matcher tests = new(StringComparison.Ordinal);
    private readonly Matcher allowed = new(StringComparison.Ordinal, preserveFilterOrder: true);
    private readonly IReadOnlyList<string> inputPatterns;

    public FileSelection(SnapshotRequest request)
    {
        inputPatterns = request.Include.Concat(request.TestIncludes).ToArray();
        if (inputPatterns.Count is < 1 or > 100)
        {
            throw new ArgumentException("Select between 1 and 100 source/test patterns.");
        }

        foreach (var pattern in request.Include) application.AddInclude(ValidatePattern(pattern));
        foreach (var pattern in request.TestIncludes) tests.AddInclude(ValidatePattern(pattern));

        allowed.AddInclude("**/*");
        foreach (var line in request.IgnoreRules)
        {
            AddIgnoreRule(line);
        }
    }

    public IReadOnlyList<SelectedRepositoryFile> Select(RepositoryTree tree, SnapshotLimits limits)
    {
        if (tree.Truncated)
        {
            throw new InvalidDataException("GitHub returned a truncated tree. A complete file selection cannot be guaranteed.");
        }

        var result = new List<SelectedRepositoryFile>();
        var paths = new HashSet<string>(StringComparer.Ordinal);
        long totalBytes = 0;

        foreach (var entry in tree.Entries.OrderBy(entry => entry.Path, StringComparer.Ordinal))
        {
            if (entry.Path.Split('/').Any(BlockedDirectories.Contains)) continue;

            var isTest = tests.Match(entry.Path).HasMatches;
            if ((!isTest && !application.Match(entry.Path).HasMatches) || !allowed.Match(entry.Path).HasMatches)
            {
                continue;
            }

            if (entry.Type == "tree") continue;
            ValidatePath(entry.Path);
            if (entry.Type != "blob" || entry.Mode is not ("100644" or "100755"))
            {
                throw new InvalidDataException($"Selected entry is a link or submodule: {entry.Path}. Links are not followed.");
            }

            if (!paths.Add(entry.Path)) throw new InvalidDataException("Duplicate repository path: " + entry.Path);
            if (entry.Size < 0 || entry.Size > limits.MaxFileBytes)
            {
                throw new InvalidDataException("Selected file exceeds the size limit: " + entry.Path);
            }

            totalBytes += entry.Size;
            if (result.Count >= limits.MaxFiles || totalBytes > limits.MaxTotalBytes)
            {
                throw new InvalidDataException("The selected snapshot exceeds the file count or total size limit.");
            }

            result.Add(new SelectedRepositoryFile(entry, isTest));
        }

        foreach (var pattern in inputPatterns)
        {
            var matcher = new Matcher(StringComparison.Ordinal).AddInclude(pattern);
            if (!tree.Entries.Any(entry => entry.Type != "tree" && matcher.Match(entry.Path).HasMatches))
            {
                throw new InvalidDataException("Input pattern matched no repository files: " + pattern);
            }
        }

        if (result.Count == 0) throw new InvalidDataException("No files remain after applying the input and ignore rules.");
        return result;
    }

    private void AddIgnoreRule(string line)
    {
        var pattern = line.Trim();
        if (pattern.Length == 0 || pattern.StartsWith('#')) return;

        var include = pattern.StartsWith('!');
        if (include) pattern = pattern[1..];
        var anchored = pattern.StartsWith('/');
        pattern = ValidatePattern(pattern.Trim('/'));
        if (!anchored && !pattern.Contains('/')) pattern = "**/" + pattern;

        foreach (var expanded in new[] { pattern, pattern + "/**/*" })
        {
            if (include) allowed.AddInclude(expanded);
            else allowed.AddExclude(expanded);
        }
    }

    private static string ValidatePattern(string pattern)
    {
        if (string.IsNullOrWhiteSpace(pattern) || pattern.Length > 300 ||
            pattern.StartsWith('/') || pattern.Contains('\\') ||
            pattern.IndexOfAny(['?', '[', ']', '{', '}', ':']) >= 0 ||
            pattern.Split('/').Any(part => part is ".." or "." or ""))
        {
            throw new ArgumentException("Use repository-relative patterns with /, * and **: " + pattern);
        }

        return pattern;
    }

    private static void ValidatePath(string path)
    {
        if (path.Contains('\\') || path.Any(char.IsControl) ||
            path.Split('/').Any(part => part is "." or ".." or ""))
        {
            throw new InvalidDataException("Repository contains a non-canonical path.");
        }
    }
}

namespace Uml.Generator.Repository;

internal sealed class SnapshotCachePaths
{
    public string Root { get; }

    public SnapshotCachePaths(string generatorWorkspace)
    {
        Root = Path.GetFullPath(Path.Combine(generatorWorkspace, ".cache", "snapshots"));
        EnsureNoLinks(Root);
    }

    public string Snapshot(string key)
    {
        if (key.Length != 64 || key.Any(c => !char.IsAsciiHexDigit(c)))
        {
            throw new InvalidDataException("Invalid snapshot cache identity.");
        }

        return WithinRoot(key);
    }

    public string NewStagingDirectory()
    {
        Directory.CreateDirectory(Root);
        EnsureNoLinks(Root);
        var directory = WithinRoot(".pending-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(directory);
        return directory;
    }

    public void RemoveStagingDirectory(string directory)
    {
        var fullPath = WithinRoot(Path.GetFileName(directory));
        if (fullPath != Path.GetFullPath(directory) || !Path.GetFileName(directory).StartsWith(".pending-"))
        {
            throw new InvalidDataException("Refusing to remove a directory not owned by this snapshot operation.");
        }

        foreach (var file in Directory.EnumerateFileSystemEntries(fullPath))
        {
            EnsureNoLinks(file);
            if (Directory.Exists(file)) throw new InvalidDataException("Unexpected subdirectory in snapshot staging.");
            File.SetAttributes(file, FileAttributes.Normal);
            File.Delete(file);
        }

        Directory.Delete(fullPath);
    }

    public static void EnsureNoLinks(string path)
    {
        for (var current = Path.GetFullPath(path); current != null; current = Path.GetDirectoryName(current))
        {
            FileAttributes attributes;
            try { attributes = File.GetAttributes(current); }
            catch (FileNotFoundException) { continue; }
            catch (DirectoryNotFoundException) { continue; }

            if ((attributes & FileAttributes.ReparsePoint) != 0)
            {
                throw new InvalidDataException("Snapshot cache paths cannot contain directory/file links.");
            }
        }
    }

    private string WithinRoot(string name)
    {
        var path = Path.GetFullPath(Path.Combine(Root, name));
        if (!path.StartsWith(Root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException("Snapshot path leaves the generator cache.");
        }

        EnsureNoLinks(path);
        return path;
    }
}

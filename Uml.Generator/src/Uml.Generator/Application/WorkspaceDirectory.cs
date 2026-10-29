namespace Uml.Generator.Application;

internal static class WorkspaceDirectory
{
    public static string Find()
    {
        foreach (var start in new[] { Directory.GetCurrentDirectory(), AppContext.BaseDirectory })
        {
            for (var folder = new DirectoryInfo(start); folder != null; folder = folder.Parent)
            {
                if (File.Exists(Path.Combine(folder.FullName, "Uml.Generator.sln")))
                {
                    return folder.FullName;
                }
            }
        }

        throw new DirectoryNotFoundException("Run from the Uml.Generator workspace.");
    }
}

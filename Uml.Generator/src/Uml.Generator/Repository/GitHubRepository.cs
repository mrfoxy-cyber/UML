namespace Uml.Generator.Repository;

public sealed record GitHubRepository(string Owner, string Name)
{
    public string FullName => $"{Owner}/{Name}";

    public static GitHubRepository Parse(string value)
    {
        var parts = value.Split('/');
        if (parts.Length != 2 || parts.Any(part =>
                string.IsNullOrWhiteSpace(part) || part.Length > 100 ||
                part is "." or ".." ||
                part.Any(c => !char.IsAsciiLetterOrDigit(c) && c is not '-' and not '_' and not '.')))
        {
            throw new ArgumentException("Use a GitHub repository name in owner/repository form.", nameof(value));
        }

        return new GitHubRepository(parts[0], parts[1]);
    }
}

namespace Uml.Generator.Authentication;

public static class FineGrainedToken
{
    public static void Require(string token)
    {
        if (!token.StartsWith("github_pat_", StringComparison.Ordinal) ||
            token.Length is < 12 or > 512 || token.Any(char.IsWhiteSpace) || token.Any(char.IsControl))
        {
            throw new ArgumentException(
                "Use a dedicated fine-grained token with read-only permissions. " +
                "Classic tokens and GitHub CLI/OAuth credentials are not accepted.");
        }
    }
}

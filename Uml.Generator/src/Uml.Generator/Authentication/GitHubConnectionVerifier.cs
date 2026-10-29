using Uml.Generator.Repository;

namespace Uml.Generator.Authentication;

/// <summary>Checks identity and repository visibility, without downloading source files.</summary>
public sealed class GitHubConnectionVerifier(HttpClient client) : IGitHubConnectionVerifier
{
    public async Task<string> VerifyAsync(
        GitHubRepository repository,
        string token,
        CancellationToken cancellationToken)
    {
        FineGrainedToken.Require(token);
        var api = new GitHubApi(client, token);
        using var user = await api.GetJsonAsync("user", 256 * 1024, cancellationToken);
        var login = GitHubApi.RequiredString(user.RootElement, "login");
        var name = GitHubRepository.Parse(repository.FullName);
        using var repo = await api.GetJsonAsync(
            $"repos/{Uri.EscapeDataString(name.Owner)}/{Uri.EscapeDataString(name.Name)}",
            512 * 1024, cancellationToken);
        if (!GitHubApi.RequiredString(repo.RootElement, "full_name").Equals(name.FullName, StringComparison.OrdinalIgnoreCase))
        {
            throw new InvalidDataException("GitHub returned a different repository.");
        }

        return login;
    }
}

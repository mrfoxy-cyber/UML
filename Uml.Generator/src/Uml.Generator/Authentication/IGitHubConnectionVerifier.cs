using Uml.Generator.Repository;

namespace Uml.Generator.Authentication;

public interface IGitHubConnectionVerifier
{
    Task<string> VerifyAsync(GitHubRepository repository, string token, CancellationToken cancellationToken);
}

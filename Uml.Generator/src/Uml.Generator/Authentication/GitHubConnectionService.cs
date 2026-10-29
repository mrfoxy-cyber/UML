using Uml.Generator.Repository;

namespace Uml.Generator.Authentication;

public sealed class GitHubConnectionService(
    IGitHubCredentialStore store,
    IGitHubConnectionVerifier verifier)
{
    public GitHubCredential? SavedConnection(GitHubRepository repository) => store.Read(repository);

    public async Task<string> ConnectAsync(
        GitHubRepository repository,
        string token,
        CancellationToken cancellationToken = default)
    {
        token = token.Trim();
        FineGrainedToken.Require(token);
        var login = await verifier.VerifyAsync(repository, token, cancellationToken);
        cancellationToken.ThrowIfCancellationRequested();
        store.Write(repository, new GitHubCredential(token, "Saved fine-grained token", login));
        return login;
    }

    public void Disconnect(GitHubRepository repository) => store.Delete(repository);

    public static string TokenCreationUrl(GitHubRepository repository)
    {
        var owner = GitHubRepository.Parse(repository.FullName).Owner;
        return "https://github.com/settings/personal-access-tokens/new" +
            "?name=UML%20Generator%20read-only" +
            "&description=Read%20code%20and%20pull-request%20metadata%20for%20UML%20diagrams" +
            "&target_name=" + Uri.EscapeDataString(owner) +
            "&expires_in=30&contents=read&pull_requests=read";
    }
}

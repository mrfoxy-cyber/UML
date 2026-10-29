namespace Uml.Generator.Authentication;

/// <summary>Uses a dedicated repository connection; never inherits the full CLI login.</summary>
public sealed class GitHubCredentialProvider
{
    private readonly IGitHubCredentialStore store;
    private readonly Func<string, string?> readEnvironment;

    public GitHubCredentialProvider()
        : this(new WindowsGitHubCredentialStore(), Environment.GetEnvironmentVariable)
    {
    }

    public GitHubCredentialProvider(
        IGitHubCredentialStore store,
        Func<string, string?> readEnvironment)
    {
        this.store = store;
        this.readEnvironment = readEnvironment;
    }

    public GitHubCredential Get(Repository.GitHubRepository repository)
    {
        var saved = store.Read(repository);
        if (saved != null)
        {
            FineGrainedToken.Require(saved.Token);
            return saved;
        }

        var token = readEnvironment("UML_GITHUB_TOKEN");
        if (!string.IsNullOrWhiteSpace(token))
        {
            FineGrainedToken.Require(token.Trim());
            return new GitHubCredential(token.Trim(), "UML_GITHUB_TOKEN");
        }

        throw new InvalidOperationException(
            "Connect " + repository.FullName + " in the generator's login screen first. " +
            "Run: dotnet run --project src/Uml.Generator -- login --config projects/garage/.uml. " +
            "Anonymous access and reuse of GitHub CLI credentials are disabled.");
    }
}

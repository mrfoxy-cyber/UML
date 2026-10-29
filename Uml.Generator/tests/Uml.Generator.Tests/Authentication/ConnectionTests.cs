using System.Net;
using System.Text;
using System.Text.Json;
using Uml.Generator.Authentication;
using Uml.Generator.Repository;
using Xunit;

namespace Uml.Generator.Tests.Authentication;

public sealed class ConnectionTests
{
    private const string Token = "github_pat_unit_test_secret";
    private static readonly GitHubRepository Repo = GitHubRepository.Parse("acme/garage");

    [Fact]
    public void SavedConnectionTakesPrecedenceOverEnvironment()
    {
        var store = new MemoryStore { Credential = new GitHubCredential(Token, "Saved") };
        var provider = new GitHubCredentialProvider(store, _ => throw new Exception("Environment must not be read."));
        Assert.Same(store.Credential, provider.Get(Repo));
        Assert.Equal(Repo, store.LastRepository);
    }

    [Fact]
    public void OnlyDedicatedEnvironmentVariableIsConsidered()
    {
        var provider = new GitHubCredentialProvider(new MemoryStore(), name =>
        {
            Assert.Equal("UML_GITHUB_TOKEN", name);
            return "  " + Token + "  ";
        });
        Assert.Equal(Token, provider.Get(Repo).Token);
    }

    [Fact]
    public void MissingCredentialDoesNotFallBackToAnonymousOrCli()
    {
        var provider = new GitHubCredentialProvider(new MemoryStore(), name =>
            name == "UML_GITHUB_TOKEN" ? null : "gho_existing_broad_account");
        var error = Assert.Throws<InvalidOperationException>(() => provider.Get(Repo));
        Assert.Contains("login --config", error.Message);
    }

    [Theory]
    [InlineData("ghp_classic_secret")]
    [InlineData("gho_oauth_secret")]
    [InlineData("github_pat_bad\r\nvalue")]
    [InlineData("")]
    public void RejectsUnsupportedCredentialsWithoutEchoingThem(string secret)
    {
        var error = Assert.Throws<ArgumentException>(() => FineGrainedToken.Require(secret));
        if (secret.Length > 0) Assert.DoesNotContain(secret, error.Message);
    }

    [Fact]
    public void CredentialSerializationAndDisplayDoNotExposeSecret()
    {
        var credential = new GitHubCredential(Token, "Saved", "alice");
        Assert.DoesNotContain(Token, JsonSerializer.Serialize(credential));
        Assert.DoesNotContain(Token, credential.ToString());
    }

    [Fact]
    public async Task SuccessfulVerificationSavesDedicatedRepositoryConnection()
    {
        var store = new MemoryStore();
        var verifier = new Verifier((repository, token, _) =>
        {
            Assert.Equal(Repo, repository);
            Assert.Equal(Token, token);
            Assert.Null(store.Credential);
            return Task.FromResult("alice");
        });
        var result = await new GitHubConnectionService(store, verifier).ConnectAsync(Repo, Token);
        Assert.Equal("alice", result);
        Assert.Equal(Token, store.Credential!.Token);
        Assert.Equal(Repo, store.LastRepository);
        Assert.Equal("alice", store.Credential.UserName);
    }

    [Fact]
    public async Task FailedVerificationPreservesExistingConnection()
    {
        var saved = new GitHubCredential(Token, "Saved");
        var store = new MemoryStore { Credential = saved };
        var verifier = new Verifier((_, _, _) => throw new HttpRequestException("Denied"));
        await Assert.ThrowsAsync<HttpRequestException>(() =>
            new GitHubConnectionService(store, verifier).ConnectAsync(Repo, "github_pat_replacement"));
        Assert.Same(saved, store.Credential);
    }

    [Fact]
    public async Task CancellationAfterVerificationDoesNotPersistToken()
    {
        using var cancellation = new CancellationTokenSource();
        var store = new MemoryStore();
        var verifier = new Verifier((_, _, _) =>
        {
            cancellation.Cancel();
            return Task.FromResult("alice");
        });
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new GitHubConnectionService(store, verifier).ConnectAsync(Repo, Token, cancellation.Token));
        Assert.Null(store.Credential);
    }

    [Fact]
    public async Task NativePromptCancellationDoesNotVerifyOrSave()
    {
        var store = new MemoryStore();
        var verifier = new Verifier((_, _, _) => throw new Exception("Must not contact GitHub."));
        using var prompt = new GitHubConnectionPrompt(new GitHubConnectionService(store, verifier), () => null);
        Assert.Null(await prompt.ConnectAsync(Repo, CancellationToken.None));
        Assert.Null(store.Credential);
    }

    [Fact]
    public async Task NativePromptReturnsOnlyAccountNameToCaller()
    {
        var store = new MemoryStore();
        var verifier = new Verifier((_, _, _) => Task.FromResult("alice"));
        using var prompt = new GitHubConnectionPrompt(new GitHubConnectionService(store, verifier), () => Token);
        Assert.Equal("alice", await prompt.ConnectAsync(Repo, CancellationToken.None));
        Assert.Equal(Token, store.Credential!.Token);
    }

    [Fact]
    public async Task ConcurrentConnectionCannotOpenSecondPrompt()
    {
        var started = new TaskCompletionSource(TaskCreationOptions.RunContinuationsAsynchronously);
        var release = new TaskCompletionSource<string>(TaskCreationOptions.RunContinuationsAsynchronously);
        var verifier = new Verifier((_, _, _) => { started.SetResult(); return release.Task; });
        using var prompt = new GitHubConnectionPrompt(new GitHubConnectionService(new MemoryStore(), verifier), () => Token);
        var first = prompt.ConnectAsync(Repo, CancellationToken.None);
        await started.Task.WaitAsync(TimeSpan.FromSeconds(5));
        try
        {
            await Assert.ThrowsAsync<InvalidOperationException>(() => prompt.ConnectAsync(Repo, CancellationToken.None));
        }
        finally { release.SetResult("alice"); }
        Assert.Equal("alice", await first);
    }

    [Fact]
    public async Task VerificationUsesOnlyAuthenticatedIdentityAndRepositoryGetRequests()
    {
        using var handler = new VerificationHandler();
        using var http = new HttpClient(handler);
        Assert.Equal("alice", await new GitHubConnectionVerifier(http).VerifyAsync(Repo, Token, CancellationToken.None));
        Assert.Equal(new[] { "/user", "/repos/acme/garage" }, handler.Paths);
    }

    [Fact]
    public void CreationLinkRequestsReadPermissionsAndCorrectOwner()
    {
        var uri = new Uri(GitHubConnectionService.TokenCreationUrl(Repo));
        Assert.Equal("github.com", uri.Host);
        Assert.Contains("target_name=acme", uri.Query);
        Assert.Contains("contents=read", uri.Query);
        Assert.Contains("pull_requests=read", uri.Query);
        Assert.DoesNotContain("=write", uri.Query);
    }

    private sealed class MemoryStore : IGitHubCredentialStore
    {
        public GitHubCredential? Credential { get; set; }
        public GitHubRepository? LastRepository { get; private set; }
        public GitHubCredential? Read(GitHubRepository repository) { LastRepository = repository; return Credential; }
        public void Write(GitHubRepository repository, GitHubCredential credential) { LastRepository = repository; Credential = credential; }
        public void Delete(GitHubRepository repository) { LastRepository = repository; Credential = null; }
    }

    private sealed class Verifier(Func<GitHubRepository, string, CancellationToken, Task<string>> verify) : IGitHubConnectionVerifier
    {
        public Task<string> VerifyAsync(GitHubRepository repository, string token, CancellationToken cancellationToken) =>
            verify(repository, token, cancellationToken);
    }

    private sealed class VerificationHandler : HttpMessageHandler
    {
        public List<string> Paths { get; } = [];
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Equal("https", request.RequestUri!.Scheme);
            Assert.Equal("api.github.com", request.RequestUri.Host);
            Assert.Equal(Token, request.Headers.Authorization?.Parameter);
            Paths.Add(request.RequestUri.AbsolutePath);
            var body = Paths.Count == 1 ? "{\"login\":\"alice\"}" : "{\"full_name\":\"acme/garage\"}";
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
                { Content = new StringContent(body, Encoding.UTF8, "application/json") });
        }
    }
}

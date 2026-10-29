using System.Net;
using System.Text;
using System.Text.Json;
using Uml.Generator.Repository;
using Xunit;

namespace Uml.Generator.Tests.Repository;

public sealed class GitHubRepositoryClientTests
{
    private static readonly string Commit = new('a', 40);
    private static readonly string Tree = new('b', 40);

    [Fact]
    public async Task EncodesBranchNamesAndUsesOnlyAuthenticatedGetRequests()
    {
        using var handler = new ScriptedHandler(request =>
        {
            Assert.Equal(HttpMethod.Get, request.Method);
            Assert.Equal("api.github.com", request.RequestUri!.Host);
            Assert.Empty(request.RequestUri.Query);
            Assert.EndsWith("feature%2Fparking", request.RequestUri.AbsoluteUri);
            Assert.Equal("Bearer", request.Headers.Authorization?.Scheme);
            Assert.Equal("test-token", request.Headers.Authorization?.Parameter);
            return CommitResponse();
        });
        using var http = new HttpClient(handler);
        var client = new GitHubRepositoryClient(http, "test-token");

        var revision = await client.ResolveAsync(GitHubRepository.Parse("acme/garage"), new BranchRevision("feature/parking"));

        Assert.Equal(Commit, revision.CommitSha);
        Assert.Equal(Tree, revision.TreeSha);
        Assert.Equal(1, handler.Requests);
    }

    [Fact]
    public async Task PullRequestsPinTheHeadCommitInTheHeadRepository()
    {
        using var handler = new ScriptedHandler(request =>
        {
            Assert.Equal(HttpMethod.Get, request.Method);
            var path = request.RequestUri!.AbsolutePath;
            if (path == "/repos/acme/garage/pulls/17")
            {
                return Json(new { head = new { sha = Commit, repo = new { full_name = "contributor/garage" } } });
            }

            Assert.Equal("/repos/contributor/garage/commits/" + Commit, path);
            return CommitResponse();
        });
        using var http = new HttpClient(handler);
        var result = await new GitHubRepositoryClient(http, "test-token").ResolveAsync(
            GitHubRepository.Parse("acme/garage"), new PullRequestRevision(17));

        Assert.Equal("contributor/garage", result.ContentRepository.FullName);
        Assert.Equal("acme/garage", result.RequestedRepository.FullName);
        Assert.Equal(2, handler.Requests);
    }

    [Fact]
    public async Task RejectsMissingForkRepositories()
    {
        using var handler = new ScriptedHandler(_ => Json(new { head = new { sha = Commit, repo = (object?)null } }));
        using var http = new HttpClient(handler);
        await Assert.ThrowsAsync<InvalidDataException>(() => new GitHubRepositoryClient(http, "test-token").ResolveAsync(
            GitHubRepository.Parse("acme/garage"), new PullRequestRevision(17)));
        Assert.Equal(1, handler.Requests);
    }

    [Fact]
    public async Task RejectsResponsesThatDoNotMatchTheRequestedCommit()
    {
        using var handler = new ScriptedHandler(_ => CommitResponse());
        using var http = new HttpClient(handler);
        await Assert.ThrowsAsync<InvalidDataException>(() => new GitHubRepositoryClient(http, "test-token").ResolveAsync(
            GitHubRepository.Parse("acme/garage"), new CommitRevision(new string('c', 40))));
    }

    [Fact]
    public async Task DownloadsAndVerifiesTheGitBlob()
    {
        const string sha = "ce013625030ba8dba906f756967f9e9ca394464a";
        using var handler = new ScriptedHandler(request =>
        {
            Assert.EndsWith("/git/blobs/" + sha, request.RequestUri!.AbsolutePath);
            return Json(new { sha, encoding = "base64", size = 6, content = Convert.ToBase64String("hello\n"u8) });
        });
        using var http = new HttpClient(handler);
        var bytes = await new GitHubRepositoryClient(http, "test-token").GetBlobAsync(GitHubRepository.Parse("acme/garage"), sha, 100);
        Assert.Equal("hello\n", Encoding.UTF8.GetString(bytes));
    }

    [Fact]
    public async Task RejectsBlobContentWithAForgedIdentity()
    {
        using var handler = new ScriptedHandler(_ => Json(new
        {
            sha = Commit, encoding = "base64", size = 6, content = Convert.ToBase64String("hello\n"u8)
        }));
        using var http = new HttpClient(handler);
        await Assert.ThrowsAsync<InvalidDataException>(() => new GitHubRepositoryClient(http, "test-token").GetBlobAsync(
            GitHubRepository.Parse("acme/garage"), Commit, 100));
    }

    [Theory]
    [InlineData(401)]
    [InlineData(403)]
    [InlineData(429)]
    [InlineData(302)]
    public async Task ReportsAccessLimitsAndDoesNotFollowRedirectResponses(int status)
    {
        using var handler = new ScriptedHandler(_ => new HttpResponseMessage((HttpStatusCode)status));
        using var http = new HttpClient(handler);
        var error = await Assert.ThrowsAsync<HttpRequestException>(() => new GitHubRepositoryClient(http, "test-token").ResolveAsync(
            GitHubRepository.Parse("acme/garage"), new BranchRevision("main")));
        Assert.Contains(status.ToString(), error.Message);
        Assert.Equal(1, handler.Requests);
    }

    [Theory]
    [InlineData("https://github.com/acme/garage")]
    [InlineData("acme/../garage")]
    [InlineData("../garage")]
    [InlineData("acme/garage?token=secret")]
    public void RepositoryNamesCannotInjectUrlsOrPaths(string value)
    {
        Assert.Throws<ArgumentException>(() => GitHubRepository.Parse(value));
    }

    private static HttpResponseMessage CommitResponse()
    {
        return Json(new { sha = Commit, commit = new { tree = new { sha = Tree } } });
    }

    private static HttpResponseMessage Json(object value)
    {
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(JsonSerializer.Serialize(value), Encoding.UTF8, "application/json")
        };
    }

    private sealed class ScriptedHandler(Func<HttpRequestMessage, HttpResponseMessage> respond) : HttpMessageHandler
    {
        public int Requests { get; private set; }

        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            cancellationToken.ThrowIfCancellationRequested();
            Requests++;
            return Task.FromResult(respond(request));
        }
    }
}

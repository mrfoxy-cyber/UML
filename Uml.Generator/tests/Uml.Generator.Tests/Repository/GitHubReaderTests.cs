using System.Text;
using Uml.Generator.Repository;
using Xunit;

namespace Uml.Generator.Tests.Repository;

public sealed class GitHubReaderTests
{
    [Fact]
    public async Task ReadsOnlyAllowedFilesAndRecordsTestInputs()
    {
        var fixture = new RepositoryFixture();
        var model = fixture.Client.Add("App/Garage.cs", "class Garage {}");
        var tests = fixture.Client.Add("Tests/ParkTests.cs", "class ParkTests {}");
        fixture.Client.Add("Secrets/Private.cs", "do not download");
        fixture.Client.Add("App/obj/Generated.cs", "build output");

        var result = await fixture.Reader.ReadAsync(fixture.Request(tests: ["Tests/**/*.cs"]));

        Assert.Equal(new[] { model.Sha, tests.Sha }, fixture.Client.Downloaded);
        Assert.Equal(fixture.Client.Revision.CommitSha, result.Manifest.CommitSha);
        Assert.Equal(2, result.Manifest.Files.Count);
        Assert.False(result.Manifest.Files[0].IsTest);
        Assert.True(result.Manifest.Files[1].IsTest);
        Assert.Equal("class Garage {}", Encoding.UTF8.GetString(
            await fixture.Store.ReadFileAsync(result, result.Manifest.Files[0])));
    }

    [Fact]
    public async Task IgnoreExceptionsCannotExpandTheInputAllowlist()
    {
        var fixture = new RepositoryFixture();
        var included = fixture.Client.Add("App/Keep.cs", "keep");
        fixture.Client.Add("App/Drop.cs", "drop");
        fixture.Client.Add("Other/Outside.cs", "outside");

        var result = await fixture.Reader.ReadAsync(fixture.Request(
            ignores: ["App/*.cs", "!App/Keep.cs", "!Other/Outside.cs"]));

        Assert.Equal("App/Keep.cs", Assert.Single(result.Manifest.Files).Path);
        Assert.Equal(included.Sha, Assert.Single(fixture.Client.Downloaded));
    }

    [Fact]
    public async Task UsesThePinnedTreeAndForkRepository()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Revision = fixture.Client.Revision with { ContentRepository = GitHubRepository.Parse("contributor/garage") };
        fixture.Client.Add("App/Garage.cs", "content from fork");

        var result = await fixture.Reader.ReadAsync(fixture.Request());

        Assert.Equal(("contributor/garage", fixture.Client.Revision.TreeSha), Assert.Single(fixture.Client.TreeRequests));
        Assert.Equal("acme/garage", result.Manifest.Repository);
        Assert.Equal("contributor/garage", result.Manifest.ContentRepository);
    }

    [Theory]
    [InlineData("../App/*.cs")]
    [InlineData("/App/*.cs")]
    [InlineData("App\\*.cs")]
    [InlineData("https://example.com/*.cs")]
    public async Task RejectsNonRepositoryPatternsBeforeDownloading(string pattern)
    {
        var fixture = new RepositoryFixture();
        await Assert.ThrowsAsync<ArgumentException>(() => fixture.Reader.ReadAsync(fixture.Request(include: [pattern])));
        Assert.Empty(fixture.Client.Downloaded);
    }

    [Fact]
    public async Task RejectsTruncatedTreesBeforeDownloading()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/Garage.cs", "source");
        fixture.Client.Truncated = true;

        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Reader.ReadAsync(fixture.Request()));

        Assert.Empty(fixture.Client.Downloaded);
        Assert.Empty(fixture.CacheDirectories());
    }

    [Fact]
    public async Task RejectsATreeFromAnotherCommit()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.TreeShaOverride = new string('c', 40);
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Reader.ReadAsync(fixture.Request()));
        Assert.Empty(fixture.Client.Downloaded);
    }

    [Theory]
    [InlineData("120000")]
    [InlineData("160000")]
    public async Task DoesNotFollowSelectedLinksOrSubmodules(string mode)
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/Linked.cs", "link target", mode);
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Reader.ReadAsync(fixture.Request()));
        Assert.Empty(fixture.Client.Downloaded);
    }

    [Fact]
    public async Task EnforcesFileAndByteLimitsBeforeDownloading()
    {
        var fixture = new RepositoryFixture(new SnapshotLimits { MaxFiles = 1, MaxFileBytes = 8, MaxTotalBytes = 8 });
        fixture.Client.Add("App/A.cs", "1234");
        fixture.Client.Add("App/B.cs", "5678");
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Reader.ReadAsync(fixture.Request()));
        Assert.Empty(fixture.Client.Downloaded);
    }

    [Fact]
    public async Task ReportsMissingPatternsInsteadOfSilentlyDroppingInputs()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/Garage.cs", "source");
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Reader.ReadAsync(
            fixture.Request(include: ["App/**/*.cs", "Missing/**/*.cs"])));
        Assert.Empty(fixture.Client.Downloaded);
    }

    [Theory]
    [InlineData(2, 10)]
    [InlineData(4, 6)]
    public async Task RejectsOversizedFilesAndCombinedByteCounts(int fileLimit, int totalLimit)
    {
        var fixture = new RepositoryFixture(new SnapshotLimits { MaxFileBytes = fileLimit, MaxTotalBytes = totalLimit });
        fixture.Client.Add("App/A.cs", "1234");
        fixture.Client.Add("App/B.cs", "5678");
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Reader.ReadAsync(fixture.Request()));
        Assert.Empty(fixture.Client.Downloaded);
    }

    [Fact]
    public async Task DownloadsIdenticalBlobsOnlyOnce()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/A.cs", "same content");
        fixture.Client.Add("App/B.cs", "same content");
        var result = await fixture.Reader.ReadAsync(fixture.Request());
        Assert.Equal(2, result.Manifest.Files.Count);
        Assert.Single(fixture.Client.Downloaded);
    }

    [Fact]
    public async Task StoresCodeAsOpaqueBlobsWithoutExecutingIt()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/Danger.csproj", "<Project><Target Name='Run'><Exec Command='never execute'/></Target></Project>");
        var result = await fixture.Reader.ReadAsync(fixture.Request(include: ["App/**/*.csproj"]));
        Assert.Equal(2, Directory.GetFiles(result.Directory).Length);
        Assert.Contains(Directory.GetFiles(result.Directory), path => path.EndsWith(".blob"));
        Assert.DoesNotContain(Directory.GetFiles(result.Directory), path => path.EndsWith(".csproj"));
    }
}

using Uml.Generator.Repository;
using Xunit;

namespace Uml.Generator.Tests.Repository;

public sealed class SnapshotStoreTests
{
    [Fact]
    public async Task ReusesVerifiedSnapshotsWithoutDownloadingBlobsAgain()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/Garage.cs", "source");
        var first = await fixture.Reader.ReadAsync(fixture.Request());
        var second = await fixture.Reader.ReadAsync(fixture.Request());
        Assert.False(first.FromCache);
        Assert.True(second.FromCache);
        Assert.Equal(first.Directory, second.Directory);
        Assert.Single(fixture.Client.Downloaded);
    }

    [Fact]
    public async Task FailedDownloadLeavesNoPublishedOrPartialSnapshot()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/A.cs", "one");
        fixture.Client.FailingBlob = fixture.Client.Add("App/B.cs", "two").Sha;
        await Assert.ThrowsAsync<HttpRequestException>(() => fixture.Reader.ReadAsync(fixture.Request()));
        Assert.Empty(fixture.CacheDirectories());
    }

    [Fact]
    public async Task CancelledDownloadLeavesNoSnapshot()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/Garage.cs", "source");
        fixture.Client.CancelDownload = true;
        await Assert.ThrowsAnyAsync<OperationCanceledException>(() => fixture.Reader.ReadAsync(fixture.Request()));
        Assert.Empty(fixture.CacheDirectories());
    }

    [Fact]
    public async Task RejectsCorruptedDownloads()
    {
        var fixture = new RepositoryFixture();
        var entry = fixture.Client.Add("App/Garage.cs", "source");
        fixture.Client.Blobs[entry.Sha] = "spoof!"u8.ToArray();
        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Reader.ReadAsync(fixture.Request()));
        Assert.Empty(fixture.CacheDirectories());
    }

    [Fact]
    public async Task DetectsSameLengthCacheTampering()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/Garage.cs", "source");
        var snapshot = await fixture.Reader.ReadAsync(fixture.Request());
        var file = Assert.Single(snapshot.Manifest.Files);
        var path = Path.Combine(snapshot.Directory, file.BlobSha + ".blob");
        File.SetAttributes(path, FileAttributes.Normal);
        await File.WriteAllTextAsync(path, "spoof!");

        await Assert.ThrowsAsync<InvalidDataException>(() => fixture.Reader.ReadAsync(fixture.Request()));
        Assert.Single(fixture.Client.Downloaded);
    }

    [Fact]
    public async Task NewCommitsPreserveThePreviousSnapshot()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/Garage.cs", "source");
        var first = await fixture.Reader.ReadAsync(fixture.Request());
        fixture.Client.Revision = fixture.Client.Revision with { CommitSha = new string('c', 40) };
        var second = await fixture.Reader.ReadAsync(fixture.Request());
        Assert.NotEqual(first.Directory, second.Directory);
        Assert.True(Directory.Exists(first.Directory));
        Assert.Equal(2, fixture.CacheDirectories().Length);
    }

    [Fact]
    public async Task TestClassificationIsPartOfTheSnapshotIdentity()
    {
        var fixture = new RepositoryFixture();
        fixture.Client.Add("App/Garage.cs", "source");
        var application = await fixture.Reader.ReadAsync(fixture.Request());
        var tests = await fixture.Reader.ReadAsync(fixture.Request(tests: ["App/**/*.cs"]));
        Assert.NotEqual(application.Directory, tests.Directory);
        Assert.False(Assert.Single(application.Manifest.Files).IsTest);
        Assert.True(Assert.Single(tests.Manifest.Files).IsTest);
    }
}

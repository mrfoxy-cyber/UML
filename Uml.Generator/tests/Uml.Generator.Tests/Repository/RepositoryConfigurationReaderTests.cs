using System.Text.Json;
using Uml.Generator.Configuration;
using Uml.Generator.Repository;
using Xunit;

namespace Uml.Generator.Tests.Repository;

public sealed class RepositoryConfigurationReaderTests
{
    [Fact]
    public void ReadsTheRepositoryConfigurationWithoutOpeningLocalApplicationFolders()
    {
        var fixture = new RepositoryFixture();
        var path = WriteConfig(fixture, "github");
        var result = RepositoryConfigurationReader.Load(path, fixture.Workspace);
        Assert.Equal("acme/garage", result.Repository.FullName);
        Assert.Equal(new PullRequestRevision(17), result.Revision);
        Assert.Equal("App/**/*.cs", Assert.Single(result.Include));
        Assert.Equal("Tests/**/*.cs", Assert.Single(result.TestIncludes));
    }

    [Fact]
    public void RejectsLocalSourceProviders()
    {
        var fixture = new RepositoryFixture();
        var path = WriteConfig(fixture, "folder");
        Assert.Throws<InvalidDataException>(() => RepositoryConfigurationReader.Load(path, fixture.Workspace));
    }

    [Fact]
    public void IgnoreFilesCannotEscapeTheConfigurationDirectory()
    {
        var fixture = new RepositoryFixture();
        var path = WriteConfig(fixture, "github", "../outside/.umlignore");
        Assert.Throws<InvalidDataException>(() => RepositoryConfigurationReader.Load(path, fixture.Workspace));
    }

    private static string WriteConfig(RepositoryFixture fixture, string provider, string ignoreFile = ".umlignore")
    {
        var folder = Path.Combine(fixture.Workspace, "project");
        Directory.CreateDirectory(folder);
        File.WriteAllText(Path.Combine(folder, ".umlignore"), "obj/\n");
        var path = Path.Combine(folder, ".uml");
        File.WriteAllText(path, JsonSerializer.Serialize(new
        {
            version = 1,
            source = new { provider, repository = "acme/garage", revision = new { kind = "pull-request", number = 17 } },
            sources = new { include = new[] { "App/**/*.cs" }, tests = new[] { "Tests/**/*.cs" } },
            ignoreFile
        }));
        return path;
    }
}

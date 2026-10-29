using System.Text.Json.Serialization;

namespace Uml.Generator.Authentication;

public sealed class GitHubCredential(string token, string source, string? userName = null)
{
    [JsonIgnore]
    public string Token { get; } = token;

    public string Source { get; } = source;
    public string? UserName { get; } = userName;

    public override string ToString() => Source;
}

using System.Net.Http.Headers;
using System.Text.Json;

namespace Uml.Generator.Repository;

internal sealed class GitHubApi(HttpClient client, string token)
{
    private static readonly Uri BaseUri = new("https://api.github.com/");
    private readonly string credential = !string.IsNullOrWhiteSpace(token)
        ? token
        : throw new ArgumentException("Authenticated GitHub access requires a credential.");

    public async Task<JsonDocument> GetJsonAsync(
        string relativePath,
        int maximumBytes,
        CancellationToken cancellationToken)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, new Uri(BaseUri, relativePath));
        request.Headers.UserAgent.ParseAdd("Uml.Generator/0.1");
        request.Headers.Accept.ParseAdd("application/vnd.github+json");
        request.Headers.Add("X-GitHub-Api-Version", "2022-11-28");
        try
        {
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", credential);
        }
        catch (FormatException)
        {
            throw new ArgumentException("GitHub credential format is invalid.");
        }

        using var response = await client.SendAsync(
            request, HttpCompletionOption.ResponseHeadersRead, cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException(
                $"GitHub returned HTTP {(int)response.StatusCode}. Check read access and API rate limits.",
                null, response.StatusCode);
        }

        if (response.Content.Headers.ContentLength > maximumBytes)
        {
            throw new InvalidDataException("GitHub response exceeds the permitted size.");
        }

        await using var stream = await response.Content.ReadAsStreamAsync(cancellationToken);
        using var content = new MemoryStream();
        var buffer = new byte[81920];
        int count;
        while ((count = await stream.ReadAsync(buffer, cancellationToken)) != 0)
        {
            if (content.Length + count > maximumBytes)
            {
                throw new InvalidDataException("GitHub response exceeds the permitted size.");
            }

            content.Write(buffer, 0, count);
        }

        return JsonDocument.Parse(content.ToArray(), new JsonDocumentOptions { MaxDepth = 64 });
    }

    public static string RequiredString(JsonElement value, string property)
    {
        if (!value.TryGetProperty(property, out var field) ||
            field.ValueKind != JsonValueKind.String || string.IsNullOrWhiteSpace(field.GetString()))
        {
            throw new InvalidDataException($"GitHub response is missing {property}.");
        }

        return field.GetString()!;
    }
}

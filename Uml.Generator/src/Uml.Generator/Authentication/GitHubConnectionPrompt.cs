using Uml.Generator.Repository;

namespace Uml.Generator.Authentication;

/// <summary>Allows one native connection prompt at a time; no secrets cross the browser API.</summary>
public sealed class GitHubConnectionPrompt(GitHubConnectionService service, Func<string?> readToken) : IDisposable
{
    private readonly SemaphoreSlim gate = new(1, 1);

    public async Task<string?> ConnectAsync(GitHubRepository repository, CancellationToken cancellationToken)
    {
        if (!await gate.WaitAsync(0, cancellationToken))
            throw new InvalidOperationException("A connection window is already open. Finish or cancel it first.");
        try
        {
            var token = await Task.Run(readToken, cancellationToken);
            cancellationToken.ThrowIfCancellationRequested();
            return token == null ? null : await service.ConnectAsync(repository, token, cancellationToken);
        }
        finally
        {
            gate.Release();
        }
    }

    public void Dispose() => gate.Dispose();
}

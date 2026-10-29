using System.Net;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.FileProviders;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Hosting;
using Uml.Generator.Repository;

namespace Uml.Generator.Authentication;

public static class LoginServer
{
    public static async Task RunAsync(GitHubRepository repository, CancellationToken cancellationToken)
    {
        const string address = "http://127.0.0.1:4182";
        using var http = new HttpClient(new HttpClientHandler { AllowAutoRedirect = false })
        {
            Timeout = TimeSpan.FromSeconds(20)
        };
        var service = new GitHubConnectionService(new WindowsGitHubCredentialStore(), new GitHubConnectionVerifier(http));
        using var prompt = new GitHubConnectionPrompt(service, WindowsTokenPrompt.Show);
        var sessionKey = Guid.NewGuid().ToString("N");
        var builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = [] });
        builder.WebHost.UseUrls(address);
        builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 16 * 1024);
        builder.Logging.ClearProviders();
        await using var app = builder.Build();

        app.Use(async (context, next) =>
        {
            context.Response.Headers.CacheControl = "no-store";
            context.Response.Headers.ContentSecurityPolicy =
                "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; " +
                "img-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
            if (context.Request.Host.Host != "127.0.0.1")
            {
                context.Response.StatusCode = 403;
                return;
            }

            if (context.Request.Method != "GET" &&
                (context.Request.Headers["X-Uml-Session"] != sessionKey ||
                 context.Request.Headers.Origin != address))
            {
                context.Response.StatusCode = 403;
                return;
            }

            await next();
        });

        var web = Path.Combine(AppContext.BaseDirectory, "Authentication", "Web");
        app.UseFileServer(new FileServerOptions { FileProvider = new PhysicalFileProvider(web) });

        app.MapGet("/api/session", () =>
        {
            var saved = service.SavedConnection(repository);
            return new
            {
                sessionKey,
                repository = repository.FullName,
                creationUrl = GitHubConnectionService.TokenCreationUrl(repository),
                connected = saved != null,
                login = saved?.UserName
            };
        });

        app.MapPost("/api/connect", async (HttpContext context) =>
        {
            if (context.Request.ContentLength is > 0 || context.Request.Headers.ContainsKey("Transfer-Encoding"))
                return Results.BadRequest(new { error = "Connection entry accepts no browser credentials. Use the Windows prompt." });
            try
            {
                var login = await prompt.ConnectAsync(repository, context.RequestAborted);
                return Results.Ok(new { login, cancelled = login == null });
            }
            catch (HttpRequestException error)
            {
                var message = error.StatusCode switch
                {
                    HttpStatusCode.Unauthorized => "GitHub did not recognize this token. Check it and try again.",
                    HttpStatusCode.Forbidden => "GitHub refused access. Check the selected repository, permissions, approval status and rate limit.",
                    HttpStatusCode.NotFound => "This connection cannot see the selected repository. Check repository access on GitHub.",
                    _ => "Could not reach GitHub. Check your connection and try again."
                };
                return Results.BadRequest(new { error = message });
            }
            catch (OperationCanceledException) when (!context.RequestAborted.IsCancellationRequested)
            {
                return Results.BadRequest(new { error = "GitHub verification timed out. Try again." });
            }
            catch (Exception error) when (error is ArgumentException or InvalidOperationException or InvalidDataException or PlatformNotSupportedException)
            {
                return Results.BadRequest(new { error = error.Message });
            }
        });

        app.MapPost("/api/disconnect", () =>
        {
            service.Disconnect(repository);
            return Results.Ok(new { disconnected = true });
        });

        Console.WriteLine("GitHub connection screen: " + address);
        Console.WriteLine("Create a dedicated fine-grained token. Existing GitHub CLI credentials are not reused.");
        await app.StartAsync(cancellationToken);
        await app.WaitForShutdownAsync(cancellationToken);
    }

}

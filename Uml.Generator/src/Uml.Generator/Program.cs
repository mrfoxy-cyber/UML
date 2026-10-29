using Uml.Generator.Application;
using Uml.Generator.Authentication;
using Uml.Generator.Configuration;

string? snapshotKey = null;
if (args is ["analyze", "--config", _, "--snapshot", var key])
{
    snapshotKey = key;
    args = args[..3];
}
if (args is not [var command, "--config", var configPath] || command is not ("snapshot" or "login" or "analyze"))
{
    Console.WriteLine("UML Generator: snapshot --config projects/garage/.uml");
    Console.WriteLine("Connect GitHub: login --config projects/garage/.uml");
    Console.WriteLine("Analyze code: analyze --config projects/garage/.uml [--snapshot <cache-identity>]");
    Console.WriteLine("Reads pinned GitHub snapshots and exports analysis facts. Diagram extraction is not implemented yet.");
    return args.Length == 0 || args is ["--help"] ? 0 : 2;
}

using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, eventArgs) =>
{
    eventArgs.Cancel = true;
    cancellation.Cancel();
};

try
{
    if (command == "login")
    {
        var request = RepositoryConfigurationReader.Load(configPath, WorkspaceDirectory.Find());
        await LoginServer.RunAsync(request.Repository, cancellation.Token);
    }
    else if (command == "analyze")
    {
        await new AnalyzeCommand().RunAsync(configPath, snapshotKey, cancellation.Token);
    }
    else
    {
        await new SnapshotCommand().RunAsync(configPath, cancellation.Token);
    }
    return 0;
}
catch (OperationCanceledException)
{
    Console.Error.WriteLine(command == "login" ? "Connection screen closed." : "Operation cancelled. No incomplete result was published.");
    return 130;
}
catch (Exception error)
{
    Console.Error.WriteLine(command + " failed: " + error.Message);
    return 2;
}

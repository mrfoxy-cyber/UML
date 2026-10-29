using System.Text.Json;
using System.Text.Json.Serialization;
using Uml.Generator.Analysis.Input;

namespace Uml.Generator.Configuration;

public static class AnalysisConfigurationReader
{
    public static AnalysisOptions Load(string configPath, string generatorWorkspace)
    {
        // Reuse the configuration boundary checks, including links and size limits.
        RepositoryConfigurationReader.Load(configPath, generatorWorkspace);
        using var document = JsonDocument.Parse(File.ReadAllText(Path.GetFullPath(configPath, generatorWorkspace)));
        if (!document.RootElement.TryGetProperty("analysis", out var analysis)) return AnalysisOptions.Default;
        var options = analysis.Deserialize<AnalysisOptions>(new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
        }) ?? throw new InvalidDataException("analysis configuration cannot be null.");
        if (options.Compilations == null || options.Compilations.Any(group => group == null || group.Id == null ||
            group.Include == null || group.References == null || group.LanguageVersion == null || group.Defines == null || group.GlobalUsings == null ||
            group.Include.Concat(group.References).Concat(group.Defines).Concat(group.GlobalUsings).Any(value => value == null)))
            throw new InvalidDataException("Each compilation needs id, include, references, languageVersion, defines and globalUsings.");
        return options;
    }
}

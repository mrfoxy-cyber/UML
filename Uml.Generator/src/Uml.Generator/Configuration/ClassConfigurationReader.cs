using System.Text.Json;
using System.Text.Json.Serialization;
using Uml.Generator.Extraction.Class;

namespace Uml.Generator.Configuration;

public static class ClassConfigurationReader
{
    public static IReadOnlyList<ClassDiagramDefinition> Load(string configPath, string workspace)
    {
        RepositoryConfigurationReader.Load(configPath, workspace);
        using var document = JsonDocument.Parse(File.ReadAllText(Path.GetFullPath(configPath, workspace)));
        if (!document.RootElement.TryGetProperty("diagrams", out var diagrams)) throw new InvalidDataException("Configure at least one class diagram.");
        var definitions = diagrams.Deserialize<ClassDiagramDefinition[]>(new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase, UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow
        }) ?? throw new InvalidDataException("Diagram definitions cannot be null.");
        if (definitions.Length == 0 || definitions.Any(definition => definition == null) ||
            definitions.Select(definition => definition.Id).Distinct(StringComparer.Ordinal).Count() != definitions.Length)
            throw new InvalidDataException("Diagram definitions must be nonempty and have unique IDs.");
        return definitions;
    }
}

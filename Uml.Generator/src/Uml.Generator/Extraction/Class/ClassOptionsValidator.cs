using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Extraction.Class;

internal static class ClassOptionsValidator
{
    public static void Validate(AnalysedProject project, ClassDiagramDefinition definition, ClassDiagramOptions options)
    {
        if (definition.Type != "class") throw new InvalidDataException("Only class diagram extraction is implemented.");
        RequireId(definition.Id);
        if (string.IsNullOrWhiteSpace(definition.Title) || definition.Title.Length > 240) throw new InvalidDataException("Diagram titles must contain 1–240 characters.");
        if (options.Compilations == null || options.Include == null || options.Exclude == null || options.Relationships == null ||
            options.Members == null || options.Members.Visibility == null || options.Context == null || options.GroupBy == null)
            throw new InvalidDataException("Class diagram options cannot contain null sections or arrays.");
        if (options.Compilations.Any(id => !project.Compilations.Any(group => group.Id == id)))
            throw new InvalidDataException("Class diagram references an unknown compilation.");
        if (options.Include.Length == 0 || options.Include.Concat(options.Exclude).Any(pattern => string.IsNullOrWhiteSpace(pattern) ||
                pattern.StartsWith('/') || pattern.Contains('\\') || pattern.Split('/').Contains("..") || pattern.Contains(':')))
            throw new InvalidDataException("Class selection needs repository-relative include/exclude patterns.");
        if (options.Context.Depth is < 0 or > 5) throw new InvalidDataException("Context depth must be between 0 and 5.");
        if (options.GroupBy is not ("namespace" or "compilation" or "none")) throw new InvalidDataException("groupBy must be namespace, compilation or none.");
        var relationships = new[] { "inheritance", "implementation", "member-type", "parameter-type", "returns", "generic-constraint", "call" };
        if (options.Relationships.Any(kind => !relationships.Contains(kind))) throw new InvalidDataException("Unsupported class relationship option.");
        if (options.Members.Visibility.Any(value => value is not ("public" or "protected" or "internal" or "private")))
            throw new InvalidDataException("Member visibility must be public, protected, internal or private.");
    }

    public static void RequireId(string id)
    {
        if (string.IsNullOrEmpty(id) || id.Length > 120 || !char.IsAsciiLetter(id[0]) ||
            id.Any(character => !char.IsAsciiLetterOrDigit(character) && character is not '.' and not '_' and not '-'))
            throw new InvalidDataException("Viewer IDs must start with a letter and contain at most 120 letters, digits, periods, underscores or hyphens.");
    }
}

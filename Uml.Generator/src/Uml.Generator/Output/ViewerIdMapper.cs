using System.Security.Cryptography;
using System.Text;

namespace Uml.Generator.Output;

/// <summary>Shared by all diagram extractors: identities do not depend on diagram names or order.</summary>
public sealed class ViewerIdMapper
{
    private readonly SortedDictionary<string, string> identities = new(StringComparer.Ordinal);
    public IReadOnlyDictionary<string, string> Identities => identities;

    public string Map(string category, string symbolIdentity)
    {
        if (category is not ("type" or "member" or "relation" or "group")) throw new ArgumentException("Unsupported viewer identity category.");
        var id = category + "_" + Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(symbolIdentity)));
        if (identities.TryGetValue(id, out var existing) && existing != symbolIdentity) throw new InvalidDataException("Viewer identity collision.");
        identities[id] = symbolIdentity;
        return id;
    }
}

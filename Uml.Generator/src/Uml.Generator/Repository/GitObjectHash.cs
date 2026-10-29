using System.Security.Cryptography;
using System.Text;

namespace Uml.Generator.Repository;

internal static class GitObjectHash
{
    public static string RequireSha(string value)
    {
        if (value.Length != 40 || value.Any(c => !char.IsAsciiHexDigit(c)))
        {
            throw new InvalidDataException("Expected a complete 40-character Git object ID.");
        }

        return value.ToLowerInvariant();
    }

    public static string Blob(ReadOnlySpan<byte> content)
    {
        using var hash = IncrementalHash.CreateHash(HashAlgorithmName.SHA1);
        hash.AppendData(Encoding.ASCII.GetBytes($"blob {content.Length}\0"));
        hash.AppendData(content);
        return Convert.ToHexStringLower(hash.GetHashAndReset());
    }

    public static string Content(ReadOnlySpan<byte> content)
    {
        return Convert.ToHexStringLower(SHA256.HashData(content));
    }
}

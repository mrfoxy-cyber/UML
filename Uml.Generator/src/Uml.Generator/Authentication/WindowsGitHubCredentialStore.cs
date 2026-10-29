using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using Uml.Generator.Repository;

namespace Uml.Generator.Authentication;

public sealed class WindowsGitHubCredentialStore : IGitHubCredentialStore
{
    public GitHubCredential? Read(GitHubRepository repository)
    {
        if (!OperatingSystem.IsWindows()) return null;
        if (!NativeCredential.Read(Target(repository), NativeCredential.Generic, 0, out var pointer))
        {
            if (Marshal.GetLastWin32Error() == NativeCredential.NotFound) return null;
            throw new InvalidOperationException("Windows Credential Manager could not read this connection.");
        }

        try
        {
            var native = Marshal.PtrToStructure<NativeCredential.Value>(pointer);
            if (native.CredentialBlobSize is < 2 or > 2048 || native.CredentialBlobSize % 2 != 0)
            {
                throw new InvalidDataException("Stored connection is invalid. Disconnect and reconnect.");
            }

            var bytes = new byte[native.CredentialBlobSize];
            try
            {
                Marshal.Copy(native.CredentialBlob, bytes, 0, bytes.Length);
                return new GitHubCredential(Encoding.Unicode.GetString(bytes), "Saved fine-grained token", native.UserName);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(bytes);
            }
        }
        finally
        {
            NativeCredential.Free(pointer);
        }
    }

    public void Write(GitHubRepository repository, GitHubCredential credential)
    {
        if (!OperatingSystem.IsWindows()) throw new PlatformNotSupportedException("Secure connection storage currently requires Windows.");
        FineGrainedToken.Require(credential.Token);
        var secret = Marshal.StringToCoTaskMemUni(credential.Token);
        try
        {
            var native = new NativeCredential.Value
            {
                Type = NativeCredential.Generic,
                TargetName = Target(repository),
                UserName = credential.UserName,
                Comment = "UML Generator dedicated GitHub connection",
                CredentialBlob = secret,
                CredentialBlobSize = (uint)Encoding.Unicode.GetByteCount(credential.Token),
                Persist = NativeCredential.LocalMachine
            };
            if (!NativeCredential.Write(ref native, 0))
            {
                throw new InvalidOperationException("Windows Credential Manager could not save this connection.");
            }
        }
        finally
        {
            Marshal.ZeroFreeCoTaskMemUnicode(secret);
        }
    }

    public void Delete(GitHubRepository repository)
    {
        if (!OperatingSystem.IsWindows()) return;
        if (!NativeCredential.Delete(Target(repository), NativeCredential.Generic, 0) &&
            Marshal.GetLastWin32Error() != NativeCredential.NotFound)
        {
            throw new InvalidOperationException("Windows Credential Manager could not remove this connection.");
        }
    }

    private static string Target(GitHubRepository repository)
    {
        var name = GitHubRepository.Parse(repository.FullName).FullName.ToLowerInvariant();
        var hash = Convert.ToHexStringLower(SHA256.HashData(Encoding.UTF8.GetBytes(name)));
        return "Uml.Generator/GitHub/" + hash;
    }
}

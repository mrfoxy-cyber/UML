using Uml.Generator.Repository;

namespace Uml.Generator.Authentication;

public interface IGitHubCredentialStore
{
    GitHubCredential? Read(GitHubRepository repository);
    void Write(GitHubRepository repository, GitHubCredential credential);
    void Delete(GitHubRepository repository);
}

# Generator tests

Run `dotnet test Uml.Generator.sln -m:1` from the generator workspace. Tests use xUnit and mocked GitHub responses; no live network or credentials are required.

`Repository/` covers commit pinning, PR head repositories, allow/ignore rules, input limits, blob integrity, cancellation, passive storage and verified cache reuse. Temporary files stay under the generator's ignored `.cache/repository-tests` directory.

`Authentication/` covers dedicated credentials, rejected token types, verification, cancellation and concurrent native-prompt requests through fakes. No real vault credentials are written.

`Analysis/` covers declarations, partial/nested/generic types, overload and cross-compilation resolution, structured branches, deferred scopes, fingerprints, initializers, test annotations, missing dependencies, invalid code, group boundaries, cancellation, offline snapshot integrity and report export. Fixtures are created in the generator cache through the snapshot layer. No repository source is executed. Extraction remains unimplemented.

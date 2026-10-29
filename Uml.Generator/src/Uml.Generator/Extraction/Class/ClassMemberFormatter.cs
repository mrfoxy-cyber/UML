using System.Text;
using Uml.Generator.Analysis.Models;

namespace Uml.Generator.Extraction.Class;

internal static class ClassMemberFormatter
{
    public static string Attribute(AnalysedMember member, bool enumValue) => enumValue ? member.Name :
        Visibility(member.Modifiers) + " " + member.Name + ": " + TypeName(member.Type.DisplayName) + Flags(member.Modifiers);

    public static string Operation(AnalysedType owner, AnalysedMethod method)
    {
        var name = method.Kind is "Constructor" or "StaticConstructor" ? owner.Name : method.Name;
        if (method.TypeParameters.Count > 0) name += "<" + string.Join(", ", method.TypeParameters.Select(parameter => parameter.Name)) + ">";
        var parameters = method.Parameters.Select(parameter =>
            (parameter.RefKind == "None" ? "" : parameter.RefKind.ToLowerInvariant() + " ") + parameter.Name + ": " + TypeName(parameter.Type.DisplayName) +
            (parameter.Optional ? " = …" : ""));
        return Visibility(method.Modifiers) + " " + name + "(" + string.Join(", ", parameters) + ")" +
            (method.Kind is "Constructor" or "StaticConstructor" ? "" : ": " + TypeName(method.ReturnType.DisplayName)) + Flags(method.Modifiers);
    }

    public static string TypeName(string name)
    {
        name = name.Replace("global::", "", StringComparison.Ordinal);
        var output = new StringBuilder();
        for (var i = 0; i < name.Length;)
        {
            if (!char.IsLetterOrDigit(name[i]) && name[i] is not '_' and not '@') { output.Append(name[i++]); continue; }
            var start = i;
            while (i < name.Length && (char.IsLetterOrDigit(name[i]) || name[i] is '_' or '@' or '.')) i++;
            var token = name[start..i];
            output.Append(token[(token.LastIndexOf('.') + 1)..]);
        }
        return output.ToString();
    }

    private static string Visibility(IReadOnlyList<string> modifiers) => modifiers[0] switch
    {
        "Public" => "+", "Protected" or "ProtectedOrInternal" or "ProtectedAndInternal" => "#", "Internal" => "~", _ => "-"
    };

    private static string Flags(IReadOnlyList<string> modifiers)
    {
        var flags = modifiers.Skip(1).Where(modifier => modifier is "static" or "abstract" or "readonly" or "const" or "required").ToArray();
        return flags.Length == 0 ? "" : " {" + string.Join(", ", flags) + "}";
    }
}

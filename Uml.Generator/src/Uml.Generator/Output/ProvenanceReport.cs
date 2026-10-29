using System.Net;
using System.Text;
using Uml.Generator.Analysis.Models;
using Uml.Generator.Extraction.Models;

namespace Uml.Generator.Output;

/// <summary>A passive, human-readable export report. Source links are pinned GitHub URLs.</summary>
internal static class ProvenanceReport
{
    public static string Render(ExtractedClassDiagram diagram, string rawJson)
    {
        var page = new StringBuilder();
        page.Append("""
            <!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
            <title>UML export details</title><style>
            :root{font-family:Segoe UI,Arial,sans-serif;color:#233c43;background:#f4f7f8}body{margin:0}main{max-width:1120px;margin:44px auto;padding:0 26px 70px}.brand{font-size:12px;letter-spacing:2px;color:#468571;font-weight:700}h1{font-size:34px;letter-spacing:-1px;margin:14px 0}h2{font-size:21px;margin:0 0 14px}p{line-height:1.7;color:#667b82}a{color:#26785f;overflow-wrap:anywhere}code{font-size:12px;overflow-wrap:anywhere}.cards{display:flex;flex-wrap:wrap;gap:12px;margin:26px 0}.card{flex:1;min-width:100px;background:white;border:1px solid #dce6e7;border-radius:12px;padding:18px}.card strong{display:block;font-size:28px}.card span,.muted{font-size:12px;color:#7a9097}section{background:white;border:1px solid #dce6e7;border-radius:14px;padding:24px;margin:18px 0}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;font-size:13px}th{text-align:left;color:#6d858c;font-size:11px;letter-spacing:.5px}td,th{padding:13px 12px;border-bottom:1px solid #edf1f2;vertical-align:top}td:first-child{padding-left:0}td small{display:block;color:#82969b;margin-top:5px}.pill{display:inline-block;padding:3px 8px;margin:2px 4px 2px 0;border-radius:12px;background:#eaf5ef;color:#37795e;font-size:11px;white-space:nowrap}.context{background:#f0f3f5;color:#7c8e96}details{margin:12px 0}summary{cursor:pointer;font-size:13px;color:#326a5b;line-height:1.7}pre{font-size:11px;background:#f5f8f9;padding:18px;white-space:pre-wrap;overflow-wrap:anywhere;line-height:1.6}.diagnostic{border-bottom:1px solid #edf1f2;padding:12px 0}.diagnostic p{font-size:13px;margin:5px 0}.empty{color:#658477;font-size:13px}.source{display:block;margin-bottom:6px}footer{font-size:12px;color:#81949a}@media(max-width:650px){main{padding:0 15px}section{padding:18px}h1{font-size:27px}}
            </style></head><body><main><div class="brand">UML GENERATOR · EXPORT DETAILS</div>
            """);
        page.Append("<h1>").Append(H(diagram.Title)).Append("</h1><p>Where this diagram came from, what it includes, and which connections were left out.</p>");
        page.Append("<p><strong>").Append(H(diagram.Snapshot.ContentRepository)).Append("</strong><br>Commit <code>")
            .Append(H(diagram.Snapshot.CommitSha)).Append("</code><br>Diagram <code>").Append(H(diagram.Id)).Append("</code></p><div class=\"cards\">");
        Card(page, diagram.Classes.Count, "types");
        Card(page, diagram.Classes.Count(type => type.IsContext), "context types");
        Card(page, diagram.Classes.Sum(type => type.Members.Count), "displayed members");
        Card(page, diagram.Relationships.Count, "connections");
        Card(page, diagram.Diagnostics.Count, "export notices");
        page.Append("</div><section><h2>Selection</h2><p>Focus: <code>").Append(H(string.Join(", ", diagram.Options.Include)))
            .Append("</code><br>Context follows outgoing connections for ").Append(diagram.Options.Context.Depth)
            .Append(" level(s). Context types are faded and omit member details.</p></section>");
        page.Append("<section><h2>Included types</h2><div class=\"scroll\"><table><thead><tr><th>TYPE</th><th>ROLE</th><th>MEMBERS</th><th>SOURCE AT THIS COMMIT</th></tr></thead><tbody>");
        foreach (var type in diagram.Classes)
        {
            page.Append("<tr><td><strong>").Append(H(type.Name)).Append("</strong><small>").Append(H(type.Namespace)).Append("</small>");
            if (type.Notes != null) page.Append("<small>").Append(H(type.Notes)).Append("</small>");
            page.Append("</td><td><span class=\"pill ").Append(type.IsContext ? "context" : "").Append("\">")
                .Append(type.IsContext ? "Context" : "Focus").Append("</span></td><td>").Append(type.Members.Count).Append("</td><td>");
            foreach (var source in type.Sources) Source(page, diagram, source);
            if (type.IsExternal) page.Append("<span class=\"muted\">External metadata; no snapshot source.</span>");
            page.Append("</td></tr>");
        }
        page.Append("</tbody></table></div></section><section><h2>Connection evidence</h2>");
        var names = diagram.Classes.ToDictionary(type => type.SymbolId, type => type.Name, StringComparer.Ordinal);
        foreach (var edge in diagram.Relationships)
        {
            page.Append("<details><summary>").Append(H(names[edge.FromId])).Append(" → ").Append(H(names[edge.ToId]))
                .Append(" <span class=\"pill\">").Append(H(edge.Kind)).Append("</span></summary>");
            foreach (var evidence in edge.Evidence)
            {
                page.Append("<p><code>").Append(H(evidence.Kind)).Append("</code> · <code>").Append(H(evidence.SymbolId)).Append("</code></p>");
                Source(page, diagram, evidence.Source);
            }
            page.Append("</details>");
        }
        if (diagram.Relationships.Count == 0) page.Append("<p class=\"empty\">No connections selected.</p>");
        page.Append("</section><section><h2>Omissions and notices</h2><p>These explain the export selection. They are not test results.</p>");
        foreach (var diagnostic in diagram.Diagnostics)
        {
            page.Append("<div class=\"diagnostic\"><code>").Append(H(diagnostic.Code)).Append("</code><p>")
                .Append(H(diagnostic.Message)).Append("</p>");
            if (diagnostic.Source != null) Source(page, diagram, diagnostic.Source);
            page.Append("</div>");
        }
        if (diagram.Diagnostics.Count == 0) page.Append("<p class=\"empty\">No export notices.</p>");
        page.Append("</section><section><details><summary>Raw provenance JSON</summary><pre>").Append(H(rawJson))
            .Append("</pre></details></section><footer>Source links open the exact GitHub commit. This report contains no executable scripts and does not read your local source folders.</footer></main></body></html>\n");
        return page.ToString();
    }

    private static void Card(StringBuilder page, int value, string label) => page.Append("<div class=\"card\"><strong>")
        .Append(value).Append("</strong><span>").Append(H(label)).Append("</span></div>");

    private static void Source(StringBuilder page, ExtractedClassDiagram diagram, SourceLocation source)
    {
        var repository = string.Join("/", diagram.Snapshot.ContentRepository.Split('/').Select(Uri.EscapeDataString));
        var path = string.Join("/", source.File.Split('/').Select(Uri.EscapeDataString));
        var url = "https://github.com/" + repository + "/blob/" + Uri.EscapeDataString(diagram.Snapshot.CommitSha) + "/" + path + "#L" + source.StartLine;
        page.Append("<a class=\"source\" target=\"_blank\" rel=\"noopener noreferrer\" href=\"").Append(H(url)).Append("\">")
            .Append(H(source.File)).Append(":").Append(source.StartLine).Append("</a>");
    }

    private static string H(string value) => WebUtility.HtmlEncode(value);
}

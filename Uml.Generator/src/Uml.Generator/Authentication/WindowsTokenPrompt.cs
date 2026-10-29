using System.Runtime.InteropServices;
using System.Runtime.Versioning;
using System.Text;

namespace Uml.Generator.Authentication;

/// <summary>Collects a token outside the browser. Persistence happens only after verification.</summary>
public static class WindowsTokenPrompt
{
    public static string? Show()
    {
        if (!OperatingSystem.IsWindows())
            throw new PlatformNotSupportedException("Secure connection entry currently requires Windows.");

        return ShowWindows();
    }

    [SupportedOSPlatform("windows")]
    private static string? ShowWindows()
    {
        var info = new PromptInfo
        {
            Size = Marshal.SizeOf<PromptInfo>(),
            Caption = "UML Generator — GitHub connection",
            Message = "Paste your dedicated GitHub fine-grained token into the password field. " +
                      "Select only the configured repository and read-only permissions on GitHub."
        };
        var user = new StringBuilder("Fine-grained GitHub token", 128);
        const int passwordCapacity = 513;
        var password = Marshal.AllocCoTaskMem(passwordCapacity * sizeof(char));
        for (var index = 0; index < passwordCapacity; index++) Marshal.WriteInt16(password, index * sizeof(char), 0);
        var save = false;
        try
        {
            const uint flags = 0x40000 | 0x80 | 0x2 | 0x100000;
            var result = CredUIPromptForCredentials(ref info, "Uml.Generator.TokenEntry", IntPtr.Zero,
                0, user, user.Capacity, password, passwordCapacity, ref save, flags);
            if (result == 1223) return null;
            if (result != 0)
                throw new InvalidOperationException("Windows could not open credential entry (code " + result + ").");
            return Marshal.PtrToStringUni(password) ?? "";
        }
        finally
        {
            for (var index = 0; index < passwordCapacity; index++) Marshal.WriteInt16(password, index * sizeof(char), 0);
            Marshal.FreeCoTaskMem(password);
        }
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    private struct PromptInfo
    {
        public int Size;
        public IntPtr Parent;
        public string Message;
        public string Caption;
        public IntPtr Banner;
    }

    [DllImport("credui.dll", EntryPoint = "CredUIPromptForCredentialsW", CharSet = CharSet.Unicode)]
    private static extern uint CredUIPromptForCredentials(
        ref PromptInfo info, string target, IntPtr reserved, uint error,
        StringBuilder user, int userCapacity, IntPtr password, int passwordCapacity,
        [MarshalAs(UnmanagedType.Bool)] ref bool save, uint flags);
}

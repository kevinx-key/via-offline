// VIA Offline K-STAR - global keyboard capture helper (Windows only).
//
// A WH_KEYBOARD_LL hook that suppresses every key and reports it to the
// Electron parent as one JSON object per line. It is only started when the
// user explicitly enables "全局拦截" in the key tester.
//
// Safety:
//   * Ctrl+Alt+F12 always exits (and is swallowed).
//   * The helper exits by itself if the parent process disappears or stops
//     sending heartbeats (PING lines on stdin).
//   * Killing the process removes the hook automatically.
//
// Build (C# 5, .NET Framework 4.x, present on every Windows 10/11):
//   csc.exe /nologo /target:exe /out:keyhook.exe keyhook.cs
using System;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

internal static class KeyHook
{
    private const int WH_KEYBOARD_LL = 13;
    private const int WM_KEYDOWN = 0x0100;
    private const int WM_KEYUP = 0x0101;
    private const int WM_SYSKEYDOWN = 0x0104;
    private const int WM_SYSKEYUP = 0x0105;
    private const int VK_CONTROL = 0x11;
    private const int VK_MENU = 0x12;
    private const int VK_F12 = 0x7B;
    private const int VK_ESCAPE = 0x1B;

    [StructLayout(LayoutKind.Sequential)]
    private struct KBDLLHOOKSTRUCT
    {
        public uint vkCode;
        public uint scanCode;
        public uint flags;
        public uint time;
        public IntPtr dwExtraInfo;
    }

    private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(IntPtr hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr CallNextHookEx(IntPtr hhk, int nCode, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr GetModuleHandle(string lpModuleName);

    [DllImport("user32.dll")]
    private static extern short GetAsyncKeyState(int vKey);

    [DllImport("user32.dll")]
    private static extern bool PostThreadMessage(uint idThread, uint msg, IntPtr wParam, IntPtr lParam);

    [DllImport("kernel32.dll")]
    private static extern uint GetCurrentThreadId();

    [DllImport("kernel32.dll")]
    private static extern IntPtr GetConsoleWindow();

    [DllImport("user32.dll")]
    private static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    private static IntPtr _hook = IntPtr.Zero;
    private static LowLevelKeyboardProc _proc;
    private static readonly object WriteLock = new object();
    private static volatile bool _stopping;
    private static int _parentPid;
    private static DateTime _lastPing = DateTime.UtcNow;

    private static bool IsDown(int vk)
    {
        return (GetAsyncKeyState(vk) & 0x8000) != 0;
    }

    private static void WriteLine(string line)
    {
        lock (WriteLock)
        {
            try
            {
                Console.Out.WriteLine(line);
                Console.Out.Flush();
            }
            catch
            {
                // Parent is gone; the monitor thread will exit shortly.
            }
        }
    }

    private static void Stop(int code)
    {
        if (_stopping) return;
        _stopping = true;
        try
        {
            if (_hook != IntPtr.Zero)
            {
                UnhookWindowsHookEx(_hook);
                _hook = IntPtr.Zero;
            }
        }
        catch { }
        Environment.Exit(code);
    }

    private static IntPtr HookCallback(int nCode, IntPtr wParam, IntPtr lParam)
    {
        if (nCode >= 0)
        {
            KBDLLHOOKSTRUCT data = (KBDLLHOOKSTRUCT)Marshal.PtrToStructure(lParam, typeof(KBDLLHOOKSTRUCT));
            int message = wParam.ToInt32();
            bool down = message == WM_KEYDOWN || message == WM_SYSKEYDOWN;
            bool up = message == WM_KEYUP || message == WM_SYSKEYUP;

            if (down || up)
            {
                // Emergency escape: no key ever reaches the OS except this
                // combination, which terminates the helper.
                if (down && data.vkCode == VK_F12 && IsDown(VK_CONTROL) && IsDown(VK_MENU))
                {
                    WriteLine("{\"type\":\"emergency\"}");
                    Stop(0);
                    return (IntPtr)1;
                }

                bool extended = (data.flags & 0x01) != 0;
                StringBuilder json = new StringBuilder(160);
                json.Append("{\"type\":\"");
                json.Append(down ? "down" : "up");
                json.Append("\",\"vk\":");
                json.Append(data.vkCode);
                json.Append(",\"scan\":");
                json.Append(data.scanCode);
                json.Append(",\"extended\":");
                json.Append(extended ? "true" : "false");
                json.Append(",\"time\":");
                json.Append(data.time);
                json.Append("}");
                WriteLine(json.ToString());
                // Swallow the key so it does not reach other applications.
                return (IntPtr)1;
            }
        }
        return CallNextHookEx(_hook, nCode, wParam, lParam);
    }

    private static void ParentMonitor()
    {
        while (!_stopping)
        {
            Thread.Sleep(1000);
            if (_parentPid > 0)
            {
                try
                {
                    Process.GetProcessById(_parentPid);
                }
                catch
                {
                    Stop(0);
                }
            }
            if ((DateTime.UtcNow - _lastPing).TotalSeconds > 6)
            {
                Stop(0);
            }
        }
    }

    private static void StdinReader()
    {
        try
        {
            string line;
            while ((line = Console.In.ReadLine()) != null)
            {
                line = line.Trim();
                if (line == "STOP") Stop(0);
                else if (line == "PING") _lastPing = DateTime.UtcNow;
            }
        }
        catch { }
        Stop(0);
    }

    private static int Main(string[] args)
    {
        // Hide the console window; stdout is still piped to Electron.
        try { ShowWindow(GetConsoleWindow(), 0); }
        catch { }

        for (int i = 0; i < args.Length; i++)
        {
            if (args[i] == "--parent" && i + 1 < args.Length)
            {
                int.TryParse(args[i + 1], out _parentPid);
            }
        }

        bool selfTest = Array.IndexOf(args, "--self-test") >= 0;
        bool probe = Array.IndexOf(args, "--probe") >= 0;
        if (selfTest)
        {
            WriteLine("{\"type\":\"ready\",\"pid\":" + Process.GetCurrentProcess().Id + "}");
            return 0;
        }

        _proc = HookCallback;
        _hook = SetWindowsHookEx(WH_KEYBOARD_LL, _proc, GetModuleHandle(null), 0);
        if (_hook == IntPtr.Zero)
        {
            WriteLine("{\"type\":\"error\",\"message\":\"SetWindowsHookEx failed\",\"code\":" + Marshal.GetLastWin32Error() + "}");
            return 2;
        }
        // "ready" is only emitted once the hook is actually installed.
        WriteLine("{\"type\":\"ready\",\"pid\":" + Process.GetCurrentProcess().Id + "}");
        if (probe)
        {
            // API probe: install then immediately remove, without a message
            // pump, so no key can be swallowed.
            UnhookWindowsHookEx(_hook);
            _hook = IntPtr.Zero;
            WriteLine("{\"type\":\"probe-ok\"}");
            return 0;
        }

        Thread monitor = new Thread(ParentMonitor);
        monitor.IsBackground = true;
        monitor.Start();

        Thread reader = new Thread(StdinReader);
        reader.IsBackground = true;
        reader.Start();

        // Low-level hooks require a message pump on the installing thread.
        MSG msg;
        while (!_stopping && GetMessage(out msg, IntPtr.Zero, 0, 0) > 0)
        {
            TranslateMessage(ref msg);
            DispatchMessage(ref msg);
        }
        Stop(0);
        return 0;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct MSG
    {
        public IntPtr hwnd;
        public uint message;
        public IntPtr wParam;
        public IntPtr lParam;
        public uint time;
        public int ptX;
        public int ptY;
    }

    [DllImport("user32.dll")]
    private static extern int GetMessage(out MSG lpMsg, IntPtr hWnd, uint wMsgFilterMin, uint wMsgFilterMax);

    [DllImport("user32.dll")]
    private static extern bool TranslateMessage(ref MSG lpMsg);

    [DllImport("user32.dll")]
    private static extern IntPtr DispatchMessage(ref MSG lpmsg);
}

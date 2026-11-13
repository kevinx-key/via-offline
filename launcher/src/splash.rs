//! Minimal first-run splash so a 3–5 s extraction never looks like a hang.
//!
//! Plain Win32 STATIC controls keep the launcher small (no GUI toolkit).

#[cfg(windows)]
mod imp {
    use std::sync::Once;
    use windows_sys::Win32::Foundation::{HWND, LPARAM, LRESULT, WPARAM};
    use windows_sys::Win32::Graphics::Gdi::GetStockObject;
    use windows_sys::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows_sys::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DestroyWindow, DispatchMessageW, GetSystemMetrics,
        LoadIconW, PeekMessageW, RegisterClassW, SendMessageW, SetForegroundWindow, SetWindowTextW, ShowWindow,
        TranslateMessage, MSG, PM_REMOVE, SM_CXSCREEN, SM_CYSCREEN, SW_SHOW, WM_SETFONT,
        WM_SETICON, WNDCLASSW, WS_CAPTION, WS_OVERLAPPED, WS_SYSMENU, WS_VISIBLE,
    };

    const DEFAULT_GUI_FONT: i32 = 17;
    const COLOR_WINDOW: u32 = 5;
    const ICON_SMALL: usize = 0;
    const ICON_BIG: usize = 1;

    pub struct Splash {
        window: HWND,
        status: HWND,
        last: std::cell::RefCell<String>,
    }

    unsafe extern "system" fn wndproc(
        window: HWND,
        message: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        DefWindowProcW(window, message, wparam, lparam)
    }

    fn wide(text: &str) -> Vec<u16> {
        text.encode_utf16().chain(std::iter::once(0)).collect()
    }

    impl Splash {
        pub fn show(title: &str, message: &str) -> Option<Self> {
            // Headless/diagnostic runs (CI smoke tests) can opt out.
            if std::env::var_os("VIA_NO_SPLASH").is_some() {
                return None;
            }
            static REGISTER: Once = Once::new();
            let class_name = wide("ViaLauncherSplash");
            let instance = unsafe { GetModuleHandleW(std::ptr::null()) };

            REGISTER.call_once(|| unsafe {
                let class = WNDCLASSW {
                    style: 0,
                    lpfnWndProc: Some(wndproc),
                    cbClsExtra: 0,
                    cbWndExtra: 0,
                    hInstance: instance,
                    hIcon: std::ptr::null_mut(),
                    hCursor: std::ptr::null_mut(),
                    hbrBackground: (COLOR_WINDOW + 1) as usize as _,
                    lpszMenuName: std::ptr::null(),
                    lpszClassName: class_name.as_ptr(),
                };
                RegisterClassW(&class);
            });

            let width = 480;
            let height = 170;
            let x = (unsafe { GetSystemMetrics(SM_CXSCREEN) } - width) / 2;
            let y = (unsafe { GetSystemMetrics(SM_CYSCREEN) } - height) / 2;

            let window = unsafe {
                CreateWindowExW(
                    0,
                    class_name.as_ptr(),
                    wide(title).as_ptr(),
                    WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU | WS_VISIBLE,
                    x,
                    y,
                    width,
                    height,
                    std::ptr::null_mut(),
                    std::ptr::null_mut(),
                    instance,
                    std::ptr::null(),
                )
            };
            if window.is_null() {
                return None;
            }

            let font = unsafe { GetStockObject(DEFAULT_GUI_FONT) };
            let message_control = unsafe {
                CreateWindowExW(
                    0,
                    wide("STATIC").as_ptr(),
                    wide(message).as_ptr(),
                    WS_VISIBLE,
                    20,
                    12,
                    440,
                    60,
                    window,
                    std::ptr::null_mut(),
                    instance,
                    std::ptr::null(),
                )
            };
            let status = unsafe {
                CreateWindowExW(
                    0,
                    wide("STATIC").as_ptr(),
                    wide(" ").as_ptr(),
                    WS_VISIBLE,
                    20,
                    96,
                    440,
                    24,
                    window,
                    std::ptr::null_mut(),
                    instance,
                    std::ptr::null(),
                )
            };
            for control in [message_control, status] {
                if !control.is_null() {
                    unsafe { SendMessageW(control, WM_SETFONT, font as usize, 1isize) };
                }
            }

            let icon = unsafe { LoadIconW(instance, 1 as *const u16) };
            if !icon.is_null() {
                unsafe {
                    SendMessageW(window, WM_SETICON, ICON_BIG, icon as isize);
                    SendMessageW(window, WM_SETICON, ICON_SMALL, icon as isize);
                }
            }

            unsafe {
                ShowWindow(window, SW_SHOW);
                SetForegroundWindow(window);
            }

            Some(Self {
                window,
                status,
                last: std::cell::RefCell::new(String::new()),
            })
        }

        pub fn set_status(&self, text: &str) {
            if text == self.last.borrow().as_str() || self.status.is_null() {
                return;
            }
            *self.last.borrow_mut() = text.to_string();
            let text = wide(text);
            unsafe { SetWindowTextW(self.status, text.as_ptr()) };
        }

        pub fn pump(&self) {
            let mut message: MSG = unsafe { std::mem::zeroed() };
            while unsafe {
                PeekMessageW(&mut message, std::ptr::null_mut(), 0, 0, PM_REMOVE)
            } != 0
            {
                unsafe {
                    TranslateMessage(&message);
                    DispatchMessageW(&message);
                }
            }
        }

        pub fn close(self) {
            if !self.window.is_null() {
                unsafe { DestroyWindow(self.window) };
            }
        }
    }
}

#[cfg(not(windows))]
mod imp {
    pub struct Splash;

    impl Splash {
        pub fn show(_title: &str, _message: &str) -> Option<Self> {
            None
        }
        pub fn set_status(&self, _text: &str) {}
        pub fn pump(&self) {}
        pub fn close(self) {}
    }
}

pub use imp::Splash;

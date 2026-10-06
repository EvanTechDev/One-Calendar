//! GTK's default Tauri container stacks child views vertically. Keep the local
//! calendar as the overlay's main child and position identity above its DOM slot.
use gtk::prelude::*;
use tauri::Webview;

pub async fn prepare(main: &Webview) -> Result<(), String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    main.with_webview(move |platform| {
        let result: Result<(), String> = (|| {
            let widget = platform.inner();
            if widget.parent().and_then(|p| p.downcast::<gtk::Overlay>().ok()).is_some() {
                return Ok(());
            }
            let parent = widget.parent().and_then(|p| p.downcast::<gtk::Box>().ok())
                .ok_or_else(|| "Calendar view container is missing".to_string())?;
            let overlay = gtk::Overlay::new();
            parent.remove(&widget);
            overlay.add(&widget);
            parent.pack_start(&overlay, true, true, 0);
            overlay.show_all();
            Ok(())
        })();
        let _ = send.send(result);
    }).map_err(|e| e.to_string())?;
    receive.await.map_err(|_| "Calendar view layout was interrupted".to_string())?
}

pub async fn place(view: &Webview, x: i32, y: i32, width: i32, height: i32, visible: bool) -> Result<(), String> {
    let (send, receive) = tokio::sync::oneshot::channel();
    view.with_webview(move |platform| {
        let result: Result<(), String> = (|| {
            let widget = platform.inner();
            let parent = widget.parent().ok_or_else(|| "Identity view container is missing".to_string())?;
            if let Ok(container) = parent.downcast::<gtk::Box>() {
                let overlay = container.children().into_iter()
                    .find_map(|child| child.downcast::<gtk::Overlay>().ok())
                    .ok_or_else(|| "Calendar overlay is missing".to_string())?;
                container.remove(&widget);
                overlay.add_overlay(&widget);
                overlay.set_overlay_pass_through(&widget, false);
            }
            widget.set_halign(gtk::Align::Start);
            widget.set_valign(gtk::Align::Start);
            widget.set_margin_start(x);
            widget.set_margin_top(y);
            widget.set_size_request(width, height);
            if visible { widget.show(); } else { widget.hide(); }
            Ok(())
        })();
        let _ = send.send(result);
    }).map_err(|e| e.to_string())?;
    receive.await.map_err(|_| "Identity view layout was interrupted".to_string())?
}

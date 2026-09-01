use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{Command, CommandEvent};

// PT-BR: reinicia o app (usado após instalar a atualização do .deb). É chamado pelo
//        frontend via window.__TAURI_INTERNALS__.invoke("relaunch_app").
// EN:    relaunches the app (used after installing the .deb update). Called by the
//        frontend via window.__TAURI_INTERNALS__.invoke("relaunch_app").
#[tauri::command]
fn relaunch_app(app: tauri::AppHandle) {
  app.restart();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default()
      .level(log::LevelFilter::Info)
      .build())
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![relaunch_app])
    .setup(|app| {
      // Start the Python backend sidecar on startup
      #[cfg(desktop)]
      {
        let app_handle = app.handle().clone();
        // PT-BR: descobre o diretório de resources do app e repassa ao sidecar para que ele
        //        encontre o backend/ e o requirements.txt. O Tauri v2 não expõe
        //        TAURI_RESOURCE_DIR automaticamente. EN: resolve the app's resource dir and
        //        forward it to the sidecar so it can find backend/ and requirements.txt.
        let resource_dir = app.path().resource_dir().ok()
          .map(|p| p.to_string_lossy().to_string());

        tauri::async_runtime::spawn(async move {
          // Give a moment for the app to fully start
          tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

          // Start the backend sidecar using Tauri v2 shell plugin
          let mut sidecar_cmd: Command = app_handle.shell()
            .command("guaralingo-backend");
          if let Some(dir) = resource_dir {
            sidecar_cmd = sidecar_cmd.env("TAURI_RESOURCE_DIR", dir);
          }

          match sidecar_cmd.spawn() {
            Ok((mut rx, child)) => {
              log::info!("Guaralingo backend sidecar started (pid={})", child.pid());
              // Keep the child alive and log its stdout/stderr by draining the event channel.
              // When the backend exits, the channel ends and this task finishes.
              tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                  if let CommandEvent::Stdout(line) = event {
                    log::info!("[backend] {}", String::from_utf8_lossy(&line).trim());
                  } else if let CommandEvent::Stderr(line) = event {
                    log::info!("[backend] {}", String::from_utf8_lossy(&line).trim());
                  }
                }
                log::info!("Guaralingo backend sidecar exited");
              });
            }
            Err(e) => {
              log::error!("Failed to spawn backend sidecar: {}", e);
            }
          }
        });
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
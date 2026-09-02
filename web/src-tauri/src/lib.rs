use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

// PT-BR: reinicia o app (usado após instalar a atualização do .deb). É chamado pelo
//        frontend via window.__TAURI_INTERNALS__.invoke("relaunch_app").
// EN:    relaunches the app (used after installing the .deb update). Called by the
//        frontend via window.__TAURI_INTERNALS__.invoke("relaunch_app").
#[tauri::command]
fn relaunch_app(app: tauri::AppHandle) {
  app.restart();
}

// PT-BR: sobe o backend local (uvicorn) em qualquer OS usando o Python do PATH.
//        No Linux prefere python3, no Windows "python". Opcionalmente usa o venv
//        criado no diretório de dados do usuário (gravável), como hoje o sidecar faz.
// EN:    starts the local backend (uvicorn) on any OS using the Python from PATH.
fn spawn_backend(app: &tauri::AppHandle) {
  let resource_dir = app
    .path()
    .resource_dir()
    .ok()
    .map(|p| p.to_string_lossy().to_string());

  tauri::async_runtime::spawn({
    let app = app.clone();
    async move {
      tokio::time::sleep(std::time::Duration::from_millis(1000)).await;

      // PT-BR: encontra o python certo (na dev usa o do PATH; no bundle pode haver um venv).
      // EN: find the right python (dev uses PATH python; bundle may have a venv).
      let data_dir = std::env::var("GUARALINGO_DATA_DIR")
        .ok()
        .unwrap_or_else(|| {
          if cfg!(windows) {
            format!("{}\\guaralingo", std::env::var("APPDATA").unwrap_or_default())
          } else {
            format!("{}/.local/share/guaralingo", std::env::var("HOME").unwrap_or_default())
          }
        });

      let mut python = String::new();
      if cfg!(windows) {
        let venv_py = format!("{}\\venv\\Scripts\\python.exe", data_dir);
        if std::path::Path::new(&venv_py).exists() {
          python = venv_py;
        }
      } else {
        let venv_py = format!("{}/venv/bin/python", data_dir);
        if std::path::Path::new(&venv_py).exists() {
          python = venv_py;
        }
      }
      if python.is_empty() {
        python = if cfg!(windows) { "python".into() } else { "python3".into() };
      }

      let mut cmd = app.shell().command(python.clone());

      // PT-BR: passa o diretório de resources para o backend achar os arquivos.
      // EN: pass the resource dir so the backend can find its files.
      if let Some(dir) = &resource_dir {
        cmd = cmd.env("TAURI_RESOURCE_DIR", dir);
      }
      cmd = cmd.env("GUARALINGO_HTTPS", "0");
      cmd = cmd.env("GUARALINGO_PORT", "8000");
      cmd = cmd.env("GUARALINGO_MDNS", "0");
      cmd = cmd.env("GUARALINGO_DESKTOP", "1");
      cmd = cmd.env("GUARALINGO_DATA_DIR", &data_dir);

      let backend_dir = resource_dir
        .as_deref()
        .map(|d| format!("{}/backend", d))
        .unwrap_or_else(|| {
          if cfg!(windows) { "backend".into() } else { "backend".into() }
        });

      let res = cmd
        .args(["-m", "uvicorn", "main:app", "--host", "127.0.0.1", "--port", "8000"])
        .current_dir(backend_dir)
        .spawn();

      match res {
        Ok((mut rx, _child)) => {
          log::info!("Guaralingo backend started via {}", python);
          tauri::async_runtime::spawn(async move {
            while let Some(event) = rx.recv().await {
              if let CommandEvent::Stdout(line) = event {
                log::info!("[backend] {}", String::from_utf8_lossy(&line).trim());
              } else if let CommandEvent::Stderr(line) = event {
                log::info!("[backend] {}", String::from_utf8_lossy(&line).trim());
              }
            }
            log::info!("Guaralingo backend exited");
          });
        }
        Err(e) => {
          log::error!("Failed to start backend via {}: {}", python, e);
        }
      }
    }
  });
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
      // Start the Python backend on startup
      #[cfg(desktop)]
      spawn_backend(app.handle());
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
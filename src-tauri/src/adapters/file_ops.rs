use std::io;
use std::path::{Path, PathBuf};
use std::process;

use chrono::Utc;
use tokio::fs;

pub async fn safe_write_bytes(target: &Path, bytes: &[u8]) -> io::Result<()> {
    let temp_path = sibling_work_path(target, "tmp");
    fs::write(&temp_path, bytes).await?;

    match replace_from_temp(target, &temp_path).await {
        Ok(()) => Ok(()),
        Err(error) => {
            let _ = fs::remove_file(&temp_path).await;
            Err(error)
        }
    }
}

async fn replace_from_temp(target: &Path, temp_path: &Path) -> io::Result<()> {
    if !target.exists() {
        return fs::rename(temp_path, target).await;
    }

    if fs::rename(temp_path, target).await.is_ok() {
        return Ok(());
    }

    let displaced_path = sibling_work_path(target, "swap");
    fs::rename(target, &displaced_path).await?;

    match fs::rename(temp_path, target).await {
        Ok(()) => {
            let _ = fs::remove_file(&displaced_path).await;
            Ok(())
        }
        Err(error) => {
            let rollback_result = fs::rename(&displaced_path, target).await;
            let _ = fs::remove_file(temp_path).await;

            match rollback_result {
                Ok(()) => Err(io::Error::new(
                    error.kind(),
                    format!("failed to replace file, rollback succeeded: {error}"),
                )),
                Err(rollback_error) => Err(io::Error::new(
                    error.kind(),
                    format!("failed to replace file: {error}; rollback failed: {rollback_error}"),
                )),
            }
        }
    }
}

fn sibling_work_path(target: &Path, suffix: &str) -> PathBuf {
    let file_name = target
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("clawdesk");

    target.with_file_name(format!(
        "{file_name}.{suffix}.{}.{}",
        process::id(),
        Utc::now().timestamp_millis()
    ))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_file_path(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "clawdesk-file-ops-{}-{}",
            process::id(),
            Utc::now().timestamp_millis()
        ));
        std::fs::create_dir_all(&dir).expect("temp dir should exist");
        dir.join(name)
    }

    #[tokio::test]
    async fn safe_write_bytes_creates_new_file() {
        let target = test_file_path("new.json");

        safe_write_bytes(&target, br#"{"value":1}"#)
            .await
            .expect("write should succeed");

        let content = std::fs::read_to_string(&target).expect("target should be readable");
        assert_eq!(content, r#"{"value":1}"#);

        let _ = std::fs::remove_file(target);
    }

    #[tokio::test]
    async fn safe_write_bytes_replaces_existing_file() {
        let target = test_file_path("existing.json");
        std::fs::write(&target, r#"{"old":true}"#).expect("seed file should be written");

        safe_write_bytes(&target, br#"{"new":true}"#)
            .await
            .expect("replace should succeed");

        let content = std::fs::read_to_string(&target).expect("target should be readable");
        assert_eq!(content, r#"{"new":true}"#);

        let _ = std::fs::remove_file(target);
    }
}

use notify::{RecommendedWatcher, RecursiveMode, Watcher, Event};
use std::sync::mpsc::channel;
use std::path::PathBuf;
use std::time::Duration;
use anyhow::Result;

pub struct FsWatcher {
    watcher: RecommendedWatcher,
}

impl FsWatcher {
    pub fn new(roots: Vec<PathBuf>) -> Result<Self> {
        let (tx, rx) = channel();

        // Optional: Run this watcher asynchronously with a debounce implementation using tokio
        let mut watcher = notify::recommended_watcher(tx)?;

        for root in roots {
            watcher.watch(&root, RecursiveMode::Recursive)?;
        }

        // Ideally, we start a dedicated tokio green thread polling `rx` and passing
        // valid changes into our debounce queue. For MVP, we've structured it without blocking logic inline.

        Ok(Self { watcher })
    }
}
